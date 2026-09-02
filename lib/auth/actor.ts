import { cache } from 'react'
import type { User } from '@supabase/supabase-js'

import { isAdminUser } from '@/lib/admin'
import type { Actor } from '@/lib/db/authz'
import { createServerClient } from '@/lib/supabase-server'

type ActorUser = Pick<User, 'id' | 'email'>

export function actorFromUser(user: ActorUser | null | undefined): Actor {
  if (!user) return { kind: 'anon' }

  return {
    kind: 'user',
    id: user.id,
    email: user.email ?? null,
    isAdmin: isAdminUser(user),
  }
}

/** Resolve and revalidate the actor against Supabase Auth for this request. */
export async function resolveActor(): Promise<Actor> {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.getUser()
    if (error) return { kind: 'anon' }
    return actorFromUser(data.user)
  } catch {
    return { kind: 'anon' }
  }
}

/** React cache deduplicates getUser() within a single server render/request. */
export const getActor = cache(resolveActor)
