import { and, desc, eq } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { routeLearningSessions, userRoutes } from '../schema'

export interface RouteWriteInput {
  name?: string
  description?: string | null
  childId?: string | null
  childName?: string | null
  startLat?: number
  startLng?: number
  endLat?: number
  endLng?: number
  startAddress?: string
  endAddress?: string
  routeGeometry?: Record<string, unknown> | null
  distanceMeters?: number | null
  estimatedTimeMinutes?: number | null
  isFavorite?: boolean
}

function validateRoute(input: RouteWriteInput, create: boolean): void {
  if (create && (!input.name || input.startLat == null || input.startLng == null
    || input.endLat == null || input.endLng == null || !input.startAddress || !input.endAddress)) {
    throw new RangeError('Missing required route fields')
  }
  if (input.name != null && (!input.name.trim() || input.name.length > 100)) throw new RangeError('Invalid route name')
  for (const [value, min, max] of [
    [input.startLat, -90, 90], [input.endLat, -90, 90],
    [input.startLng, -180, 180], [input.endLng, -180, 180],
  ] as const) {
    if (value != null && (!Number.isFinite(value) || value < min || value > max)) throw new RangeError('Invalid route coordinates')
  }
  if (input.description != null && input.description.length > 2_000) throw new RangeError('Route description is too long')
  if (input.childName != null && input.childName.length > 100) throw new RangeError('Child name is too long')
}

