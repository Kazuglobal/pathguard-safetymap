import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { authorizePrivateMedia } from '@/lib/media/authorize'
import { parsePrivateMediaKey } from '@/lib/media/url'

export const runtime = 'nodejs'

interface MediaObject {
  body: BodyInit
  httpEtag?: string
  size?: number
  httpMetadata?: { contentType?: string; contentLanguage?: string; cacheControl?: string }
  writeHttpMetadata?(headers: Headers): void
}

interface PrivateMediaBucket {
  get(key: string): Promise<MediaObject | null>
}

type RouteContext = { params: Promise<{ key?: string[] }> }

function corsHeaders(request: NextRequest): HeadersInit {
  const requestOrigin = request.headers.get('origin')
  if (!requestOrigin || requestOrigin !== request.nextUrl.origin) return {}
  return { 'Access-Control-Allow-Origin': requestOrigin, Vary: 'Origin' }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const actor = await getActor()
  if (actor.kind === 'anon') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let parsed
  try {
    const params = await context.params
    parsed = parsePrivateMediaKey((params.key ?? []).join('/'))
  } catch {
    return NextResponse.json({ error: 'Invalid media key' }, { status: 400 })
  }

  if (!await authorizePrivateMedia(actor, parsed)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cloudflare = getCloudflareContext()
  const bucket = (cloudflare.env as unknown as { MEDIA_PRIVATE: PrivateMediaBucket }).MEDIA_PRIVATE
  const object = await bucket.get(parsed.key)
  if (!object) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const headers = new Headers(corsHeaders(request))
  object.writeHttpMetadata?.(headers)
  if (object.httpMetadata?.contentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', object.httpMetadata.contentType)
  }
  headers.set('Cache-Control', 'private, max-age=300')
  headers.set('Content-Disposition', 'inline')
  headers.set('X-Content-Type-Options', 'nosniff')
  if (object.httpEtag) headers.set('ETag', object.httpEtag)
  if (object.size != null) headers.set('Content-Length', String(object.size))

  return new NextResponse(object.body, { status: 200, headers })
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
