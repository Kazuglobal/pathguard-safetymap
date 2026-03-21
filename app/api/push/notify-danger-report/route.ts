import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any
import { notifyUsersNearReport } from '@/lib/push-notifications/notify-danger-report'

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

  const { data: report, error: fetchError } = await db()
    .from('danger_reports')
    .select('id, title, latitude, longitude')
    .eq('id', parsed.data.reportId)
    .single()

  if (fetchError || !report) {
    return NextResponse.json({ error: 'レポートが見つかりません' }, { status: 404 })
  }

  const notified = await notifyUsersNearReport(report)

  return NextResponse.json({ notified })
}
