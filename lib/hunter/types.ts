// =============================================
// きけんハンター ドメイン型 (Phase 0)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md §6.3
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"
import type { HunterDangerKind } from "@/lib/hunter/kid-copy"

export type { HunterDangerKind }

/** 相対座標の矩形 (0..1)。端末サイズ非依存。 */
export interface HunterRegion {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** タップとhazardの距離を表す3段階(ヒント用)。 */
export type HunterTemperature = "hot" | "warm" | "cold"

/** 最近傍hazardへの大まかな方向(ヒント用)。 */
export type HunterDirection = "up" | "down" | "left" | "right"

/** 解析が通常成立(explore)したか、フォールバックのガイドモードか。 */
export type HunterAnalysisMode = "explore" | "guide"

/** ガイドモードへ落ちた理由。観測性・コピー分岐に使う。 */
export type HunterFallbackReason = "empty" | "ai_error" | "parse_error" | "unusable"

/** 段階ヒントのレベル。0=非表示 / 1=温度+方向 / 2=ゾーン発光 / 3=薄枠開示。 */
export type HunterHintLevel = 0 | 1 | 2 | 3

/** きけんハンターの危険ポイント (内部表現)。専用ハンターAIが返す危険ポイント1件。 */
export interface HunterHazard {
  /** 決定的な安定ID: `${sessionId}-${index}` */
  readonly id: string
  /** 危険の種類 (子ども向けの具体ラベル) */
  readonly type: string
  /** 当たり判定の領域 (相対座標) */
  readonly region: HunterRegion
  readonly severity: RiskSeverity
  /** なぜ立ち止まるか (この写真固有・やさしい日本語) */
  readonly kidExplanation: string
  /** どうすれば安全か (やさしい日本語) */
  readonly safeAction: string
  readonly confidence: number
  /** 危険の種類(英語enum・ロジック用)。後方互換のため任意。 */
  readonly kind?: HunterDangerKind
  /** 近隣の多い事故タイプとの関連(やさしいラベル)。無ければ null。任意。 */
  readonly accidentLink?: string | null
}

/** 安全の工夫(ガードレール・歩道・ミラー等)の地点。逆モード(安全さがし)用。 */
export interface HunterSafePoint {
  readonly id: string
  /** 子ども向けの種類ラベル(例: ガードレール) */
  readonly type: string
  readonly region: HunterRegion
  readonly kind?: HunterDangerKind
  /** なぜ安全か(やさしい日本語) */
  readonly whyGood: string
}

/** explore=探索 / quiz=クイズ / guide=ガイド(フォールバック)。 */
export type HunterMode = "explore" | "quiz" | "guide"

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
  /** 最近傍の未発見 hazard ID。ヒント用。全発見後は null。任意(後方互換)。 */
  readonly nearestId?: string | null
  /** 最近傍 hazard までの温度感(あったかい/つめたい)。任意。 */
  readonly temperature?: HunterTemperature
  /** 最近傍 hazard への大まかな方向。任意。 */
  readonly direction?: HunterDirection | null
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
  /** 件数降順の事故タイプ(最大3件)。プロンプトの統合事故ブロックが使用。省略時は topAccidentType のみ使う。 */
  readonly topAccidentTypes?: readonly string[]
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
  /** 近隣の多い事故タイプとの関連(やさしいラベル)。無ければ null。任意。 */
  readonly accidentLink?: string | null
}

/**
 * 専用ハンターAI(analyzeHunterImage)の戻り値。
 * route がこれに sessionId/accident/analysisTimestamp/保存系を合成して応答する。
 */
export interface HunterAnalyzeResult {
  readonly mode: HunterAnalysisMode
  readonly hazards: readonly HunterHazard[]
  readonly quiz: readonly HunterQuizItem[]
  /** 安全の工夫(逆モード「安全さがし」用)。無ければ空。 */
  readonly safePoints: readonly HunterSafePoint[]
  /** ガイドモード等の肯定フォロー文。explore では null。 */
  readonly noHazardFollow: string | null
  readonly usedFallback: boolean
  readonly fallbackReason: HunterFallbackReason | null
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
