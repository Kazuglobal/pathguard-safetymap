import type { profiles } from '@/lib/db/schema'
import { publicMediaUrl } from '@/lib/media/url'

type ProfileRow = typeof profiles.$inferSelect

export function toProfileJson(profile: ProfileRow | null, fallbackEmail: string | null = null) {
  return {
    id: profile?.id ?? null,
    email: profile?.email ?? fallbackEmail,
    display_name: profile?.displayName ?? null,
    full_name: profile?.fullName ?? null,
    avatar_url: profile?.avatarKey ? publicMediaUrl(profile.avatarKey) : null,
    created_at: profile?.createdAt ?? null,
    updated_at: profile?.updatedAt ?? null,
  }
}
