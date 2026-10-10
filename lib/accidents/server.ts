import 'server-only'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { AccidentQuery, RankedLocation, RankingsResponse, SnapshotMetadata } from './query'

interface Statement {
  bind(...values: (string | number)[]): Statement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
}
export interface RankingDatabase { prepare(sql: string): Statement }
export function rankingDatabase(): RankingDatabase {
  return (getCloudflareContext().env as unknown as { TRAFFIC_DB: RankingDatabase }).TRAFFIC_DB
}
export async function snapshot(db: RankingDatabase, version = ''): Promise<SnapshotMetadata | null> {
  let row: { metadata_json: string } | null
  try {
    row = await db.prepare(`SELECT metadata_json FROM accident_snapshots WHERE published=1 ${version ? 'AND version=?' : ''} ORDER BY updated_at DESC,version DESC LIMIT 1`).bind(...(version ? [version] : [])).first<{ metadata_json: string }>()
  } catch (error) {
    // An unapplied new migration is preparing; all other database failures remain errors.
    if (error instanceof Error && /no such table: (?:main\.)?accident_snapshots\b/.test(error.message)) return null
    throw error
  }
  if (!row) return null
  const metadata = JSON.parse(row.metadata_json) as SnapshotMetadata
  if (!metadata.years?.length || metadata.years.some(y=>!Number.isInteger(y)||y<2018||y>2100) || !/^[a-zA-Z0-9_-]{1,64}$/.test(metadata.version) || (version && metadata.version!==version)) throw new Error('Invalid snapshot metadata')
  return metadata
}
function dimensions(q: AccidentQuery, m: SnapshotMetadata, alias: string) {
  if ((q.from && !m.years.includes(q.from)) || (q.to && !m.years.includes(q.to))) throw new RangeError('Year is not available')
  const from = q.from ?? Math.min(...m.years), to = q.to ?? Math.max(...m.years)
  if (from>to || Array.from({length:to-from+1},(_,i)=>from+i).some(y=>!m.years.includes(y))) throw new RangeError('Year range is not fully available')
  const values: (string | number)[] = [m.version, from, to]
  let where = `${alias}.version=? AND ${alias}.year BETWEEN ? AND ?`
  if (q.participant !== 'all') { where += ` AND (${alias}.participants & ?) != 0`; values.push(q.participant === 'bicycle' ? 1 : 2) }
  if (q.severity === 'fatal') where += ` AND ${alias}.fatal=1`
  const hours = { morning: [7,8], afternoon: [14,15,16], evening: [17,18] }
  if (q.time !== 'all') { where += ` AND ${alias}.hour IN (${hours[q.time].map(() => '?').join(',')})`; values.push(...hours[q.time]) }
  return { where, values }
}
function area(q: AccidentQuery, alias: string, values: (string | number)[]) {
  let where = ''
  for (const field of ['prefecture','municipality'] as const) if (q[field]) { where += ` AND ${alias}.${field}=?`; values.push(q[field]) }
  return where
}
export async function rankings(db: RankingDatabase, q: AccidentQuery): Promise<RankingsResponse> {
  const m = await snapshot(db,q.version)
  if (!m) return { status: q.version ? 'unavailable' : 'preparing', metadata: null, items: [], nextOffset: null, quality: { assigned: 0, uncertain: 0, excluded: 0 } }
  if (q.prefecture) {
    const covered = await db.prepare('SELECT code FROM accident_areas WHERE version=? AND code=? AND parent_code=?').bind(m.version,q.municipality || q.prefecture,q.municipality ? q.prefecture : '').first<{code:string}>()
    if (!covered) return {status:'unavailable',metadata:m,items:[],nextOffset:null,quality:{assigned:0,uncertain:0,excluded:0}}
  }
  const d = dimensions(q,m,'c')
  let where = d.where + area(q,'l',d.values)
  if (q.kind !== 'all') { where += ' AND l.kind=?'; d.values.push(q.kind) }
  const { results } = await db.prepare(`WITH totals AS (
    SELECT l.id,l.name,l.kind,l.latitude,l.longitude,l.prefecture,l.municipality,SUM(c.count) AS count
    FROM accident_location_counts c JOIN accident_locations l ON l.version=c.version AND l.id=c.location_id
    WHERE ${where} GROUP BY l.id
  ), ranked AS (SELECT *, RANK() OVER (ORDER BY count DESC) AS rank FROM totals)
  SELECT * FROM ranked ORDER BY count DESC,id LIMIT ? OFFSET ?`).bind(...d.values,q.limit+1,q.offset).all<RankedLocation>()
  const qualityDimensions = dimensions(q,m,'c')
  const qualityWhere = qualityDimensions.where + area(q,'c',qualityDimensions.values)
  const quality = await db.prepare(`SELECT COALESCE(SUM(assigned),0) AS assigned,COALESCE(SUM(uncertain),0) AS uncertain,COALESCE(SUM(excluded),0) AS excluded FROM accident_quality_counts c WHERE ${qualityWhere}`).bind(...qualityDimensions.values).first<RankingsResponse['quality']>()
  return { status: 'ready', metadata: m, items: results.slice(0,q.limit), nextOffset: results.length > q.limit ? q.offset+q.limit : null, quality: quality! }
}
export async function areas(db: RankingDatabase, version: string, prefecture: string) {
  const metadata = await snapshot(db,version)
  if (!metadata) return { status: version ? 'unavailable' : 'preparing', metadata: null, items: [] }
  const { results } = await db.prepare('SELECT code,parent_code AS parentCode,name FROM accident_areas WHERE version=? AND parent_code=? ORDER BY code').bind(metadata.version,prefecture).all<{code:string;parentCode:string;name:string}>()
  return { status: 'ready', metadata, items: results }
}
export async function location(db: RankingDatabase, id: string, q: AccidentQuery) {
  const metadata = await snapshot(db,q.version)
  if (!metadata) return { status: q.version ? 'unavailable' : 'preparing', metadata: null }
  const item = await db.prepare('SELECT id,name,kind,latitude,longitude,scope_json AS scope FROM accident_locations WHERE version=? AND id=?').bind(metadata.version,id).first<{id:string;name:string;kind:string;latitude:number;longitude:number;scope:string}>()
  if (!item) return null
  const d = dimensions(q,metadata,'c')
  const { results: counts } = await db.prepare(`SELECT year,hour,accident_class AS accidentClass,SUM(count) AS count FROM accident_location_counts c WHERE ${d.where} AND location_id=? GROUP BY year,hour,accident_class ORDER BY year,hour`).bind(...d.values,id).all<{year:number;hour:number;accidentClass:string;count:number}>()
  return { status: 'ready', metadata, item: {...item,scope:JSON.parse(item.scope)}, counts }
}
