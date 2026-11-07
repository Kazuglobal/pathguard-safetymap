// こたえあわせ: 状態(わかった/みつけた/みのがし)の色とことば。写真のマーカーとカードで共通。
import type { RevealStatus } from "@/lib/hunter/reveal"
import type { RiskSeverity } from "@/lib/hazard-game-types"

import { tokens } from "../theme"

const C = tokens.color

export interface StatusStyle {
  /** チップ・読み上げのことば(責めない言い方)。 */
  readonly label: string
  readonly bg: string
  readonly fg: string
  /** 写真の上の枠の色。 */
  readonly line: string
}

export const STATUS_STYLE: Readonly<Record<RevealStatus, StatusStyle>> = {
  understood: { label: "わかった", bg: C.primary, fg: "#FFFFFF", line: C.primary },
  found: { label: "みつけた", bg: C.accent, fg: "#FFFFFF", line: C.accent },
  missed: { label: "つぎは みつけよう", bg: "#FFFFFF", fg: C.ink, line: C.sun },
}

/** おうちの人むけの危険の度合い。 */
export const SEVERITY_PARENT_LABEL: Readonly<Record<RiskSeverity, string>> = {
  high: "高い(まず気をつけたい場所)",
  medium: "中くらい",
  low: "低め",
}
