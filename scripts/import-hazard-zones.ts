import path from 'node:path'

import {
  parseHazardImportArgs,
  runHazardZoneImport,
  streamHazardFeatures,
  type D1HazardCoverageRow,
  type D1HazardZoneRow,
  type HazardZoneImportSink,
} from '@/lib/hazard-zone-import'

type D1Statement = { sql: string; params?: unknown[] }

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function createRemoteD1Sink(): HazardZoneImportSink {
  const accountId = requiredEnvironment('CLOUDFLARE_ACCOUNT_ID')
  const databaseId = requiredEnvironment('D1_DATABASE_ID')
  const token = requiredEnvironment('D1_REST_API_TOKEN')
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`

  const execute = async (statements: readonly D1Statement[]) => {
    for (let offset = 0; offset < statements.length; offset += 50) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: statements.slice(offset, offset + 50) }),
      })
      const payload = await response.json().catch(() => null) as {
        success?: boolean
        errors?: Array<{ message?: string }>
        result?: Array<{ success?: boolean; error?: string }>
      } | null
      if (!response.ok || payload?.success === false || payload?.result?.some((entry) => entry.success === false)) {
        const detail = payload?.errors?.[0]?.message ?? payload?.result?.find((entry) => entry.error)?.error
        throw new Error(`D1 query failed (${response.status})${detail ? `: ${detail}` : ''}`)
      }
    }
  }

  const insertZone = (row: D1HazardZoneRow): D1Statement => ({
    sql: `INSERT INTO hazard_zones
      (id, zone_group_id, hazard_type, source_layer, risk_level, depth_min_m, depth_max_m,
       area_context, properties, geojson, bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      row.id, row.zone_group_id, row.hazard_type, row.source_layer, row.risk_level,
      row.depth_min_m, row.depth_max_m, row.area_context, JSON.stringify(row.properties),
      JSON.stringify(row.geojson), row.bbox_min_lng, row.bbox_min_lat,
      row.bbox_max_lng, row.bbox_max_lat,
    ],
  })

  const insertCoverage = (row: D1HazardCoverageRow): D1Statement => ({
    sql: `INSERT INTO hazard_zone_coverage
      (id, coverage_group_id, hazard_type, region_label, source, source_layer, geojson,
       bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat, imported_features, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      row.id, row.coverage_group_id, row.hazard_type, row.region_label, row.source,
      row.source_layer, JSON.stringify(row.geojson), row.bbox_min_lng, row.bbox_min_lat,
      row.bbox_max_lng, row.bbox_max_lat, row.imported_features, row.imported_at,
    ],
  })

  return {
    async deleteExisting(args) {
      await execute([{
        sql: `DELETE FROM hazard_zones
          WHERE hazard_type = ? AND source_layer = ?
          AND json_extract(properties, '$.region_label') = ?`,
        params: [args.hazardType, args.sourceLayer, args.regionLabel],
      }])
    },
    async insertZones(rows) { await execute(rows.map(insertZone)) },
    async replaceCoverage(row) {
      await execute([
        {
          sql: 'DELETE FROM hazard_zone_coverage WHERE hazard_type = ? AND region_label = ? AND source_layer = ?',
          params: [row.hazard_type, row.region_label, row.source_layer],
        },
        insertCoverage(row),
      ])
    },
  }
}

async function main() {
  const args = parseHazardImportArgs(process.argv.slice(2))
  const fullPath = path.resolve(args.filePath)
  const imported = await runHazardZoneImport(createRemoteD1Sink(), {
    args: { ...args, filePath: fullPath, batchSize: Math.min(args.batchSize, 50) },
    features: streamHazardFeatures(fullPath, args.inputFormat),
  })
  console.log(`Imported ${imported.importedFeatures} D1 hazard polygons for ${args.regionLabel}`)
}

main().catch((error) => {
  console.error('[import-hazard-zones]', error instanceof Error ? error.message : 'unknown')
  process.exitCode = 1
})
