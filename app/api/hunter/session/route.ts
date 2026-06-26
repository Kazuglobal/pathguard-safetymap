import { NextRequest, NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"
import { scoreSession } from "@/lib/hunter/scoring"
import { parseSessionBody } from "@/lib/hunter/validation"

export const runtime = "nodejs"

/**
 * POST /api/hunter/session — 探索モードのサーバ側再採点 (Phase 0)
 *
 * - 認証必須
 * - クライアントの点数を信用せず、hazards と taps からサーバ側で権威的に再採点する。
 * - Phase 0 は保存なし（記録/バッジは Phase 2）。
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "リクエストJSONが正しくありません" }, { status: 400 })
  }

  const parsed = parseSessionBody(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { hazards, taps } = parsed.data
  const result = scoreSession(taps, hazards)

  return NextResponse.json({
    score: result.score,
    matches: result.matches,
    comboMax: result.comboMax,
    total: hazards.length,
    outcomes: result.outcomes,
  })
}
