// =============================================
// 地図の縮尺ごとに、どの事故多発地点を出すか（純粋関数）
//
// 引いた地図で件数の少ない地点まで全部出すと、数字のない丸が道沿いに並ぶだけで
// どこが本当に危ないか読み取れない（2026-10-08 ユーザー指摘）。
// 引いた縮尺では件数の多い地点だけを数字つきで出し、拡大するにつれて全部を出す。
// =============================================

import { HOTSPOT_MIN_COUNT } from './hotspot-config'

/** 丸の中に件数を出し始める縮尺。取得を始める縮尺（ズーム10）と同じにする。 */
export const HOTSPOT_LABEL_MIN_ZOOM = 10

/** この縮尺より引いているときは、minCount 件以上の地点だけを出す（引いた順に並べる）。 */
const ZOOM_TIERS: ReadonlyArray<{ belowZoom: number; minCount: number }> = [
  { belowZoom: 11, minCount: 20 },
  // 密集地（東京23区など）はズーム12でも丸で埋まるので、全件はズーム13から（2026-10-08）
  { belowZoom: 13, minCount: 10 },
]

/** 縮尺に応じて、地図に出す多発地点の最小件数を返す。 */
export function hotspotMinCountForZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return HOTSPOT_MIN_COUNT
  const tier = ZOOM_TIERS.find((item) => zoom < item.belowZoom)
  return Math.max(tier?.minCount ?? HOTSPOT_MIN_COUNT, HOTSPOT_MIN_COUNT)
}

/** Mapbox のレイヤーに付ける絞り込み条件（件数が minCount 以上）。 */
export function hotspotVisibilityFilter(minCount: number): ['>=', ['get', 'accidentCount'], number] {
  return ['>=', ['get', 'accidentCount'], minCount]
}
