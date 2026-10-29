import { eq, sql } from 'drizzle-orm'

import { isLocationPrecision, ROUTE_COARSE_ENDPOINT_DECIMALS, type LocationPrecision } from '@/lib/route-privacy'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { profiles, userRoutes } from '../schema'

/**
 * 本人が変えられる項目。氏名(full_name)は預からない設計になったので受け付けない(UIUX改装 項目55)。
 * 列は古いコードが読まなくなってから消す(グループ3)。それまでは保存のたびに空にする
 */
export interface ProfileUpdateInput {
  displayName?: string | null
  avatarKey?: string | null
  /** 位置の保存のしかた(UIUX改装 項目59)。coarse にすると、保存済みの通学路も粗くする */
  locationPrecision?: LocationPrecision
}

function validate(input: ProfileUpdateInput): void {
  if (input.displayName != null && (!input.displayName.trim() || input.displayName.length > 100)) {
    throw new RangeError('Invalid display name')
  }
  if (input.avatarKey != null && !/^avatars\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\.webp$/.test(input.avatarKey)) {
    throw new RangeError('Invalid avatar key')
  }
  if (input.locationPrecision !== undefined && !isLocationPrecision(input.locationPrecision)) {
    throw new RangeError('Invalid location precision')
  }
}

const FIELD_COLUMNS: Record<keyof ProfileUpdateInput, string> = {
  displayName: 'display_name',
  avatarKey: 'avatar_key',
  locationPrecision: 'location_precision',
}

export function createProfilesRepo(db: AppDb) {
  return {
    async get(actor: Actor, userId: string) {
      const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
      if (!row) return null
      assertCan(actor, 'select', 'profiles', {
        ownerId: row.id,
        displayOnly: actor.kind !== 'user' || actor.id !== row.id,
      })
      return row
    },

    async upsertOwn(actor: Actor, email: string, input: ProfileUpdateInput) {
      if (actor.kind !== 'user') throw new Error('A user actor is required')
      assertCan(actor, 'update', 'profiles', {
        ownerId: actor.id,
        changedFields: (Object.keys(input) as Array<keyof ProfileUpdateInput>).map((key) => FIELD_COLUMNS[key]),
      })
      validate(input)
      const now = new Date().toISOString()
      const [row] = await db.insert(profiles).values({
        id: actor.id,
        email,
        displayName: input.displayName?.trim() || null,
        avatarKey: input.avatarKey ?? null,
        locationPrecision: input.locationPrecision ?? 'standard',
        role: 'user',
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: profiles.id,
        set: {
          email,
          ...(input.displayName !== undefined ? { displayName: input.displayName?.trim() || null } : {}),
          ...(input.avatarKey !== undefined ? { avatarKey: input.avatarKey } : {}),
          ...(input.locationPrecision !== undefined ? { locationPrecision: input.locationPrecision } : {}),
          // 以前に預かった氏名が残っていれば、本人がプロフィールを保存したときに消す
          fullName: null,
          updatedAt: now,
        },
      }).returning()
      if (!row) throw new Error('Failed to update profile')
      if (input.locationPrecision === 'coarse') {
        // 「粗く保存」にしたら、保存済みの通学路からも道すじを消し、起点・終点を約10kmに丸める
        assertCan(actor, 'update', 'user_routes', { ownerId: actor.id })
        await db.update(userRoutes).set({
          routeGeometry: null,
          startLat: sql`round(${userRoutes.startLat}, ${ROUTE_COARSE_ENDPOINT_DECIMALS})`,
          startLng: sql`round(${userRoutes.startLng}, ${ROUTE_COARSE_ENDPOINT_DECIMALS})`,
          endLat: sql`round(${userRoutes.endLat}, ${ROUTE_COARSE_ENDPOINT_DECIMALS})`,
          endLng: sql`round(${userRoutes.endLng}, ${ROUTE_COARSE_ENDPOINT_DECIMALS})`,
          updatedAt: now,
        }).where(eq(userRoutes.userId, actor.id))
      }
      return row
    },
  }
}

export function getProfile(actor: Actor, userId: string) { return createProfilesRepo(getDb()).get(actor, userId) }
export function upsertOwnProfile(actor: Actor, email: string, input: ProfileUpdateInput) {
  return createProfilesRepo(getDb()).upsertOwn(actor, email, input)
}
