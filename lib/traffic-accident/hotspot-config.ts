// =============================================
// 事故多発地点の判定条件（警察庁「事故多発地点解析ツール」の距離グループ集計と同じ考え方）
//
// 半径 HOTSPOT_RADIUS_METERS 以内に、直近 HOTSPOT_YEARS 年で HOTSPOT_MIN_COUNT 件以上の事故がある地点。
// 条件や年を変えたら dataset_version が変わり、D1 の accident_hotspots は新しい版を入れ直す。
// =============================================

import { ACCIDENT_DATA_MAX_YEAR } from '@/lib/accident-stats-year-window'

export const HOTSPOT_RADIUS_METERS = 30
export const HOTSPOT_MIN_COUNT = 5
export const HOTSPOT_YEARS = 5
export const HOTSPOT_MAX_YEAR = ACCIDENT_DATA_MAX_YEAR
export const HOTSPOT_MIN_YEAR = HOTSPOT_MAX_YEAR - HOTSPOT_YEARS + 1

/** D1 accident_hotspots.dataset_version。アプリはこの版だけを読む。 */
export const HOTSPOT_DATASET_VERSION =
  `${HOTSPOT_MIN_YEAR}-${HOTSPOT_MAX_YEAR}_r${HOTSPOT_RADIUS_METERS}_n${HOTSPOT_MIN_COUNT}`

/** 出典表示（警察庁オープンデータの利用条件）。 */
export const HOTSPOT_ATTRIBUTION = '警察庁「交通事故統計情報のオープンデータ」を加工して作成'
