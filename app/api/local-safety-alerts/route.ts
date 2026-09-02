import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { listLocalSafetyAlerts } from '@/lib/db/repos/push.repo'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const hours = Math.min(24 * 30, Math.max(1, Number(params.get('hours') ?? 24)))
    if (!Number.isFinite(hours)) throw new RangeError('Invalid hours')
    const prefecture = params.get('prefecture')
    const rows = await listLocalSafetyAlerts(await getActor(), {
      since: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
      ...(prefecture && prefecture !== '全国' ? { prefecture } : {}),
      limit: 50,
    })
    return NextResponse.json({ alerts: rows.map((row) => ({
      id: row.id, prefecture: row.prefecture, city: row.city, category: row.category,
      description: row.description, source_url: row.sourceUrl, occurred_at: row.occurredAt,
      push_notified_at: row.pushNotifiedAt, created_at: row.createdAt,
    })) })
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Failed to list alerts' }, { status: 500 })
  }
}
