import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { isSensitiveBuildVariable } from './secret-policy.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const openNextDir = path.join(projectRoot, '.open-next')
const capturedDir = path.join(projectRoot, '.codex-artifacts', 'cloudflare-handlers')
const cliPath = path.join(projectRoot, 'node_modules', '@opennextjs', 'cloudflare', 'dist', 'cli', 'index.js')
const splitBundlerPath = path.join(projectRoot, 'scripts', 'cloudflare', 'bundle-split-workers.mjs')
const nextEnvPath = path.join(openNextDir, 'cloudflare', 'next-env.mjs')
const freeWorkerLimit = 3 * 1024 * 1024
const targets = [
  'editorial',
  'map3d',
  'mapUi',
  'routeQuiz',
  'routeList',
  'mapData',
  'aiVision',
  'hunter',
  'safetyQuest',
  'authAdmin',
  'community',
  'user',
  'operations',
  // Keep core last so .open-next retains the middleware, assets, and default
  // server used by the public router Worker.
  'core',
]

const skipNextBuild = process.argv.includes('--skip-next-build')
const onlyArg = process.argv.find((argument) => argument.startsWith('--only='))
const buildTargets = onlyArg
  ? onlyArg.slice('--only='.length).split(',').filter(Boolean)
  : targets
for (const target of buildTargets) {
  if (!targets.includes(target)) throw new Error(`Unknown --only target: ${target}`)
}
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
  // values here would copy private credentials into every Worker module.
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

if (!onlyArg) rmSync(capturedDir, { recursive: true, force: true })
mkdirSync(capturedDir, { recursive: true })

for (const [index, target] of buildTargets.entries()) {
  const shouldSkipNext = skipNextBuild || index > 0
  const args = [cliPath, 'build', ...(shouldSkipNext ? ['--skipNextBuild'] : [])]
  console.log(`\n=== Building Cloudflare Free Worker: ${target} ===`)
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      OPENNEXT_TARGET: target,
      // Source map upload is a release concern and must never make the runtime
      // bundle build depend on an optional Sentry token.
      SENTRY_AUTH_TOKEN: '',
    },
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)

  const buildTimeSecretValues = scrubOpenNextBuildEnvironment()

  const bundleResult = spawnSync(process.execPath, [splitBundlerPath, target], {
    cwd: projectRoot,
    env: { ...process.env, OPENNEXT_TARGET: target },
    stdio: 'inherit',
  })
  if (bundleResult.error) throw bundleResult.error
  if (bundleResult.status !== 0) process.exit(bundleResult.status ?? 1)

  const source = path.join(openNextDir, 'server-functions', target, 'handler.mjs')
  assertNoEmbeddedSecrets(source, buildTimeSecretValues)
  const sourceMeta = `${source}.meta.json`
  const targetDir = path.join(capturedDir, target)
  mkdirSync(targetDir, { recursive: true })
  copyFileSync(source, path.join(targetDir, 'handler.mjs'))
  if (existsSync(sourceMeta)) copyFileSync(sourceMeta, path.join(targetDir, 'handler.mjs.meta.json'))

  const bytes = readFileSync(source)
  const compressedBytes = gzipSync(bytes, { level: 9 }).byteLength
  console.log(`${target}: ${(compressedBytes / 1024 / 1024).toFixed(3)} MiB gzip`)
}

const measurements = []
const allTargetsCaptured = targets.every((target) =>
  existsSync(path.join(capturedDir, target, 'handler.mjs')),
)
// Once every split handler has been captured, always reconstruct the complete
// deployable tree and recheck all Workers, even when this invocation built only
// the final targets. Before that point, a focused --only build remains usable.
const measurementTargets = allTargetsCaptured ? targets : buildTargets
for (const target of measurementTargets) {
  const capturedHandler = path.join(capturedDir, target, 'handler.mjs')
  if (!existsSync(capturedHandler)) {
    throw new Error(`Captured handler is missing: ${capturedHandler}`)
  }
  const destinationDir = path.join(openNextDir, 'server-functions', target)
  mkdirSync(destinationDir, { recursive: true })
  copyFileSync(capturedHandler, path.join(destinationDir, 'handler.mjs'))
  const bytes = readFileSync(capturedHandler)
  measurements.push({
    target,
    rawBytes: bytes.byteLength,
    compressedBytes: gzipSync(bytes, { level: 9 }).byteLength,
  })
}

console.table(measurements.map((measurement) => ({
  worker: measurement.target,
  rawMiB: (measurement.rawBytes / 1024 / 1024).toFixed(3),
  gzipMiB: (measurement.compressedBytes / 1024 / 1024).toFixed(3),
  freeLimit: measurement.compressedBytes <= freeWorkerLimit ? 'PASS' : 'FAIL',
})))

const oversized = measurements.filter(({ compressedBytes }) => compressedBytes > freeWorkerLimit)
if (oversized.length > 0) {
  throw new Error(`Cloudflare Free size limit exceeded: ${oversized.map(({ target }) => target).join(', ')}`)
}
