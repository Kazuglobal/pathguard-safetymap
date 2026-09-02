import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { toDangerReportJson, toPublicDangerReportPreviewJson } from '@/lib/danger-report-api'
import { AuthzError } from '@/lib/db/authz'
import { deleteDangerReport, getDangerReportById } from '@/lib/db/repos/danger-reports.repo'

export const runtime = 'nodejs'

interface MediaBucket { delete(keys: string | string[]): Promise<void> }
type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const actor = await getActor()
  try {
    const { id } = await context.params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid report id' }, { status: 400 })
    const report = await getDangerReportById(actor, id)
    return report
      ? NextResponse.json({ report: actor.kind === 'anon'
        ? toPublicDangerReportPreviewJson(report)
        : toDangerReportJson(report) })
      : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Failed to get danger report' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const actor = await getActor()
  if (actor.kind === 'anon') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await context.params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid report id' }, { status: 400 })
    const deleted = await deleteDangerReport(actor, id)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let mediaDeleteFailed = false
    if (deleted.imageKeys.length > 0) {
      try {
        const cloudflare = getCloudflareContext()
        const bucket = (cloudflare.env as unknown as { MEDIA_PRIVATE: MediaBucket }).MEDIA_PRIVATE
        await bucket.delete(deleted.imageKeys)
      } catch (error) {
        mediaDeleteFailed = true
        console.error('[api/reports] R2 cleanup failed', { reportId: id, count: deleted.imageKeys.length })
      }
    }
    return NextResponse.json({ deleted: true, mediaDeleteFailed })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[api/reports] delete failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to delete danger report' }, { status: 500 })
  }
}
