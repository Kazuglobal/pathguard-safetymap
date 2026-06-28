import { NextRequest, NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"
import { scoreSession } from "@/lib/hunter/scoring"
import { buildQuizItems, scoreQuiz } from "@/lib/hunter/quiz"
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

  const { mode, hazards = [], taps = [], accident, answers = [] } = parsed.data

  if (mode === "quiz") {
    // クライアントの点数を信用せず、hazards+accident から出題を再生成して採点する。
    if (!accident) {
      return NextResponse.json({ error: "クイズの採点に必要な情報が不足しています" }, { status: 400 })
    }
    const items = buildQuizItems(hazards, accident)
    const result = scoreQuiz(items, answers)
    return NextResponse.json({
      mode: "quiz",
      score: result.score,
      correct: result.correct,
      total: result.total,
      outcomes: result.outcomes,
    })
  }

  const result = scoreSession(taps, hazards)
  return NextResponse.json({
    mode: "explore",
    score: result.score,
    matches: result.matches,
    comboMax: result.comboMax,
    total: hazards.length,
    outcomes: result.outcomes,
  })
}
