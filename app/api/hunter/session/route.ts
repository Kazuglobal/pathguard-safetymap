import { NextRequest, NextResponse } from "next/server"

import { getActor } from "@/lib/auth/actor"
import { getServiceActor } from "@/lib/auth/service-actor"
import {
  applyMissionProgress,
  recordSafetyQuestAttemptAndAward,
} from "@/lib/db/repos/gamification.repo"
import { getHunterPhoto } from "@/lib/db/repos/hunter.repo"
import { scoreSession } from "@/lib/hunter/scoring"
import { scoreQuiz } from "@/lib/hunter/quiz"
import {
  claimSessionScore,
  getAnswerKey,
  isAnswerCacheConfigured,
} from "@/lib/hunter/answer-cache"
import {
  buildHunterAttempt,
  missionTargetsFor,
  wasAttempted,
  type HunterMissionReward,
  type HunterPlaySummary,
} from "@/lib/hunter/rewards"
import { parseSessionBody } from "@/lib/hunter/validation"
import { checkApiRateLimit, rateLimitedResponse } from "@/lib/upstash-rate-limiter"
import type { HunterHazard, HunterQuizItem } from "@/lib/hunter/types"

export const runtime = "nodejs"

type UserActor = Extract<Awaited<ReturnType<typeof getActor>>, { kind: "user" }>

/**
 * 記録しなかった理由。
 * - no-server-key: サーバに正解鍵が無い(Upstash 未設定)。クライアント供給の定義だけでは
 *   永続ポイントを付けない(トラスト境界を弱めない)。採点結果は返す。
 * - already-scored: 同じ sessionId・同じ あそびかた は 1 回だけ記録する(再送で水増ししない)。
 * - guide: 危険 0 件(guide モード)は記録しない=偽クレジット禁止。
 */
type PersistSkip = "no-server-key" | "already-scored" | "guide"

interface PersistOutcome {
  pointsAwarded: number
  missionsCompleted: HunterMissionReward[]
  persistError: boolean
  persistSkipped: PersistSkip | null
}

function skipped(reason: PersistSkip): PersistOutcome {
  return { pointsAwarded: 0, missionsCompleted: [], persistError: false, persistSkipped: reason }
}

/**
 * 再採点結果を既存のゲーミフィケーション契約へ載せる。
 * - safety_quest_attempts + user_points: recordSafetyQuestAttemptAndAward(同日二重付与は索引が遮断)。
 * - missions: hazard_game_play(タップ/回答があったときだけ +1)/ hazard_game_high_score(80% 以上で +1)。
 * - どの永続化が失敗しても 200 を返す(ゲームを止めない)。persistError で正直に伝える。
 */
async function persistPlay(actor: UserActor, summary: HunterPlaySummary): Promise<PersistOutcome> {
  const attempt = buildHunterAttempt(summary)
  if (!attempt) return skipped("guide")
  const service = getServiceActor()
  let pointsAwarded = 0
  let persistError = false

  try {
    const saved = await recordSafetyQuestAttemptAndAward(actor, service, attempt)
    pointsAwarded = saved.pointsAwarded
  } catch (error) {
    console.error("hunter/session attempt persistence failed:", error instanceof Error ? error.message : "unknown")
    persistError = true
  }

  const missionsCompleted: HunterMissionReward[] = []
  for (const targetType of missionTargetsFor(attempt.accuracy, wasAttempted(summary))) {
    try {
      const result = await applyMissionProgress(actor, service, { targetType, increment: 1 })
      missionsCompleted.push(
        ...result.completed.map((mission) => ({ title: mission.title, rewardPoints: mission.rewardPoints })),
      )
    } catch (error) {
      console.error("hunter/session mission progress failed:", error instanceof Error ? error.message : "unknown")
      persistError = true
    }
  }

  return { pointsAwarded, missionsCompleted, persistError, persistSkipped: null }
}

/**
 * 記録してよいかのゲート: サーバ保持の正解鍵で採点したときだけ、同じ session/mode につき 1 回。
 */
