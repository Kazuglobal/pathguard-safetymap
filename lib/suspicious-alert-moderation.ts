// =============================================
// 不審者アラート AI一次審査（決定論的ヒューリスティック核）
// 設計書: docs/plans/2026-06-28-suspicious-alert-map-visualization-plan.md §1.5
//
// 方針:
// - 低リスク（テキストのみ・個人情報/中傷なし）は approved に自動昇格。
// - 不確実・高リスクは needs_review に回し、自動公開しない。
// - 写真添付は本モジュールでは内容を検証できないため、安全側に needs_review とする
//   （顔/ナンバー/表札の写り込みリスクを自動公開しない）。
// - ここは純関数。実際のLLM/画像ビジョン審査は lib/suspicious-alert-moderation-ai.ts の
//   moderateSuspiciousAlertWithAi が担い、本モジュールはその「判定の下限」かつ
//   LLM呼び出し失敗時の安全側フォールバックとして機能する（AIは判定を厳しくする方向にのみ作用）。
// =============================================

export type ModerationStatus = "approved" | "needs_review" | "rejected"

export interface ModerationVerdict {
  status: ModerationStatus
  reason: string
  /** リスクスコア 0（低リスク）〜1（高リスク） */
  score: number
}

export interface ModerationInput {
  text?: string | null
  hasImage?: boolean
}

// 電話番号らしき並び（日本の固定/携帯）
const PHONE_REGEX = /0\d{1,4}[-(\s]?\d{1,4}[-)\s]?\d{3,4}/
// 7桁以上の連続数字（個人特定情報の可能性）
const LONG_DIGITS_REGEX = /\d{7,}/
// 断定的な犯人扱い・誹謗中傷・差別を示唆する語
const ABUSIVE_TERMS = [
  "犯人",
  "逮捕",
  "殺",
  "死ね",
  "ぶっ",
  "あいつ",
  "通報しろ",
  "晒",
  "晒す",
  "クズ",
  "気持ち悪",
]

/**
 * 不審者アラートの一次審査を行う。
 * - 写真添付あり → needs_review（写真内容を自動検証できないため安全側）。
 * - 電話番号/長い数字列 → needs_review（個人情報の可能性）。
 * - 断定的犯人扱い・中傷語 → needs_review。
 * - それ以外（テキストのみ・問題なし） → approved。
 */
export function moderateSuspiciousAlert(input: ModerationInput): ModerationVerdict {
  const text = (input.text ?? "").trim()

  if (input.hasImage) {
    return {
      status: "needs_review",
      reason: "写真添付のため内容確認が必要です（顔・ナンバー・表札の写り込み確認）。",
      score: 0.5,
    }
  }

  if (PHONE_REGEX.test(text) || LONG_DIGITS_REGEX.test(text)) {
    return {
      status: "needs_review",
      reason: "電話番号や個人を特定し得る数字が含まれている可能性があります。",
      score: 0.7,
    }
  }

  const matchedAbusive = ABUSIVE_TERMS.find((term) => text.includes(term))
  if (matchedAbusive) {
    return {
      status: "needs_review",
      reason: "断定的な犯人扱い・誹謗中傷の可能性がある表現が含まれています。",
      score: 0.8,
    }
  }

  return {
    status: "approved",
    reason: "個人情報・中傷を検出せず、低リスクと判定しました。",
    score: 0.1,
  }
}

/**
 * verdict から danger_reports に書き込む更新ペイロードを作る。
 * approved のときのみ status を 'approved' に昇格。それ以外は 'pending' のまま据え置く。
 * checkedAtIso は呼び出し側で `new Date().toISOString()` を渡す（純関数を保つため）。
 */
export function buildModerationUpdate(
  verdict: ModerationVerdict,
  checkedAtIso: string,
): {
  status?: string
  ai_moderation_status: string
  ai_moderation_reason: string
  ai_moderation_score: number
  ai_moderation_checked_at: string
} {
  const update = {
    ai_moderation_status: verdict.status,
    ai_moderation_reason: verdict.reason,
    ai_moderation_score: verdict.score,
    ai_moderation_checked_at: checkedAtIso,
  }
  if (verdict.status === "approved") {
    return { ...update, status: "approved" }
  }
  return update
}
