import { and, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm'

import { DEMO_SAMPLE_MODERATION_REASON } from '@/lib/admin-report-moderation-queue'
import { RETENTION_DAYS, RETENTION_REPORT_BATCH, retentionCutoff } from '@/lib/retention/policy'

import type { Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { chunkForD1 } from '../d1-limits'
import { dangerReports, pushSubscriptions, reportCreateHistory, reportImages } from '../schema'

/** 保持期間を過ぎたデータを消す(UIUX改装 項目60)。サービス(cron)だけが使う */

function requireService(actor: Actor) {
  if (actor.kind !== 'service') throw new Error('Service actor is required')
}

export interface ExpiredReport {
  id: string
  /** 消す写真(MEDIA_PRIVATE)のキー */
  mediaKeys: string[]
}

export function createRetentionRepo(db: AppDb) {
  return {
    /**
     * 保持期間を過ぎた報告。非公開のまま(審査待ち・却下)は作成から90日、公開中は承認から2年、
     * 解決済みは解決(最後の更新)から90日。デモ用サンプル(公開しない見本)は消さない
     */
    async listExpiredReports(actor: Actor, now: Date): Promise<ExpiredReport[]> {
      requireService(actor)
      const unpublishedCutoff = retentionCutoff(now, RETENTION_DAYS.unpublishedReport)
      const publishedCutoff = retentionCutoff(now, RETENTION_DAYS.publishedReport)
      const resolvedCutoff = retentionCutoff(now, RETENTION_DAYS.resolvedReport)
      const approvedAt = sql<string>`coalesce(${dangerReports.humanApprovedAt}, ${dangerReports.aiModerationCheckedAt}, ${dangerReports.createdAt})`
      const rows = await db.select({
        id: dangerReports.id,
        imageKey: dangerReports.imageKey,
        processedImageKey: dangerReports.processedImageKey,
        processedImageKeys: dangerReports.processedImageKeys,
      }).from(dangerReports).where(and(
        or(isNull(dangerReports.aiModerationReason), ne(dangerReports.aiModerationReason, DEMO_SAMPLE_MODERATION_REASON)),
        or(
          and(inArray(dangerReports.status, ['pending', 'rejected']), lt(dangerReports.createdAt, unpublishedCutoff)),
          and(inArray(dangerReports.status, ['approved', 'published']), lt(approvedAt, publishedCutoff)),
          and(eq(dangerReports.status, 'resolved'), lt(dangerReports.updatedAt, resolvedCutoff)),
        ),
      )).limit(RETENTION_REPORT_BATCH)
      if (rows.length === 0) return []
      // D1 の変数の上限(100個)に収まるよう、id を分けて問い合わせる
      const extra: Array<{ reportId: string; imageKey: string }> = []
      for (const ids of chunkForD1(rows.map((row) => row.id))) {
        extra.push(...await db.select({ reportId: reportImages.reportId, imageKey: reportImages.imageKey }).from(reportImages)
          .where(inArray(reportImages.reportId, ids)))
      }
      return rows.map((row) => ({
        id: row.id,
        mediaKeys: [...new Set([
          row.imageKey, row.processedImageKey, ...row.processedImageKeys,
          ...extra.filter((image) => image.reportId === row.id).map((image) => image.imageKey),
        ].filter((key): key is string => Boolean(key)))],
      }))
    },

    /** 報告を消す。先にポイントの記録を外す(報告を消すと投稿者のポイントを引くトリガーがあるため) */
    async deleteReports(actor: Actor, ids: readonly string[]): Promise<number> {
      requireService(actor)
      let deleted = 0
      for (const chunk of chunkForD1(ids)) {
        await db.update(dangerReports).set({ rewardPoints: null }).where(inArray(dangerReports.id, chunk))
        deleted += (await db.delete(dangerReports).where(inArray(dangerReports.id, chunk)).returning({ id: dangerReports.id })).length
      }
      return deleted
    },

    /** 180日、更新も配信もない通知の購読(配信に失敗したものは lib/web-push.ts がすぐ消す) */
    async deleteStaleSubscriptions(actor: Actor, now: Date): Promise<number> {
      requireService(actor)
      const cutoff = retentionCutoff(now, RETENTION_DAYS.staleSubscription)
      const lastActive = sql<string>`max(${pushSubscriptions.updatedAt}, coalesce(${pushSubscriptions.lastNotifiedAt}, ${pushSubscriptions.updatedAt}))`
      const deleted = await db.delete(pushSubscriptions).where(lt(lastActive, cutoff)).returning({ id: pushSubscriptions.id })
      return deleted.length
    },

    /** 30日より前の、報告の作成の記録(連続投稿の制限にだけ使う) */
    async deleteOldReportCreateHistory(actor: Actor, now: Date): Promise<number> {
      requireService(actor)
      // この表の created_at は UNIX 秒(連続投稿の制限の計算に合わせている)
      const cutoffSeconds = Math.floor(new Date(retentionCutoff(now, RETENTION_DAYS.reportCreateHistory)).getTime() / 1000)
      const deleted = await db.delete(reportCreateHistory).where(lt(reportCreateHistory.createdAt, cutoffSeconds))
        .returning({ id: reportCreateHistory.reportId })
      return deleted.length
    },
  }
}

export function listExpiredReports(actor: Actor, now: Date) { return createRetentionRepo(getDb()).listExpiredReports(actor, now) }
export function deleteExpiredReports(actor: Actor, ids: readonly string[]) { return createRetentionRepo(getDb()).deleteReports(actor, ids) }
export function deleteStaleSubscriptions(actor: Actor, now: Date) { return createRetentionRepo(getDb()).deleteStaleSubscriptions(actor, now) }
export function deleteOldReportCreateHistory(actor: Actor, now: Date) { return createRetentionRepo(getDb()).deleteOldReportCreateHistory(actor, now) }
