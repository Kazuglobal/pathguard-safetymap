import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import dotenv from 'dotenv'
import { createPreviewConfig, previewName, previewSecrets, forbiddenBuildFiles, previewBuildEnvironment } from './preview-config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2).filter((arg) => arg !== '--')
const id = args.find((arg) => arg.startsWith('--preview='))?.slice('--preview='.length)
previewName('pathguardian', id ?? '')
for (const arg of args) {
  if (!arg.startsWith('--preview=') && !['--delete', '--dry-run'].includes(arg)) {
    throw new Error(`Unknown option: ${arg}`)
  }
}
const dryRun = args.includes('--dry-run')
const remove = args.includes('--delete')
const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js')
const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
  if (result.error) throw result.error
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) throw new Error(`Command failed with exit code ${result.status}`)
  return result.stdout ?? ''
}
const readConfig = (name) => {
  const result = ts.parseConfigFileTextToJson(name, readFileSync(path.join(root, name), 'utf8'))
  if (result.error) throw new Error(`Cannot parse ${name}`)
  return result.config
}
const routerBase = readConfig('wrangler.jsonc')
const serverBase = readConfig('wrangler.server.jsonc')
const resources = readConfig('wrangler.preview-resources.json')
const serverNames = routerBase.services.filter((service) => service.binding !== 'WORKER_SELF_REFERENCE').map((service) => service.service)

// Never implicitly load production environment files for a preview.
dotenv.config({ path: path.join(root, '.env.preview.local'), quiet: true })
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: resources.account_id, WRANGLER_SEND_METRICS: 'false' }
const dir = mkdtempSync(path.join(tmpdir(), 'pathguardian-preview-'))
try {
  const writeConfig = (name, config) => {
    const target = path.join(dir, `${name}.json`)
    writeFileSync(target, JSON.stringify(config, null, 2))
    return target
  }
  const router = createPreviewConfig(routerBase, resources, id, root, true)
  const routerConfig = writeConfig('router', router)
  if (remove) {
    // Delete only the exact PR-scoped Workers, not D1/R2 or production Workers.
    for (const name of [...serverNames, 'pathguardian']) {
      const target = previewName(name, id)
      if (dryRun) console.log(`Would delete ${target}`)
      else run(process.execPath, [wrangler, 'delete', '--config', routerConfig, '--name', target, '--force'], { env })
    }
  } else {
    const secrets = previewSecrets(env)
    const buildEnv = previewBuildEnvironment(env, forbiddenBuildFiles.filter((file) => existsSync(path.join(root, file))))
    run(process.execPath, [path.join(root, 'scripts/cloudflare/build-free-workers.mjs')], { env: buildEnv, stdio: 'inherit' })
    const secretFile = path.join(dir, 'secrets.json')
    writeFileSync(secretFile, JSON.stringify(secrets), { mode: 0o600 })
    const deploy = (config) => run(process.execPath, [wrangler, 'deploy', '--config', config,
      ...(dryRun ? ['--dry-run'] : ['--secrets-file', secretFile])], { env })
    if (!dryRun) {
      // Break the initial router -> servers -> router service-binding cycle.
      // Returning 503 also avoids mixed frontend/server versions during updates.
      const bootstrap = writeConfig('bootstrap', {
        name: router.name, account_id: resources.account_id,
        main: path.join(root, 'cloudflare/preview-bootstrap.mjs'),
        compatibility_date: router.compatibility_date, workers_dev: true, preview_urls: false,
      })
      deploy(bootstrap)
    }
    for (const name of serverNames) {
      const config = createPreviewConfig({ ...serverBase, name,
        main: `cloudflare/workers/server-${name.slice('pathguardian-'.length)}.ts`,
      }, resources, id, root)
      deploy(writeConfig(name, config))
    }
    const output = deploy(routerConfig)
    if (!dryRun) {
      const url = output.match(new RegExp(`https://${router.name}\\.[a-z0-9-]+\\.workers\\.dev`))?.[0]
      if (!url) throw new Error('Wrangler did not report the PR router URL')
      for (const route of ['/', '/landing']) {
        let healthy = false
        for (let attempt = 0; attempt < 6; attempt += 1) {
          try {
            const response = await fetch(`${url}${route}`, { signal: AbortSignal.timeout(15000) })
            const body = await response.text()
            if (response.ok && /text\/html/.test(response.headers.get('content-type') ?? '') && body.includes('<html')) {
              healthy = true
              break
            }
          } catch { /* Retry while the deployment propagates. */ }
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
        if (!healthy) throw new Error(`Preview smoke check failed: ${route}`)
      }
      console.log(`Cloudflare preview: ${url}`)
      if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `preview_url=${url}\n`, { flag: 'a' })
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}
