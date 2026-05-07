import { NextRequest, NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { createServerClient } from "@/lib/supabase-server"
import {
  buildSafetyQuestChallengesFromReports,
  findSampleSafetyQuestChallenge,
  parseSafetyQuestMarkers,
  scoreSafetyQuestAttempt,
  type SafetyQuestAttemptMode,
  type SafetyQuestChallenge,
  type SafetyQuestReportRow,
} from "@/lib/safety-quest"

export const runtime = "nodejs"

const VALID_MODES = new Set<SafetyQuestAttemptMode>(["hazard", "quiz-battle", "private-practice"])

async function loadReportChallenge(challengeId: string): Promise<SafetyQuestChallenge | null> {
  if (!challengeId.startsWith("report-")) return null
  const reportId = challengeId.slice("report-".length)
  const admin = getSupabaseAdmin() as any
  const { data, error } = await admin
    .from("danger_reports")
    .select("id,title,status,image_url,processed_image_url,processed_image_urls,city,town,prefecture,danger_type,danger_level")
    .eq("id", reportId)
    .maybeSingle()

  if (error || !data) return null
  return buildSafetyQuestChallengesFromReports([data as SafetyQuestReportRow])[0] ?? null
}

async function persistAttempt({
  userId,
  challengeId,
  mode,
  userMarkers,
  answerPayload,
  result,
  durationMs,
}: {
  userId: string
  challengeId: string
  mode: SafetyQuestAttemptMode
  userMarkers: unknown
  answerPayload: unknown
  result: ReturnType<typeof scoreSafetyQuestAttempt>
  durationMs: number | null
}) {
  try {
    const admin = getSupabaseAdmin() as any
    await admin.from("safety_quest_attempts").insert({
      user_id: userId,
      challenge_id: challengeId,
      mode,
      user_markers: userMarkers,
      answer_payload: answerPayload ?? null,
      score: result.score,
      accuracy: result.accuracy,
      duration_ms: durationMs,
      points_awarded: result.pointsAwarded,
    })
  } catch (error) {
    console.warn("Safety Quest attempt persistence skipped", error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

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

  const challenge = findSampleSafetyQuestChallenge(challengeId) ?? await loadReportChallenge(challengeId)
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

  await persistAttempt({
    userId: user.id,
    challengeId,
    mode,
    userMarkers,
    answerPayload,
    result,
    durationMs,
  })

  return NextResponse.json({
    result,
    next: {
      rewardsUnlocked: result.rewardKeys,
      dailyMissionDelta: {
        hazardFinds: result.matches,
        quizCorrect: answerPayload?.correct === true || answerPayload?.answer === "danger" ? 1 : 0,
        clearedStages: result.score >= 60 ? 1 : 0,
      },
    },
  })
}
