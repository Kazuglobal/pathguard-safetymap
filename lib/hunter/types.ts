// =============================================
// きけんハンター ドメイン型 (Phase 0)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md §6.3
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"

/** 相対座標の矩形 (0..1)。端末サイズ非依存。 */
export interface HunterRegion {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** きけんハンターの危険ポイント (内部表現)。DetectionItem.positions[] を flatten した1件。 */
export interface HunterHazard {
  /** 決定的な安定ID: `${photoSessionId}-${detIndex}-${posIndex}` */
  readonly id: string
  /** 危険の種類 (日本語ラベル) */
  readonly type: string
  /** 当たり判定の領域 (相対座標) */
  readonly region: HunterRegion
  readonly severity: RiskSeverity
  /** なぜ気をつけるか (やさしい日本語) */
  readonly kidExplanation: string
  /** どうすれば安全か (やさしい日本語) */
  readonly safeAction: string
  readonly confidence: number
}

/** Phase 0 は explore のみ。quiz は Phase 2。 */
export type HunterMode = "explore" | "quiz"

export type HunterAnalysisPurpose = "hunter-explore"

/** ユーザーのタップ (相対座標) */
export interface HunterTap {
  readonly x: number
  readonly y: number
}

export type HunterTapResult = "hit" | "near" | "miss"

export interface HunterTapOutcome {
  readonly result: HunterTapResult
  /** hit/near のとき該当 hazard。miss は null。 */
  readonly hazardId: string | null
  readonly points: number
}

/** UI「気をつけるカード」と AI 注入の素になる事故サマリ。 */
export interface HunterAccidentSummary {
  readonly hasData: boolean
  readonly riskScore: number
  readonly riskLevel: string
  readonly riskLabel: string
  readonly riskEmoji: string
  readonly totalAccidents: number
  readonly childInvolved: number
  readonly topAccidentType: string | null
  readonly peakTimeSlot: string | null
  /** 子ども向けのやさしい一文 (断定しない) */
  readonly kidMessage: string
}

/** ピン座標 (照会入力)。スカラーは個別名で持つ。 */
export interface HunterPin {
  readonly latitude: number
  readonly longitude: number
}

// =============================================
// AIクイズモード (Phase 2 / 設計書 モードB)
// =============================================

/** place=写真上の場所をタップ / choice=4択 */
export type HunterQuizKind = "place" | "choice"

export interface HunterQuizChoice {
  readonly id: string
  readonly label: string
}

export interface HunterQuizItem {
  readonly id: string
  readonly kind: HunterQuizKind
  /** 出題テーマ（事故タイプ等）。無い場合 null */
  readonly theme: string | null
  readonly question: string
  /** place: 正解の危険ポイント */
  readonly answerHazardId?: string
  readonly answerRegion?: HunterRegion
  /** choice: 選択肢と正解ID */
  readonly choices?: readonly HunterQuizChoice[]
  readonly correctChoiceId?: string
  /** 解説（やさしい学び＋事故のリアリティ一言） */
  readonly explanation: string
}

export interface HunterQuizAnswer {
  readonly itemId: string
  readonly tap?: HunterTap
  readonly choiceId?: string
}

export interface HunterQuizOutcome {
  readonly itemId: string
  readonly correct: boolean
  readonly points: number
}

export interface HunterQuizResult {
  readonly score: number
  readonly correct: number
  readonly total: number
  readonly outcomes: readonly HunterQuizOutcome[]
}
