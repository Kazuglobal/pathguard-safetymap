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
  created_at: string | null
  updated_at: string | null
}

export interface FilterOptions {
  dangerType: string
  dangerLevel: string
  dateRange: string
}
