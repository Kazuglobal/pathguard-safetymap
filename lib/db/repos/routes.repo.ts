import { and, desc, eq } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { children, profiles, routeLearningSessions, userRoutes } from '../schema'
import { coarsenRouteLocation, isLocationPrecision, type LocationPrecision } from '@/lib/route-privacy'

import { createChildrenRepo, legacyChildNameToNickname } from './children.repo'

/**
 * 子どもは通学路の行に名前を書かず、children 表の id で指す(UIUX改装 項目56)。
 * 入力欄の呼び名(childNickname)から children の行を探し、無ければ作る。
 * child_name 列には書かない(移行前の行に残っている値は、読むときに呼び名が無ければ使う)
 */
export interface RouteWriteInput {
  name?: string
  description?: string | null
  childId?: string | null
  childNickname?: string | null
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
}

export type UserRouteRow = typeof userRoutes.$inferSelect
/** 通学路の行に、その子の呼び名(children.nickname)を添えたもの */
export type UserRouteWithChild = UserRouteRow & { childNickname: string | null }

const routeWithChildColumns = { route: userRoutes, childNickname: children.nickname }

function withChild(rows: Array<{ route: UserRouteRow; childNickname: string | null }>): UserRouteWithChild[] {
  return rows.map(({ route, childNickname }) => ({ ...route, childNickname: childNickname ?? null }))
}

