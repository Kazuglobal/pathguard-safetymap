import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { once } from 'node:events'
import { finished } from 'node:stream/promises'
import { Client } from 'pg'

type CoverageRow = {
  id: string
  hazard_type: 'flood' | 'tsunami'
  region_label: string
  source: string
  source_layer: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  bbox_min_lng: number
  bbox_min_lat: number
  bbox_max_lng: number
  bbox_max_lat: number
  imported_features: number
  imported_at: Date | string
}
type HazardRow = {
  id: string
  hazard_type: 'flood' | 'tsunami'
  source_layer: string
  risk_level: number
  depth_min_m: number | null
  depth_max_m: number | null
  area_context: 'residential-school-route' | 'riverside' | 'coastal'
  properties: Record<string, unknown>
  geometry: GeoJSON.MultiPolygon
}
type Group = {
  file: string
  hazardType: HazardRow['hazard_type']
  sourceLayer: string
  defaultAreaContext: HazardRow['area_context']
  region: string
  source: string
  count: number
  stream: ReturnType<typeof createWriteStream>
}

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function write(stream: ReturnType<typeof createWriteStream>, value: string): Promise<void> {
  if (!stream.write(value)) await once(stream, 'drain')
}

async function main() {
  const postgresUrl = process.env.POSTGRES_URL?.trim()
  const out = argument('out')
  if (!postgresUrl) throw new Error('POSTGRES_URL is required')
  if (!out) throw new Error('Use --out=<directory>')
  const outputDirectory = path.resolve(out)
  const featureDirectory = path.join(outputDirectory, 'hazards')
  await mkdir(featureDirectory, { recursive: true })

  const client = new Client({ connectionString: postgresUrl, ssl: { rejectUnauthorized: true } })
  const groups = new Map<string, Group>()
  let coverageRows: CoverageRow[] = []
  let sourceRows = 0
  try {
    await client.connect()
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    coverageRows = (await client.query<CoverageRow>(`SELECT id::text, hazard_type, region_label, source, source_layer,
      ST_AsGeoJSON(coverage_geom, 7)::json AS geometry,
      ST_XMin(Box2D(coverage_geom)) AS bbox_min_lng, ST_YMin(Box2D(coverage_geom)) AS bbox_min_lat,
      ST_XMax(Box2D(coverage_geom)) AS bbox_max_lng, ST_YMax(Box2D(coverage_geom)) AS bbox_max_lat,
      imported_features, imported_at
      FROM public.hazard_zone_coverage ORDER BY hazard_type, region_label, source_layer`)).rows
    for (const coverage of coverageRows) {
      if (Buffer.byteLength(JSON.stringify(coverage.geometry), 'utf8') > 1_800_000) {
        throw new Error(`Coverage geometry ${coverage.id} exceeds the D1 row safety limit`)
      }
    }

    await client.query(`DECLARE hazard_cursor NO SCROLL CURSOR FOR
      SELECT id::text, hazard_type, source_layer, risk_level,
        depth_min_m::float8, depth_max_m::float8, area_context, properties,
        ST_AsGeoJSON(geom, 7)::json AS geometry
      FROM public.hazard_zones ORDER BY id`)
    while (true) {
      const rows = (await client.query<HazardRow>('FETCH FORWARD 500 FROM hazard_cursor')).rows
      if (!rows.length) break
      for (const row of rows) {
        const matchingCoverage = coverageRows.filter((coverage) =>
          coverage.hazard_type === row.hazard_type && coverage.source_layer === row.source_layer)
        const region = nonEmpty(row.properties.region_label)
          ?? (matchingCoverage.length === 1 ? matchingCoverage[0].region_label : null)
        const source = nonEmpty(row.properties.source)
          ?? (matchingCoverage.length === 1 ? matchingCoverage[0].source : null)
        if (!region || !source) {
          throw new Error(`Hazard zone ${row.id} cannot be assigned unambiguously to a region/source`)
        }
        const key = JSON.stringify([row.hazard_type, row.source_layer, region, source])
        let group = groups.get(key)
        if (!group) {
          const digest = createHash('sha256').update(key).digest('hex').slice(0, 16)
          const file = `${row.hazard_type}-${digest}.ndjson`
          group = {
            file,
            hazardType: row.hazard_type,
            sourceLayer: row.source_layer,
            defaultAreaContext: row.area_context,
            region,
            source,
            count: 0,
            stream: createWriteStream(path.join(featureDirectory, file), { flags: 'w' }),
          }
          groups.set(key, group)
        }
        const feature = {
          type: 'Feature',
          properties: {
            ...row.properties,
            source_record_id: row.id,
            risk_level: row.risk_level,
            depth_min_m: row.depth_min_m,
            depth_max_m: row.depth_max_m,
            area_context: row.area_context,
          },
          geometry: row.geometry,
        }
        await write(group.stream, `${JSON.stringify(feature)}\n`)
        group.count += 1
        sourceRows += 1
      }
    }
    await client.query('CLOSE hazard_cursor')
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end().catch(() => undefined)
    const completed = [...groups.values()].map((group) => finished(group.stream))
    for (const group of groups.values()) group.stream.end()
    await Promise.all(completed)
  }

  const plan = {
    createdAt: new Date().toISOString(),
    sourceRows,
    coverageRows: coverageRows.length,
    entries: [...groups.values()].map(({ stream: _stream, ...group }) => group),
  }
  await Promise.all([
    writeFile(path.join(outputDirectory, 'hazard-import-plan.json'), `${JSON.stringify(plan, null, 2)}\n`, 'utf8'),
    writeFile(path.join(outputDirectory, 'hazard-coverage.json'), `${JSON.stringify(coverageRows, null, 2)}\n`, 'utf8'),
  ])
  console.log(`Exported ${sourceRows} hazard source rows in ${groups.size} import groups and ${coverageRows.length} coverage rows`)
}

void main().catch((error) => {
  console.error('[export-pg-hazards]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
