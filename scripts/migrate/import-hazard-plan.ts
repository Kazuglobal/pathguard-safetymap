import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

type ImportPlan = {
  sourceRows: number
  coverageRows: number
  entries: Array<{
    file: string
    hazardType: 'flood' | 'tsunami'
    sourceLayer: string
    defaultAreaContext: string
    region: string
    source: string
  }>
}
type CoverageRow = {
  id: string
  hazard_type: string
  region_label: string
  source: string
  source_layer: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  bbox_min_lng: number
  bbox_min_lat: number
  bbox_max_lng: number
  bbox_max_lat: number
  imported_features: number
  imported_at: string
}
type D1Statement = { sql: string; params?: unknown[] }

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function d1Endpoint(): string {
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(requiredEnvironment('CLOUDFLARE_ACCOUNT_ID'))}/d1/database/${encodeURIComponent(requiredEnvironment('D1_DATABASE_ID'))}/query`
}

async function d1(statements: D1Statement | D1Statement[]): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(d1Endpoint(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${requiredEnvironment('D1_REST_API_TOKEN')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(Array.isArray(statements) ? { batch: statements } : statements),
  })
  const payload = await response.json() as {
    success?: boolean
    errors?: Array<{ message?: string }>
    result?: Array<{ success?: boolean; error?: string; results?: Array<Record<string, unknown>> }>
  }
  if (!response.ok || payload.success === false || payload.result?.some((entry) => entry.success === false)) {
    const detail = payload.errors?.map((entry) => entry.message).filter(Boolean).join('; ')
      || payload.result?.find((entry) => entry.error)?.error
    throw new Error(`D1 hazard import failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  return payload.result?.[0]?.results ?? []
}

async function runImporter(args: string[]): Promise<void> {
  const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, ['exec', 'tsx', 'scripts/import-hazard-zones.ts', ...args], {
      cwd: process.cwd(), shell: false, stdio: 'inherit', env: process.env,
    })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Hazard importer exited with ${code}`)))
  })
}

async function main() {
  const planArgument = argument('plan')
  if (!planArgument) throw new Error('Use --plan=<hazard-import-plan.json>')
  const planPath = path.resolve(planArgument)
  const directory = path.dirname(planPath)
  const plan = JSON.parse(await readFile(planPath, 'utf8')) as ImportPlan
  const coverage = JSON.parse(await readFile(path.join(directory, 'hazard-coverage.json'), 'utf8')) as CoverageRow[]
  if (!Array.isArray(plan.entries) || !Array.isArray(coverage)) throw new Error('Invalid hazard import artifact')

  for (const entry of plan.entries) {
    await runImporter([
      '--file', path.join(directory, 'hazards', entry.file),
      '--format', 'ndjson',
      '--hazardType', entry.hazardType,
      '--sourceLayer', entry.sourceLayer,
      '--defaultAreaContext', entry.defaultAreaContext,
      '--region', entry.region,
      '--source', entry.source,
      '--batchSize', '50',
    ])
  }

  for (const row of coverage) {
    await d1([
      {
        sql: 'DELETE FROM hazard_zone_coverage WHERE hazard_type = ? AND region_label = ? AND source_layer = ?',
        params: [row.hazard_type, row.region_label, row.source_layer],
      },
      {
        sql: `INSERT INTO hazard_zone_coverage
          (id, coverage_group_id, hazard_type, region_label, source, source_layer, geojson,
           bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat, imported_features, imported_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          row.id, `${row.hazard_type}:${row.region_label}:${row.source_layer}`,
          row.hazard_type, row.region_label, row.source, row.source_layer,
          JSON.stringify(row.geometry), row.bbox_min_lng, row.bbox_min_lat,
          row.bbox_max_lng, row.bbox_max_lat, row.imported_features,
          new Date(row.imported_at).toISOString(),
        ],
      },
    ])
  }

  const zoneCount = Number((await d1({ sql: 'SELECT count(DISTINCT zone_group_id) AS count FROM hazard_zones' }))[0]?.count ?? -1)
  const coverageCount = Number((await d1({ sql: 'SELECT count(*) AS count FROM hazard_zone_coverage' }))[0]?.count ?? -1)
  if (zoneCount !== plan.sourceRows || coverageCount !== plan.coverageRows) {
    throw new Error(`Spatial count mismatch: source zones=${plan.sourceRows}/D1 groups=${zoneCount}, source coverage=${plan.coverageRows}/D1=${coverageCount}`)
  }
  console.log(`Hazard migration verified: ${zoneCount} source zone groups, ${coverageCount} coverage rows`)
}

void main().catch((error) => {
  console.error('[import-hazard-plan]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
