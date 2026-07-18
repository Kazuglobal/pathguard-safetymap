// 学校検索(Mapbox Search Box API)
//
// 学校名から POI を検索して座標を返す。地図が無い画面(ランディング/一覧)でも
// 使えるよう mapbox-gl には依存せず、環境変数のトークンを直接参照する。
// 学校カテゴリの定義は components/map/map-search.tsx と共有する。

export const SCHOOL_POI_CATEGORIES = [
  // 既存
  "school",
  "university",
  "college",
  "kindergarten",
  // 初等教育
  "elementary_school",
  "preschool",
  "nursery",
  "nursery_school",
  // 中等教育
  "middle_school",
  "junior_high_school",
  "secondary_school",
  "high_school",
  // 高等・専門教育
  "vocational_school",
  "technical_school",
  "trade_school",
  // 特殊教育
  "special_education_school",
] as const

export function matchesSchoolCategory(categories: readonly string[]): boolean {
  return categories.some((category) =>
    SCHOOL_POI_CATEGORIES.includes(category as (typeof SCHOOL_POI_CATEGORIES)[number]),
  )
}

// Mapbox のカテゴリ付与が無い学校 POI も拾えるよう、名称でも判定する
const SCHOOL_NAME_PATTERN = /学校|小学|中学|高校|高等|幼稚園|保育|学園|義務教育/

export interface SchoolSearchResult {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}

interface SearchBoxFeature {
  id?: string
  geometry?: { coordinates?: number[] }
  properties?: {
    name?: string
    full_address?: string
    mapbox_id?: string
    feature_type?: string
    poi_category?: string[] | string
  }
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.toLowerCase())
  }
  if (typeof value === "string" && value.length > 0) {
    return [value.toLowerCase()]
  }
  return []
}

function toSchoolResult(feature: SearchBoxFeature): SchoolSearchResult | null {
  const coordinates = feature.geometry?.coordinates
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    return null
  }

  const properties = feature.properties ?? {}
  const name = properties.name ?? ""
  const categories = toStringArray(properties.poi_category)
  if (!matchesSchoolCategory(categories) && !SCHOOL_NAME_PATTERN.test(name)) {
    return null
  }

  return {
    id: String(feature.id ?? properties.mapbox_id ?? `${coordinates[0]},${coordinates[1]}`),
    name: name || (properties.full_address ?? "名称不明の学校"),
    address: properties.full_address ?? "",
    longitude: coordinates[0],
    latitude: coordinates[1],
  }
}

export interface SearchSchoolsOptions {
  signal?: AbortSignal
  /** [lng, lat]。指定すると近い順に並びやすくなる */
  proximity?: [number, number]
}

/** 学校名で POI を検索する。トークン未設定・HTTP失敗時は throw */
export async function searchSchools(
  query: string,
  options: SearchSchoolsOptions = {},
): Promise<SchoolSearchResult[]> {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN が設定されていません")
  }

  const params = new URLSearchParams({
    q: query,
    access_token: accessToken,
    country: "JP",
    language: "ja",
    limit: "8",
    types: "poi",
  })
  if (options.proximity) {
    params.set("proximity", `${options.proximity[0]},${options.proximity[1]}`)
  }

  const response = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/forward?${params.toString()}`,
    { signal: options.signal },
  )
  if (!response.ok) {
    throw new Error(`学校検索リクエストに失敗しました: ${response.status}`)
  }

  const data: { features?: SearchBoxFeature[] } = await response.json()
  if (!Array.isArray(data.features)) {
    return []
  }

  return data.features
    .map(toSchoolResult)
    .filter((result): result is SchoolSearchResult => result !== null)
}
