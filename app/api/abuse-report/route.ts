import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getActor } from '@/lib/auth/actor'
import { flagDangerReport } from '@/lib/db/repos/social.repo'
import { checkApiRateLimit, rateLimitedResponse } from "@/lib/upstash-rate-limiter"

export const runtime = "nodejs"

const AbuseReportSchema = z.object({
  target_report_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
})

export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== 'user') {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`abuse-report:${actor.id}`)
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

  try {
    const inserted = await flagDangerReport(actor, target_report_id, reason)
    if (!inserted) {
      return NextResponse.json({ error: "通報対象のレポートが見つかりません" }, { status: 404 })
    }
  } catch (error) {
    console.error("abuse report insert failed:", error)
    return NextResponse.json(
      { error: "通報の送信に失敗しました" },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
