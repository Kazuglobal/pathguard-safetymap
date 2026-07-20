// =============================================
// きけんハンター 危険ポイントのサニタイズ&選別 (純粋ロジック)
// 生AIの危険ポイントを、タップ採点に使える HunterHazard[] へ落とす。
// 「的外れな正解」を構造的に排除するための後処理が核心:
//  - 面積フィルタ(全画面/極小を除外)
//  - IoU 重複統合(同じ場所の重複を1つに)
//  - severity×confidence ランキング + 件数 cap
//  - 最小サイズへ中心膨張(寛容な当たり判定の土台)
//  - 語彙正規化 / 英語・空文言を検証済み子ども文へ置換
// React/IO/副作用なし。イミュータブル。
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"
import type { HunterHazard, HunterRegion, HunterSafePoint } from "@/lib/hunter/types"
import type { RawAiQuiz, RawDangerPoint, RawSafePoint } from "@/lib/hunter/ai-schema"
import {
  KID_COPY_BY_KIND,
  KID_LABEL_BY_KIND,
  KID_QUIZ_FALLBACK_BY_KIND,
  SAFE_POINT_FALLBACK,
  SEVERITY_BY_KIND,
  type HunterDangerKind,
} from "@/lib/hunter/kid-copy"
import { kidAccidentLabel } from "@/lib/hunter/accident-context"

/** 表示・採点対象とする最低 confidence。 */
export const DISPLAY_CONF_MIN = 0.45
/** confidence 欠落時の既定値。 */
export const DEFAULT_CONFIDENCE = 0.6
/** これより大きい面積は、無関係な場所まで正解にするため採点対象にしない。 */
export const MAX_AREA = 0.22
/**
 * 安全ポイント専用の面積上限。安全ポイントは採点対象でなく誤正解の害がない一方、
 * ガードレール・歩道・横断歩道は本質的に横長で MAX_AREA を超えやすい。
 * 危険ポイントと同じ上限で落とすと「あんぜん さがし」モード自体が消えるため、別枠にする。
 */
export const MAX_SAFE_AREA = 0.55
/** これより小さい面積(極小)は誤検出として除外。 */
export const MIN_AREA = 0.004
/** IoU がこれを超える重複は統合する。 */
export const IOU_DEDUP = 0.5
/** 当たり判定を寛容にするための最小辺(中心膨張)。 */
export const MIN_REGION = 0.12
/** 1枚あたりの危険ポイント上限(低学年の集中時間に配慮)。 */
export const MAX_HAZARDS = 5
/** 逆モードで提示する安全ポイントの上限。 */
export const MAX_SAFE_POINTS = 3

const WEIGHT_BY_SEVERITY: Record<RiskSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export interface SanitizeOptions {
  readonly sessionId: string
}

export interface SanitizeResult {
  /** タップ採点対象の危険ポイント(0..MAX_HAZARDS件)。 */
  readonly hazards: HunterHazard[]
  /** materials[i] は hazards[i] のクイズ素材(place→choice フォールバック保証)。 */
  readonly materials: RawAiQuiz[]
}

