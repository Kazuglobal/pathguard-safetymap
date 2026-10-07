// =============================================
// 事故多発地点の表示（文言・色・GeoJSON）を一か所にまとめる純粋関数
// 地図ポップアップ・通学路一覧・事故統計パネル・AI への注入文で同じ言い方を使う。
// =============================================

import { tankenTokens } from '@/lib/design/tanken'

import { dominantAccidentClass, type AccidentHotspotSummary } from './hotspot-types'

/** 件数の段階（地図の色・大きさ）。 */
export type HotspotTier = 'high' | 'medium' | 'low'

export const HOTSPOT_TIER_THRESHOLDS = { high: 20, medium: 10 } as const

export function hotspotTier(accidentCount: number): HotspotTier {
  if (accidentCount >= HOTSPOT_TIER_THRESHOLDS.high) return 'high'
  if (accidentCount >= HOTSPOT_TIER_THRESHOLDS.medium) return 'medium'
  return 'low'
}

export const HOTSPOT_TIER_COLORS: Record<HotspotTier, string> = {
  high: tankenTokens.color.danger,
  medium: tankenTokens.color.accentStrong,
  low: tankenTokens.color.accent,
}

/** 「2021〜2025年に半径30m以内で12件」 */
export function hotspotHeadline(spot: Pick<AccidentHotspotSummary, 'minYear' | 'maxYear' | 'radiusMeters' | 'accidentCount'>): string {
  return `${spot.minYear}〜${spot.maxYear}年に半径${spot.radiusMeters}m以内で${spot.accidentCount}件`
}

/** 「うち死亡1件・歩行者2件」。該当が無ければ null。 */
export function hotspotBreakdown(spot: Pick<AccidentHotspotSummary, 'fatalCount' | 'pedestrianCount' | 'youngCount'>): string | null {
  const parts: string[] = []
  if (spot.fatalCount > 0) parts.push(`死亡${spot.fatalCount}件`)
  if (spot.pedestrianCount > 0) parts.push(`歩行者${spot.pedestrianCount}件`)
  if (spot.youngCount > 0) parts.push(`24歳以下が関わる${spot.youngCount}件`)
  return parts.length > 0 ? `うち${parts.join('・')}` : null
}

export function hotspotPeakHourLabel(peakHour: number | null): string | null {
  return peakHour == null ? null : `${peakHour}時台`
}

/** 年の古い順に件数を並べる（無い年は0件）。 */
export function hotspotYearSeries(spot: Pick<AccidentHotspotSummary, 'minYear' | 'maxYear' | 'byYear'>): Array<{ year: number; count: number }> {
  const series: Array<{ year: number; count: number }> = []
  for (let year = spot.minYear; year <= spot.maxYear; year += 1) {
    series.push({ year, count: spot.byYear[String(year)] ?? 0 })
  }
  return series
}

/** 一覧・注入文向けの1行要約。「全国12位・2021〜2025年に半径30m以内で40件（主に車両相互）」 */
export function hotspotOneLine(spot: AccidentHotspotSummary): string {
  const main = dominantAccidentClass(spot.byClass)
  return `全国${spot.nationalRank}位・${hotspotHeadline(spot)}${main ? `（主に${main}）` : ''}`
}

export interface HotspotFeatureProperties {
  id: number
  accidentCount: number
  tier: HotspotTier
  color: string
}

export function hotspotsToGeoJSON(
  hotspots: readonly AccidentHotspotSummary[],
): GeoJSON.FeatureCollection<GeoJSON.Point, HotspotFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: hotspots.map((spot) => {
      const tier = hotspotTier(spot.accidentCount)
      return {
        type: 'Feature',
        id: spot.id,
        geometry: { type: 'Point', coordinates: [spot.longitude, spot.latitude] },
        properties: { id: spot.id, accidentCount: spot.accidentCount, tier, color: HOTSPOT_TIER_COLORS[tier] },
      }
    }),
  }
}

/**
 * AI への注入文用の1文。データにある数値だけを使う（件数・距離を作らない）。
 * 例: 「半径300m以内に事故多発地点が2か所（最大: 半径30m以内で12件・主に車両相互・85m先）」
 */
export function hotspotPromptLine(
  hotspots: readonly AccidentHotspotSummary[] | null | undefined,
  searchRadiusMeters: number | null | undefined,
  /** 半径内の総数（hotspots が上位だけのとき）。無ければ hotspots の件数を使う。 */
  total?: number | null,
): string | null {
  const valid = (hotspots ?? []).filter((spot) => Number.isSafeInteger(spot.accidentCount) && spot.accidentCount > 0)
  if (valid.length === 0) return null
  const top = valid.reduce((best, spot) => (spot.accidentCount > best.accidentCount ? spot : best))
  const details = [
    `半径${top.radiusMeters}m以内で${top.accidentCount}件`,
    dominantAccidentClass(top.byClass) ? `主に${dominantAccidentClass(top.byClass)}` : null,
    top.distanceMeters != null ? `${top.distanceMeters}m先` : null,
  ].filter((part): part is string => part !== null)
  const where = Number.isFinite(searchRadiusMeters) && searchRadiusMeters > 0 ? `半径${searchRadiusMeters}m以内に` : '近くに'
  const count = Number.isSafeInteger(total) && (total as number) > valid.length ? (total as number) : valid.length
  return `${where}事故多発地点が${count}か所（最大: ${details.join('・')}）`
}
