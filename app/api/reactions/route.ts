import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { AuthzError } from '@/lib/db/authz'
import { listReactions, toggleReaction } from '@/lib/db/repos/social.repo'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ reactions: [] })
  try {
    const ids = new URL(request.url).searchParams.getAll('reportId')
    const rows = await listReactions(actor, ids)
    return NextResponse.json({ reactions: rows.map((row) => ({ report_id: row.reportId, reaction_type: row.reactionType })) })
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Failed to list reactions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json() as Record<string, unknown>
    if (typeof body.reportId !== 'string' || typeof body.reactionType !== 'string') throw new RangeError('Invalid reaction')
    return NextResponse.json(await toggleReaction(actor, body.reportId, body.reactionType))
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update reaction' }, { status: 500 })
  }
}