async function persistIfAllowed(
  actor: UserActor,
  summary: HunterPlaySummary,
  serverKeyed: boolean,
): Promise<PersistOutcome> {
  if (!serverKeyed || !summary.sessionId) return skipped("no-server-key")
  if (summary.total <= 0) return skipped("guide")
  const first = await claimSessionScore(summary.sessionId, summary.mode)
  if (!first) return skipped("already-scored")
  return persistPlay(actor, summary)
}

/** photoId は所有者の写真であるときだけ結果に紐づける。他人/不明な ID は黙って無視。 */
async function resolveOwnedPhotoId(actor: UserActor, photoId: string | undefined): Promise<string | null> {
  if (!photoId) return null
  try {
    const photo = await getHunterPhoto(actor, photoId)
    return photo ? photo.id : null
  } catch {
    return null
  }
}

/**
 * POST /api/hunter/session — 探索/クイズのサーバ側再採点 + 記録・ポイント・ミッション
 *
 * - 認証必須、レート制限あり。
 * - クライアントの点数を信用せず、hazards と taps からサーバ側で権威的に再採点する。
 * - サーバ保持の正解鍵で採点したときだけ attempts/points/missions へ記録する。
 */
export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== "user") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`hunter-session:${actor.id}`)
  if (!rate.success) return rateLimitedResponse(rate.reset)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "リクエストJSONが正しくありません" }, { status: 400 })
  }

  const parsed = parseSessionBody(body)
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { mode, hazards = [], taps = [], items = [], answers = [], sessionId, photoId } = parsed.data

  // sessionId のサーバキャッシュ(正解鍵)があれば、それで採点する=改ざん耐性。
  // Upstash が「未設定」の環境のみ、クライアント供給の定義で採点する(Phase0 後方互換。ただし記録はしない)。
  // Upstash が設定済みなのにミス(sessionId 省略/期限切れ/改ざん)した場合は、
  // クライアント供給の定義をそのまま信用せず再試行を促す(トラスト境界を弱めない)。
  const cached = sessionId ? await getAnswerKey(sessionId) : null
  if (isAnswerCacheConfigured() && !cached) {
    return NextResponse.json(
      { error: "セッションの有効期限が切れました。もういちど はじめから ためしてね。", code: "session_expired" },
      { status: 409 },
    )
  }
  const serverKeyed = Boolean(cached)

  const ownedPhotoId = serverKeyed ? await resolveOwnedPhotoId(actor, photoId) : null

  if (mode === "quiz") {
    const scoringItems: HunterQuizItem[] =
      cached
        ? cached.quiz.map((q) => ({
            id: q.id,
            kind: q.kind,
            theme: null,
            question: "",
            explanation: "",
            correctChoiceId: q.correctChoiceId,
            answerRegion: q.answerRegion,
          }))
        : items

    const result = scoreQuiz(scoringItems, answers)
    const persisted = await persistIfAllowed(actor, {
      mode: "quiz",
      matches: result.correct,
      total: result.total,
      rawScore: result.score,
      comboMax: 0,
      sessionId: sessionId ?? null,
      photoId: ownedPhotoId,
      answered: answers.length,
    }, serverKeyed)
    return NextResponse.json({
      mode: "quiz",
      score: result.score,
      correct: result.correct,
      total: result.total,
      outcomes: result.outcomes,
      ...persisted,
    })
  }

  const scoringHazards: HunterHazard[] =
    cached
      ? cached.hazards.map((h) => ({
          id: h.id,
          type: "",
          region: h.region,
          severity: h.severity,
          kidExplanation: "",
          safeAction: "",
          confidence: h.confidence,
        }))
      : hazards

  const result = scoreSession(taps, scoringHazards)
  const foundIds = result.outcomes.flatMap((o) => (o.result === "hit" && o.hazardId ? [o.hazardId] : []))
  const persisted = await persistIfAllowed(actor, {
    mode: "explore",
    matches: result.matches,
    total: scoringHazards.length,
    rawScore: result.score,
    comboMax: result.comboMax,
    sessionId: sessionId ?? null,
    photoId: ownedPhotoId,
    foundIds,
    taps,
  }, serverKeyed)
  return NextResponse.json({
    mode: "explore",
    score: result.score,
    matches: result.matches,
    comboMax: result.comboMax,
    total: scoringHazards.length,
    outcomes: result.outcomes,
    ...persisted,
  })
}
