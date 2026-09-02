import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { once } from 'node:events'
import { finished } from 'node:stream/promises'
import { Client } from 'pg'

const TABLE_ORDER = [
  'profiles', 'danger_reports', 'danger_report_moderation_log', 'report_images', 'danger_report_reactions',
  'report_comments', 'report_likes', 'report_bookmarks', 'report_shares', 'report_flags',
  'notifications', 'user_routes', 'route_learning_sessions', 'badges', 'missions',
  'user_points', 'user_badges', 'user_mission_progress', 'safety_quest_attempts',
  'hunter_photos', 'hazard_detections', 'hunter_audit_log', 'push_subscriptions',
  'local_safety_alerts', 'hazard_image_cache', 'image_generation_gate_log',
  'api_budget_settings', 'api_usage_logs', 'traffic_accidents',
] as const
const SPATIAL_TABLES = ['hazard_zones', 'hazard_zone_coverage'] as const
const MAX_ROWS_PER_INSERT = 50
const MAX_STATEMENT_BYTES = 99_000
type Row = Record<string, unknown>
type MediaMove = { source: string; destinationBucket: 'public' | 'private'; destinationKey: string }
type SupabaseRestSource = { baseUrl: string; serviceRoleKey: string }

const REST_PAGE_SIZE = 1000
const REST_OFFSET_ORDER: Readonly<Record<string, string>> = {
  user_points: 'user_id.asc',
  user_badges: 'user_id.asc,badge_id.asc',
  user_mission_progress: 'user_id.asc,mission_id.asc',
}

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error(`Unsafe identifier: ${value}`)
  return `"${value}"`
}

function sqlLiteral(value: unknown): string {
  if (value == null) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite number cannot be migrated')
    return String(value)
  }
  if (value instanceof Date) return `'${value.toISOString()}'`
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (text.includes('\0')) throw new Error('NUL is not supported by D1 text values')
  return `'${text.replaceAll("'", "''")}'`
}

