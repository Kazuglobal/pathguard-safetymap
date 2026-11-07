// こたえあわせ: 状態(わかった/みつけた/みのがし)の色とことば。写真のマーカー・カード・凡例で共通。
// 文字は 4.5:1 以上のコントラストにする(白文字は primaryStrong だけ。オレンジ系は淡い地に墨文字)。
import type { RevealStatus } from "@/lib/hunter/reveal"
import type { RiskSeverity } from "@/lib/hazard-game-types"

import { tokens } from "../theme"

const C = tokens.color

export interface StatusStyle {
  /** チップ・読み上げのことば(責めない言い方)。 */
  readonly label: string
  /** チップ・マーカーの地と文字(4.5:1 以上)。 */
  readonly bg: string
  readonly fg: string
  /** チップ・マーカーのふち(色で区別する手がかり)。 */
  readonly border: string
  /** 写真の上の範囲の枠の色。 */
  readonly line: string
}

export const STATUS_STYLE: Readonly<Record<RevealStatus, StatusStyle>> = {
  understood: { label: "わかった", bg: C.primaryStrong, fg: "#FFFFFF", border: "#FFFFFF", line: C.primary },
  found: { label: "みつけた", bg: C.accentSoft, fg: C.ink, border: C.accent, line: C.accent },
  missed: { label: "つぎは みつけよう", bg: "#FFFFFF", fg: C.ink, border: C.sunDeep, line: C.sun },
}

/** おうちの人むけの危険の度合い。 */
export const SEVERITY_PARENT_LABEL: Readonly<Record<RiskSeverity, string>> = {
  high: "高い(まず気をつけたい場所)",
  medium: "中くらい",
  low: "低め",
}
