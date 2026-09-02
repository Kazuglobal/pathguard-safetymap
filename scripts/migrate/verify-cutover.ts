import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { Client } from 'pg'
import * as turf from '@turf/turf'

type D1Row = Record<string, unknown>
type StorageMove = { source: string; destinationBucket: 'public' | 'private'; destinationKey: string }
type RcloneStat = { Size?: number; Hashes?: Record<string, string>; Metadata?: Record<string, string> }
type HazardGolden = {
  name: string
  latitude: number
  longitude: number
  expectedHazardTypes: string[]
  expectedMinimumRiskLevel?: number
}
const turfOps = turf as unknown as {
  point(coordinates: [number, number]): GeoJSON.Feature<GeoJSON.Point>
  booleanPointInPolygon(
    point: GeoJSON.Feature<GeoJSON.Point>,
    polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  ): boolean
}

const SAFE_TABLE = /^[a-z][a-z0-9_]*$/

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function hashIds(ids: readonly string[]): string {
  return createHash('sha256').update(`${ids.join('\n')}\n`, 'utf8').digest('hex')
}

async function d1Query(sql: string, params: unknown[] = []): Promise<D1Row[]> {
  const accountId = requiredEnvironment('CLOUDFLARE_ACCOUNT_ID')
  const databaseId = requiredEnvironment('D1_DATABASE_ID')
  const token = requiredEnvironment('D1_REST_API_TOKEN')
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  const payload = await response.json() as {
    success?: boolean
    errors?: Array<{ message?: string }>
    result?: Array<{ success?: boolean; error?: string; results?: D1Row[] }>
  }
  const result = payload.result?.[0]
  if (!response.ok || payload.success === false || result?.success === false) {
    const detail = payload.errors?.map((entry) => entry.message).filter(Boolean).join('; ') || result?.error
    throw new Error(`D1 verification query failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  return result?.results ?? []
}

async function d1Ids(table: string): Promise<string[]> {
  const result: string[] = []
  for (let offset = 0; ; offset += 5_000) {
    const rows = await d1Query(`SELECT id FROM "${table}" ORDER BY id LIMIT ? OFFSET ?`, [5_000, offset])
    result.push(...rows.map((row) => String(row.id)))
    if (rows.length < 5_000) return result
  }
}

async function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0
      ? resolve(stdout)
      : reject(new Error(`${command} exited with ${code}: ${stderr.trim()}`)))
  })
}

async function rcloneStat(remote: string): Promise<RcloneStat> {
  const raw = await run('rclone', ['lsjson', remote, '--stat', '--hash', '--metadata'])
  return JSON.parse(raw) as RcloneStat
}

async function rcloneContentSha256(remote: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('rclone', ['cat', remote], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    const hash = createHash('sha256')
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => hash.update(chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0
      ? resolve(hash.digest('hex'))
      : reject(new Error(`rclone cat exited with ${code}: ${stderr.trim()}`)))
  })
}

function metadataValue(stat: RcloneStat, name: string): string | undefined {
  const match = Object.entries(stat.Metadata ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return match?.[1]
}

async function verifyStorage(manifestPath: string, all: boolean): Promise<number> {
  const sourceRemote = argument('supabase-remote') ?? 'supabase-storage'
  const publicRemote = argument('public-r2-remote') ?? 'r2-public'
  const privateRemote = argument('private-r2-remote') ?? 'r2-private'
  const moves = (await readFile(manifestPath, 'utf8')).split(/\r?\n/).filter(Boolean)
    .map((line) => JSON.parse(line) as StorageMove)
  const unique = [...new Map(moves.map((move) => [`${move.destinationBucket}/${move.destinationKey}`, move])).values()]
  const sampleSize = Math.min(Number(argument('storage-sample') ?? 100), unique.length)
  const selected = all || sampleSize === unique.length
    ? unique
    : Array.from({ length: sampleSize }, (_, index) => unique[Math.floor(index * unique.length / sampleSize)])

  for (let index = 0; index < selected.length; index += 1) {
    const move = selected[index]
    const destinationRemote = move.destinationBucket === 'public' ? publicRemote : privateRemote
    const [source, destination] = await Promise.all([
      rcloneStat(`${sourceRemote}:${move.source}`),
      rcloneStat(`${destinationRemote}:${move.destinationKey}`),
    ])
    if (source.Size !== destination.Size) {
      throw new Error(`Storage size mismatch at mapping ${index + 1}/${selected.length}`)
    }
    const sourceHashes = source.Hashes ?? {}
    const destinationHashes = destination.Hashes ?? {}
    const comparable = Object.keys(sourceHashes).find((name) => destinationHashes[name])
    if (comparable && sourceHashes[comparable] !== destinationHashes[comparable]) {
      throw new Error(`Storage hash mismatch at mapping ${index + 1}/${selected.length}`)
    }
    if (!comparable) {
      const [sourceSha256, destinationSha256] = await Promise.all([
        rcloneContentSha256(`${sourceRemote}:${move.source}`),
        rcloneContentSha256(`${destinationRemote}:${move.destinationKey}`),
      ])
      if (sourceSha256 !== destinationSha256) {
        throw new Error(`Storage streamed SHA-256 mismatch at mapping ${index + 1}/${selected.length}`)
      }
    }
    if (move.destinationBucket === 'public') {
      if (metadataValue(destination, 'cache-control') !== 'public, max-age=31536000, immutable') {
        throw new Error(`Public storage Cache-Control mismatch at mapping ${index + 1}/${selected.length}`)
      }
      if (metadataValue(destination, 'content-disposition') !== 'inline') {
        throw new Error(`Public storage Content-Disposition mismatch at mapping ${index + 1}/${selected.length}`)
      }
    }
  }
  return selected.length
}

function productionOrigin(name: string): URL {
  const url = new URL(requiredEnvironment(name))
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must contain only an HTTPS origin`)
  }
  return url
}

