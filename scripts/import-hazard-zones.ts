import fs from "node:fs/promises"
import path from "node:path"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { HazardAreaContext, HazardType } from "@/lib/types"

type FeatureProperties = Record<string, unknown>

type GeoJsonFeature = {
  type: "Feature"
  properties?: FeatureProperties | null
  geometry?: GeoJSON.Geometry | null
}

type FeatureCollection = {
  type: "FeatureCollection"
  features: GeoJsonFeature[]
}

type ImportArgs = {
  filePath: string
  hazardType: HazardType
  sourceLayer: string
  defaultAreaContext: HazardAreaContext
}

function parseArgs(argv: string[]): ImportArgs {
  const params = new Map<string, string>()

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (!item.startsWith("--")) continue
    const key = item.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`)
    }
    params.set(key, value)
    index += 1
  }

  const filePath = params.get("file")
  const hazardType = params.get("hazardType")
  const sourceLayer = params.get("sourceLayer")
  const defaultAreaContext = params.get("defaultAreaContext")

  if (!filePath || !hazardType || !sourceLayer || !defaultAreaContext) {
    throw new Error(
      "Usage: tsx scripts/import-hazard-zones.ts --file <geojson> --hazardType <flood|tsunami> --sourceLayer <layer> --defaultAreaContext <residential-school-route|riverside|coastal>",
    )
  }

  if (hazardType !== "flood" && hazardType !== "tsunami") {
    throw new Error("hazardType must be flood or tsunami")
  }

  if (
    defaultAreaContext !== "residential-school-route" &&
    defaultAreaContext !== "riverside" &&
    defaultAreaContext !== "coastal"
  ) {
    throw new Error("defaultAreaContext is invalid")
  }

  return {
    filePath,
    hazardType,
    sourceLayer,
    defaultAreaContext,
  }
}

function pickRiskLevel(properties: FeatureProperties, fallback = 3): number {
  const candidates = ["risk_level", "riskLevel", "level", "rank"]
  for (const key of candidates) {
    const value = properties[key]
    if (typeof value === "number" && value >= 1 && value <= 5) {
      return Math.trunc(value)
    }
  }
  return fallback
}

function pickNumber(properties: FeatureProperties, keys: string[]): number | null {
  for (const key of keys) {
    const value = properties[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function pickAreaContext(
  properties: FeatureProperties,
  fallback: HazardAreaContext,
): HazardAreaContext {
  const value = properties.area_context
  if (
    value === "residential-school-route" ||
    value === "riverside" ||
    value === "coastal"
  ) {
    return value
  }

  return fallback
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const fullPath = path.resolve(args.filePath)
  const raw = await fs.readFile(fullPath, "utf8")
  const data = JSON.parse(raw) as FeatureCollection

  if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("GeoJSON FeatureCollection is required")
  }

  const rows = data.features
    .filter((feature) => feature.geometry)
    .map((feature) => {
      const properties = feature.properties ?? {}
      return {
        hazard_type: args.hazardType,
        source_layer: args.sourceLayer,
        risk_level: pickRiskLevel(properties),
        depth_min_m: pickNumber(properties, ["depth_min_m", "depthMinMeters", "min_depth"]),
        depth_max_m: pickNumber(properties, ["depth_max_m", "depthMaxMeters", "max_depth"]),
        area_context: pickAreaContext(properties, args.defaultAreaContext),
        properties,
        geom: feature.geometry,
      }
    })

  if (rows.length === 0) {
    throw new Error("No importable features found")
  }

  const admin = getSupabaseAdmin() as any
  const chunkSize = 200

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    const payload = chunk.map((row) => ({
      hazard_type: row.hazard_type,
      source_layer: row.source_layer,
      risk_level: row.risk_level,
      depth_min_m: row.depth_min_m,
      depth_max_m: row.depth_max_m,
      area_context: row.area_context,
      properties: row.properties,
      geom: `SRID=4326;${JSON.stringify(row.geom)}`,
    }))

    const { error } = await admin.from("hazard_zones").insert(payload)
    if (error) {
      throw error
    }
  }

  console.log(`Imported ${rows.length} hazard zone features from ${fullPath}`)
}

main().catch((error) => {
  console.error("[import-hazard-zones]", error)
  process.exitCode = 1
})
