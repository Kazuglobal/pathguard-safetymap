import { NextRequest, NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"
import { scoreSession } from "@/lib/hunter/scoring"
import { scoreQuiz } from "@/lib/hunter/quiz"
import { getAnswerKey, isAnswerCacheConfigured } from "@/lib/hunter/answer-cache"
import { parseSessionBody } from "@/lib/hunter/validation"
import type { HunterHazard, HunterQuizItem } from "@/lib/hunter/types"

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

  const { mode, hazards = [], taps = [], items = [], answers = [], sessionId } = parsed.data

  // sessionId のサーバキャッシュ(正解鍵)があれば、それで採点する=改ざん耐性。
  // Upstash が「未設定」の環境のみ、クライアント供給の定義で採点する(Phase0 後方互換)。
  // Upstash が設定済みなのにミス(sessionId 省略/期限切れ/改ざん)した場合は、
  // クライアント供給の定義をそのまま信用せず再試行を促す(トラスト境界を弱めない)。
  const cached = sessionId ? await getAnswerKey(sessionId) : null
  if (isAnswerCacheConfigured() && !cached) {
    return NextResponse.json(
      { error: "セッションの有効期限が切れました。もういちど はじめから ためしてね。" },
      { status: 409 },
    )
  }

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
    return NextResponse.json({
      mode: "quiz",
      score: result.score,
      correct: result.correct,
      total: result.total,
      outcomes: result.outcomes,
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
  return NextResponse.json({
    mode: "explore",
    score: result.score,
    matches: result.matches,
    comboMax: result.comboMax,
    total: scoringHazards.length,
    outcomes: result.outcomes,
  })
}
