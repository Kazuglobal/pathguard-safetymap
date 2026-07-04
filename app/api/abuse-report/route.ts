import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase-server"
import { checkApiRateLimit, rateLimitedResponse } from "@/lib/upstash-rate-limiter"

export const runtime = "nodejs"

const AbuseReportSchema = z.object({
  target_report_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`abuse-report:${user.id}`)
  if (!rate.success) {
    return rateLimitedResponse(rate.reset)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 })
  }

  const parsed = AbuseReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容が正しくありません" },
      { status: 400 },
    )
  }

  const { target_report_id, reason } = parsed.data

  const { error: insertError } = await supabase
    .from("report_flags")
    .insert({
      reporter_user_id: user.id,
      target_report_id,
      reason: reason || null,
    })

  if (insertError) {
    console.error("abuse report insert failed:", insertError)
    // 外部キー違反(通報対象が存在しない)は404として扱う
    const status = insertError.code === "23503" ? 404 : 500
    return NextResponse.json(
      {
        error:
          status === 404
            ? "通報対象のレポートが見つかりません"
            : "通報の送信に失敗しました",
      },
      { status },
    )
  }

  return NextResponse.json({ success: true })
}
