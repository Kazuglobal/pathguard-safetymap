import { and, desc, eq } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { notifications } from '../schema'

export function createNotificationsRepo(db: AppDb) {
  return {
    async list(actor: Actor) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'select', 'notifications', { ownerId: actor.id })
      return db.select().from(notifications).where(eq(notifications.userId, actor.id))
        .orderBy(desc(notifications.createdAt)).limit(50)
    },

    async markRead(actor: Actor, notificationId?: string) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'update', 'notifications', { ownerId: actor.id, changedFields: ['is_read'] })
      await db.update(notifications).set({ isRead: true }).where(notificationId
        ? and(eq(notifications.id, notificationId), eq(notifications.userId, actor.id))
        : and(eq(notifications.userId, actor.id), eq(notifications.isRead, false)))
    },

    async createRouteReportNotification(
      actor: Actor,
      input: { reportId: string; reportTitle: string; routeId?: string | null; routeName: string },
    ) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'insert', 'notifications', {
        targetUserId: actor.id,
        notificationType: 'route_report',
        reportId: input.reportId,
      })
      if (!input.routeName.trim() || input.routeName.length > 100) throw new RangeError('Invalid routeName')
      if (input.routeId && input.routeId.length > 128) throw new RangeError('Invalid routeId')
      const [created] = await db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: actor.id,
        reportId: input.reportId,
        type: 'route_report',
        title: `${input.routeName.trim()}に新しい危険報告があります`,
        content: `「${input.reportTitle}」として報告されました。家族にも共有して見直してください。`,
        link: input.routeId ? `/map?routeId=${encodeURIComponent(input.routeId)}` : '/map',
      }).returning()
      return created
    },
  }
}

export function createRouteReportNotification(
  actor: Actor,
  input: { reportId: string; reportTitle: string; routeId?: string | null; routeName: string },
) {
  return createNotificationsRepo(getDb()).createRouteReportNotification(actor, input)
}

export function listNotifications(actor: Actor) { return createNotificationsRepo(getDb()).list(actor) }
export function markNotificationsRead(actor: Actor, notificationId?: string) {
  return createNotificationsRepo(getDb()).markRead(actor, notificationId)
}
