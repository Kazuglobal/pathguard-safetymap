import { getCloudflareContext } from '@opennextjs/cloudflare'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { getDb } from '@/lib/db/client'
import { dangerReports } from '@/lib/db/schema'
import { authorizePrivateMedia } from '@/lib/media/authorize'
import { keyForReportMediaSlot, parseReportMediaSlot } from '@/lib/media/report-media'
import { parsePrivateMediaKey } from '@/lib/media/url'

export const runtime = 'nodejs'

interface MediaObject {
  body: BodyInit
  httpEtag?: string
  size?: number
  httpMetadata?: { contentType?: string }
  writeHttpMetadata?(headers: Headers): void
}

type RouteContext = { params: Promise<{ id: string; slot: string }> }

/**
 * 報告の写真を、報告の id と写真の場所だけで配信する(UIUX改装 項目61。投稿者の id を URL に出さない)。
 * 見てよいかは /api/media/private と同じ判定(ほかの人には、公開中の報告の、ぼかした写真だけ)
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const actor = await getActor()
  if (actor.kind === 'anon') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, slot: rawSlot } = await context.params
  const slot = parseReportMediaSlot(rawSlot)
  if (!id || id.length > 128 || !slot) return NextResponse.json({ error: 'Invalid media' }, { status: 400 })

  const [report] = await getDb().select({
    imageKey: dangerReports.imageKey,
    processedImageKey: dangerReports.processedImageKey,
    processedImageKeys: dangerReports.processedImageKeys,
  }).from(dangerReports).where(eq(dangerReports.id, id)).limit(1)
  const key = report ? keyForReportMediaSlot(report, slot) : null
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let parsed
  try {
    parsed = parsePrivateMediaKey(key)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!await authorizePrivateMedia(actor, parsed)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { env } = getCloudflareContext()
  const object = await (env as unknown as { MEDIA_PRIVATE: { get(key: string): Promise<MediaObject | null> } }).MEDIA_PRIVATE.get(key)
  if (!object) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata?.(headers)
  if (object.httpMetadata?.contentType && !headers.has('Content-Type')) headers.set('Content-Type', object.httpMetadata.contentType)
  headers.set('Cache-Control', 'private, max-age=300')
  headers.set('Content-Disposition', 'inline')
  headers.set('X-Content-Type-Options', 'nosniff')
  if (object.httpEtag) headers.set('ETag', object.httpEtag)
  if (object.size != null) headers.set('Content-Length', String(object.size))
  return new NextResponse(object.body, { status: 200, headers })
}