export function createRoutesRepo(db: AppDb) {
  const childrenRepo = createChildrenRepo(db)

  /** 持ち主が選んだ位置の保存のしかた(プロフィールが無ければ standard) */
  async function locationPrecisionOf(userId: string): Promise<LocationPrecision> {
    const [row] = await db.select({ locationPrecision: profiles.locationPrecision }).from(profiles)
      .where(eq(profiles.id, userId)).limit(1)
    return isLocationPrecision(row?.locationPrecision) ? row.locationPrecision : 'standard'
  }

  /**
   * 書き込む child_id を決める。undefined は「変えない」。
   * 呼び名が来ていればそれを優先し、id だけなら本人の子どもの id のときだけ使う
   * (以前の「child-呼び名」形式の id などは捨てる)
   */
  async function resolveChildId(actor: Actor, input: RouteWriteInput): Promise<string | null | undefined> {
    if (input.childNickname !== undefined) {
      const nickname = input.childNickname?.trim()
      if (!nickname) return null
      return (await childrenRepo.findOrCreateByNickname(actor, nickname)).id
    }
    if (input.childId !== undefined) {
      if (!input.childId) return null
      return (await childrenRepo.getOwn(actor, input.childId))?.id ?? null
    }
    return undefined
  }

  /**
   * 移行前の行(child_name に名前が残り、children の行が無い)を保存するときは、その名前を
   * 未確認の呼び名として children へ移す。移せなければ(長さ・上限など)子どもの指定を外す
   */
  async function migrateLegacyChild(actor: Actor, existing: UserRouteWithChild): Promise<string | null | undefined> {
    if (!existing.childName || existing.childNickname) return undefined
    const nickname = legacyChildNameToNickname(existing.childName)
    if (!nickname) return null
    try {
      return (await childrenRepo.findOrCreateByNickname(actor, nickname, { confirmed: false })).id
    } catch (error) {
      if (error instanceof RangeError) return null
      throw error
    }
  }

  return {
    async list(actor: Actor): Promise<UserRouteWithChild[]> {
      if (actor.kind !== 'user') {
        assertCan(actor, 'select', 'user_routes')
        return []
      }
      assertCan(actor, 'select', 'user_routes', { ownerId: actor.id })
      const rows = await db.select(routeWithChildColumns).from(userRoutes)
        .leftJoin(children, and(eq(children.id, userRoutes.childId), eq(children.userId, userRoutes.userId)))
        .where(eq(userRoutes.userId, actor.id))
        .orderBy(desc(userRoutes.isFavorite), desc(userRoutes.updatedAt)).limit(200)
      return withChild(rows)
    },

    async getById(actor: Actor, routeId: string): Promise<UserRouteWithChild | null> {
      if (actor.kind === 'anon') {
        assertCan(actor, 'select', 'user_routes')
        return null
      }
      const predicate = actor.kind === 'service'
        ? eq(userRoutes.id, routeId)
        : and(eq(userRoutes.id, routeId), eq(userRoutes.userId, actor.id))
      const [route] = withChild(await db.select(routeWithChildColumns).from(userRoutes)
        .leftJoin(children, and(eq(children.id, userRoutes.childId), eq(children.userId, userRoutes.userId)))
        .where(predicate).limit(1))
      if (!route) return null
      assertCan(actor, 'select', 'user_routes', { ownerId: route.userId })
      return route
    },

    async create(actor: Actor, input: RouteWriteInput) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'insert', 'user_routes', { ownerId: actor.id })
      validateRoute(input, true)
      const childId = (await resolveChildId(actor, input)) ?? null
      // 道すじの両端を200m以上削り、起点・終点・住所を粗くしてから保存する(UIUX改装 項目59)
      const located = coarsenRouteLocation(input, await locationPrecisionOf(actor.id))
      const now = new Date().toISOString()
      const [created] = await db.insert(userRoutes).values({
        id: crypto.randomUUID(), userId: actor.id, name: input.name!.trim(),
        description: input.description?.trim() || null,
        childId, childName: null,
        startLat: located.startLat!, startLng: located.startLng!, endLat: located.endLat!, endLng: located.endLng!,
        startAddress: located.startAddress!, endAddress: located.endAddress!,
        routeGeometry: located.routeGeometry ?? null,
        distanceMeters: input.distanceMeters ?? null,
        estimatedTimeMinutes: input.estimatedTimeMinutes ?? null,
        isFavorite: input.isFavorite ?? false, createdAt: now, updatedAt: now,
      }).returning()
      if (!created) throw new Error('Failed to create route')
      return (await this.getById(actor, created.id)) ?? { ...created, childNickname: null }
    },

    async update(actor: Actor, routeId: string, input: RouteWriteInput) {
      const existing = await this.getById(actor, routeId)
      if (!existing) return null
      assertCan(actor, 'update', 'user_routes', { ownerId: existing.userId })
      validateRoute(input, false)
      // 編集画面は移行前の名前(child_name)を呼び名の欄に入れて送ってくる。同じ名前のままなら、
      // 本人が「呼び名」として確かめたものではないので、未確認の呼び名として移す
      const legacyNickname = existing.childName && !existing.childNickname ? legacyChildNameToNickname(existing.childName) : null
      const sendsLegacyName = legacyNickname !== null && input.childNickname != null
        && legacyChildNameToNickname(input.childNickname) === legacyNickname
      const requestedChildId = sendsLegacyName ? undefined : await resolveChildId(actor, input)
      const childId = requestedChildId !== undefined ? requestedChildId : await migrateLegacyChild(actor, existing)
      const precision = await locationPrecisionOf(existing.userId)
      // 保存してある線をそのまま送り直されたときは、もう一度削らない(削るたびに線が短くなるため)
      const resendsStoredLine = precision === 'standard' && input.routeGeometry != null && existing.routeGeometry != null
        && JSON.stringify(input.routeGeometry) === JSON.stringify(existing.routeGeometry)
      const located = coarsenRouteLocation(resendsStoredLine ? { ...input, routeGeometry: undefined } : input, precision)
      const [updated] = await db.update(userRoutes).set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(childId !== undefined ? { childId } : {}),
        // 移行前の行に子どもの名前が残っていれば、保存のたびに消す
        childName: null,
        ...(located.startLat !== undefined ? { startLat: located.startLat } : {}),
        ...(located.startLng !== undefined ? { startLng: located.startLng } : {}),
        ...(located.endLat !== undefined ? { endLat: located.endLat } : {}),
        ...(located.endLng !== undefined ? { endLng: located.endLng } : {}),
        ...(located.startAddress !== undefined ? { startAddress: located.startAddress } : {}),
        ...(located.endAddress !== undefined ? { endAddress: located.endAddress } : {}),
        ...(located.routeGeometry !== undefined ? { routeGeometry: located.routeGeometry } : {}),
        ...(input.distanceMeters !== undefined ? { distanceMeters: input.distanceMeters } : {}),
        ...(input.estimatedTimeMinutes !== undefined ? { estimatedTimeMinutes: input.estimatedTimeMinutes } : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        updatedAt: new Date().toISOString(),
      }).where(and(eq(userRoutes.id, routeId), eq(userRoutes.userId, existing.userId))).returning()
      if (!updated) return null
      return this.getById(actor, updated.id)
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
      // 子どもの名前は持たない。id は本人の子どものものだけを残す
      const childId = input.childId ? (await childrenRepo.getOwn(actor, input.childId))?.id ?? null : null
      const now = new Date().toISOString()
      const [row] = await db.insert(routeLearningSessions).values({
        ...input, childId, childName: null, id: input.id || crypto.randomUUID(), updatedAt: now,
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