interface Candidate {
  readonly kind: HunterDangerKind
  readonly region: HunterRegion
  readonly severity: RiskSeverity
  readonly confidence: number
  readonly rank: number
  readonly whyDangerous: string
  readonly safeAction: string
  readonly accidentLink: string | null
  readonly quiz: RawAiQuiz
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

/** region を単位矩形に収める(x,y を 0..1、w,h を残り幅に clamp)。 */
function clampRegion(r: { x: number; y: number; w: number; h: number }): HunterRegion {
  const x = clamp01(r.x)
  const y = clamp01(r.y)
  const w = Math.max(0, Math.min(r.w, 1 - x))
  const h = Math.max(0, Math.min(r.h, 1 - y))
  return { x, y, w, h }
}

/** region を最小辺まで中心膨張し、単位矩形へ収める。 */
function expandToMin(r: HunterRegion, min: number): HunterRegion {
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  const w = Math.min(1, Math.max(r.w, min))
  const h = Math.min(1, Math.max(r.h, min))
  const x = Math.max(0, Math.min(cx - w / 2, 1 - w))
  const y = Math.max(0, Math.min(cy - h / 2, 1 - h))
  return { x, y, w, h }
}

function iou(a: HunterRegion, b: HunterRegion): number {
  const ix = Math.max(a.x, b.x)
  const iy = Math.max(a.y, b.y)
  const ax2 = Math.min(a.x + a.w, b.x + b.w)
  const ay2 = Math.min(a.y + a.h, b.y + b.h)
  const iw = Math.max(0, ax2 - ix)
  const ih = Math.max(0, ay2 - iy)
  const inter = iw * ih
  const union = a.w * a.h + b.w * b.h - inter
  return union > 0 ? inter / union : 0
}

/** 空・英語混入・非文字列の文言は kind 既定文へ置換する(英語ラベルを画面に出さない)。 */
function safeCopy(text: unknown, fallback: string): string {
  if (typeof text !== "string") return fallback
  const trimmed = text.trim()
  if (trimmed.length === 0) return fallback
  if (/[A-Za-z]/.test(trimmed)) return fallback
  return trimmed
}

/** 空文字・空白のみ・英語混入・非文字列を弾く(quiz 素材の各フィールド用)。 */
function isCleanKidText(text: unknown): text is string {
  if (typeof text !== "string") return false
  const trimmed = text.trim()
  if (trimmed.length === 0) return false
  if (/[A-Za-z]/.test(trimmed)) return false
  return true
}

/**
 * quiz 素材(question/choices/explanation)を検証する。
 * whyDangerous/safeAction/accidentLink と同じ「生AI文言を子どもへ出さない」境界だが、
 * quiz は question・choices(正解=index0)・explanation の対応関係が崩れると
 * 誤った正解を教えてしまうため、1フィールドでも不正なら quiz 全体を
 * kind 既定のフォールバックへ丸ごと差し替える(部分置換はしない)。
 * quiz 自体が欠落(undefined)・非配列 choices でも、点を落とさず kind 既定へ倒す。
 */
function safeQuiz(quiz: RawAiQuiz | undefined, kind: HunterDangerKind): RawAiQuiz {
  const fallback = KID_QUIZ_FALLBACK_BY_KIND[kind]
  if (
    !quiz ||
    !Array.isArray(quiz.choices) ||
    quiz.choices.length < 2 ||
    !isCleanKidText(quiz.question) ||
    !isCleanKidText(quiz.explanation) ||
    !quiz.choices.every((choice) => isCleanKidText(choice))
  ) {
    return { question: fallback.question, choices: [...fallback.choices], explanation: fallback.explanation }
  }
  return {
    question: quiz.question.trim(),
    choices: quiz.choices.map((choice) => choice.trim()),
    explanation: quiz.explanation.trim(),
  }
}

/**
 * 生の危険ポイント配列を、採点可能な HunterHazard[] と並走するクイズ素材へ変換する。
 */
export function sanitizeDangerPoints(
  raw: readonly RawDangerPoint[],
  options: SanitizeOptions,
): SanitizeResult {
  // 1) 正規化(clamp/conf/severity/rank/文言) → 2) 面積&信頼度フィルタ
  const candidates: Candidate[] = []
  for (const point of raw) {
    const kind = point.kind
    const region = clampRegion(point.region)
    const area = region.w * region.h
    if (area < MIN_AREA || area > MAX_AREA) continue

    const confidence = clamp01(
      typeof point.confidence === "number" ? point.confidence : DEFAULT_CONFIDENCE,
    )
    if (confidence < DISPLAY_CONF_MIN) continue

    const severity: RiskSeverity = point.severity ?? SEVERITY_BY_KIND[kind]
    const defaults = KID_COPY_BY_KIND[kind]
    candidates.push({
      kind,
      region,
      severity,
      confidence,
      rank: WEIGHT_BY_SEVERITY[severity] * confidence,
      whyDangerous: safeCopy(point.whyDangerous, defaults.whyDangerous),
      safeAction: safeCopy(point.safeAction, defaults.safeAction),
      // whyDangerous/safeAction と同じ「生AI文言を子どもへ出さない」境界に合わせ、
      // accidentLink も検証済みの子ども向け語彙(kidAccidentLabel)へ通してから保持する。
      // 未知語は generic な「交通事故」に丸められ、生の英語・専門語が漏れることはない。
      accidentLink:
        typeof point.accidentLink === "string" && point.accidentLink.trim().length > 0
          ? kidAccidentLabel(point.accidentLink.trim())
          : null,
      // whyDangerous/safeAction/accidentLink と同じ境界: quiz の生AI文言
      // (question/choices/explanation)も検証済みの kind 既定文へ丸ごと差し替え得る。
      quiz: safeQuiz(point.quiz, kind),
    })
  }

  // 3) rank 降順 → 4) IoU 重複統合(高 rank を優先採用)
  const ranked = candidates.slice().sort((a, b) => b.rank - a.rank)
  const kept: Candidate[] = []
  for (const cand of ranked) {
    const dup = kept.some((k) => iou(k.region, cand.region) > IOU_DEDUP)
    if (!dup) kept.push(cand)
    if (kept.length >= MAX_HAZARDS) break
  }

  // 5) 最小サイズ膨張 + 安定ID + 素材並走
  const hazards: HunterHazard[] = []
  const materials: RawAiQuiz[] = []
  kept.forEach((cand, i) => {
    hazards.push({
      id: `${options.sessionId}-${i}`,
      kind: cand.kind,
      type: KID_LABEL_BY_KIND[cand.kind],
      region: expandToMin(cand.region, MIN_REGION),
      severity: cand.severity,
      kidExplanation: cand.whyDangerous,
      safeAction: cand.safeAction,
      confidence: cand.confidence,
      accidentLink: cand.accidentLink,
    })
    materials.push(cand.quiz)
  })

  return { hazards, materials }
}

/**
 * 安全ポイント(逆モード)をサニタイズする。
 * - region 必須・最小サイズ膨張は危険ポイントと共通。面積上限のみ MAX_SAFE_AREA(横長対応)。
 * - 英語/空のラベル・説明は検証済みフォールバックへ置換。
 * - 件数は MAX_SAFE_POINTS で打ち切り。
 */
export function sanitizeSafePoints(
  raw: readonly RawSafePoint[],
  options: SanitizeOptions,
): HunterSafePoint[] {
  const out: HunterSafePoint[] = []
  for (const point of raw) {
    if (!point.region) continue
    const region = clampRegion(point.region)
    const area = region.w * region.h
    if (area < MIN_AREA || area > MAX_SAFE_AREA) continue

    out.push({
      id: `${options.sessionId}-safe-${out.length}`,
      type: safeCopy(point.kidType, SAFE_POINT_FALLBACK.type),
      region: expandToMin(region, MIN_REGION),
      kind: point.kind,
      whyGood: safeCopy(point.whyGood, SAFE_POINT_FALLBACK.whyGood),
    })
    if (out.length >= MAX_SAFE_POINTS) break
  }
  return out
}
