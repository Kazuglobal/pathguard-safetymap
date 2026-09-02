import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const outputDir = path.join(projectRoot, '.open-next')
const functionsDir = path.join(outputDir, 'server-functions')
const defaultDir = path.join(functionsDir, 'default')
const parkedDefaultDir = path.join(functionsDir, '.default-bundle-source')
const functionNames = process.argv.slice(2)

const renameWithRetry = (source, destination) => {
  let lastError
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      renameSync(source, destination)
      return
    } catch (error) {
      lastError = error
      if (!['EACCES', 'EBUSY', 'EPERM'].includes(error?.code)) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
    }
  }
  throw lastError
}

const patchExternalMiddlewareManifest = (handler) => {
  const methodStart = handler.indexOf('getMiddlewareManifest(){')
  const methodEnd = handler.indexOf('async getMiddleware(){', methodStart)

  if (methodStart === -1 || methodEnd === -1) {
    throw new Error('Could not locate bundled NextServer.getMiddlewareManifest()')
  }

  const method = handler.slice(methodStart, methodEnd)
  if (method === 'getMiddlewareManifest(){return null}') return handler
  if (!method.includes('middlewareManifestPath')) {
    throw new Error('Bundled NextServer.getMiddlewareManifest() no longer has the expected shape')
  }

  // OpenNext externalizes middleware to the public router. Next.js 16.2 still
  // performs a direct dynamic require here, which workerd cannot execute.
  return `${handler.slice(0, methodStart)}getMiddlewareManifest(){return null}${handler.slice(methodEnd)}`
}

if (functionNames.length === 0) {
  throw new Error('Pass at least one split function name to bundle')
}

if (!existsSync(defaultDir)) {
  throw new Error(`OpenNext default function was not found: ${defaultDir}`)
}

if (existsSync(parkedDefaultDir)) {
  throw new Error(`Refusing to overwrite the recovery directory: ${parkedDefaultDir}`)
}

for (const functionName of functionNames) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(functionName)) {
    throw new Error(`Invalid function name: ${functionName}`)
  }
  const functionDir = path.join(functionsDir, functionName)
  if (!existsSync(functionDir)) {
    throw new Error(`OpenNext split function was not found: ${functionDir}`)
  }
}

process.chdir(projectRoot)

const [{ compileConfig, getNormalizedOptions }, { bundleServer }] = await Promise.all([
  import('../../node_modules/@opennextjs/cloudflare/dist/cli/commands/utils/utils.js'),
  import('../../node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js'),
])

const { config, buildDir } = await compileConfig()
const buildOptions = getNormalizedOptions(config, buildDir)
buildOptions.minify = false

renameWithRetry(defaultDir, parkedDefaultDir)

try {
  for (const functionName of functionNames) {
    const functionDir = path.join(functionsDir, functionName)
    renameWithRetry(functionDir, defaultDir)
    try {
      await bundleServer(buildOptions, { minify: true })
      const handlerPath = path.join(defaultDir, 'handler.mjs')
      const handler = patchExternalMiddlewareManifest(readFileSync(handlerPath, 'utf8'))
        .replaceAll('server-functions/default', `server-functions/${functionName}`)
        .replaceAll('server-functions\\\\default', `server-functions\\\\${functionName}`)
      writeFileSync(handlerPath, handler)
    } finally {
      renameWithRetry(defaultDir, functionDir)
    }
  }
} finally {
  if (existsSync(defaultDir)) {
    throw new Error('Cannot restore the default bundle because its destination is occupied')
  }
  renameWithRetry(parkedDefaultDir, defaultDir)
}

console.log(`Bundled split Workers: ${functionNames.join(', ')}`)
