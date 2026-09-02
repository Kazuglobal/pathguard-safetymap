import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const wranglerCli = path.join(projectRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const buildScript = path.join(projectRoot, 'scripts', 'cloudflare', 'build-free-workers.mjs')
const serverConfig = path.join(projectRoot, 'wrangler.server.jsonc')
const routerConfig = path.join(projectRoot, 'wrangler.jsonc')
const dryRun = process.argv.includes('--dry-run')
const skipBuild = process.argv.includes('--skip-build')
const onlyArg = process.argv.find((argument) => argument.startsWith('--only='))
const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').filter(Boolean)) : null

const servers = [
  ['pathguardian-editorial', 'server-editorial.ts'],
  ['pathguardian-map-3d', 'server-map-3d.ts'],
  ['pathguardian-map-ui', 'server-map-ui.ts'],
  ['pathguardian-route-quiz', 'server-route-quiz.ts'],
  ['pathguardian-route-list', 'server-route-list.ts'],
  ['pathguardian-map-data', 'server-map-data.ts'],
  ['pathguardian-ai-vision', 'server-ai-vision.ts'],
  ['pathguardian-hunter', 'server-hunter.ts'],
  ['pathguardian-safety-quest', 'server-safety-quest.ts'],
  ['pathguardian-auth-admin', 'server-auth-admin.ts'],
  ['pathguardian-community', 'server-community.ts'],
  ['pathguardian-user', 'server-user.ts'],
  ['pathguardian-operations', 'server-operations.ts'],
  ['pathguardian-core', 'server-core.ts'],
]
const serversToDeploy = only
  ? servers.filter(([name]) => only.has(name.replace(/^pathguardian-/, '')))
  : servers
const deployRouter = only === null || only.has('router')
if (only && serversToDeploy.length + (deployRouter ? 1 : 0) !== only.size) {
  throw new Error(`Unknown --only target: ${[...only].join(', ')}`)
}

const secretNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
  'NEXT_PUBLIC_MEDIA_BASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_EMAILS',
  'OPENAI_API_KEY',
  'OPENAI_ORG_ID',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'MAPBOX_SECRET_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'CRON_SECRET',
  'LINE_CHANNEL_ID',
  'LINE_CHANNEL_SECRET',
  'D1_REST_API_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'XROAD_API_KEY',
  'ACCIDENT_IMAGE_CONTEXT_ENABLED',
  'DANGER_REPORT_AI_MODERATION_MODE',
  'HAZARD_ZONE_GATE_MODE',
  'GEMINI_IMAGE_MODEL',
  'GEMINI_VISION_MODEL',
  'OPENAI_IMAGE_MODEL',
  'OPENAI_IMAGE_SIZE',
]

function run(args, env = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function runDryRun(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw result.error
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  if (result.status !== 0) {
    process.stderr.write(output)
    process.exit(result.status ?? 1)
  }
  const size = output.match(/Total Upload:\s*[\d.]+ KiB\s*\/\s*gzip:\s*([\d.]+) KiB/)
  if (!size) throw new Error(`Wrangler did not report a compressed size for ${label}`)
  const compressedKiB = Number(size[1])
  console.log(`${label}: ${compressedKiB.toFixed(2)} KiB gzip`)
  if (compressedKiB > 3 * 1024) {
    throw new Error(`${label} exceeds the Cloudflare Free 3 MiB limit`)
  }
}

for (const envFile of ['.env.production.local', '.env.local', '.env.production']) {
  const envPath = path.join(projectRoot, envFile)
  if (existsSync(envPath)) dotenv.config({ path: envPath, override: false, quiet: true })
}

if (!skipBuild) run([buildScript])

const sensitiveBuildTimeValues = secretNames
  .filter((name) => {
    const isPublic = name.startsWith('NEXT_PUBLIC_') || name.includes('ANON_KEY')
    return !isPublic && /(?:API_KEY|AUTH_TOKEN|PRIVATE_KEY|SECRET|SERVICE_ROLE)/.test(name)
  })
  .map((name) => process.env[name])
  .filter((value) => typeof value === 'string' && value.length >= 8)

const generatedModules = [path.join(projectRoot, '.open-next', 'cloudflare', 'next-env.mjs')]
const serverFunctionsDir = path.join(projectRoot, '.open-next', 'server-functions')
if (existsSync(serverFunctionsDir)) {
  for (const entry of readdirSync(serverFunctionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    generatedModules.push(path.join(serverFunctionsDir, entry.name, 'handler.mjs'))
  }
}
for (const generatedModule of generatedModules) {
  if (!existsSync(generatedModule)) continue
  const contents = readFileSync(generatedModule, 'utf8')
  if (sensitiveBuildTimeValues.some((value) => contents.includes(value))) {
    throw new Error(`Refusing to deploy a generated module containing a build-time secret: ${generatedModule}`)
  }
}

const requiredOutputs = serversToDeploy.map(([, entry]) =>
  path.join(projectRoot, 'cloudflare', 'workers', entry),
)
for (const output of requiredOutputs) {
  if (!existsSync(output)) throw new Error(`Worker entry is missing: ${output}`)
}

const secretValues = Object.fromEntries(
  secretNames
    .map((name) => [name, process.env[name]])
    .filter((entry) => typeof entry[1] === 'string' && entry[1].trim().length > 0),
)
const tempSecretPath = path.join(tmpdir(), `pathguardian-worker-secrets-${randomUUID()}.json`)
const dryRunRoot = path.join(projectRoot, '.codex-artifacts', 'wrangler-free')

if (dryRun) {
  rmSync(dryRunRoot, { recursive: true, force: true })
  mkdirSync(dryRunRoot, { recursive: true })
} else if (Object.keys(secretValues).length > 0) {
  writeFileSync(tempSecretPath, JSON.stringify(secretValues), { encoding: 'utf8', mode: 0o600 })
}

try {
  for (const [name, entry] of serversToDeploy) {
    const entryPath = path.join('cloudflare', 'workers', entry)
    const args = [
      wranglerCli,
      'deploy',
      entryPath,
      '--config',
      serverConfig,
      '--name',
      name,
      '--keep-vars',
    ]
    if (dryRun) {
      args.push('--dry-run', '--outdir', path.join(dryRunRoot, name), '--metafile')
    } else if (Object.keys(secretValues).length > 0) {
      args.push('--secrets-file', tempSecretPath)
    }
    console.log(`\n=== ${dryRun ? 'Checking' : 'Deploying'} ${name} ===`)
    if (dryRun) runDryRun(args, name)
    else run(args)
  }

  if (deployRouter) {
    const routerArgs = [wranglerCli, 'deploy', '--config', routerConfig, '--keep-vars']
    if (dryRun) {
      routerArgs.push('--dry-run', '--outdir', path.join(dryRunRoot, 'pathguardian'), '--metafile')
    } else if (Object.keys(secretValues).length > 0) {
      routerArgs.push('--secrets-file', tempSecretPath)
    }
    console.log(`\n=== ${dryRun ? 'Checking' : 'Deploying'} pathguardian router ===`)
    if (dryRun) runDryRun(routerArgs, 'pathguardian')
    else run(routerArgs)
  }
} finally {
  if (existsSync(tempSecretPath)) rmSync(tempSecretPath, { force: true })
}
