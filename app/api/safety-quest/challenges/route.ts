import { NextRequest, NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { createServerClient } from "@/lib/supabase-server"
import {
  SAMPLE_SAFETY_QUEST_CHALLENGES,
  buildSafetyQuestChallengesFromReports,
  type SafetyQuestReportRow,
} from "@/lib/safety-quest"

export const runtime = "nodejs"

export async function GET(_request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const admin = getSupabaseAdmin() as any
  const { data, error } = await admin
    .from("danger_reports")
    .select("id,title,status,image_url,processed_image_url,processed_image_urls,city,town,prefecture,danger_type,danger_level")
    .in("status", ["approved", "published", "resolved"])
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(12)

  if (error) {
    return NextResponse.json({ error: "チャレンジの取得に失敗しました" }, { status: 500 })
  }

  const challenges = buildSafetyQuestChallengesFromReports((data ?? []) as SafetyQuestReportRow[])

  return NextResponse.json({
    challenges: challenges.length > 0 ? challenges : SAMPLE_SAFETY_QUEST_CHALLENGES,
    progress: {
      userId: user.id,
      completedChallengeIds: [],
      dailyMissionProgress: {
        hazardFinds: 0,
        quizCorrect: 0,
        clearedStages: 0,
      },
    },
  })
}
