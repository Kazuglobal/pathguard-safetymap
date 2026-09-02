import { createReadStream } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"
import * as turf from '@turf/turf'

import {
  isHazardAreaContext,
  type HazardAreaContext,
  type HazardType,
} from "@/lib/types"

type FeatureProperties = Record<string, unknown>

export type GeoJsonFeature = {
  type: "Feature"
  properties?: FeatureProperties | null
  geometry?: GeoJSON.Geometry | null
}

type FeatureCollection = {
  type: "FeatureCollection"
  features: GeoJsonFeature[]
}

export type HazardImportInputFormat = "geojson" | "ndjson"

export type HazardImportArgs = {
  filePath: string
  hazardType: HazardType
  sourceLayer: string
  defaultAreaContext: HazardAreaContext
  regionLabel: string
  source: string
  batchSize: number
  inputFormat: HazardImportInputFormat
}

export interface D1HazardZoneRow {
  id: string
  zone_group_id: string
  hazard_type: HazardType
  source_layer: string
  risk_level: number
  depth_min_m: number | null
  depth_max_m: number | null
  area_context: HazardAreaContext
  properties: FeatureProperties
  geojson: GeoJSON.Polygon
  bbox_min_lng: number
  bbox_min_lat: number
  bbox_max_lng: number
  bbox_max_lat: number
}

export interface D1HazardCoverageRow {
  id: string
  coverage_group_id: string
  hazard_type: HazardType
  region_label: string
  source: string
  source_layer: string
  geojson: GeoJSON.Polygon
  bbox_min_lng: number
  bbox_min_lat: number
  bbox_max_lng: number
  bbox_max_lat: number
  imported_features: number
  imported_at: string
}

export interface HazardZoneImportSink {
  deleteExisting(args: Pick<HazardImportArgs, 'hazardType' | 'sourceLayer' | 'regionLabel'>): Promise<void>
  insertZones(rows: readonly D1HazardZoneRow[]): Promise<void>
  replaceCoverage(row: D1HazardCoverageRow): Promise<void>
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1_000) {
    throw new Error("batchSize must be an integer between 1 and 1000")
  }
  return parsed
}

function inferInputFormat(filePath: string): HazardImportInputFormat {
  const extension = path.extname(filePath).toLowerCase()
  return extension === ".ndjson" || extension === ".jsonl"
    ? "ndjson"
    : "geojson"
}

export function parseHazardImportArgs(argv: string[]): HazardImportArgs {
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
  const regionLabel = params.get("region")
  const source = params.get("source")

  if (!filePath) throw new Error("Missing required --file")
  if (!hazardType) throw new Error("Missing required --hazardType")
  if (!sourceLayer) throw new Error("Missing required --sourceLayer")
  if (!defaultAreaContext) {
    throw new Error("Missing required --defaultAreaContext")
  }
  if (!regionLabel) throw new Error("Missing required --region")
  if (!source) throw new Error("Missing required --source")

  if (hazardType !== "flood" && hazardType !== "tsunami") {
    throw new Error("hazardType must be flood or tsunami")
  }
  if (!isHazardAreaContext(defaultAreaContext)) {
    throw new Error("defaultAreaContext is invalid")
  }

  const requestedFormat = params.get("format")
  if (
    requestedFormat !== undefined &&
    requestedFormat !== "geojson" &&
    requestedFormat !== "ndjson"
  ) {
    throw new Error("format must be geojson or ndjson")
  }

  return {
    filePath,
    hazardType,
    sourceLayer,
    defaultAreaContext,
    regionLabel,
    source,
    batchSize: parsePositiveInteger(params.get("batchSize"), 200),
    inputFormat:
      requestedFormat === "geojson" || requestedFormat === "ndjson"
        ? requestedFormat
        : inferInputFormat(filePath),
  }
}

function assertFeature(value: unknown): GeoJsonFeature {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { type?: unknown }).type !== "Feature"
  ) {
    throw new Error("Each input item must be a GeoJSON Feature")
  }
  return value as GeoJsonFeature
}

