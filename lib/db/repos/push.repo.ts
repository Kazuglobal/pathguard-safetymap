import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, notExists, or, sql } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { chunkForD1 } from '../d1-limits'
import {
  children,
  dangerReports,
  localSafetyAlerts,
  localAlertDistricts,
  profiles,
  pushSubscriptions,
  schoolDistrictBoundaries,
  schoolDistricts,
  userRoutes,
} from '../schema'

export const DANGER_REPORT_NOTIFICATION_STATUSES = ['approved', 'published', 'resolved'] as const
/** 学区の境界の矩形を広げる幅(度)。境界から 50m(lib/school-districts.ts)より広く取る */
const DISTRICT_SEARCH_MARGIN_DEGREES = 0.001

/**
 * 通知してよい報告か。公開の状態で、AI が承認したか運営(人)が承認したもの(UIUX改装 項目59)。
 * 審査前・審査中のものは送らない
 */
export function isDangerReportNotificationReady(report: {
  status: string
  aiModerationStatus: string | null
  humanApprovedAt?: string | null
}): boolean {
  return DANGER_REPORT_NOTIFICATION_STATUSES.includes(
    report.status as (typeof DANGER_REPORT_NOTIFICATION_STATUSES)[number],
  ) && (report.aiModerationStatus === 'approved' || Boolean(report.humanApprovedAt))
}

function dangerReportNotificationReadyPredicate() {
  return and(
    inArray(dangerReports.status, [...DANGER_REPORT_NOTIFICATION_STATUSES]),
    or(eq(dangerReports.aiModerationStatus, 'approved'), isNotNull(dangerReports.humanApprovedAt)),
  )!
}

/** 承認された時刻(人の承認 → AI の審査 → 作成の順に使う)。通知の取りこぼしを拾う範囲に使う */
const dangerReportApprovedAt = sql<string>`coalesce(${dangerReports.humanApprovedAt}, ${dangerReports.aiModerationCheckedAt}, ${dangerReports.createdAt})`

export interface LocalAlertWriteInput {
  prefecture: string
  city: string
  category: string
  description: string
  source_url: string | null
  occurred_at: string
}

