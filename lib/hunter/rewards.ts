// =============================================
// きけんハンター 報酬・記録の契約 (純粋ロジック)
// session の再採点結果を、既存のゲーミフィケーション契約
// (safety_quest_attempts + user_points + missions) へ載せるための変換。
// - ポイントは「その日その遊びかたで最初の 1 回だけ +5pt」(部分ユニーク索引
//   uq_safety_quest_daily_award がサーバ側で二重付与を遮断する)。
// - guide モード(total 0)は記録しない = 偽クレジット禁止。
// =============================================

import type { HunterTap } from "@/lib/hunter/types"

/** 1 プレイの基本ポイント(app/leaderboard の「写真ゲーム +5pt」と一致させる)。 */
export const HUNTER_PLAY_POINTS = 5
/** hazard_game_high_score ミッションの達成ライン(正規化スコア %)。 */
export const HUNTER_HIGH_SCORE_ACCURACY = 80
/** safety_quest_attempts.mode の CHECK 制約に収まる値。自分の写真 = private の意味。 */
export const HUNTER_ATTEMPT_MODE = "private-practice" as const
export const MISSION_TARGET_PLAY = "hazard_game_play"
export const MISSION_TARGET_HIGH_SCORE = "hazard_game_high_score"
export const HUNTER_CHALLENGE_PREFIX = "hunter-"

export type HunterPlayMode = "explore" | "quiz"

export interface HunterPlaySummary {
  readonly mode: HunterPlayMode
  /** explore=みつけた数 / quiz=正解数 */
  readonly matches: number
  /** explore=危険ポイント数 / quiz=出題数 */
  readonly total: number
  /** サーバ再採点の生スコア(コンボ込み・上限なし)。表示用。 */
  readonly rawScore: number
  readonly comboMax: number
  readonly sessionId: string | null
  /** 所有者検証済みの写真ID(保存していなければ null)。 */
  readonly photoId: string | null
  readonly foundIds?: readonly string[]
  readonly taps?: readonly HunterTap[]
  /** quiz: 回答した数(未回答で けっかを みる を区別するため)。 */
  readonly answered?: number
}

export interface HunterAttemptInput {
  challengeId: string
  mode: typeof HUNTER_ATTEMPT_MODE
  userMarkers: unknown[]
  answerPayload: Record<string, unknown>
  /** 0..100 に正規化(CHECK 制約)。 */
  score: number
  accuracy: number
  durationMs: null
  pointsAwarded: number
}

/** 結果画面/API 応答で共有する「達成したミッション」の形。 */
export interface HunterMissionReward {
  readonly title: string
  readonly rewardPoints: number
}

function hunterChallengeId(mode: HunterPlayMode): string {
  return `${HUNTER_CHALLENGE_PREFIX}${mode}`
}

/** みつけた/正解の割合を 0..100 の整数へ。total 0 は 0。 */
export function normalizedAccuracy(matches: number, total: number): number {
  if (!Number.isFinite(matches) || !Number.isFinite(total) || total <= 0) return 0
  const clamped = Math.max(0, Math.min(matches, total))
  return Math.max(0, Math.min(100, Math.round((clamped / total) * 100)))
}

/**
 * 再採点結果 → safety_quest_attempts 行。guide(total 0)は null(記録しない)。
 * ポイントは 1 つでも みつけた/正解したときだけ。0 のときは attempts 行だけ残る(回数の記録)。
 */
export function buildHunterAttempt(summary: HunterPlaySummary): HunterAttemptInput | null {
  if (summary.total <= 0) return null
  const accuracy = normalizedAccuracy(summary.matches, summary.total)
  return {
    challengeId: hunterChallengeId(summary.mode),
    mode: HUNTER_ATTEMPT_MODE,
    userMarkers: (summary.taps ?? []).map((tap) => ({ x: tap.x, y: tap.y })),
    answerPayload: {
      source: "hunter",
      mode: summary.mode,
      sessionId: summary.sessionId,
      photoId: summary.photoId,
      rawScore: summary.rawScore,
      comboMax: summary.comboMax,
      matches: summary.matches,
      total: summary.total,
      foundIds: [...(summary.foundIds ?? [])],
    },
    score: accuracy,
    accuracy,
    durationMs: null,
    pointsAwarded: summary.matches > 0 ? HUNTER_PLAY_POINTS : 0,
  }
}

/**
 * 進めるミッション種別。
 * - 「プレイ」は実際に手を動かした(タップ/回答が 1 つ以上ある)ときだけ進める。
 *   タップ 0 回で「けっかを みる」を連打して回数ミッションを積めないようにする。
 * - 「高スコア」はライン以上のときだけ(= みつけた/正解が前提)。
 */
export function missionTargetsFor(accuracy: number, attempted: boolean): string[] {
  const targets: string[] = []
  if (attempted) targets.push(MISSION_TARGET_PLAY)
  if (accuracy >= HUNTER_HIGH_SCORE_ACCURACY) targets.push(MISSION_TARGET_HIGH_SCORE)
  return targets
}

/** タップ/回答を 1 つでも送ったか(ミッション「プレイ」のゲート)。 */
export function wasAttempted(summary: Pick<HunterPlaySummary, "taps" | "answered">): boolean {
  return (summary.taps?.length ?? 0) > 0 || (summary.answered ?? 0) > 0
}

export interface HunterPhotoPlays {
  /** この写真で遊んだ回数(explore/quiz 合算)。 */
  readonly count: number
  /** いちばん多く みつけた回の みつけた数 / 全体数(explore のみ)。無ければ null。 */
  readonly bestFound: number | null
  readonly bestTotal: number | null
  readonly lastPlayedAt: string | null
}

interface AttemptLike {
  readonly answerPayload: Record<string, unknown> | null
  readonly createdAt: string
}

/**
 * attempts(新しい順)を photoId ごとに集計する。answerPayload が壊れている行は無視。
 */
export function summarizeHunterPlays(attempts: readonly AttemptLike[]): Map<string, HunterPhotoPlays> {
  const byPhoto = new Map<string, HunterPhotoPlays>()
  for (const attempt of attempts) {
    const payload = attempt.answerPayload
    if (!payload || payload.source !== "hunter" || typeof payload.photoId !== "string") continue
    const photoId = payload.photoId
    const prev = byPhoto.get(photoId) ?? { count: 0, bestFound: null, bestTotal: null, lastPlayedAt: null }
    const isExplore = payload.mode === "explore"
    const matches = typeof payload.matches === "number" ? payload.matches : null
    const total = typeof payload.total === "number" ? payload.total : null
    const better =
      isExplore && matches !== null && total !== null && (prev.bestFound === null || matches > prev.bestFound)
    byPhoto.set(photoId, {
      count: prev.count + 1,
      bestFound: better ? matches : prev.bestFound,
      bestTotal: better ? total : prev.bestTotal,
      lastPlayedAt: prev.lastPlayedAt ?? attempt.createdAt,
    })
  }
  return byPhoto
}
