import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getServiceActor } from '@/lib/auth/service-actor'
import { verifyCronSecret } from '@/lib/cron-auth'
import { findReferencedKeys } from '@/lib/db/repos/media-maintenance.repo'

export const runtime = 'nodejs'

const CURSOR_KEY = 'maintenance/r2-orphan-cursor.json'
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

interface ListedObject { key: string; uploaded: Date }
interface ListedObjects { objects: ListedObject[]; truncated: boolean; cursor?: string }
interface CursorObject { json<T>(): Promise<T> }
interface MediaBucket {
  get(key: string): Promise<CursorObject | null>
  list(options: { prefix: string; limit: number; cursor?: string }): Promise<ListedObjects>
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
}

async function readCursor(bucket: MediaBucket): Promise<string | undefined> {
  try {
    const object = await bucket.get(CURSOR_KEY)
    if (!object) return undefined
    const state = await object.json<{ cursor?: unknown }>()
    return typeof state.cursor === 'string' && state.cursor ? state.cursor : undefined
  } catch {
    return undefined
  }
}

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const cloudflare = getCloudflareContext()
  const bucket = (cloudflare.env as unknown as { MEDIA_PRIVATE: MediaBucket }).MEDIA_PRIVATE
  const cursor = await readCursor(bucket)
  const page = await bucket.list({ prefix: 'danger-reports/', limit: 500, ...(cursor ? { cursor } : {}) })
  const cutoff = Date.now() - GRACE_PERIOD_MS
  const deletionCandidates = page.objects
    .filter((object) => object.uploaded.getTime() < cutoff)
    .map((object) => object.key)
  const referenced = await findReferencedKeys(getServiceActor(), deletionCandidates)
  const orphanKeys = deletionCandidates.filter((key) => !referenced.has(key))

  if (orphanKeys.length > 0) {
    console.info('[cron/r2-orphan-cleanup] deleting unreferenced objects', { count: orphanKeys.length })
    await bucket.delete(orphanKeys)
  }

  if (page.truncated && page.cursor) {
    await bucket.put(CURSOR_KEY, JSON.stringify({ cursor: page.cursor }), {
      httpMetadata: { contentType: 'application/json' },
    })
  } else {
    await bucket.delete(CURSOR_KEY)
  }

  return NextResponse.json({
    scanned: page.objects.length,
    eligible: deletionCandidates.length,
    deleted: orphanKeys.length,
    continuesNextRun: Boolean(page.truncated && page.cursor),
  })
}
