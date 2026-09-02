import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type StorageObject = {
  bucket: string
  key: string
  contentType: string
  expectedBytes: number | null
}

type ReceiptObject = StorageObject & {
  bytes: number
  sha256: string
  destination: string
}

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function validateKey(value: string, label: string): string {
  if (!value || value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
  if (value.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}

function encodedPath(value: string): string {
  return validateKey(value, 'Storage object key').split('/').map(encodeURIComponent).join('/')
}

async function listObjects(client: SupabaseClient, bucket: string, prefix = ''): Promise<StorageObject[]> {
  const objects: StorageObject[] = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`Unable to list Supabase Storage bucket ${bucket}: ${error.message}`)
    for (const entry of data ?? []) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id === null) {
        objects.push(...await listObjects(client, bucket, key))
        continue
      }
      validateKey(key, 'Storage object key')
      const metadata = entry.metadata as Record<string, unknown> | null
      objects.push({
        bucket,
        key,
        contentType: typeof metadata?.mimetype === 'string' ? metadata.mimetype : 'application/octet-stream',
        expectedBytes: typeof metadata?.size === 'number' ? metadata.size : null,
      })
    }
    if (!data || data.length < 100) break
  }
  return objects
}

async function uploadObject(
  sourceUrl: URL,
  serviceRoleKey: string,
  object: StorageObject,
  destination: string,
): Promise<{ bytes: number; sha256: string }> {
  const url = new URL(`/storage/v1/object/authenticated/${encodeURIComponent(object.bucket)}/${encodedPath(object.key)}`, sourceUrl)
  const response = await fetch(url, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    signal: AbortSignal.timeout(10 * 60_000),
  })
  if (!response.ok || !response.body) throw new Error(`Supabase Storage download failed (${response.status})`)

  const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js')
  const child = spawn(process.execPath, [
    wrangler,
    'r2', 'object', 'put', `pg-backups/${destination}`,
    '--remote', '--force', '--pipe',
    `--content-type=${object.contentType}`,
    '--content-disposition=attachment',
    '--cache-control=private, max-age=0, no-store',
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let commandOutput = ''
  child.stdout.on('data', (chunk: Buffer) => { commandOutput = `${commandOutput}${chunk.toString('utf8')}`.slice(-4000) })
  child.stderr.on('data', (chunk: Buffer) => { commandOutput = `${commandOutput}${chunk.toString('utf8')}`.slice(-4000) })

  const hash = createHash('sha256')
  let bytes = 0
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length
      hash.update(chunk)
      callback(null, chunk)
    },
  })
  const exit = new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => code === 0
      ? resolve()
      : reject(new Error(`Wrangler R2 upload failed (${code ?? 'unknown'})\n${commandOutput}`)))
  })
  await Promise.all([
    pipeline(Readable.fromWeb(response.body as never), meter, child.stdin),
    exit,
  ])
  if (object.expectedBytes !== null && bytes !== object.expectedBytes) {
    throw new Error(`Supabase Storage size changed during backup (${object.bucket})`)
  }
  return { bytes, sha256: hash.digest('hex') }
}

async function main(): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!baseUrl || !serviceRoleKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  const sourceUrl = new URL(baseUrl)
  if (sourceUrl.protocol !== 'https:' || !sourceUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL')
  }

  const stamp = argument('stamp') ?? new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  if (!/^\d{8}T\d{6}Z$/.test(stamp)) throw new Error('Invalid backup stamp')
  const client = createClient(sourceUrl.origin, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: buckets, error } = await client.storage.listBuckets()
  if (error) throw new Error(`Unable to list Supabase Storage buckets: ${error.message}`)
  for (const bucket of buckets ?? []) validateKey(bucket.id, 'Storage bucket name')
  const objects = (await Promise.all((buckets ?? []).map((bucket) => listObjects(client, bucket.id)))).flat()
  const receipts: ReceiptObject[] = []
  let totalBytes = 0

  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index]
    const destination = `supabase-storage-pre-cutover/${stamp}/${object.bucket}/${object.key}`
    const uploaded = await uploadObject(sourceUrl, serviceRoleKey, object, destination)
    totalBytes += uploaded.bytes
    receipts.push({ ...object, ...uploaded, destination })
    console.log(`Backed up ${index + 1}/${objects.length} objects (${totalBytes} bytes)`)
  }

  const artifactDirectory = path.resolve('artifacts/migration', `storage-backup-${stamp}`)
  await mkdir(artifactDirectory, { recursive: true })
  const receiptPath = path.join(artifactDirectory, 'receipt.json')
  await writeFile(receiptPath, `${JSON.stringify({
    completedAt: new Date().toISOString(),
    destinationPrefix: `pg-backups/supabase-storage-pre-cutover/${stamp}`,
    objects: receipts.length,
    totalBytes,
    objectDigests: receipts,
  }, null, 2)}\n`, 'utf8')
  console.log(`Supabase Storage backup complete: ${receipts.length} objects, ${totalBytes} bytes`)
  console.log(`Receipt: ${receiptPath}`)
}

void main().catch((error) => {
  console.error('[backup-storage-via-wrangler]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
