import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { notifyUsersNearReport } from '@/lib/push-notifications/notify-danger-report'
import type { DangerReport } from '@/lib/types'

const bodySchema = z.object({
  reportId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  // 認証チェック
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

  const { reportId } = parsed.data

  // レポートを取得
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: report, error: fetchError } = await admin
    .from('danger_reports')
    .select('id, title, latitude, longitude')
    .eq('id', reportId)
    .single()

  if (fetchError || !report) {
    return NextResponse.json({ error: 'レポートが見つかりません' }, { status: 404 })
  }

  const notified = await notifyUsersNearReport(report as unknown as DangerReport)

  return NextResponse.json({ notified })
}
