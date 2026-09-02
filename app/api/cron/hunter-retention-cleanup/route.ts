import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getServiceActor } from '@/lib/auth/service-actor'
import { verifyCronSecret } from '@/lib/cron-auth'
import { deleteHunterRows, listExpiredHunterRows } from '@/lib/db/repos/media-maintenance.repo'

export const runtime = 'nodejs'

interface MediaBucket { delete(keys: string | string[]): Promise<void> }

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const serviceActor = getServiceActor()
  const expired = await listExpiredHunterRows(serviceActor)
  if (expired.length > 0) {
    const cloudflare = getCloudflareContext()
    const bucket = (cloudflare.env as unknown as { MEDIA_PRIVATE: MediaBucket }).MEDIA_PRIVATE
    // R2 first: if the following D1 delete fails, the next run retries idempotently.
    await bucket.delete(expired.map((row) => row.imageKey))
    await deleteHunterRows(serviceActor, expired.map((row) => row.id))
  }
  return NextResponse.json({ deleted: expired.length })
}