export function createPushRepo(db: AppDb) {
  return {
    async listAlerts(actor: Actor, input: { since: string; prefecture?: string; schoolDistrictId?: string; limit?: number }) {
      assertCan(actor, 'select', 'local_safety_alerts')
      const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 50)))
      const predicates = [gte(localSafetyAlerts.occurredAt, input.since)]
      if (input.prefecture) predicates.push(eq(localSafetyAlerts.prefecture, input.prefecture))
      if (input.schoolDistrictId) predicates.push(sql`exists (select 1 from ${localAlertDistricts} where ${localAlertDistricts.alertId} = ${localSafetyAlerts.id} and ${localAlertDistricts.districtId} = ${input.schoolDistrictId})`)
      return db.select().from(localSafetyAlerts).where(and(...predicates))
        .orderBy(desc(localSafetyAlerts.occurredAt)).limit(limit)
    },

    async getSubscription(actor: Actor, endpoint: string) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'select', 'push_subscriptions', { ownerId: actor.id })
      const [row] = await db.select().from(pushSubscriptions).where(and(
        eq(pushSubscriptions.userId, actor.id), eq(pushSubscriptions.endpoint, endpoint),
      )).limit(1)
      return row ?? null
    },

    async listSubscriptions(actor: Actor, input: { preference?: string; userId?: string } = {}) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      assertCan(actor, 'select', 'push_subscriptions')
      const rows: Array<typeof pushSubscriptions.$inferSelect> = []
      const pageSize = 1_000
      for (let offset = 0; ; offset += pageSize) {
        const page = await db.select().from(pushSubscriptions)
          .where(input.userId ? eq(pushSubscriptions.userId, input.userId) : undefined)
          .limit(pageSize).offset(offset)
        rows.push(...page)
        if (page.length < pageSize) break
      }
      return input.preference
        ? rows.filter((row) => row.notificationPreferences[input.preference!] !== false)
        : rows
    },

    async upsertSubscription(actor: Actor, input: {
      endpoint: string; p256dh: string; auth: string; preferences?: Record<string, boolean>; prefecture?: string | null
    }) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'insert', 'push_subscriptions', { ownerId: actor.id })
      if (!input.endpoint.startsWith('https://') || input.endpoint.length > 2_048
        || !input.p256dh || input.p256dh.length > 512 || !input.auth || input.auth.length > 512) {
        throw new RangeError('Invalid push subscription')
      }
      const now = new Date().toISOString()
      const [row] = await db.insert(pushSubscriptions).values({
        id: crypto.randomUUID(), userId: actor.id, endpoint: input.endpoint,
        p256dh: input.p256dh, auth: input.auth,
        notificationPreferences: input.preferences ?? {
          danger_reports: true, news: true, magazine: true, local_alerts: true, daily_digest: true,
        },
        prefecture: input.prefecture ?? null, createdAt: now, updatedAt: now,
      }).onConflictDoUpdate({
        target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
        set: {
          p256dh: input.p256dh, auth: input.auth,
          ...(input.preferences ? { notificationPreferences: input.preferences } : {}),
          ...(input.prefecture !== undefined ? { prefecture: input.prefecture } : {}),
          updatedAt: now,
        },
      }).returning()
      return row
    },

    async patchSubscription(actor: Actor, endpoint: string, input: {
      preferences: Record<string, boolean>; prefecture?: string | null
    }) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'update', 'push_subscriptions', { ownerId: actor.id })
      const [row] = await db.update(pushSubscriptions).set({
        notificationPreferences: input.preferences,
        ...(input.prefecture !== undefined ? { prefecture: input.prefecture } : {}),
        updatedAt: new Date().toISOString(),
      }).where(and(eq(pushSubscriptions.userId, actor.id), eq(pushSubscriptions.endpoint, endpoint))).returning()
      return row ?? null
    },

    async deleteSubscription(actor: Actor, endpoint: string) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'delete', 'push_subscriptions', { ownerId: actor.id })
      await db.delete(pushSubscriptions).where(and(
        eq(pushSubscriptions.userId, actor.id), eq(pushSubscriptions.endpoint, endpoint),
      ))
    },

    async deleteSubscriptionById(actor: Actor, id: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))
    },

    /** 配信できた購読に、配信した時刻を残す(180日、更新も配信もない購読を消すときに見る。lib/retention/policy.ts) */
    async markSubscriptionsNotified(actor: Actor, ids: readonly string[], notifiedAt: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      for (const chunk of chunkForD1([...new Set(ids)])) {
        await db.update(pushSubscriptions).set({ lastNotifiedAt: notifiedAt }).where(inArray(pushSubscriptions.id, chunk))
      }
    },

    /** まだ通知していない報告のうち、since 以降に承認されたもの(作成からの時間ではなく承認からの時間で見る) */
    async listPendingReportIds(actor: Actor, since: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      return db.select({ id: dangerReports.id }).from(dangerReports).where(and(
        gte(dangerReportApprovedAt, since), isNull(dangerReports.pushNotifiedAt),
        dangerReportNotificationReadyPredicate(),
      )).orderBy(asc(dangerReports.createdAt)).limit(500)
    },

    async claimReport(actor: Actor, reportId: string, userId?: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      const predicates = [eq(dangerReports.id, reportId)]
      if (userId) predicates.push(eq(dangerReports.userId, userId))
      const [existing] = await db.select({
        id: dangerReports.id, dangerType: dangerReports.dangerType,
        prefecture: dangerReports.prefecture, status: dangerReports.status,
        aiModerationStatus: dangerReports.aiModerationStatus, humanApprovedAt: dangerReports.humanApprovedAt,
        latitude: dangerReports.latitude,
        longitude: dangerReports.longitude, pushNotifiedAt: dangerReports.pushNotifiedAt,
      }).from(dangerReports).where(and(...predicates)).limit(1)
      if (!existing) return { status: 'not_found' as const }
      if (existing.pushNotifiedAt) return { status: 'already_claimed' as const }
      if (!isDangerReportNotificationReady(existing)) return { status: 'not_ready' as const }
      const claimedAt = `claim:${crypto.randomUUID()}`
      const [claimed] = await db.update(dangerReports).set({ pushNotifiedAt: claimedAt })
        .where(and(
          ...predicates,
          isNull(dangerReports.pushNotifiedAt),
          dangerReportNotificationReadyPredicate(),
        )).returning({
          id: dangerReports.id, dangerType: dangerReports.dangerType,
          prefecture: dangerReports.prefecture,
          latitude: dangerReports.latitude, longitude: dangerReports.longitude,
        })
      return claimed
        ? { status: 'claimed' as const, report: claimed, claimedAt }
        : { status: 'not_ready' as const }
    },

    async releaseReportClaim(actor: Actor, reportId: string, claimedAt: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      await db.update(dangerReports).set({ pushNotifiedAt: null }).where(and(
        eq(dangerReports.id, reportId), eq(dangerReports.pushNotifiedAt, claimedAt),
      ))
    },

    async confirmReportClaim(actor: Actor, reportId: string, claimedAt: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      const [confirmed] = await db.update(dangerReports).set({ pushNotifiedAt: claimedAt })
        .where(and(
          eq(dangerReports.id, reportId),
          eq(dangerReports.pushNotifiedAt, claimedAt),
          dangerReportNotificationReadyPredicate(),
        )).returning({ id: dangerReports.id })
      return Boolean(confirmed)
    },

    async completeReportClaim(actor: Actor, reportId: string, claimedAt: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      const [completed] = await db.update(dangerReports).set({ pushNotifiedAt: new Date().toISOString() })
        .where(and(
          eq(dangerReports.id, reportId), eq(dangerReports.pushNotifiedAt, claimedAt),
        )).returning({ id: dangerReports.id })
      return Boolean(completed)
    },

    async listRoutesWithGeometry(actor: Actor) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      const rows: Array<Pick<typeof userRoutes.$inferSelect, 'id' | 'userId' | 'name' | 'routeGeometry'>> = []
      const pageSize = 1_000
      for (let offset = 0; ; offset += pageSize) {
        const page = await db.select({
          id: userRoutes.id, userId: userRoutes.userId, name: userRoutes.name,
          routeGeometry: userRoutes.routeGeometry,
        }).from(userRoutes).limit(pageSize).offset(offset)
        rows.push(...page)
        if (page.length < pageSize) return rows
      }
    },

    /**
     * 報告の地点を囲む矩形に入る小学校区の境界(地点が本当に学区の中かは呼び出し側が確かめる。
     * このリポジトリに図形の計算ライブラリを持ち込まないため)
     */
    async listDistrictBoundariesAround(actor: Actor, report: { longitude: number; latitude: number; prefecture: string | null }) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      const { longitude, latitude } = report
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return []
      // 境界のすぐ外の報告も、となりの学区として拾えるよう、矩形を少し広げて探す(約100m)
      const margin = DISTRICT_SEARCH_MARGIN_DEGREES
      const predicates = [
        lte(schoolDistrictBoundaries.minLng, longitude + margin), gte(schoolDistrictBoundaries.maxLng, longitude - margin),
        lte(schoolDistrictBoundaries.minLat, latitude + margin), gte(schoolDistrictBoundaries.maxLat, latitude - margin),
      ]
      if (report.prefecture) predicates.push(eq(schoolDistricts.prefecture, report.prefecture))
      return db.select({
        districtId: schoolDistrictBoundaries.districtId, name: schoolDistricts.name, geometry: schoolDistrictBoundaries.geometry,
      }).from(schoolDistrictBoundaries)
        .innerJoin(schoolDistricts, eq(schoolDistricts.id, schoolDistrictBoundaries.districtId))
        .where(and(...predicates))
    },

    /**
     * 指定の小学校区にお子さまを登録している人のうち、通学路の道すじで 300m の判定ができない人(UIUX改装 項目59):
     * 「粗く保存」を選んだ人と、道すじを保存していない人(短くて保存できない通学路だけ・通学路が無い)。学区単位で知らせる
     */
    async listDistrictNotificationUsers(actor: Actor, districtIds: readonly string[]) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      if (districtIds.length === 0) return []
      const routeLine = db.select({ id: userRoutes.id }).from(userRoutes)
        .where(and(eq(userRoutes.userId, children.userId), isNotNull(userRoutes.routeGeometry)))
      const rows = await db.selectDistinct({ userId: children.userId, districtId: children.schoolDistrictId }).from(children)
        .leftJoin(profiles, eq(profiles.id, children.userId))
        .where(and(
          inArray(children.schoolDistrictId, [...districtIds]),
          or(eq(profiles.locationPrecision, 'coarse'), notExists(routeLine)),
        ))
      return rows.flatMap((row) => (row.districtId ? [{ userId: row.userId, districtId: row.districtId }] : []))
    },

    async listPendingAlerts(actor: Actor, since: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      return db.select({
        id: localSafetyAlerts.id, prefecture: localSafetyAlerts.prefecture, category: localSafetyAlerts.category,
      }).from(localSafetyAlerts).where(and(
        gte(localSafetyAlerts.createdAt, since), isNull(localSafetyAlerts.pushNotifiedAt),
      )).orderBy(asc(localSafetyAlerts.createdAt)).limit(500)
    },

    async claimAlert(actor: Actor, alertId: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      const [existing] = await db.select().from(localSafetyAlerts)
        .where(eq(localSafetyAlerts.id, alertId)).limit(1)
      if (!existing) return { status: 'not_found' as const }
      if (existing.pushNotifiedAt) return { status: 'already_claimed' as const }
      if (!['suspicious', 'voice_call'].includes(existing.category)) return { status: 'skip' as const }
      const claimedAt = new Date().toISOString()
      const [claimed] = await db.update(localSafetyAlerts).set({ pushNotifiedAt: claimedAt })
        .where(and(eq(localSafetyAlerts.id, alertId), isNull(localSafetyAlerts.pushNotifiedAt))).returning()
      return claimed
        ? { status: 'claimed' as const, alert: claimed, claimedAt }
        : { status: 'already_claimed' as const }
    },

    async releaseAlertClaim(actor: Actor, alertId: string, claimedAt: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      await db.update(localSafetyAlerts).set({ pushNotifiedAt: null }).where(and(
        eq(localSafetyAlerts.id, alertId), eq(localSafetyAlerts.pushNotifiedAt, claimedAt),
      ))
    },

    async insertAlerts(actor: Actor, alerts: readonly LocalAlertWriteInput[]) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      assertCan(actor, 'insert', 'local_safety_alerts')
      if (!alerts.length) return []
      return db.insert(localSafetyAlerts).values(alerts.map((alert) => ({
        id: crypto.randomUUID(), prefecture: alert.prefecture, city: alert.city || null,
        category: alert.category, description: alert.description,
        sourceUrl: alert.source_url, occurredAt: alert.occurred_at,
      }))).onConflictDoNothing().returning({ id: localSafetyAlerts.id })
    },

    async listDigestAlerts(actor: Actor, since: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      const rows: Array<{ prefecture: string }> = []
      const pageSize = 1_000
      for (let offset = 0; ; offset += pageSize) {
        const page = await db.select({ prefecture: localSafetyAlerts.prefecture }).from(localSafetyAlerts)
          .where(gte(localSafetyAlerts.occurredAt, since)).limit(pageSize).offset(offset)
        rows.push(...page)
        if (page.length < pageSize) return rows
      }
    },

    async coverPendingAlerts(actor: Actor, since: string, notifiedAt: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      return db.update(localSafetyAlerts).set({ pushNotifiedAt: notifiedAt }).where(and(
        isNull(localSafetyAlerts.pushNotifiedAt), gte(localSafetyAlerts.createdAt, since),
      )).returning({ id: localSafetyAlerts.id })
    },
  }
}

