import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { AuthzError } from '@/lib/db/authz'
import { listInteractions } from '@/lib/db/repos/social.repo'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (actor.kind === 'anon') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const ids = request.nextUrl.searchParams.getAll('id')
    return NextResponse.json({ interactions: await listInteractions(actor, ids) })
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Failed to list report interactions:', error)
    return NextResponse.json({ error: 'リアクションの取得に失敗しました' }, { status: 500 })
  }
}
