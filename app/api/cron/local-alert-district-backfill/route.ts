import { NextRequest, NextResponse } from 'next/server'
import { and, asc, gt, gte } from 'drizzle-orm'
import { verifyCronSecret } from '@/lib/cron-auth'
import { getDb } from '@/lib/db/client'
import { localSafetyAlerts } from '@/lib/db/schema'
import { associateLocalAlertDistricts } from '@/lib/local-alert-district-association'

export const runtime = 'nodejs'
export const maxDuration = 300

// Explicit, secret-protected maintenance endpoint; no new recurring schedule.
export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError
  const params = new URL(request.url).searchParams
  const cursor = params.get('cursor') ?? ''
  const sinceInput = params.get('since') ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  if (cursor.length > 80 || !Number.isFinite(Date.parse(sinceInput))) return NextResponse.json({ error: 'Invalid cursor or since' }, { status: 400 })
  const since = new Date(sinceInput).toISOString()
  try {
    const rows = await getDb().select({ id: localSafetyAlerts.id }).from(localSafetyAlerts)
      .where(and(gte(localSafetyAlerts.occurredAt, since), cursor ? gt(localSafetyAlerts.id, cursor) : undefined))
      .orderBy(asc(localSafetyAlerts.id)).limit(10)
    const counts = await associateLocalAlertDistricts(rows.map(row => row.id))
    return NextResponse.json({ ...counts, since, nextCursor: rows.length === 10 ? rows[rows.length - 1].id : null })
  } catch {
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 })
  }
}
