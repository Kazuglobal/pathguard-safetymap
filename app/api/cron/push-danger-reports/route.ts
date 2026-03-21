import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUsersNearReport } from '@/lib/push-notifications/notify-danger-report'
import type { DangerReport } from '@/lib/types'

// Cron: 過去20分の新規レポートを処理してプッシュ通知を送信する安全網
// vercel.json で */15 * * * * (15分毎) に設定

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // CRON_SECRET 認証
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 過去20分の新規レポートを取得
  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString()
  const { data: reports, error } = await admin
    .from('danger_reports')
    .select('id, title, latitude, longitude')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[cron/push-danger-reports] fetch error', error)
    return NextResponse.json({ error: 'レポート取得に失敗しました' }, { status: 500 })
  }

  if (!reports || reports.length === 0) {
    return NextResponse.json({ processed: 0, notified: 0 })
  }

  let totalNotified = 0
  for (const report of reports) {
    try {
      const count = await notifyUsersNearReport(report as unknown as DangerReport)
      totalNotified += count
    } catch (err) {
      console.error('[cron/push-danger-reports] notify error for report', report.id, err)
    }
  }

  return NextResponse.json({
    processed: reports.length,
    notified: totalNotified,
  })
}
