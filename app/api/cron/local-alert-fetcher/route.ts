/**
 * Cron: 地域安全アラートの自動収集
 *
 * vercel.json で 0 *\/4 * * * (4時間毎) に設定。
 * Gemini + Google Search Grounding で最新の声かけ・不審者情報を収集し
 * local_safety_alerts テーブルに upsert する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { fetchLocalAlertsFromGemini } from '@/lib/local-alert-fetcher'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req)
  if (authError) return authError

  const alerts = await fetchLocalAlertsFromGemini()

  if (alerts.length === 0) {
    return NextResponse.json({ fetched: 0, inserted: 0, skipped: 0 })
  }

  const { data, error } = await db()
    .from('local_safety_alerts')
    .upsert(alerts, {
      onConflict: 'prefecture,city,occurred_at',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) {
    console.error('[cron/local-alert-fetcher] upsert error', error)
    return NextResponse.json({ error: 'データ保存に失敗しました' }, { status: 500 })
  }

  const inserted = Array.isArray(data) ? data.length : 0
  const skipped = alerts.length - inserted

  return NextResponse.json({
    fetched: alerts.length,
    inserted,
    skipped,
  })
}
