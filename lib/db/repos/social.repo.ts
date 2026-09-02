import { and, count, desc, eq, inArray } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import {
  dangerReportReactions,
  dangerReports,
  profiles,
  reportBookmarks,
  reportComments,
  reportFlags,
  reportLikes,
} from '../schema'

function userIdForMutation(actor: Actor, table: 'report_likes' | 'report_bookmarks'): string {
  const ownerId = actor.kind === 'user' ? actor.id : null
  assertCan(actor, 'insert', table, { ownerId })
  if (actor.kind !== 'user') throw new Error('A user actor is required')
  return actor.id
}

function validateReportId(reportId: string): void {
  if (!reportId || reportId.length > 128) throw new RangeError('Invalid reportId')
}

export function createSocialRepo(db: AppDb) {
  return {
    async listReactions(actor: Actor, reportIds: readonly string[]) {
      if (actor.kind !== 'user') return []
      assertCan(actor, 'select', 'danger_report_reactions', { ownerId: actor.id })
      const ids = [...new Set(reportIds.filter(Boolean))]
      if (ids.length > 50) throw new RangeError('At most 50 report ids are allowed')
      if (!ids.length) return []
      return db.select({ reportId: dangerReportReactions.reportId, reactionType: dangerReportReactions.reactionType })
        .from(dangerReportReactions).where(and(
          eq(dangerReportReactions.userId, actor.id),
          inArray(dangerReportReactions.reportId, ids),
        ))
    },

    async toggleReaction(actor: Actor, reportId: string, reactionType: string) {
      validateReportId(reportId)
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      if (reactionType !== 'helpful' && reactionType !== 'caution') throw new RangeError('Invalid reaction type')
      assertCan(actor, 'insert', 'danger_report_reactions', { ownerId: actor.id })
      const existing = and(
        eq(dangerReportReactions.userId, actor.id),
        eq(dangerReportReactions.reportId, reportId),
        eq(dangerReportReactions.reactionType, reactionType),
      )
      const inserted = await db.insert(dangerReportReactions).values({
        id: crypto.randomUUID(), userId: actor.id, reportId, reactionType,
      }).onConflictDoNothing().returning({ id: dangerReportReactions.id })
      if (inserted.length) return { active: true }
      assertCan(actor, 'delete', 'danger_report_reactions', { ownerId: actor.id })
      await db.delete(dangerReportReactions).where(existing)
      return { active: false }
    },

    async listComments(actor: Actor, reportId: string) {
      validateReportId(reportId)
      const [report] = await db.select({ status: dangerReports.status }).from(dangerReports)
        .where(eq(dangerReports.id, reportId)).limit(1)
      if (!report) return null
      assertCan(actor, 'select', 'report_comments', {
        reportPublic: ['approved', 'published', 'resolved'].includes(report.status),
      })
      return db.select({
        id: reportComments.id, content: reportComments.content, createdAt: reportComments.createdAt,
        updatedAt: reportComments.updatedAt, userId: reportComments.userId, reportId: reportComments.reportId,
        isEdited: reportComments.isEdited, parentCommentId: reportComments.parentCommentId,
        displayName: profiles.displayName,
      }).from(reportComments).leftJoin(profiles, eq(profiles.id, reportComments.userId))
        .where(eq(reportComments.reportId, reportId)).orderBy(desc(reportComments.createdAt)).limit(500)
    },

    async addComment(actor: Actor, reportId: string, content: string, parentCommentId?: string | null) {
      validateReportId(reportId)
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      const trimmed = content.trim()
      if (!trimmed || trimmed.length > 1_000) throw new RangeError('Invalid comment')
      const [report] = await db.select({ status: dangerReports.status }).from(dangerReports)
        .where(eq(dangerReports.id, reportId)).limit(1)
      if (!report || !['approved', 'published', 'resolved'].includes(report.status)) throw new RangeError('Report not found')
      assertCan(actor, 'insert', 'report_comments', { ownerId: actor.id })
      const [created] = await db.insert(reportComments).values({
        id: crypto.randomUUID(), reportId, userId: actor.id, content: trimmed,
        parentCommentId: parentCommentId ?? null,
      }).returning()
      return created
    },

    async flagReport(actor: Actor, reportId: string, reason?: string | null) {
      validateReportId(reportId)
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'insert', 'report_flags', { ownerId: actor.id })
      if (reason != null && reason.length > 500) throw new RangeError('Reason is too long')
      const [report] = await db.select({ id: dangerReports.id }).from(dangerReports)
        .where(eq(dangerReports.id, reportId)).limit(1)
      if (!report) return null
      const [row] = await db.insert(reportFlags).values({
        id: crypto.randomUUID(), reporterUserId: actor.id, targetReportId: reportId,
        reason: reason?.trim() || null,
      }).returning()
      return row
    },

    async listInteractions(actor: Actor, reportIds: readonly string[]) {
      assertCan(actor, 'select', 'report_likes', { aggregateOnly: true })
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      const ids = [...new Set(reportIds.filter(Boolean))]
      if (ids.length === 0) return []
      if (ids.length > 50) throw new RangeError('At most 50 report ids are allowed')

      const [likes, bookmarks] = await Promise.all([
        db.select({ reportId: reportLikes.reportId, userId: reportLikes.userId })
          .from(reportLikes).where(inArray(reportLikes.reportId, ids)),
        db.select({ reportId: reportBookmarks.reportId, userId: reportBookmarks.userId })
          .from(reportBookmarks).where(inArray(reportBookmarks.reportId, ids)),
      ])
      const likeCounts = new Map<string, number>()
      const bookmarkCounts = new Map<string, number>()
      const userLikes = new Set<string>()
      const userBookmarks = new Set<string>()
      for (const like of likes) {
        likeCounts.set(like.reportId, (likeCounts.get(like.reportId) ?? 0) + 1)
        if (like.userId === actor.id) userLikes.add(like.reportId)
      }
      for (const bookmark of bookmarks) {
        bookmarkCounts.set(bookmark.reportId, (bookmarkCounts.get(bookmark.reportId) ?? 0) + 1)
        if (bookmark.userId === actor.id) userBookmarks.add(bookmark.reportId)
      }
      return ids.map((reportId) => ({
        reportId,
        liked: userLikes.has(reportId),
        likeCount: likeCounts.get(reportId) ?? 0,
        saved: userBookmarks.has(reportId),
        saveCount: bookmarkCounts.get(reportId) ?? 0,
      }))
    },

    async toggleLike(actor: Actor, reportId: string) {
      validateReportId(reportId)
      const userId = userIdForMutation(actor, 'report_likes')
      const inserted = await db.insert(reportLikes).values({
        id: crypto.randomUUID(),
        userId,
        reportId,
      }).onConflictDoNothing().returning({ id: reportLikes.id })

      const active = inserted.length > 0
      if (!active) {
        assertCan(actor, 'delete', 'report_likes', { ownerId: userId })
        await db.delete(reportLikes).where(and(
          eq(reportLikes.userId, userId),
          eq(reportLikes.reportId, reportId),
        ))
      }
      const [aggregate] = await db.select({ value: count() }).from(reportLikes)
        .where(eq(reportLikes.reportId, reportId))
      return { active, count: aggregate?.value ?? 0 }
    },

    async toggleBookmark(actor: Actor, reportId: string) {
      validateReportId(reportId)
      const userId = userIdForMutation(actor, 'report_bookmarks')
      const inserted = await db.insert(reportBookmarks).values({
        id: crypto.randomUUID(),
        userId,
        reportId,
      }).onConflictDoNothing().returning({ id: reportBookmarks.id })

      const active = inserted.length > 0
      if (!active) {
        assertCan(actor, 'delete', 'report_bookmarks', { ownerId: userId })
        await db.delete(reportBookmarks).where(and(
          eq(reportBookmarks.userId, userId),
          eq(reportBookmarks.reportId, reportId),
        ))
      }
      const [aggregate] = await db.select({ value: count() }).from(reportBookmarks)
        .where(eq(reportBookmarks.reportId, reportId))
      return { active, count: aggregate?.value ?? 0 }
    },
  }
}

export function toggleLike(actor: Actor, reportId: string) {
  return createSocialRepo(getDb()).toggleLike(actor, reportId)
}

export function toggleBookmark(actor: Actor, reportId: string) {
  return createSocialRepo(getDb()).toggleBookmark(actor, reportId)
}

export function listInteractions(actor: Actor, reportIds: readonly string[]) {
  return createSocialRepo(getDb()).listInteractions(actor, reportIds)
}

export function listReactions(actor: Actor, reportIds: readonly string[]) { return createSocialRepo(getDb()).listReactions(actor, reportIds) }
export function toggleReaction(actor: Actor, reportId: string, reactionType: string) {
  return createSocialRepo(getDb()).toggleReaction(actor, reportId, reactionType)
}
export function listComments(actor: Actor, reportId: string) { return createSocialRepo(getDb()).listComments(actor, reportId) }
export function addComment(actor: Actor, reportId: string, content: string, parentCommentId?: string | null) {
  return createSocialRepo(getDb()).addComment(actor, reportId, content, parentCommentId)
}
export function flagDangerReport(actor: Actor, reportId: string, reason?: string | null) {
  return createSocialRepo(getDb()).flagReport(actor, reportId, reason)
}
