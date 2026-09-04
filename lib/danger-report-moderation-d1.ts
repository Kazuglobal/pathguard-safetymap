import { getCloudflareContext } from '@opennextjs/cloudflare'
import { moderationImageKeys } from '@/lib/danger-report-moderation-images'
import { and, count, eq, gte, isNull, lte, ne, notExists, or, sql } from 'drizzle-orm'

import { calculateDistance } from '@/lib/ar-utils'
import { getServiceActor } from '@/lib/auth/service-actor'
import {
  buildDangerModerationUpdate,
  type DangerModerationStatus,
} from '@/lib/danger-report-moderation'
import {
  DANGER_MODERATION_PROMPT_VERSION,
  moderateDangerReportWithAi,
  type DangerModerationResult,
} from '@/lib/danger-report-moderation-ai'
import { assertCan, type Actor } from '@/lib/db/authz'
import { getDb, type AppDb } from '@/lib/db/client'
import { dangerReportModerationLog, dangerReports } from '@/lib/db/schema'

export type DangerReportModerationMode = 'off' | 'shadow' | 'live'
export type DangerReportRow = typeof dangerReports.$inferSelect
export const MAX_DANGER_MODERATION_FALLBACKS = 3

export type ModerationServiceResult =
  | { outcome: 'shadow' | 'retry' | 'updated'; verdict: DangerModerationResult; report: DangerReportRow }
  | { outcome: 'conflict'; verdict: DangerModerationResult; report: null }

interface MediaObject {
  size: number
  httpMetadata?: { contentType?: string }
  arrayBuffer(): Promise<ArrayBuffer>
}
interface MediaBucket { get(key: string): Promise<MediaObject | null> }

export function getDangerModerationMode(
  value = process.env.DANGER_REPORT_AI_MODERATION_MODE,
): DangerReportModerationMode {
  return value === 'shadow' || value === 'live' ? value : 'off'
}

function hasImage(report: DangerReportRow): boolean {
  return Boolean(report.imageKey || report.processedImageKey || report.processedImageKeys.length)
}

async function collectImageDataUrls(report: DangerReportRow): Promise<string[]> {
  const keys = moderationImageKeys(report)
  if (keys.length === 0) return []
  const cloudflare = getCloudflareContext()
  const bucket = (cloudflare.env as unknown as { MEDIA_PRIVATE: MediaBucket }).MEDIA_PRIVATE

  const values = await Promise.all(keys.map(async (key) => {
    try {
      const object = await Promise.race([
        bucket.get(key),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
      ])
      if (!object || object.size > 8 * 1024 * 1024) return null
      const mime = object.httpMetadata?.contentType?.startsWith('image/')
        ? object.httpMetadata.contentType
        : 'image/webp'
      const buffer = Buffer.from(await object.arrayBuffer())
      return `data:${mime};base64,${buffer.toString('base64')}`
    } catch (error) {
      console.error('[danger-report/moderation] R2 image read failed', error instanceof Error ? error.message : 'unknown')
      return null
    }
  }))
  return values.filter((value): value is string => value !== null)
}

