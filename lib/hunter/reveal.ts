// =============================================
// きけんハンター こたえあわせ (純粋ロジック)
// 遊んだあと、写真の上で危険を 1 つずつ見せるための並びと状態、ズームの計算。
//  - 並び = AI の優先度順(sanitize が severity×confidence で並べた hazards の順)。番号は 1 から。
//  - 状態 = understood(理由まで)/ found(場所だけ)/ missed(見のがし)。
//  - ズーム = 選んだ危険が画面の真ん中に来るよう拡大・移動。写真の外の余白は見せない。
// React/IO/副作用なし。
// =============================================

import { KID_REASON_BY_KIND } from "@/lib/hunter/kid-copy"
import type { HunterDiscovery, HunterHazard, HunterParentNote, HunterRegion } from "@/lib/hunter/types"

export type RevealStatus = "understood" | "found" | "missed"

export interface RevealItem {
  /** 1 から始まる番号(写真のマーカーとカードで共通)。 */
  readonly number: number
  readonly hazard: HunterHazard
  readonly status: RevealStatus
  /** 「どうして あぶない？」の答え。理由を問わない危険は null。 */
  readonly reason: string | null
  /** おうちの人むけの根拠(検証済み)。無ければ null。 */
  readonly evidence: string | null
}

export interface RevealCounts {
  readonly understood: number
  readonly found: number
  readonly missed: number
}

export function buildRevealItems(
  hazards: readonly HunterHazard[],
  discoveries: readonly HunterDiscovery[],
  notes: readonly HunterParentNote[] = [],
): RevealItem[] {
  const byId = new Map(discoveries.map((d) => [d.hazardId, d]))
  const noteById = new Map(notes.map((n) => [n.hazardId, n.evidence]))
  return hazards.map((hazard, i) => {
    const discovery = byId.get(hazard.id)
    const status: RevealStatus = !discovery ? "missed" : discovery.understood ? "understood" : "found"
    return {
      number: i + 1,
      hazard,
      status,
      reason: hazard.kind ? KID_REASON_BY_KIND[hazard.kind] : null,
      evidence: noteById.get(hazard.id) ?? null,
    }
  })
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
/** 危険の範囲のまわりに残す余白の倍率。 */
const FOCUS_PADDING = 1.8

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

/**
 * 選んだ危険の範囲を真ん中に寄せる拡大・移動。null なら全体(拡大なし)。
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
