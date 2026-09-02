import { NextRequest, NextResponse } from "next/server"

import { getActor } from "@/lib/auth/actor"
import { getServiceActor } from "@/lib/auth/service-actor"
import { toDangerReportJson } from "@/lib/danger-report-api"
import { getDangerReportById } from "@/lib/db/repos/danger-reports.repo"
import { recordSafetyQuestAttemptAndAward } from "@/lib/db/repos/gamification.repo"
import {
  buildSafetyQuestChallengesFromReports,
  findSampleSafetyQuestChallenge,
  parseSafetyQuestMarkers,
  scoreSafetyQuestAttempt,
  type SafetyQuestAttemptMode,
  type SafetyQuestChallenge,
  type SafetyQuestReportRow,
} from "@/lib/safety-quest"
import { checkApiRateLimit, rateLimitedResponse } from "@/lib/upstash-rate-limiter"

export const runtime = "nodejs"

const VALID_MODES = new Set<SafetyQuestAttemptMode>(["hazard", "quiz-battle", "private-practice"])

async function loadReportChallenge(actor: Awaited<ReturnType<typeof getActor>>, challengeId: string): Promise<SafetyQuestChallenge | null> {
  if (!challengeId.startsWith("report-")) return null
  const reportId = challengeId.slice("report-".length)
  const report = await getDangerReportById(actor, reportId)
  if (!report || !["approved", "published", "resolved"].includes(report.status)) return null
  return buildSafetyQuestChallengesFromReports([toDangerReportJson(report) as SafetyQuestReportRow])[0] ?? null
}

async function persistAttempt({
  actor,
  challengeId,
  mode,
  userMarkers,
  answerPayload,
  result,
  durationMs,
}: {
  actor: Extract<Awaited<ReturnType<typeof getActor>>, { kind: "user" }>
  challengeId: string
  mode: SafetyQuestAttemptMode
  userMarkers: unknown
  answerPayload: unknown
  result: ReturnType<typeof scoreSafetyQuestAttempt>
  durationMs: number | null
}) {
  return recordSafetyQuestAttemptAndAward(actor, getServiceActor(), {
    challengeId,
    mode,
    userMarkers: userMarkers as unknown[],
    answerPayload: answerPayload && typeof answerPayload === "object" ? answerPayload as Record<string, unknown> : null,
    score: result.score,
    accuracy: result.accuracy,
    durationMs,
    pointsAwarded: result.pointsAwarded,
  })
}

export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== "user") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }
  const rate = await checkApiRateLimit(`safety-quest-attempt:${actor.id}`)
  if (!rate.success) return rateLimitedResponse(rate.reset)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "リクエストJSONが正しくありません" }, { status: 400 })
  }

  const challengeId = typeof body.challengeId === "string" ? body.challengeId : ""
  const mode = typeof body.mode === "string" && VALID_MODES.has(body.mode as SafetyQuestAttemptMode)
    ? body.mode as SafetyQuestAttemptMode
    : null
  const userMarkers = parseSafetyQuestMarkers(body.userMarkers)

  if (!challengeId || !mode || !userMarkers) {
    return NextResponse.json({ error: "チャレンジID、モード、マーカーが必要です" }, { status: 400 })
  }

  const challenge = findSampleSafetyQuestChallenge(challengeId) ?? await loadReportChallenge(actor, challengeId)
  if (!challenge) {
    return NextResponse.json({ error: "チャレンジが見つかりません" }, { status: 404 })
  }

  const durationMs = Number.isFinite(Number(body.durationMs)) ? Number(body.durationMs) : null
  const answerPayload = body.answerPayload && typeof body.answerPayload === "object"
    ? body.answerPayload as { answer?: string; correct?: boolean }
    : null
  const result = scoreSafetyQuestAttempt({
    challenge,
    mode,
    userMarkers,
    answerPayload,
    durationMs,
  })

  let awardedPoints: number
  try {
    const saved = await persistAttempt({ actor, challengeId, mode, userMarkers, answerPayload, result, durationMs })
    awardedPoints = saved.pointsAwarded
  } catch (error) {
    console.error("Safety Quest attempt persistence failed", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "結果の保存に失敗しました" }, { status: 500 })
  }

  const persistedResult = awardedPoints === result.pointsAwarded
    ? result
    : { ...result, pointsAwarded: awardedPoints, rewardKeys: [] }

  return NextResponse.json({
    result: persistedResult,
    next: {
      rewardsUnlocked: persistedResult.rewardKeys,
      dailyMissionDelta: {
        hazardFinds: result.matches,
        quizCorrect: answerPayload?.correct === true || answerPayload?.answer === "danger" ? 1 : 0,
        clearedStages: result.score >= 60 ? 1 : 0,
      },
    },
  })
}
