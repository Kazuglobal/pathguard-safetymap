import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { getUserPoints } from '@/lib/db/repos/gamification.repo'

export const runtime = 'nodejs'

export async function GET() {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ points: 0, level: 1 })
  const row = await getUserPoints(actor, actor.id)
  return NextResponse.json({ user_id: actor.id, points: row?.points ?? 0, level: row?.level ?? 1 })
}