function parseTargetColumns(sql: string, columns: Map<string, string[]>): void {
  for (const match of sql.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\n\);/g)) {
    const tableColumns = [...match[2].matchAll(/^\s*`([^`]+)`\s+/gm)].map((item) => item[1])
    columns.set(match[1], tableColumns)
  }
  for (const match of sql.matchAll(/ALTER TABLE `([^`]+)` ADD `([^`]+)`/g)) {
    const current = columns.get(match[1]) ?? []
    if (!current.includes(match[2])) current.push(match[2])
    columns.set(match[1], current)
  }
}

async function targetColumns(): Promise<Map<string, string[]>> {
  const directory = path.resolve('lib/db/migrations')
  const result = new Map<string, string[]>()
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()
  for (const file of files) parseTargetColumns(await readFile(path.join(directory, file), 'utf8'), result)
  return result
}

const STORAGE_BUCKETS = new Set(['images', 'danger-reports', 'processed-images', 'avatars', 'hazard-simulations', 'hunter-photos'])

function storageObject(value: unknown, fallbackBucket: string): { bucket: string; key: string } | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const raw = value.trim()
  if (!/^https?:\/\//i.test(raw)) {
    const segments = raw.replace(/^\/+/, '').split('/').filter(Boolean)
    if (!segments.length) return null
    const bucket = STORAGE_BUCKETS.has(segments[0]) ? segments.shift()! : fallbackBucket
    return { bucket, key: segments.join('/') }
  }
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) return null
  const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean)
  const objectIndex = parts.findIndex((part) => part === 'object')
  if (objectIndex < 0) return null
  const mode = parts[objectIndex + 1]
  const bucketIndex = mode === 'public' || mode === 'sign' || mode === 'authenticated'
    ? objectIndex + 2 : objectIndex + 1
  const bucket = parts[bucketIndex]
  const key = parts.slice(bucketIndex + 1).join('/')
  return bucket && key ? { bucket, key } : null
}

function migrateMedia(
  value: unknown,
  sourceBucket: string,
  destinationBucket: 'public' | 'private',
  destinationKey: (source: { bucket: string; key: string }) => string,
  moves: MediaMove[],
): string | null {
  if (value == null || value === '') return null
  const source = storageObject(value, sourceBucket)
  if (!source) throw new Error(`Storage URL/path could not be parsed: ${String(value).slice(0, 120)}`)
  const key = destinationKey(source)
  moves.push({ source: `${source.bucket}/${source.key}`, destinationBucket, destinationKey: key })
  return key
}

function basename(key: string): string {
  const name = key.split('/').filter(Boolean).at(-1)
  if (!name || name === '.' || name === '..') throw new Error('Invalid storage object name')
  return name
}

function migratedObjectName(
  source: { bucket: string; key: string },
  role: string,
): string {
  const extensionMatch = basename(source.key).match(/\.([a-z0-9]{1,10})$/i)
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : ''
  const digest = createHash('sha256')
    .update(`${source.bucket}/${source.key}`, 'utf8')
    .digest('hex')
    .slice(0, 24)
  return `${role}-${digest}${extension}`
}

function requiredKeyPart(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error(`${label} is required to build a safe R2 object key`)
  }
  return value
}

function transformRow(table: string, source: Row, moves: MediaMove[]): Row {
  const row = { ...source }
  if (table === 'profiles') {
    const profileId = requiredKeyPart(row.id, 'profiles.id')
    row.avatar_key = migrateMedia(row.avatar_url, 'avatars', 'public', (item) =>
      `avatars/${profileId}/${migratedObjectName(item, 'avatar')}`, moves)
  }
  if (table === 'danger_reports') {
    const ownerId = requiredKeyPart(row.user_id, 'danger_reports.user_id')
    const reportId = requiredKeyPart(row.id, 'danger_reports.id')
    const prefix = (item: { bucket: string; key: string }, role: string) =>
      `danger-reports/${ownerId}/${reportId}/${migratedObjectName(item, role)}`
    row.image_key = migrateMedia(row.image_url, 'danger-reports', 'private',
      (item) => prefix(item, 'original'), moves)
    row.processed_image_key = migrateMedia(row.processed_image_url, 'processed-images', 'private',
      (item) => prefix(item, 'processed-primary'), moves)
    const values = Array.isArray(row.processed_image_urls) ? row.processed_image_urls : []
    row.processed_image_keys = values.map((value, index) => {
      const key = migrateMedia(value, 'processed-images', 'private',
        (item) => prefix(item, `processed-${index}`), moves)
      if (!key) throw new Error(`danger_reports.processed_image_urls[${index}] is empty or invalid`)
      return key
    })
  }
  if (table === 'report_images') {
    const ownerId = requiredKeyPart(row.__owner_id, 'report_images owner id')
    const reportId = requiredKeyPart(row.report_id, 'report_images.report_id')
    const imageId = requiredKeyPart(row.id, 'report_images.id')
    row.image_key = migrateMedia(row.image_url, 'processed-images', 'private', (item) =>
      `danger-reports/${ownerId}/${reportId}/${migratedObjectName(item, `report-image-${imageId}`)}`, moves)
  }
  if (table === 'hunter_photos') {
    const playerId = requiredKeyPart(row.player_id, 'hunter_photos.player_id')
    const photoId = requiredKeyPart(row.id, 'hunter_photos.id')
    row.image_key = migrateMedia(row.image_path, 'hunter-photos', 'private', () =>
      `hunter-photos/${playerId}/${photoId}/masked.webp`, moves)
  }
  if (table === 'hazard_image_cache') {
    row.object_key = migrateMedia(row.storage_path ?? row.public_url, 'hazard-simulations', 'public', (item) =>
      `hazard-simulations/${migratedObjectName(item, 'simulation')}`, moves)
  }
  if (table === 'traffic_accidents') {
    row.lat = row.latitude
    row.lng = row.longitude
    // Historical imports left this nullable in Postgres even though the
    // application treats an absent flag as false. D1 enforces the intended
    // non-null boolean contract.
    row.involves_child = row.involves_child ?? false
    row.involves_pedestrian = row.involves_pedestrian ?? false
  }
  return row
}

async function write(stream: ReturnType<typeof createWriteStream>, text: string): Promise<void> {
  if (!stream.write(text)) await once(stream, 'drain')
}

function buildInsert(table: string, columns: readonly string[], rows: readonly Row[]): string {
  const values = rows.map((row) => `(${columns.map((column) => sqlLiteral(row[column])).join(',')})`).join(',\n')
  return `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(',')}) VALUES\n${values};\n`
}

async function sourceTables(client: Client): Promise<Set<string>> {
  const result = await client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
  )
  return new Set(result.rows.map((row) => row.table_name))
}

function sourceSelect(table: string): string {
  if (table === 'report_images') {
    return 'SELECT ri.*, dr.user_id AS __owner_id FROM public.report_images ri LEFT JOIN public.danger_reports dr ON dr.id=ri.report_id'
  }
  return `SELECT * FROM public.${quoteIdentifier(table)}`
}

function restSourceFromEnvironment(): SupabaseRestSource | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!rawUrl || !serviceRoleKey) return null
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL')
  }
  return { baseUrl: url.origin, serviceRoleKey }
}

async function restFetch(
  source: SupabaseRestSource,
  table: string,
  search: URLSearchParams,
  count = false,
): Promise<Response> {
  const url = new URL(`/rest/v1/${table}`, source.baseUrl)
  url.search = search.toString()
  let lastStatus = 0
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          apikey: source.serviceRoleKey,
          authorization: `Bearer ${source.serviceRoleKey}`,
          ...(count ? { prefer: 'count=exact' } : {}),
        },
        signal: AbortSignal.timeout(90_000),
      })
      lastStatus = response.status
      if (response.ok || response.status === 404) return response
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`Supabase REST request for ${table} failed (${response.status})`)
      }
    } catch (error) {
      if (attempt === 4) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
  }
  throw new Error(`Supabase REST request for ${table} failed (${lastStatus || 'network error'})`)
}

async function sourceTablesFromRest(source: SupabaseRestSource): Promise<Set<string>> {
  const result = new Set<string>()
  for (const table of [...TABLE_ORDER, ...SPATIAL_TABLES]) {
    const search = new URLSearchParams({ select: '*', limit: '0' })
    const response = await restFetch(source, table, search)
    if (response.ok) result.add(table)
    else if (response.status !== 404) throw new Error(`Unable to inspect Supabase table ${table}`)
  }
  return result
}

async function restTableCount(source: SupabaseRestSource, table: string): Promise<number> {
  const response = await restFetch(source, table, new URLSearchParams({ select: 'id', limit: '1' }), true)
  if (!response.ok) return 0
  const total = response.headers.get('content-range')?.split('/').at(-1)
  if (!total || total === '*') throw new Error(`Supabase did not return an exact count for ${table}`)
  return Number(total)
}

function restSelect(table: string): string {
  return table === 'report_images' ? '*,danger_reports!report_images_report_id_fkey(user_id)' : '*'
}

async function* restRows(source: SupabaseRestSource, table: string): AsyncGenerator<Row[]> {
  const offsetOrder = REST_OFFSET_ORDER[table]
  let offset = 0
  let lastId: string | number | null = null
  while (true) {
    const search = new URLSearchParams({
      select: restSelect(table),
      order: offsetOrder ?? 'id.asc',
      limit: String(REST_PAGE_SIZE),
    })
    if (offsetOrder) search.set('offset', String(offset))
    else if (lastId != null) search.set('id', `gt.${lastId}`)
    const response = await restFetch(source, table, search)
    if (!response.ok) throw new Error(`Supabase table ${table} became unavailable during export`)
    const rows = (await response.json()) as Row[]
    if (!Array.isArray(rows)) throw new Error(`Supabase returned a non-array payload for ${table}`)
    if (!rows.length) break
    if (table === 'report_images') {
      for (const row of rows) {
        const report = row.danger_reports as { user_id?: unknown } | null | undefined
        row.__owner_id = report?.user_id
        delete row.danger_reports
      }
    }
    yield rows
    if (rows.length < REST_PAGE_SIZE) break
    if (offsetOrder) offset += rows.length
    else {
      const nextId = rows.at(-1)?.id
      if (typeof nextId !== 'string' && typeof nextId !== 'number') {
        throw new Error(`Supabase table ${table} did not return a usable id for pagination`)
      }
      if (nextId === lastId) throw new Error(`Supabase pagination did not advance for ${table}`)
      lastId = nextId
    }
  }
}

async function migrateTable(params: {
  client: Client
  table: string
  target: string[]
  sqlStream: ReturnType<typeof createWriteStream>
  manifestStream: ReturnType<typeof createWriteStream>
}): Promise<number> {
  const cursor = `cursor_${params.table}`
  await params.client.query(`DECLARE ${quoteIdentifier(cursor)} NO SCROLL CURSOR FOR ${sourceSelect(params.table)}`)
  let total = 0
  let pending: Row[] = []
  let columns: string[] | null = null
  const moves: MediaMove[] = []
  const flush = async () => {
    if (!pending.length || !columns) return
    await write(params.sqlStream, buildInsert(params.table, columns, pending))
    pending = []
  }
  while (true) {
    const result = await params.client.query<Row>(`FETCH FORWARD 1000 FROM ${quoteIdentifier(cursor)}`)
    if (!result.rows.length) break
    for (const source of result.rows) {
      const row = transformRow(params.table, source, moves)
      columns ??= params.target.filter((column) => Object.hasOwn(row, column))
      if (!columns.length) throw new Error(`No shared columns for ${params.table}`)
      const candidate = [...pending, row]
      const statementBytes = Buffer.byteLength(buildInsert(params.table, columns, candidate), 'utf8')
      if (pending.length && (candidate.length > MAX_ROWS_PER_INSERT || statementBytes >= MAX_STATEMENT_BYTES)) await flush()
      pending.push(row)
      if (Buffer.byteLength(buildInsert(params.table, columns, pending), 'utf8') >= MAX_STATEMENT_BYTES) {
        if (pending.length === 1) throw new Error(`${params.table} has a row too large for a D1 SQL statement`)
        const last = pending.pop()!
        await flush()
        pending.push(last)
      }
      total += 1
    }
  }
  await flush()
  await params.client.query(`CLOSE ${quoteIdentifier(cursor)}`)
  for (const move of moves) await write(params.manifestStream, `${JSON.stringify(move)}\n`)
  return total
}

async function migrateTableFromRest(params: {
  source: SupabaseRestSource
  table: string
  target: string[]
  sqlStream: ReturnType<typeof createWriteStream>
  manifestStream: ReturnType<typeof createWriteStream>
}): Promise<number> {
  let total = 0
  let pending: Row[] = []
  let columns: string[] | null = null
  const moves: MediaMove[] = []
  const flush = async () => {
    if (!pending.length || !columns) return
    await write(params.sqlStream, buildInsert(params.table, columns, pending))
    pending = []
  }
  for await (const sourceRows of restRows(params.source, params.table)) {
    for (const source of sourceRows) {
      const row = transformRow(params.table, source, moves)
      columns ??= params.target.filter((column) => Object.hasOwn(row, column))
      if (!columns.length) throw new Error(`No shared columns for ${params.table}`)
      const candidate = [...pending, row]
      const statementBytes = Buffer.byteLength(buildInsert(params.table, columns, candidate), 'utf8')
      if (pending.length && (candidate.length > MAX_ROWS_PER_INSERT || statementBytes >= MAX_STATEMENT_BYTES)) await flush()
      pending.push(row)
      if (Buffer.byteLength(buildInsert(params.table, columns, pending), 'utf8') >= MAX_STATEMENT_BYTES) {
        if (pending.length === 1) throw new Error(`${params.table} has a row too large for a D1 SQL statement`)
        const last = pending.pop()!
        await flush()
        pending.push(last)
      }
      total += 1
    }
    if (total > 0 && total % 25_000 === 0) console.log(`${params.table}: ${total} rows exported`)
  }
  await flush()
  for (const move of moves) await write(params.manifestStream, `${JSON.stringify(move)}\n`)
  return total
}

async function main() {
  const postgresUrl = process.env.POSTGRES_URL?.trim()
  const restSource = postgresUrl ? null : restSourceFromEnvironment()
  const out = argument('out')
  if (!postgresUrl && !restSource) {
    throw new Error('POSTGRES_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY is required')
  }
  if (!out) throw new Error('Use --out=<directory>; existing files are overwritten')
  const outputDirectory = path.resolve(out)
  await mkdir(outputDirectory, { recursive: true })
  const sqlPath = path.join(outputDirectory, 'd1-import.sql')
  const manifestPath = path.join(outputDirectory, 'storage-key-map.ndjson')
  const countsPath = path.join(outputDirectory, 'source-counts.json')
  const spatialCountsPath = path.join(outputDirectory, 'spatial-source-counts.json')
  const sqlStream = createWriteStream(sqlPath, { flags: 'w' })
  const manifestStream = createWriteStream(manifestPath, { flags: 'w' })
  const client = postgresUrl ? new Client({ connectionString: postgresUrl, ssl: { rejectUnauthorized: true } }) : null
  const columns = await targetColumns()
  const counts: Record<string, number> = {}
  try {
    if (client) {
      await client.connect()
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    }
    const available = client ? await sourceTables(client) : await sourceTablesFromRest(restSource!)
    const spatialCounts: Record<string, number> = {}
    for (const table of SPATIAL_TABLES) {
      spatialCounts[table] = available.has(table)
        ? client
          ? Number((await client.query(`SELECT count(*)::bigint AS count FROM public.${quoteIdentifier(table)}`)).rows[0]?.count ?? 0)
          : await restTableCount(restSource!, table)
        : 0
    }
    await writeFile(spatialCountsPath, `${JSON.stringify(spatialCounts, null, 2)}\n`, 'utf8')
    if (Object.values(spatialCounts).some((count) => count > 0) && argument('spatial-exported') !== 'true') {
      throw new Error(`Spatial source tables contain data (${JSON.stringify(spatialCounts)}). Run migrate:export:hazards and migrate:import:hazard-plan; then rerun this command with --spatial-exported=true.`)
    }
    // D1 wraps an imported SQL file in an implicit transaction. Explicit
    // BEGIN/COMMIT is rejected by Wrangler's import path.
    await write(sqlStream, 'PRAGMA defer_foreign_keys=ON;\n')
    for (const table of [...TABLE_ORDER].reverse()) await write(sqlStream, `DELETE FROM ${quoteIdentifier(table)};\n`)
    for (const table of TABLE_ORDER) {
      if (!available.has(table)) { counts[table] = 0; continue }
      const target = columns.get(table)
      if (!target) throw new Error(`D1 schema not found for ${table}`)
      counts[table] = client
        ? await migrateTable({ client, table, target, sqlStream, manifestStream })
        : await migrateTableFromRest({ source: restSource!, table, target, sqlStream, manifestStream })
      console.log(`${table}: ${counts[table]} rows`)
    }
    await write(sqlStream, 'PRAGMA defer_foreign_keys=OFF;\n')
    if (client) await client.query('COMMIT')
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    if (client) await client.end().catch(() => undefined)
    const sqlFinished = finished(sqlStream)
    const manifestFinished = finished(manifestStream)
    sqlStream.end()
    manifestStream.end()
    await Promise.all([sqlFinished, manifestFinished])
  }
  await writeFile(countsPath, `${JSON.stringify(counts, null, 2)}\n`, 'utf8')
  console.log(`D1 import and storage manifest written to ${outputDirectory}`)
}

void main().catch((error) => {
  console.error('[pg-to-d1]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
