import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { AuthzError } from '@/lib/db/authz'
import { getDangerReportById, setDangerReportAccidentStats } from '@/lib/db/repos/danger-reports.repo'
import { nearbyStats } from '@/lib/db/repos/accidents.repo'
import { ACCIDENT_IMAGE_CONTEXT_PARAMS } from '@/lib/accident-stats-year-window'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await context.params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid report id' }, { status: 400 })
    const report = await getDangerReportById(actor, id)
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const stats = await nearbyStats(actor, {
      latitude: report.latitude,
      longitude: report.longitude,
      ...ACCIDENT_IMAGE_CONTEXT_PARAMS,
    })
    const saved = await setDangerReportAccidentStats(
      actor,
      id,
      stats as unknown as Record<string, unknown>,
      Number(stats.risk_score ?? 0),
    )
    if (!saved) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ stats })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[api/reports/accident-stats] failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to update accident statistics' }, { status: 500 })
  }
}
