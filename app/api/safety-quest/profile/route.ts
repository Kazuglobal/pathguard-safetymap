import { NextRequest, NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"

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

  return NextResponse.json({
    profile: {
      userId: user.id,
      points: 0,
      level: 1,
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
