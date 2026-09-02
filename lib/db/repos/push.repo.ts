import { and, asc, desc, eq, gte, isNull } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { dangerReports, localSafetyAlerts, pushSubscriptions, userRoutes } from '../schema'

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
    async listAlerts(actor: Actor, input: { since: string; prefecture?: string; limit?: number }) {
      assertCan(actor, 'select', 'local_safety_alerts')
      const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 50)))
      const predicates = [gte(localSafetyAlerts.occurredAt, input.since)]
      if (input.prefecture) predicates.push(eq(localSafetyAlerts.prefecture, input.prefecture))
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

    async listPendingReportIds(actor: Actor, since: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      return db.select({ id: dangerReports.id }).from(dangerReports).where(and(
        gte(dangerReports.createdAt, since), isNull(dangerReports.pushNotifiedAt),
      )).orderBy(asc(dangerReports.createdAt)).limit(500)
    },

    async claimReport(actor: Actor, reportId: string, userId?: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      const predicates = [eq(dangerReports.id, reportId)]
      if (userId) predicates.push(eq(dangerReports.userId, userId))
      const [existing] = await db.select({
        id: dangerReports.id, title: dangerReports.title, latitude: dangerReports.latitude,
        longitude: dangerReports.longitude, pushNotifiedAt: dangerReports.pushNotifiedAt,
      }).from(dangerReports).where(and(...predicates)).limit(1)
      if (!existing) return { status: 'not_found' as const }
      if (existing.pushNotifiedAt) return { status: 'already_claimed' as const }
      const claimedAt = new Date().toISOString()
      const [claimed] = await db.update(dangerReports).set({ pushNotifiedAt: claimedAt })
        .where(and(...predicates, isNull(dangerReports.pushNotifiedAt))).returning({
          id: dangerReports.id, title: dangerReports.title,
          latitude: dangerReports.latitude, longitude: dangerReports.longitude,
        })
      return claimed
        ? { status: 'claimed' as const, report: claimed, claimedAt }
        : { status: 'already_claimed' as const }
    },

    async releaseReportClaim(actor: Actor, reportId: string, claimedAt: string) {
      if (actor.kind !== 'service') throw new Error('Service actor is required')
      await db.update(dangerReports).set({ pushNotifiedAt: null }).where(and(
        eq(dangerReports.id, reportId), eq(dangerReports.pushNotifiedAt, claimedAt),
      ))
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

export function listLocalSafetyAlerts(actor: Actor, input: { since: string; prefecture?: string; limit?: number }) { return createPushRepo(getDb()).listAlerts(actor, input) }
export function getPushSubscription(actor: Actor, endpoint: string) { return createPushRepo(getDb()).getSubscription(actor, endpoint) }
export function listPushSubscriptions(actor: Actor, input?: { preference?: string; userId?: string }) { return createPushRepo(getDb()).listSubscriptions(actor, input) }
export function upsertPushSubscription(actor: Actor, input: Parameters<ReturnType<typeof createPushRepo>['upsertSubscription']>[1]) { return createPushRepo(getDb()).upsertSubscription(actor, input) }
export function patchPushSubscription(actor: Actor, endpoint: string, input: Parameters<ReturnType<typeof createPushRepo>['patchSubscription']>[2]) { return createPushRepo(getDb()).patchSubscription(actor, endpoint, input) }
export function deletePushSubscription(actor: Actor, endpoint: string) { return createPushRepo(getDb()).deleteSubscription(actor, endpoint) }
export function deletePushSubscriptionById(actor: Actor, id: string) { return createPushRepo(getDb()).deleteSubscriptionById(actor, id) }
export function listPendingDangerReportIds(actor: Actor, since: string) { return createPushRepo(getDb()).listPendingReportIds(actor, since) }
export function claimDangerReport(actor: Actor, reportId: string, userId?: string) { return createPushRepo(getDb()).claimReport(actor, reportId, userId) }
export function releaseDangerReportClaim(actor: Actor, reportId: string, claimedAt: string) { return createPushRepo(getDb()).releaseReportClaim(actor, reportId, claimedAt) }
export function listNotificationRoutes(actor: Actor) { return createPushRepo(getDb()).listRoutesWithGeometry(actor) }
export function listPendingLocalAlerts(actor: Actor, since: string) { return createPushRepo(getDb()).listPendingAlerts(actor, since) }
export function claimLocalAlert(actor: Actor, alertId: string) { return createPushRepo(getDb()).claimAlert(actor, alertId) }
export function releaseLocalAlertClaim(actor: Actor, alertId: string, claimedAt: string) { return createPushRepo(getDb()).releaseAlertClaim(actor, alertId, claimedAt) }
export function insertLocalAlerts(actor: Actor, alerts: readonly LocalAlertWriteInput[]) { return createPushRepo(getDb()).insertAlerts(actor, alerts) }
export function listDigestLocalAlerts(actor: Actor, since: string) { return createPushRepo(getDb()).listDigestAlerts(actor, since) }
export function coverPendingLocalAlerts(actor: Actor, since: string, notifiedAt: string) { return createPushRepo(getDb()).coverPendingAlerts(actor, since, notifiedAt) }
