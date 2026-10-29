import { NextRequest, NextResponse } from "next/server"

import { getActor } from "@/lib/auth/actor"
import { SAMPLE_SAFETY_QUEST_CHALLENGES } from "@/lib/safety-quest"

export const runtime = "nodejs"

/**
 * セーフティクエストの問題は、アプリで用意した見本の写真だけを使う(UIUX改装 項目57)。
 * 利用者が投稿した報告の写真は、問題に使い回さない。
 */
export async function GET(_request: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== "user") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  return NextResponse.json({
    challenges: SAMPLE_SAFETY_QUEST_CHALLENGES,
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
