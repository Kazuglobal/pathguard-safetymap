import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { AuthzError } from '@/lib/db/authz'
import { getProfile, upsertOwnProfile } from '@/lib/db/repos/profiles.repo'
import { toProfileJson } from '@/lib/profile-api'

export const runtime = 'nodejs'

function optionalNullableString(body: Record<string, unknown>, key: string): string | null | undefined {
  const value = body[key]
  if (typeof value === 'string') return value
  if (value === null) return null
  return undefined
}

export async function GET() {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const profile = await getProfile(actor, actor.id)
    return NextResponse.json({ profile: toProfileJson(profile, actor.email) })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json() as Record<string, unknown>
    const profile = await upsertOwnProfile(actor, actor.email ?? '', {
      displayName: optionalNullableString(body, 'display_name'),
      fullName: optionalNullableString(body, 'full_name'),
    })
    return NextResponse.json({ profile: toProfileJson(profile, actor.email) })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
