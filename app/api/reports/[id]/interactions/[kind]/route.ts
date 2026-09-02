import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { AuthzError } from '@/lib/db/authz'
import { toggleBookmark, toggleLike } from '@/lib/db/repos/social.repo'

type RouteContext = { params: Promise<{ id: string; kind: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const actor = await getActor()
  if (actor.kind === 'anon') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id, kind } = await context.params
    if (kind !== 'like' && kind !== 'bookmark') {
      return NextResponse.json({ error: 'Unknown interaction' }, { status: 404 })
    }
    const result = kind === 'like'
      ? await toggleLike(actor, id)
      : await toggleBookmark(actor, id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Failed to toggle report interaction:', error)
    return NextResponse.json({ error: 'リアクションの更新に失敗しました' }, { status: 500 })
  }
}