export async function* streamHazardFeatures(
  filePath: string,
  format: HazardImportInputFormat,
): AsyncGenerator<GeoJsonFeature> {
  if (format === "geojson") {
    const raw = await readFile(filePath, "utf8")
    const collection = JSON.parse(raw) as FeatureCollection
    if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
      throw new Error("GeoJSON FeatureCollection is required")
    }
    for (const feature of collection.features) yield assertFeature(feature)
    return
  }

  const lines = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
  })
  for await (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    const parsed = JSON.parse(trimmed) as GeoJsonFeature | FeatureCollection
    if (parsed.type === "FeatureCollection") {
      if (!Array.isArray(parsed.features)) {
        throw new Error("FeatureCollection features must be an array")
      }
      for (const feature of parsed.features) yield assertFeature(feature)
    } else {
      yield assertFeature(parsed)
    }
  }
}

function pickNumber(properties: FeatureProperties, keys: string[]): number | null {
  for (const key of keys) {
    const value = properties[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

export function depthRangeToRiskLevel(
  depthMinMeters: number | null,
  depthMaxMeters: number | null,
): number {
  if (depthMinMeters !== null && depthMinMeters >= 10) return 5
  if (depthMaxMeters !== null) {
    if (depthMaxMeters <= 0.5) return 1
    if (depthMaxMeters <= 3) return 2
    if (depthMaxMeters <= 5) return 3
    if (depthMaxMeters <= 10) return 4
    return 5
  }
  if (depthMinMeters !== null && depthMinMeters >= 5) return 4
  if (depthMinMeters !== null && depthMinMeters >= 3) return 3
  if (depthMinMeters !== null && depthMinMeters >= 0.5) return 2
  if (depthMinMeters !== null) return 1
  return 3
}

function pickRiskLevel(
  properties: FeatureProperties,
  depthMinMeters: number | null,
  depthMaxMeters: number | null,
): number {
  for (const key of ["risk_level", "riskLevel", "level", "rank"]) {
    const value = properties[key]
    if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5) {
      return value
    }
  }
  return depthRangeToRiskLevel(depthMinMeters, depthMaxMeters)
}

function pickAreaContext(
  properties: FeatureProperties,
  fallback: HazardAreaContext,
): HazardAreaContext {
  const value = properties.area_context
  if (isHazardAreaContext(value)) {
    return value
  }
  return fallback
}

function toMultiPolygon(geometry: GeoJSON.Geometry): GeoJSON.MultiPolygon | null {
  if (geometry.type === "MultiPolygon") return geometry
  if (geometry.type === "Polygon") {
    return { type: "MultiPolygon", coordinates: [geometry.coordinates] }
  }
  return null
}

type Bounds = {
  minLongitude: number
  minLatitude: number
  maxLongitude: number
  maxLatitude: number
}

function extendBounds(bounds: Bounds | null, value: unknown): Bounds | null {
  if (!Array.isArray(value)) return bounds
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    const longitude = value[0]
    const latitude = value[1]
    if (bounds === null) {
      return {
        minLongitude: longitude,
        minLatitude: latitude,
        maxLongitude: longitude,
        maxLatitude: latitude,
      }
    }
    return {
      minLongitude: Math.min(bounds.minLongitude, longitude),
      minLatitude: Math.min(bounds.minLatitude, latitude),
      maxLongitude: Math.max(bounds.maxLongitude, longitude),
      maxLatitude: Math.max(bounds.maxLatitude, latitude),
    }
  }
  return value.reduce<Bounds | null>(extendBounds, bounds)
}

function envelope(bounds: Bounds): GeoJSON.MultiPolygon {
  const { minLongitude, minLatitude, maxLongitude, maxLatitude } = bounds
  return {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [minLongitude, minLatitude],
          [maxLongitude, minLatitude],
          [maxLongitude, maxLatitude],
          [minLongitude, maxLatitude],
          [minLongitude, minLatitude],
        ],
      ],
    ],
  }
}

type RunHazardZoneImportInput = {
  args: HazardImportArgs
  features: AsyncIterable<GeoJsonFeature>
}

const MAX_GEOJSON_ROW_BYTES = 1_500_000
const turfOps = turf as unknown as {
  simplify(
    feature: GeoJSON.Feature<GeoJSON.Polygon>,
    options: { tolerance: number; highQuality: boolean; mutate: boolean },
  ): GeoJSON.Feature<GeoJSON.Polygon>
}

function polygonBounds(polygon: GeoJSON.Polygon): Bounds {
  const bounds = extendBounds(null, polygon.coordinates)
  if (!bounds) throw new Error('Polygon has no finite coordinates')
  return bounds
}

