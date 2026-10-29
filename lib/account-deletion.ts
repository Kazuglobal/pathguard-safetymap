import { eq, inArray } from 'drizzle-orm'

import type { AppDb } from '@/lib/db/client'
import {
  children,
  dangerReportReactions,
  dangerReports,
  hunterAuditLog,
  hunterPhotos,
  imageGenerationGateLog,
  notifications,
  profiles,
  pushSubscriptions,
  reportBookmarks,
  reportComments,
  reportCreateHistory,
  reportFlags,
  reportImages,
  reportLikes,
  reportShares,
  routeLearningSessions,
  safetyQuestAttempts,
  userBadges,
  userMissionProgress,
  userPoints,
  userRoutes,
} from '@/lib/db/schema'

/**
 * 退会(UIUX改装 項目40)。順番は「写真のキーを集める → 写真(R2)を消す → D1 を消す → Supabase のアカウントを消す」。
 * 写真を先に消すので、途中で失敗しても、流し直せば残りを消せる(D1 を先に消すと、写真のキーが分からなくなる)。
 * ログ(画像生成の判定・きけんハンターの監査)は、本人を指す id だけを消して残す(匿名化)。
 *
 * 利用者を指す列を持つ表は、ここで必ず扱う。新しい表を足したら ACCOUNT_DELETION_COVERAGE にも足す
 * (tests/unit/lib/account-deletion.test.ts がスキーマから洗い出して、漏れを見つける)。
 */

/** 表 → 利用者を指す列と、退会での扱い */
export { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/account-deletion-confirmation'

export const ACCOUNT_DELETION_COVERAGE: Readonly<Record<string, { column: string; action: 'delete' | 'anonymize' }>> = {
  profiles: { column: 'id', action: 'delete' },
  danger_reports: { column: 'user_id', action: 'delete' },
  report_create_history: { column: 'user_id', action: 'delete' },
  report_images: { column: 'uploaded_by', action: 'delete' },
  danger_report_reactions: { column: 'user_id', action: 'delete' },
  notifications: { column: 'user_id', action: 'delete' },
  report_comments: { column: 'user_id', action: 'delete' },
  report_likes: { column: 'user_id', action: 'delete' },
  report_bookmarks: { column: 'user_id', action: 'delete' },
  report_shares: { column: 'user_id', action: 'anonymize' },
  report_flags: { column: 'reporter_user_id', action: 'delete' },
  user_routes: { column: 'user_id', action: 'delete' },
  route_learning_sessions: { column: 'user_id', action: 'delete' },
  children: { column: 'user_id', action: 'delete' },
  push_subscriptions: { column: 'user_id', action: 'delete' },
  user_points: { column: 'user_id', action: 'delete' },
  user_badges: { column: 'user_id', action: 'delete' },
  user_mission_progress: { column: 'user_id', action: 'delete' },
  safety_quest_attempts: { column: 'user_id', action: 'delete' },
  hunter_photos: { column: 'player_id', action: 'delete' },
  hunter_audit_log: { column: 'actor_id', action: 'anonymize' },
  image_generation_gate_log: { column: 'user_id', action: 'anonymize' },
}

export interface AccountMediaKeys {
  /** MEDIA_PRIVATE(報告の写真・もしも画像・きけんハンターの写真) */
  readonly privateKeys: string[]
  /** MEDIA_PUBLIC(プロフィールのアイコン) */
  readonly publicKeys: string[]
}

/** 退会で消す写真のキー(D1 を消す前に集める) */
export async function collectAccountMediaKeys(db: AppDb, userId: string): Promise<AccountMediaKeys> {
  const reports = await db.select({
    id: dangerReports.id,
    imageKey: dangerReports.imageKey,
    processedImageKey: dangerReports.processedImageKey,
    processedImageKeys: dangerReports.processedImageKeys,
  }).from(dangerReports).where(eq(dangerReports.userId, userId))
  const reportIds = reports.map((report) => report.id)
  const ownReportImages = reportIds.length > 0
    ? await db.select({ imageKey: reportImages.imageKey }).from(reportImages).where(inArray(reportImages.reportId, reportIds))
    : []
  const uploadedImages = await db.select({ imageKey: reportImages.imageKey }).from(reportImages).where(eq(reportImages.uploadedBy, userId))
  const hunter = await db.select({ imageKey: hunterPhotos.imageKey }).from(hunterPhotos).where(eq(hunterPhotos.playerId, userId))
  const [profile] = await db.select({ avatarKey: profiles.avatarKey }).from(profiles).where(eq(profiles.id, userId)).limit(1)

  const privateKeys = new Set<string>()
  for (const report of reports) {
    for (const key of [report.imageKey, report.processedImageKey, ...report.processedImageKeys]) if (key) privateKeys.add(key)
  }
  for (const row of [...ownReportImages, ...uploadedImages, ...hunter]) if (row.imageKey) privateKeys.add(row.imageKey)
  return { privateKeys: [...privateKeys], publicKeys: profile?.avatarKey ? [profile.avatarKey] : [] }
}

/**
 * 本人の D1 のデータを消す。何度流しても同じ結果になる(途中で失敗したら流し直せる)。
 * 報告は先にポイントの記録を外してから消す(報告を消すとポイントを引くトリガーがあるため)。
 * 報告を消すと、その報告へのほかの人のコメント・いいね・審査の記録なども外部キーで一緒に消える
 */
export async function deleteAccountRows(db: AppDb, userId: string): Promise<void> {
  if (!userId) throw new RangeError('A user id is required')

  await db.update(dangerReports).set({ rewardPoints: null }).where(eq(dangerReports.userId, userId))
  await db.delete(reportComments).where(eq(reportComments.userId, userId))
  await db.delete(reportLikes).where(eq(reportLikes.userId, userId))
  await db.delete(reportBookmarks).where(eq(reportBookmarks.userId, userId))
  await db.delete(dangerReportReactions).where(eq(dangerReportReactions.userId, userId))
  await db.delete(reportFlags).where(eq(reportFlags.reporterUserId, userId))
  await db.update(reportShares).set({ userId: null }).where(eq(reportShares.userId, userId))
  await db.delete(notifications).where(eq(notifications.userId, userId))
  await db.delete(reportImages).where(eq(reportImages.uploadedBy, userId))
  await db.delete(dangerReports).where(eq(dangerReports.userId, userId))
  await db.delete(reportCreateHistory).where(eq(reportCreateHistory.userId, userId))

  await db.delete(routeLearningSessions).where(eq(routeLearningSessions.userId, userId))
  await db.delete(userRoutes).where(eq(userRoutes.userId, userId))
  await db.delete(children).where(eq(children.userId, userId))
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))

  await db.delete(userBadges).where(eq(userBadges.userId, userId))
  await db.delete(userMissionProgress).where(eq(userMissionProgress.userId, userId))
  await db.delete(safetyQuestAttempts).where(eq(safetyQuestAttempts.userId, userId))
  await db.delete(userPoints).where(eq(userPoints.userId, userId))

  await db.delete(hunterPhotos).where(eq(hunterPhotos.playerId, userId))
  await db.update(hunterAuditLog).set({ actorId: null }).where(eq(hunterAuditLog.actorId, userId))
  await db.update(imageGenerationGateLog).set({ userId: null }).where(eq(imageGenerationGateLog.userId, userId))

  await db.delete(profiles).where(eq(profiles.id, userId))
}
