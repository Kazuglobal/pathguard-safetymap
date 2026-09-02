import { NextRequest, NextResponse } from "next/server"

import { getActor } from "@/lib/auth/actor"
import { toDangerReportJson } from "@/lib/danger-report-api"
import { listDangerReports } from "@/lib/db/repos/danger-reports.repo"
import {
  SAMPLE_SAFETY_QUEST_CHALLENGES,
  buildSafetyQuestChallengesFromReports,
  type SafetyQuestReportRow,
} from "@/lib/safety-quest"

export const runtime = "nodejs"

export async function GET(_request: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== "user") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const rows = await listDangerReports(actor, { statuses: ["approved", "published", "resolved"], limit: 50 })
  const challengeRows = rows.filter((row) => row.imageKey || row.processedImageKey || row.processedImageKeys.length)
    .slice(0, 12).map((row) => toDangerReportJson(row) as SafetyQuestReportRow)
  const challenges = buildSafetyQuestChallengesFromReports(challengeRows)

  return NextResponse.json({
    challenges: challenges.length > 0 ? challenges : SAMPLE_SAFETY_QUEST_CHALLENGES,
    progress: {
      userId: actor.id,
      completedChallengeIds: [],
      dailyMissionProgress: {
        hazardFinds: 0,
        quizCorrect: 0,
        clearedStages: 0,
      },
    },
  })
}
