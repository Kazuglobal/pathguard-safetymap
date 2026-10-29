import { and, eq } from 'drizzle-orm'

import type { Actor } from '@/lib/db/authz'
import { getDb, type AppDb } from '@/lib/db/client'
import { dangerReports, hunterPhotos, reportImages } from '@/lib/db/schema'

import { isMaskedMediaKey, type PrivateMediaKey } from './url'

const PUBLIC_REPORT_STATUSES = new Set(['approved', 'published', 'resolved'])

export function createPrivateMediaAuthorizer(db: AppDb) {
  return async function authorize(actor: Actor, parsed: PrivateMediaKey): Promise<boolean> {
    if (actor.kind === 'anon') return false

    if (parsed.kind === 'hunter-photo') {
      const [photo] = await db.select({
        playerId: hunterPhotos.playerId,
        imageKey: hunterPhotos.imageKey,
      }).from(hunterPhotos).where(and(
        eq(hunterPhotos.id, parsed.resourceId),
        eq(hunterPhotos.playerId, parsed.ownerId),
      )).limit(1)
      if (!photo || photo.imageKey !== parsed.key) return false
      return actor.kind === 'user' && actor.id === photo.playerId
    }

    const [report] = await db.select({
      userId: dangerReports.userId,
      status: dangerReports.status,
      imageKey: dangerReports.imageKey,
      processedImageKey: dangerReports.processedImageKey,
      processedImageKeys: dangerReports.processedImageKeys,
    }).from(dangerReports).where(and(
      eq(dangerReports.id, parsed.resourceId),
      eq(dangerReports.userId, parsed.ownerId),
    )).limit(1)
    if (!report) return false

    const directKeys = [report.imageKey, report.processedImageKey, ...report.processedImageKeys]
    let isPersistedKey = directKeys.includes(parsed.key)
    // 端末でぼかした(加工済みの)写真か。報告ごとではなく、写真ごと(キーの印 m-)で決める(追加の写真も同じ)
    const masked = isMaskedMediaKey(parsed.key)
    if (!isPersistedKey) {
      const [image] = await db.select({ id: reportImages.id }).from(reportImages).where(and(
        eq(reportImages.reportId, parsed.resourceId),
        eq(reportImages.imageKey, parsed.key),
      )).limit(1)
      isPersistedKey = Boolean(image)
    }
    if (!isPersistedKey) return false

    if (actor.kind === 'service') return true
    if (actor.isAdmin || actor.id === report.userId) return true
    // ほかの人には、公開中の報告の、ぼかした写真だけを見せる(UIUX改装 項目57)。
    // 既存の(ぼかしていない)写真は、管理者がぼかし直すまで本人と管理者だけ
    return PUBLIC_REPORT_STATUSES.has(report.status) && masked
  }
}

export function authorizePrivateMedia(actor: Actor, parsed: PrivateMediaKey) {
  return createPrivateMediaAuthorizer(getDb())(actor, parsed)
}
