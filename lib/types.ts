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
}

export interface FilterOptions {
  dangerType: string
  dangerLevel: string
  dateRange: string
}