async function verifyPublicDelivery(manifestPath: string): Promise<number> {
  const move = (await readFile(manifestPath, 'utf8')).split(/\r?\n/).filter(Boolean)
    .map((line) => JSON.parse(line) as StorageMove)
    .find((entry) => entry.destinationBucket === 'public')
  if (!move) return 0

  const siteOrigin = productionOrigin('NEXT_PUBLIC_SITE_URL').origin
  const mediaOrigin = productionOrigin('NEXT_PUBLIC_MEDIA_BASE_URL').origin
  const encodedKey = move.destinationKey.split('/').map((part) => encodeURIComponent(part)).join('/')
  const response = await fetch(`${mediaOrigin}/${encodedKey}`, {
    headers: { origin: siteOrigin, range: 'bytes=0-0' },
  })
  try {
    if (!response.ok) throw new Error(`Public media delivery failed (${response.status})`)
    if (response.headers.get('access-control-allow-origin') !== siteOrigin) {
      throw new Error('Public media CORS origin does not match NEXT_PUBLIC_SITE_URL')
    }
    if (response.headers.get('cache-control') !== 'public, max-age=31536000, immutable') {
      throw new Error('Public media Cache-Control is not one year and immutable')
    }
    if (response.headers.get('content-disposition') !== 'inline') {
      throw new Error('Public media Content-Disposition is not inline')
    }
  } finally {
    await response.body?.cancel()
  }
  return 1
}

async function verifyHazardGolden(filePath: string): Promise<number> {
  const points = JSON.parse(await readFile(filePath, 'utf8')) as HazardGolden[]
  if (!Array.isArray(points) || points.length < 1) throw new Error('Hazard golden file must be a non-empty array')
  for (const golden of points) {
    const rows = await d1Query(`SELECT hazard_type, risk_level, geojson FROM hazard_zones
      WHERE bbox_min_lng <= ? AND bbox_max_lng >= ? AND bbox_min_lat <= ? AND bbox_max_lat >= ?
      LIMIT 10000`, [golden.longitude, golden.longitude, golden.latitude, golden.latitude])
    const matched = rows.filter((row) => {
      const geometry = JSON.parse(String(row.geojson)) as GeoJSON.Polygon | GeoJSON.MultiPolygon
      return turfOps.booleanPointInPolygon(turfOps.point([golden.longitude, golden.latitude]), geometry)
    })
    const actualTypes = [...new Set(matched.map((row) => String(row.hazard_type)))].sort()
    const expectedTypes = [...golden.expectedHazardTypes].sort()
    if (JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes)) {
      throw new Error(`Hazard golden mismatch for ${golden.name}: expected ${expectedTypes}, received ${actualTypes}`)
    }
    if (golden.expectedMinimumRiskLevel !== undefined) {
      const maximum = Math.max(0, ...matched.map((row) => Number(row.risk_level)))
      if (maximum < golden.expectedMinimumRiskLevel) {
        throw new Error(`Hazard risk mismatch for ${golden.name}: expected >=${golden.expectedMinimumRiskLevel}, received ${maximum}`)
      }
    }
  }
  return points.length
}

