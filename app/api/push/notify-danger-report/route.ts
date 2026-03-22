import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import {
  claimDangerReportForNotification,
  notifyUsersNearReport,
  releaseDangerReportNotificationClaim,
} from '@/lib/push-notifications/notify-danger-report'

const bodySchema = z.object({
  reportId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'パラメータが不正です', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  let claimed
  try {
    claimed = await claimDangerReportForNotification({
      reportId: parsed.data.reportId,
      userId: user.id,
    })
  } catch (error) {
    console.error('[push/notify-danger-report] claim error', error)
    return NextResponse.json({ error: '通知送信に失敗しました' }, { status: 500 })
  }

  if (claimed.status === 'not_found') {
    return NextResponse.json({ error: 'レポートが見つかりません' }, { status: 404 })
  }

  if (claimed.status === 'already_claimed') {
    return NextResponse.json({ notified: 0, skipped: true })
  }

  try {
    const notified = await notifyUsersNearReport(claimed.report)
    return NextResponse.json({ notified })
  } catch (error) {
    await releaseDangerReportNotificationClaim({
      reportId: parsed.data.reportId,
      claimedAt: claimed.claimedAt,
    })
    console.error('[push/notify-danger-report] notify error', error)
    return NextResponse.json({ error: '通知送信に失敗しました' }, { status: 500 })
  }
}
