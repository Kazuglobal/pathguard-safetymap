import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { isSensitiveBuildVariable } from './secret-policy.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const openNextDir = path.join(projectRoot, '.open-next')
const cliPath = path.join(projectRoot, 'node_modules', '@opennextjs', 'cloudflare', 'dist', 'cli', 'index.js')
const nextEnvPath = path.join(openNextDir, 'cloudflare', 'next-env.mjs')
const paidWorkerLimit = 10 * 1024 * 1024

const skipNextBuild = process.argv.includes('--skip-next-build')
const standaloneManifestPath = path.join(
  projectRoot,
  '.next',
  'standalone',
  '.next',
  'server',
  'pages-manifest.json',
)
if (skipNextBuild && !existsSync(standaloneManifestPath)) {
  throw new Error(
    '--skip-next-build requires an existing successful standalone Next.js build',
  )
}
if (!existsSync(cliPath)) {
  throw new Error(`OpenNext CLI was not found: ${cliPath}`)
}

function scrubOpenNextBuildEnvironment() {
  if (!existsSync(nextEnvPath)) throw new Error(`OpenNext environment module is missing: ${nextEnvPath}`)

  const source = readFileSync(nextEnvPath, 'utf8')
  const secretValues = []
  for (const match of source.matchAll(/^export const \w+ = (\{.*\});$/gm)) {
    const values = JSON.parse(match[1])
    for (const [name, value] of Object.entries(values)) {
      if (isSensitiveBuildVariable(name) && typeof value === 'string' && value.length >= 8) {
        secretValues.push(value)
      }
    }
  }

  // Runtime bindings populate process.env in Cloudflare. Keeping build-machine
  // values here would copy private credentials into the Worker module.
  writeFileSync(
    nextEnvPath,
    '// Build-time values intentionally removed; Cloudflare runtime bindings populate process.env.\n' +
      'export const production = {};\n' +
      'export const development = {};\n' +
      'export const test = {};\n',
    'utf8',
  )
  return secretValues
}

function assertNoEmbeddedSecrets(filePath, secretValues) {
  const contents = readFileSync(filePath, 'utf8')
  if (secretValues.some((value) => contents.includes(value))) {
    throw new Error(`Refusing to publish a Worker containing a build-time secret: ${filePath}`)
  }
}

for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === 'string' && key.startsWith('NEXT_PUBLIC_')) {
    process.env[key] = value.trim()
  }
}

console.log('\n=== Building Cloudflare Paid single Worker ===')
const args = [cliPath, 'build', ...(skipNextBuild ? ['--skipNextBuild'] : [])]
const result = spawnSync(process.execPath, args, {
  cwd: projectRoot,
  env: {
    ...process.env,
    // Source map upload is a release concern and must never make the runtime
    // bundle build depend on an optional Sentry token.
    SENTRY_AUTH_TOKEN: '',
  },
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

const buildTimeSecretValues = scrubOpenNextBuildEnvironment()
const handlerPath = path.join(openNextDir, 'server-functions', 'default', 'handler.mjs')
if (!existsSync(handlerPath)) {
  throw new Error(`OpenNext default server handler was not found: ${handlerPath}`)
}
assertNoEmbeddedSecrets(handlerPath, buildTimeSecretValues)

const bytes = readFileSync(handlerPath)
const compressedBytes = gzipSync(bytes, { level: 9 }).byteLength
console.table([{
  worker: 'pathguardian',
  rawMiB: (bytes.byteLength / 1024 / 1024).toFixed(3),
  gzipMiB: (compressedBytes / 1024 / 1024).toFixed(3),
  paidLimit: compressedBytes <= paidWorkerLimit ? 'PASS' : 'FAIL',
}])

if (compressedBytes > paidWorkerLimit) {
  throw new Error(`Cloudflare Paid 10 MiB gzip limit exceeded: ${(compressedBytes / 1024 / 1024).toFixed(3)} MiB`)
}