function fitPolygonToD1(polygon: GeoJSON.Polygon): GeoJSON.Polygon {
  let candidate = polygon
  if (Buffer.byteLength(JSON.stringify(candidate), 'utf8') <= MAX_GEOJSON_ROW_BYTES) return candidate
  for (const tolerance of [0.00001, 0.00005, 0.0001, 0.0005, 0.001]) {
    const simplified = turfOps.simplify(
      { type: 'Feature', properties: {}, geometry: candidate },
      { tolerance, highQuality: true, mutate: false },
    ).geometry
    if (simplified.type !== 'Polygon') throw new Error('Hazard polygon simplification changed geometry type')
    candidate = simplified
    if (Buffer.byteLength(JSON.stringify(candidate), 'utf8') <= MAX_GEOJSON_ROW_BYTES) return candidate
  }
  throw new Error(`Hazard polygon exceeds the D1 row safety limit (${MAX_GEOJSON_ROW_BYTES} bytes)`)
}

export async function runHazardZoneImport(
  sink: HazardZoneImportSink,
  input: RunHazardZoneImportInput,
): Promise<{ importedFeatures: number }> {
  const { args } = input
  await sink.deleteExisting({
    hazardType: args.hazardType,
    sourceLayer: args.sourceLayer,
    regionLabel: args.regionLabel,
  })

  let importedFeatures = 0
  let bounds: Bounds | null = null
  let batch: D1HazardZoneRow[] = []

  const flush = async () => {
    if (batch.length === 0) return
    const payload = batch
    batch = []
    await sink.insertZones(payload)
  }

  let featureIndex = 0
  for await (const feature of input.features) {
    if (!feature.geometry) continue
    const geometry = toMultiPolygon(feature.geometry)
    if (!geometry) continue

    const properties = feature.properties ?? {}
    const depthMinMeters = pickNumber(properties, [
      "depth_min_m",
      "depthMinMeters",
      "min_depth",
    ])
    const depthMaxMeters = pickNumber(properties, [
      "depth_max_m",
      "depthMaxMeters",
      "max_depth",
    ])
    const zoneGroupId = `${args.sourceLayer}:${args.regionLabel}:${featureIndex}`
    featureIndex += 1
    for (const coordinates of geometry.coordinates) {
      const polygon = fitPolygonToD1({ type: 'Polygon', coordinates })
      const polygonBbox = polygonBounds(polygon)
      bounds = extendBounds(bounds, polygon.coordinates)
      batch.push({
        id: crypto.randomUUID(),
        zone_group_id: zoneGroupId,
        hazard_type: args.hazardType,
        source_layer: args.sourceLayer,
        risk_level: pickRiskLevel(properties, depthMinMeters, depthMaxMeters),
        depth_min_m: depthMinMeters,
        depth_max_m: depthMaxMeters,
        area_context: pickAreaContext(properties, args.defaultAreaContext),
        properties: { ...properties, region_label: args.regionLabel, source: args.source },
        geojson: polygon,
        bbox_min_lng: polygonBbox.minLongitude,
        bbox_min_lat: polygonBbox.minLatitude,
        bbox_max_lng: polygonBbox.maxLongitude,
        bbox_max_lat: polygonBbox.maxLatitude,
      })
      importedFeatures += 1
      if (batch.length >= args.batchSize) await flush()
    }
  }
  await flush()

  if (importedFeatures === 0 || bounds === null) {
    throw new Error("No importable Polygon or MultiPolygon features found")
  }

  const coverageMultiPolygon = envelope(bounds)
  const coveragePolygon: GeoJSON.Polygon = {
    type: 'Polygon', coordinates: coverageMultiPolygon.coordinates[0],
  }
  await sink.replaceCoverage({
    id: crypto.randomUUID(),
    coverage_group_id: `${args.hazardType}:${args.regionLabel}:${args.sourceLayer}`,
    hazard_type: args.hazardType,
    region_label: args.regionLabel,
    source: args.source,
    source_layer: args.sourceLayer,
    geojson: coveragePolygon,
    bbox_min_lng: bounds.minLongitude,
    bbox_min_lat: bounds.minLatitude,
    bbox_max_lng: bounds.maxLongitude,
    bbox_max_lat: bounds.maxLatitude,
    imported_features: importedFeatures,
    imported_at: new Date().toISOString(),
  })

  return { importedFeatures }
}
