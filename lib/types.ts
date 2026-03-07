import type { Database } from "./database.types"

export interface DangerReport {
  id: string
  user_id: string
  title: string
  description: string | null
  latitude: number
  longitude: number
  danger_type: string
  danger_level: number
  status: string
  image_url: string | null
  processed_image_url: string | null
  processed_image_urls: string[] | null
  prefecture: string | null
  prefecture_code: number | null
  city: string | null
  municipality_code: string | null
  town: string | null
  postal_code: string | null
  geocode_source: Database["public"]["Enums"]["geocode_provider"] | null
  geocoded_at: string | null
  geocode_confidence: number | null
  address_hash: string | null
  created_at: string | null
  updated_at: string | null
  learning_summary?: string | null
  learning_checkpoints?: string[] | null
  attention_tags?: string[] | null
}

export interface FilterOptions {
  dangerType: string
  dangerLevel: string
  dateRange: string
}

/**
 * User Route Types - Phase 2.1: School Route Management
 */
export interface UserRoute {
  id: string
  user_id: string
  name: string
  description: string | null
  start_lat: number
  start_lng: number
  end_lat: number
  end_lng: number
  start_address: string
  end_address: string
  route_geometry: GeoJSON.LineString | null
  distance_meters: number | null
  estimated_time_minutes: number | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface CreateRouteInput {
  name: string
  description?: string
  start_lat: number
  start_lng: number
  end_lat: number
  end_lng: number
  start_address: string
  end_address: string
  route_geometry?: GeoJSON.LineString
}

export interface UpdateRouteInput {
  name?: string
  description?: string
  start_lat?: number
  start_lng?: number
  end_lat?: number
  end_lng?: number
  start_address?: string
  end_address?: string
  route_geometry?: GeoJSON.LineString
  is_favorite?: boolean
}

/**
 * Route Danger Report Types
 */
export interface RouteDangerReport {
  route: UserRoute
  dangers: DangerReport[]
  bufferMeters: number
  generatedAt: string
  summary: RouteDangerSummary
  selectedImageUrls?: Record<string, string>
}

export interface RouteDangerSummary {
  totalDangers: number
  byType: Record<string, number>
  byLevel: Record<number, number>
}

export type ReportExportFormat = 'pdf' | 'png' | 'jpeg'

export type HazardType = "flood" | "tsunami"

export type HazardAreaContext =
  | "residential-school-route"
  | "riverside"
  | "coastal"

export interface HazardScenarioOption {
  key: string
  label: string
  description: string
  hazardTypes: HazardType[]
  allowedAreaContexts: HazardAreaContext[]
}

export interface RouteHazardMarker {
  id: string
  route_id?: string
  hazard_type: HazardType
  source_layer?: string | null
  risk_level: number
  depth_min_m: number | null
  depth_max_m: number | null
  depth_label: string
  area_context: HazardAreaContext
  area_label: string
  title: string
  summary: string
  explanation: string
  evacuation_points: string[]
  coordinates: [number, number]
  scenario_options: HazardScenarioOption[]
  scenario_key: string
}

export interface HazardImageResult {
  imageUrl: string
  prompt: string
  cached: boolean
  generatedAt: string
  scenarioKey: string
}
