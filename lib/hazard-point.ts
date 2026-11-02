import sourceManifest from './hazard-source-manifest.json'
import type { HazardType } from '@/lib/types'

export type HazardPointState = 'inside' | 'outside' | 'no_coverage' | 'unavailable'
export interface HazardDepth {
  zoneId: string
  depthMinMeters: number | null
  depthMaxMeters: number | null
  sourceLayer: string
}
export interface HazardPointRisk {
  kind: HazardPointState
  confirmed?: boolean
  zone?: HazardDepth
  sources: Array<{ region: string; name: string; url: string | null; dataYear: number | null; importedAt: string | null }>
}
export interface HazardPointResult {
  point: { latitude: number; longitude: number }
  hazards: Record<HazardType, HazardPointRisk>
}

export function hazardDepthLabel(zone: Pick<HazardDepth, 'depthMinMeters' | 'depthMaxMeters'>): string {
  const min = zone.depthMinMeters
  const max = zone.depthMaxMeters
  if (min !== null && max !== null) return `${min.toFixed(1)}〜${max.toFixed(1)}m`
  if (min !== null) return `${min.toFixed(1)}m以上`
  if (max !== null) return `${max.toFixed(1)}m以下`
  return '深さ情報なし'
}

export function hazardStatusLabel(kind: HazardPointState): string {
  return { inside: '浸水想定区域内', outside: '想定区域外', no_coverage: '未収録', unavailable: '取得不能' }[kind]
}

export const HAZARD_LEARNING_NOTICE = '浸水想定を理解するためのイメージです。実際の水位・到達時間・流れではありません。'
/** 説明をたたんだときの短い表記。限界の要点は落とさない。 */
export const HAZARD_LEARNING_NOTICE_SHORT = '実際の水位・到達時間・流れではありません。'
export const HAZARD_OUTSIDE_NOTICE = '区域外であることは安全を保証するものではありません。'
/** カメラ映像に水面を重ねるときの限界。再生前と表示中の両方に出す。 */
export const HAZARD_WATER_SCENE_NOTICE = '仮定した平面に水面を重ねた学習イメージです。実際の道路・建物の浸水位置を示すものではありません。'
/** 説明をたたんだときの短い表記。仮定した平面であることと、現地の浸水位置ではないことは残す。 */
export const HAZARD_WATER_SCENE_NOTICE_SHORT = '仮定した平面の学習イメージです。実際の浸水位置ではありません。'
/** 画面の名称。現地の再現精度を約束する文言は使わない。 */
export const HAZARD_LEARNING_TITLE = '浸水深の学習イメージ'

/** Only identify source metadata which we actually inspected, never infer publication dates. */
export function hazardSourceMetadata(layer: string) {
  return sourceManifest[layer as keyof typeof sourceManifest] ?? { region: '地域不明', name: layer, dataYear: null, url: null }
}