export function createRoutesRepo(db: AppDb) {
  return {
    async list(actor: Actor) {
      if (actor.kind !== 'user') {
        assertCan(actor, 'select', 'user_routes')
        return []
      }
      assertCan(actor, 'select', 'user_routes', { ownerId: actor.id })
      return db.select().from(userRoutes).where(eq(userRoutes.userId, actor.id))
        .orderBy(desc(userRoutes.isFavorite), desc(userRoutes.updatedAt)).limit(200)
    },

    async getById(actor: Actor, routeId: string) {
      if (actor.kind === 'anon') {
        assertCan(actor, 'select', 'user_routes')
        return null
      }
      const predicate = actor.kind === 'service'
        ? eq(userRoutes.id, routeId)
        : and(eq(userRoutes.id, routeId), eq(userRoutes.userId, actor.id))
      const [route] = await db.select().from(userRoutes).where(predicate).limit(1)
      if (!route) return null
      assertCan(actor, 'select', 'user_routes', { ownerId: route.userId })
      return route
    },

    async create(actor: Actor, input: RouteWriteInput) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'insert', 'user_routes', { ownerId: actor.id })
      validateRoute(input, true)
      const now = new Date().toISOString()
      const [created] = await db.insert(userRoutes).values({
        id: crypto.randomUUID(), userId: actor.id, name: input.name!.trim(),
        description: input.description?.trim() || null,
        childId: input.childId ?? null, childName: input.childName?.trim() || null,
        startLat: input.startLat!, startLng: input.startLng!, endLat: input.endLat!, endLng: input.endLng!,
        startAddress: input.startAddress!.trim(), endAddress: input.endAddress!.trim(),
        routeGeometry: input.routeGeometry ?? null,
        distanceMeters: input.distanceMeters ?? null,
        estimatedTimeMinutes: input.estimatedTimeMinutes ?? null,
        isFavorite: input.isFavorite ?? false, createdAt: now, updatedAt: now,
      }).returning()
      if (!created) throw new Error('Failed to create route')
      return created
    },

    async update(actor: Actor, routeId: string, input: RouteWriteInput) {
      const existing = await this.getById(actor, routeId)
      if (!existing) return null
      assertCan(actor, 'update', 'user_routes', { ownerId: existing.userId })
      validateRoute(input, false)
      const [updated] = await db.update(userRoutes).set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.childId !== undefined ? { childId: input.childId } : {}),
        ...(input.childName !== undefined ? { childName: input.childName?.trim() || null } : {}),
        ...(input.startLat !== undefined ? { startLat: input.startLat } : {}),
        ...(input.startLng !== undefined ? { startLng: input.startLng } : {}),
        ...(input.endLat !== undefined ? { endLat: input.endLat } : {}),
        ...(input.endLng !== undefined ? { endLng: input.endLng } : {}),
        ...(input.startAddress !== undefined ? { startAddress: input.startAddress.trim() } : {}),
        ...(input.endAddress !== undefined ? { endAddress: input.endAddress.trim() } : {}),
        ...(input.routeGeometry !== undefined ? { routeGeometry: input.routeGeometry } : {}),
        ...(input.distanceMeters !== undefined ? { distanceMeters: input.distanceMeters } : {}),
        ...(input.estimatedTimeMinutes !== undefined ? { estimatedTimeMinutes: input.estimatedTimeMinutes } : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        updatedAt: new Date().toISOString(),
      }).where(and(eq(userRoutes.id, routeId), eq(userRoutes.userId, existing.userId))).returning()
      return updated ?? null
    },

    async delete(actor: Actor, routeId: string) {
      const existing = await this.getById(actor, routeId)
      if (!existing) return false
      assertCan(actor, 'delete', 'user_routes', { ownerId: existing.userId })
      await db.delete(userRoutes).where(and(eq(userRoutes.id, routeId), eq(userRoutes.userId, existing.userId)))
      return true
    },

    async setPrimary(actor: Actor, routeId: string) {
      const existing = await this.getById(actor, routeId)
      if (!existing) return null
      assertCan(actor, 'update', 'user_routes', { ownerId: existing.userId })
      const now = new Date().toISOString()
      await db.batch([
        db.update(userRoutes).set({ isFavorite: false, updatedAt: now }).where(eq(userRoutes.userId, existing.userId)),
        db.update(userRoutes).set({ isFavorite: true, updatedAt: now })
          .where(and(eq(userRoutes.id, routeId), eq(userRoutes.userId, existing.userId))),
      ])
      return this.getById(actor, routeId)
    },

    async upsertLearningSession(actor: Actor, input: typeof routeLearningSessions.$inferInsert) {
      if (actor.kind !== 'user' || input.userId !== actor.id) throw new Error('A user actor is required')
      const route = await this.getById(actor, input.routeId)
      if (!route) throw new RangeError('Route not found')
      assertCan(actor, 'insert', 'route_learning_sessions', { ownerId: actor.id })
      const now = new Date().toISOString()
      const [row] = await db.insert(routeLearningSessions).values({
        ...input, id: input.id || crypto.randomUUID(), updatedAt: now,
      }).onConflictDoUpdate({
        target: [routeLearningSessions.userId, routeLearningSessions.routeId, routeLearningSessions.sessionId],
        set: {
          completedAt: input.completedAt, reviewedCount: input.reviewedCount, savedCount: input.savedCount,
          quizScore: input.quizScore, quizTotal: input.quizTotal, checklist: input.checklist,
          stopResults: input.stopResults, updatedAt: now,
        },
      }).returning()
      return row
    },
  }
}

export function getRouteById(actor: Actor, routeId: string) {
  return createRoutesRepo(getDb()).getById(actor, routeId)
}

export function listRoutes(actor: Actor) { return createRoutesRepo(getDb()).list(actor) }
export function createRoute(actor: Actor, input: RouteWriteInput) { return createRoutesRepo(getDb()).create(actor, input) }
export function updateRoute(actor: Actor, routeId: string, input: RouteWriteInput) { return createRoutesRepo(getDb()).update(actor, routeId, input) }
export function deleteRoute(actor: Actor, routeId: string) { return createRoutesRepo(getDb()).delete(actor, routeId) }
export function setPrimaryRoute(actor: Actor, routeId: string) { return createRoutesRepo(getDb()).setPrimary(actor, routeId) }
export function upsertRouteLearningSession(actor: Actor, input: typeof routeLearningSessions.$inferInsert) {
  return createRoutesRepo(getDb()).upsertLearningSession(actor, input)
}
