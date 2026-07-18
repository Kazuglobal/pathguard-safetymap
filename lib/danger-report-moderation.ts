// 危険箇所レポート AI一次審査の決定論的ヒューリスティック核。
// AIはこの判定を厳しくする方向にだけ作用し、本モジュール単独では公開へ昇格しない。

export type DangerModerationStatus =
  | "approved"
  | "needs_review"
  | "escalated"

export interface DangerModerationInput {
  title: string
  description: string | null
  dangerType: string
  dangerLevel: number
  latitude: number
  longitude: number
  geocodeConfidence: number | null
  prefecture: string | null
  city: string | null
  hasImage: boolean
  recentReportsByUserLastHour: number
  nearbyDuplicateCount: number
  userRejectedCountLast30d: number
}

export interface DangerModerationVerdict {
  status: DangerModerationStatus
  reason: string
  /** リスクスコア 0（低リスク）〜1（高リスク）。 */
  score: number
  /** Geminiのテキスト審査が成功した場合のみtrue。 */
  aiExecuted: boolean
}

export interface DangerModerationUpdate {
  status?: "approved"
  ai_moderation_status: DangerModerationStatus
  ai_moderation_reason: string
  ai_moderation_score: number
  ai_moderation_checked_at: string
}

const JAPAN_MIN_LATITUDE = 20
const JAPAN_MAX_LATITUDE = 46
const JAPAN_MIN_LONGITUDE = 122
const JAPAN_MAX_LONGITUDE = 154

const PHONE_REGEX = /0\d{1,4}[-(\s]?\d{1,4}[-)\s]?\d{3,4}/
const LONG_DIGITS_REGEX = /\d{7,}/
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s]+/gi
const REPEATED_CHARACTER_REGEX = /(.)\1{9,}/u

const ABUSIVE_TERMS = [
  "犯人",
  "逮捕",
  "殺",
  "死ね",
  "ぶっ",
  "あいつ",
  "通報しろ",
  "晒",
  "クズ",
  "気持ち悪",
  "バカ",
  "馬鹿",
  "消えろ",
] as const

const STATUS_RANK: Record<DangerModerationStatus, number> = {
  approved: 0,
  needs_review: 1,
  escalated: 2,
}

function needsReview(reason: string, score: number): DangerModerationVerdict {
  return {
    status: "needs_review",
    reason,
    score,
    aiExecuted: false,
  }
}

function isWithinJapanBoundingBox(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= JAPAN_MIN_LATITUDE &&
    latitude <= JAPAN_MAX_LATITUDE &&
    longitude >= JAPAN_MIN_LONGITUDE &&
    longitude <= JAPAN_MAX_LONGITUDE
  )
}

/**
 * H1〜H10を順に評価し、最初に一致した安全側の下限判定を返す。
 */
export function moderateDangerReport(
  input: DangerModerationInput,
): DangerModerationVerdict {
  const text = `${input.title ?? ""}\n${input.description ?? ""}`.trim()

  if (!isWithinJapanBoundingBox(input.latitude, input.longitude)) {
    return needsReview(
      "座標が日本国内の想定範囲外、または不正なため位置確認が必要です。",
      0.65,
    )
  }

  if (
    input.geocodeConfidence !== null &&
    (!Number.isFinite(input.geocodeConfidence) ||
      input.geocodeConfidence < 0.3)
  ) {
    return needsReview(
      "位置情報のジオコード信頼度が低いため確認が必要です。",
      0.55,
    )
  }

  if (input.hasImage) {
    return needsReview(
      "画像添付のため、顔・ナンバー・表札などの写り込み確認が必要です。",
      0.5,
    )
  }

  if (PHONE_REGEX.test(text) || LONG_DIGITS_REGEX.test(text)) {
    return needsReview(
      "電話番号や個人を特定し得る数字が含まれている可能性があります。",
      0.7,
    )
  }

  if (ABUSIVE_TERMS.some((term) => text.includes(term))) {
    return needsReview(
      "断定的な犯人扱い・誹謗中傷の可能性がある表現が含まれています。",
      0.8,
    )
  }

  const urlCount = text.match(URL_REGEX)?.length ?? 0
  if (urlCount >= 2 || REPEATED_CHARACTER_REGEX.test(text)) {
    return needsReview(
      "複数URLまたは同一文字の過度な繰り返しを検出したため、スパム確認が必要です。",
      0.65,
    )
  }

  if (input.recentReportsByUserLastHour >= 5) {
    return needsReview(
      "同一投稿者から短時間に多数の報告があるため確認が必要です。",
      0.65,
    )
  }

  if (input.nearbyDuplicateCount >= 1) {
    return needsReview(
      "同一投稿者による近隣の重複報告である可能性があります。",
      0.6,
    )
  }

  if (input.userRejectedCountLast30d >= 3) {
    return needsReview(
      "直近の却下履歴が複数あるため、人間による内容確認が必要です。",
      0.65,
    )
  }

  return {
    status: "approved",
    reason: "自動保留条件を検出しませんでした。",
    score: 0.1,
    aiExecuted: false,
  }
}

/** 2つの判定のうち厳しい方を返す。 */
export function stricterStatus(
  a: DangerModerationStatus,
  b: DangerModerationStatus,
): DangerModerationStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b
}

/**
 * danger_reports更新ペイロードを作る。
 * AIが実行され、最終判定がapprovedの場合に限って公開へ昇格する。
 */
export function buildDangerModerationUpdate(
  verdict: DangerModerationVerdict,
  checkedAtIso: string,
): DangerModerationUpdate {
  const update: DangerModerationUpdate = {
    ai_moderation_status: verdict.status,
    ai_moderation_reason: verdict.reason,
    ai_moderation_score: verdict.score,
    ai_moderation_checked_at: checkedAtIso,
  }

  if (verdict.status === "approved" && verdict.aiExecuted) {
    update.status = "approved"
  }

  return update
}
