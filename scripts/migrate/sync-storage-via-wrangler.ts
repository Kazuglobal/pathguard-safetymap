import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

type MediaMove = {
  source: string
  destinationBucket: 'public' | 'private'
  destinationKey: string
}

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function validateKey(value: string, label: string): string {
  if (!value || value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
  const segments = value.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}

function encodeStoragePath(value: string): string {
  return validateKey(value, 'source object key').split('/').map(encodeURIComponent).join('/')
}

async function download(
  baseUrl: string,
  serviceRoleKey: string,
  source: string,
  file: string,
): Promise<{ bytes: number; contentType: string; sha256: string }> {
  const url = new URL(`/storage/v1/object/authenticated/${encodeStoragePath(source)}`, baseUrl)
  let response: Response | null = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      response = await fetch(url, {
        headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
        signal: AbortSignal.timeout(10 * 60_000),
      })
      if (response.ok) break
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`Supabase Storage download failed (${response.status})`)
      }
    } catch (error) {
      if (attempt === 4) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
  }
  if (!response?.ok || !response.body) {
    throw new Error(`Supabase Storage download failed (${response?.status ?? 'network error'})`)
  }
  const hash = createHash('sha256')
  let bytes = 0
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length
      hash.update(chunk)
      callback(null, chunk)
    },
  })
  await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(file, { flags: 'w' }))
  return {
    bytes,
    contentType: response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream',
    sha256: hash.digest('hex'),
  }
}

async function runWrangler(args: string[]): Promise<void> {
  const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js')
  await stat(wrangler)
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let output = ''
    const collect = (chunk: Buffer) => { output = `${output}${chunk.toString('utf8')}`.slice(-4000) }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Wrangler R2 upload failed (${code ?? 'unknown'})\n${output}`))
    })
  })
}

async function main(): Promise<void> {
  const manifestArgument = argument('manifest')
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!manifestArgument) throw new Error('Use --manifest=<storage-key-map.ndjson>')
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  const sourceUrl = new URL(baseUrl)
  if (sourceUrl.protocol !== 'https:' || !sourceUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL')
  }
  const manifestPath = path.resolve(manifestArgument)
  const rows = (await readFile(manifestPath, 'utf8')).split(/\r?\n/).filter(Boolean)
  const unique = new Map<string, MediaMove>()
  for (const line of rows) {
    const move = JSON.parse(line) as MediaMove
    validateKey(move.source, 'source object key')
    validateKey(move.destinationKey, 'destination object key')
    if (move.destinationBucket !== 'public' && move.destinationBucket !== 'private') {
      throw new Error('Invalid destination bucket')
    }
    const identity = `${move.destinationBucket}/${move.destinationKey}`
    const existing = unique.get(identity)
    if (existing && existing.source !== move.source) throw new Error(`Conflicting destination ${identity}`)
    unique.set(identity, move)
  }

  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'pathguardian-storage-'))
  const temporaryFile = path.join(temporaryDirectory, 'object.bin')
  let totalBytes = 0
  const objectDigests: Array<{ destination: string; bytes: number; sha256: string }> = []
  try {
    const moves = [...unique.values()]
    for (let index = 0; index < moves.length; index += 1) {
      const move = moves[index]
      const downloaded = await download(sourceUrl.origin, serviceRoleKey, move.source, temporaryFile)
      const bucket = move.destinationBucket === 'public' ? 'pg-media-public' : 'pg-media-private'
      const cacheControl = move.destinationBucket === 'public'
        ? 'public, max-age=31536000, immutable'
        : 'private, max-age=300'
      await runWrangler([
        'r2', 'object', 'put', `${bucket}/${move.destinationKey}`,
        '--remote', '--force', `--file=${temporaryFile}`,
        `--content-type=${downloaded.contentType}`,
        '--content-disposition=inline', `--cache-control=${cacheControl}`,
      ])
      totalBytes += downloaded.bytes
      objectDigests.push({
        destination: `${move.destinationBucket}/${move.destinationKey}`,
        bytes: downloaded.bytes,
        sha256: downloaded.sha256,
      })
      console.log(`Synchronized ${index + 1}/${moves.length} objects (${totalBytes} bytes)`)
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }

  const receiptPath = path.join(path.dirname(manifestPath), 'storage-sync-receipt.json')
  await writeFile(receiptPath, `${JSON.stringify({
    completedAt: new Date().toISOString(),
    objects: objectDigests.length,
    totalBytes,
    objectDigests,
  }, null, 2)}\n`, 'utf8')
  console.log(`Storage synchronization complete: ${objectDigests.length} objects, ${totalBytes} bytes`)
}

void main().catch((error) => {
  console.error('[sync-storage-via-wrangler]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
