import type { MultiPolygon, Polygon } from 'geojson'
import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from './common'

export const hazardZones = sqliteTable('hazard_zones', {
  id: text('id').primaryKey(),
  zoneGroupId: text('zone_group_id').notNull(),
  hazardType: text('hazard_type').notNull(),
  sourceLayer: text('source_layer').notNull(),
  riskLevel: integer('risk_level').notNull(),
  depthMinM: real('depth_min_m'),
  depthMaxM: real('depth_max_m'),
  areaContext: text('area_context').notNull(),
  properties: text('properties', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  geojson: text('geojson', { mode: 'json' }).$type<Polygon>().notNull(),
  bboxMinLng: real('bbox_min_lng').notNull(),
  bboxMinLat: real('bbox_min_lat').notNull(),
  bboxMaxLng: real('bbox_max_lng').notNull(),
  bboxMaxLat: real('bbox_max_lat').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_hazard_zones_lookup').on(table.hazardType, table.riskLevel, table.areaContext),
  index('idx_hazard_zones_bbox').on(table.hazardType, table.bboxMinLng, table.bboxMaxLng),
  index('idx_hazard_zones_group').on(table.zoneGroupId),
  check('hazard_zone_type', sql`${table.hazardType} in ('flood','tsunami')`),
  check('hazard_zone_risk', sql`${table.riskLevel} between 1 and 5`),
  check('hazard_zone_area', sql`${table.areaContext} in ('residential-school-route','riverside','coastal')`),
  check('hazard_zone_json', sql`json_valid(${table.properties}) and json_valid(${table.geojson})`),
  check('hazard_zone_bbox_order', sql`${table.bboxMinLng} <= ${table.bboxMaxLng} and ${table.bboxMinLat} <= ${table.bboxMaxLat}`),
])

export const hazardZoneCoverage = sqliteTable('hazard_zone_coverage', {
  id: text('id').primaryKey(),
  coverageGroupId: text('coverage_group_id').notNull(),
  hazardType: text('hazard_type').notNull(),
  regionLabel: text('region_label').notNull(),
  source: text('source').notNull(),
  sourceLayer: text('source_layer').notNull(),
  geojson: text('geojson', { mode: 'json' }).$type<Polygon | MultiPolygon>().notNull(),
  bboxMinLng: real('bbox_min_lng').notNull(),
  bboxMinLat: real('bbox_min_lat').notNull(),
  bboxMaxLng: real('bbox_max_lng').notNull(),
  bboxMaxLat: real('bbox_max_lat').notNull(),
  importedFeatures: integer('imported_features').notNull(),
  importedAt: text('imported_at').notNull(),
}, (table) => [
  uniqueIndex('uq_hazard_coverage_source').on(table.hazardType, table.regionLabel, table.sourceLayer),
  index('idx_hazard_coverage_bbox').on(table.hazardType, table.bboxMinLng, table.bboxMaxLng),
  index('idx_hazard_coverage_group').on(table.coverageGroupId),
  check('hazard_coverage_type', sql`${table.hazardType} in ('flood','tsunami')`),
  check('hazard_coverage_imported', sql`${table.importedFeatures} >= 0`),
  check('hazard_coverage_json', sql`json_valid(${table.geojson})`),
])

export const hazardImageCache = sqliteTable('hazard_image_cache', {
  id: text('id').primaryKey(),
  hazardType: text('hazard_type').notNull(),
  riskLevel: integer('risk_level').notNull(),
  areaContext: text('area_context').notNull(),
  scenarioKey: text('scenario_key').notNull(),
  provider: text('provider').notNull().default('gemini'),
  depthLabel: text('depth_label').notNull(),
  promptEn: text('prompt_en').notNull(),
  promptSignature: text('prompt_signature').notNull(),
  objectKey: text('object_key').notNull(),
  status: text('status').notNull().default('ready'),
  generatedAt: text('generated_at').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('uq_hazard_image_cache_lookup').on(
    table.hazardType,
    table.riskLevel,
    table.areaContext,
    table.scenarioKey,
    table.provider,
    table.promptSignature,
  ),
  check('hazard_cache_type', sql`${table.hazardType} in ('flood','tsunami')`),
  check('hazard_cache_risk', sql`${table.riskLevel} between 1 and 5`),
])

export const imageGenerationGateLog = sqliteTable('image_generation_gate_log', {
  id: text('id').primaryKey(),
  route: text('route').notNull(),
  mode: text('mode').notNull(),
  situation: text('situation'),
  verdict: text('verdict').notNull(),
  zoneId: text('zone_id'),
  latRounded: real('lat_rounded'),
  lngRounded: real('lng_rounded'),
  userId: text('user_id'),
  latencyMs: integer('latency_ms'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_image_gate_created').on(table.createdAt),
  check('image_gate_route', sql`${table.route} in ('hazard-image','generate-image','generate-prompts')`),
  check('image_gate_mode', sql`${table.mode} in ('log','enforce')`),
  check('image_gate_verdict', sql`${table.verdict} in ('inside','outside','no_coverage','unavailable')`),
  check('image_gate_latency', sql`${table.latencyMs} is null or ${table.latencyMs} >= 0`),
])
