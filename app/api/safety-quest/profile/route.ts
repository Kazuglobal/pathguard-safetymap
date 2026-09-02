import { NextRequest, NextResponse } from "next/server"

import { getActor } from "@/lib/auth/actor"
import { getUserPoints } from "@/lib/db/repos/gamification.repo"

export const runtime = "nodejs"

export async function GET(_request: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== "user") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const points = await getUserPoints(actor, actor.id)
  return NextResponse.json({
    profile: {
      userId: actor.id,
      points: points?.points ?? 0,
      level: points?.level ?? 1,
      streak: 0,
      tickets: 0,
      collectionProgress: {
        unlocked: 0,
        total: 0,
      },
      rewards: [],
    },
  })
}