export function createDangerModerationD1(db: AppDb) {
  return {
    async getReport(actor: Actor, reportId: string) {
      const [report] = await db.select().from(dangerReports)
        .where(eq(dangerReports.id, reportId)).limit(1)
      if (!report) return null
      assertCan(actor, 'select', 'danger_reports', {
        ownerId: report.userId,
        status: report.status,
      })
      return report
    },

    async listForSweep(actor: Actor, input: {
      mode: Exclude<DangerReportModerationMode, 'off'>
      cutoff: string
      limit: number
    }) {
      assertCan(actor, 'select', 'danger_reports')
      const limit = Math.min(100, Math.max(1, Math.trunc(input.limit)))
      const base = and(
        eq(dangerReports.status, 'pending'),
        lte(dangerReports.createdAt, input.cutoff),
        or(isNull(dangerReports.aiModerationStatus), eq(dangerReports.aiModerationStatus, 'pending')),
      )
      const shadowAlreadyLogged = db.select({ value: sql`1` }).from(dangerReportModerationLog)
        .where(and(
          eq(dangerReportModerationLog.reportId, dangerReports.id),
          eq(dangerReportModerationLog.mode, 'shadow'),
          eq(dangerReportModerationLog.promptVersion, DANGER_MODERATION_PROMPT_VERSION),
        ))
      return db.select().from(dangerReports).where(input.mode === 'shadow'
        ? and(base, notExists(shadowAlreadyLogged))
        : base).orderBy(dangerReports.createdAt).limit(limit)
    },

    async fallbackCount(actor: Actor, reportId: string): Promise<number> {
      assertCan(actor, 'select', 'danger_report_moderation_log')
      const [row] = await db.select({ value: count() }).from(dangerReportModerationLog)
        .where(and(
          eq(dangerReportModerationLog.reportId, reportId),
          eq(dangerReportModerationLog.fallback, true),
          eq(dangerReportModerationLog.mode, 'live'),
          eq(dangerReportModerationLog.promptVersion, DANGER_MODERATION_PROMPT_VERSION),
        ))
      return row?.value ?? 0
    },

    async markFailed(actor: Actor, reportId: string, now = new Date()) {
      assertCan(actor, 'update', 'danger_reports')
      const [updated] = await db.update(dangerReports).set({
        aiModerationStatus: 'needs_review',
        aiModerationReason: 'AI審査が繰り返し失敗したため人間の確認に回します。',
        aiModerationScore: 0.5,
        aiModerationCheckedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }).where(and(
        eq(dangerReports.id, reportId),
        eq(dangerReports.status, 'pending'),
        or(isNull(dangerReports.aiModerationStatus), eq(dangerReports.aiModerationStatus, 'pending')),
      )).returning()
      return updated ?? null
    },

    async moderate(actor: Actor, report: DangerReportRow, mode: Exclude<DangerReportModerationMode, 'off'>, now = new Date()): Promise<ModerationServiceResult> {
      assertCan(actor, 'insert', 'danger_report_moderation_log')
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const [[recent], nearby, [rejected]] = await Promise.all([
        db.select({ value: count() }).from(dangerReports).where(and(
          eq(dangerReports.userId, report.userId), gte(dangerReports.createdAt, oneHourAgo),
        )),
        db.select({ latitude: dangerReports.latitude, longitude: dangerReports.longitude })
          .from(dangerReports).where(and(
            eq(dangerReports.userId, report.userId), ne(dangerReports.id, report.id),
            gte(dangerReports.createdAt, oneDayAgo),
          )),
        db.select({ value: count() }).from(dangerReports).where(and(
          eq(dangerReports.userId, report.userId), eq(dangerReports.status, 'rejected'),
          gte(dangerReports.createdAt, thirtyDaysAgo),
        )),
      ])
      const nearbyDuplicateCount = nearby.filter((candidate) => calculateDistance(
        report.latitude, report.longitude, candidate.latitude, candidate.longitude,
      ) <= 50).length
      const reportHasImage = hasImage(report)
      const verdict = await moderateDangerReportWithAi({
        title: report.title,
        description: report.description,
        dangerType: report.dangerType,
        dangerLevel: report.dangerLevel,
        latitude: report.latitude,
        longitude: report.longitude,
        geocodeConfidence: report.geocodeConfidence,
        prefecture: report.prefecture,
        city: report.city,
        hasImage: reportHasImage,
        recentReportsByUserLastHour: recent?.value ?? 0,
        nearbyDuplicateCount,
        userRejectedCountLast30d: rejected?.value ?? 0,
        imageDataUrls: reportHasImage ? await collectImageDataUrls(report) : [],
      })

      await db.insert(dangerReportModerationLog).values({
        id: crypto.randomUUID(),
        reportId: report.id,
        mode,
        heuristicStatus: verdict.heuristicStatus,
        aiVerdict: verdict.aiVerdict as Record<string, unknown> | null,
        finalStatus: verdict.status,
        fallback: verdict.fallback,
        latencyMs: verdict.latencyMs,
        model: verdict.model,
        promptVersion: verdict.promptVersion,
      })
      if (mode === 'shadow') return { outcome: 'shadow', verdict, report }
      if (verdict.fallback) return { outcome: 'retry', verdict, report }

      const update = buildDangerModerationUpdate(verdict, now.toISOString())
      const conditions = [
        eq(dangerReports.id, report.id),
        eq(dangerReports.status, 'pending'),
        eq(dangerReports.title, report.title),
        eq(dangerReports.dangerType, report.dangerType),
        eq(dangerReports.dangerLevel, report.dangerLevel),
        eq(dangerReports.latitude, report.latitude),
        eq(dangerReports.longitude, report.longitude),
        report.description == null ? isNull(dangerReports.description) : eq(dangerReports.description, report.description),
        report.geocodeConfidence == null ? isNull(dangerReports.geocodeConfidence) : eq(dangerReports.geocodeConfidence, report.geocodeConfidence),
        report.prefecture == null ? isNull(dangerReports.prefecture) : eq(dangerReports.prefecture, report.prefecture),
        report.city == null ? isNull(dangerReports.city) : eq(dangerReports.city, report.city),
        or(isNull(dangerReports.aiModerationStatus), eq(dangerReports.aiModerationStatus, 'pending')),
      ]
      if (update.status === 'approved' && !reportHasImage) {
        conditions.push(
          isNull(dangerReports.imageKey),
          isNull(dangerReports.processedImageKey),
          sql`json_array_length(${dangerReports.processedImageKeys}) = 0`,
        )
      }
      const [updated] = await db.update(dangerReports).set({
        ...(update.status ? { status: update.status } : {}),
        aiModerationStatus: update.ai_moderation_status,
        aiModerationReason: update.ai_moderation_reason,
        aiModerationScore: update.ai_moderation_score,
        aiModerationCheckedAt: update.ai_moderation_checked_at,
        updatedAt: now.toISOString(),
      }).where(and(...conditions)).returning()
      return updated
        ? { outcome: 'updated', verdict, report: updated }
        : { outcome: 'conflict', verdict, report: null }
    },
  }
}

function repo() { return createDangerModerationD1(getDb()) }
export function getModerationReport(actor: Actor, reportId: string) { return repo().getReport(actor, reportId) }
export function listReportsForModerationSweep(cutoff: string, mode: Exclude<DangerReportModerationMode, 'off'>, limit = 10) {
  return repo().listForSweep(getServiceActor(), { cutoff, mode, limit })
}
export function getDangerModerationFallbackCount(reportId: string) { return repo().fallbackCount(getServiceActor(), reportId) }
export function markDangerReportModerationFailed(reportId: string, now?: Date) { return repo().markFailed(getServiceActor(), reportId, now) }
export function moderateDangerReportRecord(report: DangerReportRow, mode: Exclude<DangerReportModerationMode, 'off'>, now?: Date) {
  return repo().moderate(getServiceActor(), report, mode, now)
}
