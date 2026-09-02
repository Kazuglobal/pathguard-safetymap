/**
 * Cron: 地域安全アラートの自動収集
 *
 * wrangler.jsonc の Cron Trigger で 0 *\/3 * * * (3時間毎) に設定。
 * Gemini + Google Search Grounding で最新の声かけ・不審者情報を収集し
 * local_safety_alerts テーブルに upsert する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { fetchLocalAlertsFromGemini } from '@/lib/local-alert-fetcher'
import { getServiceActor } from '@/lib/auth/service-actor'
import { insertLocalAlerts } from '@/lib/db/repos/push.repo'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req)
  if (authError) return authError

  const alerts = await fetchLocalAlertsFromGemini()

  if (alerts.length === 0) {
    return NextResponse.json({ fetched: 0, inserted: 0, skipped: 0 })
  }

  const data = await insertLocalAlerts(getServiceActor(), alerts.map((alert) => ({
    prefecture: alert.prefecture!,
    city: alert.city,
    category: alert.category!,
    description: alert.description!,
    source_url: alert.source_url ?? null,
    occurred_at: alert.occurred_at!,
  })))
  const inserted = data.length
  const skipped = alerts.length - inserted

  return NextResponse.json({
    fetched: alerts.length,
    inserted,
    skipped,
  })
}
