// =============================================
// きけんハンター こたえあわせ (純粋ロジック)
// 遊んだあと、写真の上で 1 つずつ見せるための並びと状態、ズームの計算。
// たんけん(危険)と あんぜん さがし(安全の工夫)で同じ画面を使うため、表示用の形へそろえる。
//  - 並び = AI の優先度順(sanitize が並べた順)。番号は 1 から。
//  - 状態 = understood(理由まで)/ found(場所だけ)/ missed(見のがし)。
//  - ズーム = 選んだものが画面の真ん中に来るよう拡大・移動。写真の外の余白は見せない。
// React/IO/副作用なし。
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"
import { anchorOf } from "@/lib/hunter/hit-zone"
import { KID_REASON_BY_KIND } from "@/lib/hunter/kid-copy"
import { KID_SAFE_REASON_BY_KIND } from "@/lib/hunter/safe-kinds"
import type {
  HunterDiscovery,
  HunterHazard,
  HunterParentNote,
  HunterPoint,
  HunterRegion,
  HunterSafePoint,
} from "@/lib/hunter/types"

export type RevealStatus = "understood" | "found" | "missed"

export interface RevealItem {
  /** 1 から始まる番号(写真のマーカーとカードで共通)。 */
  readonly number: number
  readonly id: string
  /** 種類のことば(例: 見通しの悪い角 / ガードレール)。 */
  readonly title: string
  /** 写真の上で見せる範囲(表示用の枠)。 */
  readonly region: HunterRegion
  /** マーカーを置く点(focus、無ければ当たり枠の中心)。 */
  readonly anchor: HunterPoint
  readonly status: RevealStatus
  /** 「どうして あぶない？/あんしん？」の答え。理由を問わないものは null。 */
  readonly reason: string | null
  /** この写真での説明(なぜ危ない / なぜ安全)。 */
  readonly detail: string
  /** つぎに すること(危険だけ)。 */
  readonly action: string | null
  /** 危険の度合い(危険だけ・おうちの人むけ)。 */
  readonly severity: RiskSeverity | null
  readonly accidentLink: string | null
  /** おうちの人むけの根拠(検証済み)。無ければ null。 */
  readonly evidence: string | null
}

export interface RevealCounts {
  readonly understood: number
  readonly found: number
  readonly missed: number
}

function statusOf(id: string, byId: ReadonlyMap<string, HunterDiscovery>): RevealStatus {
  const discovery = byId.get(id)
  if (!discovery) return "missed"
  return discovery.understood ? "understood" : "found"
}

/** たんけん(危険)のこたえあわせ。 */
export function buildRevealItems(
  hazards: readonly HunterHazard[],
  discoveries: readonly HunterDiscovery[],
  notes: readonly HunterParentNote[] = [],
): RevealItem[] {
  const byId = new Map(discoveries.map((d) => [d.hazardId, d]))
  const noteById = new Map(notes.map((n) => [n.hazardId, n.evidence]))
  return hazards.map((hazard, i) => ({
    number: i + 1,
    id: hazard.id,
    title: hazard.type,
    region: hazard.region,
    anchor: anchorOf(hazard),
    status: statusOf(hazard.id, byId),
    reason: hazard.kind ? KID_REASON_BY_KIND[hazard.kind] : null,
    detail: hazard.kidExplanation,
    action: hazard.safeAction || null,
    severity: hazard.severity,
    accidentLink: hazard.accidentLink ?? null,
    evidence: noteById.get(hazard.id) ?? null,
  }))
}

/** あんぜん さがし(安全の工夫)のこたえあわせ。 */
export function buildSafeRevealItems(
  points: readonly HunterSafePoint[],
  discoveries: readonly HunterDiscovery[],
): RevealItem[] {
  const byId = new Map(discoveries.map((d) => [d.hazardId, d]))
  return points.map((point, i) => ({
    number: i + 1,
    id: point.id,
    title: point.type,
    region: point.region,
    anchor: anchorOf(point),
    status: statusOf(point.id, byId),
    reason: point.safeKind ? KID_SAFE_REASON_BY_KIND[point.safeKind] : null,
    detail: point.whyGood,
    action: null,
    severity: null,
    accidentLink: null,
    evidence: null,
  }))
}

export function countReveal(items: readonly RevealItem[]): RevealCounts {
  return {
    understood: items.filter((i) => i.status === "understood").length,
    found: items.filter((i) => i.status === "found").length,
    missed: items.filter((i) => i.status === "missed").length,
  }
}

export interface FocusTransform {
  readonly scale: number
  /** 写真の層の大きさに対する移動量(0..-(scale-1))。transform-origin は左上。 */
  readonly tx: number
  readonly ty: number
}

export const REVEAL_MAX_SCALE = 2.4
/** 範囲のまわりに残す余白の倍率。 */
const FOCUS_PADDING = 1.8

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

/**
 * 選んだ範囲を真ん中に寄せる拡大・移動。null なら全体(拡大なし)。
 * 点 p は画面上で tx + scale·p に来る。写真の外が見えないよう tx は [1-scale, 0] に収める。
 */
export function focusTransform(region: HunterRegion | null, maxScale: number = REVEAL_MAX_SCALE): FocusTransform {
  if (!region || region.w <= 0 || region.h <= 0) return { scale: 1, tx: 0, ty: 0 }
  const scale = clamp(Math.min(1 / (region.w * FOCUS_PADDING), 1 / (region.h * FOCUS_PADDING)), 1, maxScale)
  const cx = region.x + region.w / 2
  const cy = region.y + region.h / 2
  return {
    scale,
    tx: clamp(0.5 - scale * cx, 1 - scale, 0),
    ty: clamp(0.5 - scale * cy, 1 - scale, 0),
  }
}
