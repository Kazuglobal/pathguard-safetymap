import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getServiceActor } from '@/lib/auth/service-actor'
import { verifyCronSecret } from '@/lib/cron-auth'
import {
  deleteExpiredReports,
  deleteOldReportCreateHistory,
  deleteStaleSubscriptions,
  listExpiredReports,
} from '@/lib/db/repos/retention.repo'
import { deleteR2Keys, type DeletableBucket } from '@/lib/media/r2-batch-delete'
import { isExpiredBackupKey } from '@/lib/retention/policy'

export const runtime = 'nodejs'

type MediaBucket = DeletableBucket
interface BackupBucket extends MediaBucket {
  list(options: { prefix: string; cursor?: string }): Promise<{ objects: Array<{ key: string }>; truncated: boolean; cursor?: string }>
}

async function deleteExpiredBackups(bucket: BackupBucket, now: Date): Promise<number> {
  const expired: string[] = []
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix: 'd1/', cursor })
    expired.push(...page.objects.map((object) => object.key).filter((key) => isExpiredBackupKey(key, now)))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  await deleteR2Keys(bucket, expired)
  return expired.length
}

/**
 * 保持期間を過ぎたデータを消す(UIUX改装 項目60。期間は lib/retention/policy.ts)。毎日 19:00 UTC。
 * 写真(R2)を先に消してから D1 を消す(D1 が失敗しても、次の日に同じ報告から続けて消せる)
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const service = getServiceActor()
  const now = new Date()
  const { env } = getCloudflareContext()
  const buckets = env as unknown as { MEDIA_PRIVATE: MediaBucket; BACKUPS: BackupBucket }

  const reports = await listExpiredReports(service, now)
  await deleteR2Keys(buckets.MEDIA_PRIVATE, reports.flatMap((report) => report.mediaKeys))
  const deletedReports = await deleteExpiredReports(service, reports.map((report) => report.id))
  const deletedSubscriptions = await deleteStaleSubscriptions(service, now)
  const deletedHistory = await deleteOldReportCreateHistory(service, now)
  const deletedBackups = await deleteExpiredBackups(buckets.BACKUPS, now)

  return NextResponse.json({ deletedReports, deletedSubscriptions, deletedHistory, deletedBackups })
}