async function main() {
  const countsPath = argument('counts')
  if (!countsPath) throw new Error('Use --counts=<source-counts.json>')
  const counts = JSON.parse(await readFile(countsPath, 'utf8')) as Record<string, number>
  const mismatches: string[] = []
  for (const [table, expected] of Object.entries(counts)) {
    if (!SAFE_TABLE.test(table) || !Number.isSafeInteger(expected) || expected < 0) {
      throw new Error(`Invalid source count entry: ${table}`)
    }
    const rows = await d1Query(`SELECT count(*) AS count FROM "${table}"`)
    const actual = Number(rows[0]?.count ?? -1)
    if (actual !== expected) mismatches.push(`${table}: source=${expected}, D1=${actual}`)
  }
  if (mismatches.length) throw new Error(`D1 row-count verification failed:\n${mismatches.join('\n')}`)

  const postgres = new Client({ connectionString: requiredEnvironment('POSTGRES_URL'), ssl: { rejectUnauthorized: true } })
  await postgres.connect()
  let sourceReportIds: string[]
  let sourceAdminEmails: string[]
  try {
    const result = await postgres.query<{ id: string }>('SELECT id::text AS id FROM public.danger_reports ORDER BY id')
    sourceReportIds = result.rows.map((row) => row.id)
    const admins = await postgres.query<{ id: string; email: string | null }>(
      "SELECT id::text AS id, lower(email) AS email FROM public.profiles WHERE role = 'admin' ORDER BY id",
    )
    const missingEmail = admins.rows.filter((row) => !row.email)
    if (missingEmail.length) {
      throw new Error(`Legacy admin profiles without email cannot be mapped: ${missingEmail.map((row) => row.id).join(', ')}`)
    }
    sourceAdminEmails = [...new Set(admins.rows.map((row) => row.email!))]
  } finally {
    await postgres.end()
  }
  const configuredAdminEmails = new Set(
    (process.env.ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
  )
  const unmappedAdmins = sourceAdminEmails.filter((email) => !configuredAdminEmails.has(email))
  if (unmappedAdmins.length) {
    throw new Error(`ADMIN_EMAILS is missing legacy administrators: ${unmappedAdmins.join(', ')}`)
  }
  const destinationReportIds = await d1Ids('danger_reports')
  const sourceHash = hashIds(sourceReportIds)
  const destinationHash = hashIds(destinationReportIds)
  if (sourceHash !== destinationHash) throw new Error('danger_reports sorted ID hash does not match')

  let storageChecked = 0
  let publicDeliveryChecked = 0
  const storageManifest = argument('storage-manifest')
  if (storageManifest) {
    storageChecked = await verifyStorage(storageManifest, process.argv.includes('--all-storage'))
    publicDeliveryChecked = await verifyPublicDelivery(storageManifest)
  }
  let goldenChecked = 0
  const golden = argument('hazard-golden')
  if (golden) goldenChecked = await verifyHazardGolden(golden)

  console.log(JSON.stringify({
    verifiedTables: Object.keys(counts).length,
    dangerReportIds: sourceReportIds.length,
    dangerReportIdSha256: sourceHash,
    legacyAdminProfilesVerified: sourceAdminEmails.length,
    storageObjectsChecked: storageChecked,
    publicDeliveryChecked,
    hazardGoldenPointsChecked: goldenChecked,
  }, null, 2))
}

void main().catch((error) => {
  console.error('[verify-cutover]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