export function listLocalSafetyAlerts(actor: Actor, input: { since: string; prefecture?: string; schoolDistrictId?: string; limit?: number }) { return createPushRepo(getDb()).listAlerts(actor, input) }
export function getPushSubscription(actor: Actor, endpoint: string) { return createPushRepo(getDb()).getSubscription(actor, endpoint) }
export function listPushSubscriptions(actor: Actor, input?: { preference?: string; userId?: string }) { return createPushRepo(getDb()).listSubscriptions(actor, input) }
export function upsertPushSubscription(actor: Actor, input: Parameters<ReturnType<typeof createPushRepo>['upsertSubscription']>[1]) { return createPushRepo(getDb()).upsertSubscription(actor, input) }
export function patchPushSubscription(actor: Actor, endpoint: string, input: Parameters<ReturnType<typeof createPushRepo>['patchSubscription']>[2]) { return createPushRepo(getDb()).patchSubscription(actor, endpoint, input) }
export function deletePushSubscription(actor: Actor, endpoint: string) { return createPushRepo(getDb()).deleteSubscription(actor, endpoint) }
export function deletePushSubscriptionById(actor: Actor, id: string) { return createPushRepo(getDb()).deleteSubscriptionById(actor, id) }
export function markPushSubscriptionsNotified(actor: Actor, ids: readonly string[], notifiedAt: string) {
  return createPushRepo(getDb()).markSubscriptionsNotified(actor, ids, notifiedAt)
}
export function listPendingDangerReportIds(actor: Actor, since: string) { return createPushRepo(getDb()).listPendingReportIds(actor, since) }
export function claimDangerReport(actor: Actor, reportId: string, userId?: string) { return createPushRepo(getDb()).claimReport(actor, reportId, userId) }
export function releaseDangerReportClaim(actor: Actor, reportId: string, claimedAt: string) { return createPushRepo(getDb()).releaseReportClaim(actor, reportId, claimedAt) }
export function confirmDangerReportClaim(actor: Actor, reportId: string, claimedAt: string) { return createPushRepo(getDb()).confirmReportClaim(actor, reportId, claimedAt) }
export function completeDangerReportClaim(actor: Actor, reportId: string, claimedAt: string) { return createPushRepo(getDb()).completeReportClaim(actor, reportId, claimedAt) }
export function listNotificationRoutes(actor: Actor) { return createPushRepo(getDb()).listRoutesWithGeometry(actor) }
export function listDistrictBoundariesAround(actor: Actor, report: { longitude: number; latitude: number; prefecture: string | null }) {
  return createPushRepo(getDb()).listDistrictBoundariesAround(actor, report)
}
export function listDistrictNotificationUsers(actor: Actor, districtIds: readonly string[]) {
  return createPushRepo(getDb()).listDistrictNotificationUsers(actor, districtIds)
}
export function listPendingLocalAlerts(actor: Actor, since: string) { return createPushRepo(getDb()).listPendingAlerts(actor, since) }
export function claimLocalAlert(actor: Actor, alertId: string) { return createPushRepo(getDb()).claimAlert(actor, alertId) }
export function releaseLocalAlertClaim(actor: Actor, alertId: string, claimedAt: string) { return createPushRepo(getDb()).releaseAlertClaim(actor, alertId, claimedAt) }
export function insertLocalAlerts(actor: Actor, alerts: readonly LocalAlertWriteInput[]) { return createPushRepo(getDb()).insertAlerts(actor, alerts) }
export function listDigestLocalAlerts(actor: Actor, since: string) { return createPushRepo(getDb()).listDigestAlerts(actor, since) }
export function coverPendingLocalAlerts(actor: Actor, since: string, notifiedAt: string) { return createPushRepo(getDb()).coverPendingAlerts(actor, since, notifiedAt) }
