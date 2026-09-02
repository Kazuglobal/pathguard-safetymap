import { eq } from 'drizzle-orm'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { profiles } from '../schema'

export interface ProfileUpdateInput {
  displayName?: string | null
  fullName?: string | null
  avatarKey?: string | null
}

function validate(input: ProfileUpdateInput): void {
  if (input.displayName != null && (!input.displayName.trim() || input.displayName.length > 100)) {
    throw new RangeError('Invalid display name')
  }
  if (input.fullName != null && input.fullName.length > 200) throw new RangeError('Invalid full name')
  if (input.avatarKey != null && !/^avatars\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{1,128}\.webp$/.test(input.avatarKey)) {
    throw new RangeError('Invalid avatar key')
  }
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
        changedFields: Object.keys(input).map((key) => key === 'displayName' ? 'display_name' : key === 'fullName' ? 'full_name' : 'avatar_key'),
      })
      validate(input)
      const now = new Date().toISOString()
      const [row] = await db.insert(profiles).values({
        id: actor.id,
        email,
        displayName: input.displayName?.trim() || null,
        fullName: input.fullName?.trim() || null,
        avatarKey: input.avatarKey ?? null,
        role: 'user',
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: profiles.id,
        set: {
          email,
          ...(input.displayName !== undefined ? { displayName: input.displayName?.trim() || null } : {}),
          ...(input.fullName !== undefined ? { fullName: input.fullName?.trim() || null } : {}),
          ...(input.avatarKey !== undefined ? { avatarKey: input.avatarKey } : {}),
          updatedAt: now,
        },
      }).returning()
      if (!row) throw new Error('Failed to update profile')
      return row
    },
  }
}

export function getProfile(actor: Actor, userId: string) { return createProfilesRepo(getDb()).get(actor, userId) }
export function upsertOwnProfile(actor: Actor, email: string, input: ProfileUpdateInput) {
  return createProfilesRepo(getDb()).upsertOwn(actor, email, input)
}
