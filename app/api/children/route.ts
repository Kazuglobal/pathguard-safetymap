import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { childErrorMessage, parseChildWriteInput, toChildJson } from '@/lib/children-api'
import { AuthzError } from '@/lib/db/authz'
import { createChild, listChildren } from '@/lib/db/repos/children.repo'

export const runtime = 'nodejs'

/** 自分の子どもの登録(呼び名・学年・学区)。本人だけが読み書きできる(UIUX改装 項目56) */
export async function GET() {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const children = await listChildren(actor)
    return NextResponse.json({ children: children.map(toChildJson) })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[api/children] list failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to load children' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const child = await createChild(actor, parseChildWriteInput(await request.json()))
    return NextResponse.json({ child: toChildJson(child) }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError) return NextResponse.json({ error: childErrorMessage(error) }, { status: 400 })
    if (error instanceof SyntaxError) return NextResponse.json({ error: '入力を確かめてください' }, { status: 400 })
    console.error('[api/children] create failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to create child' }, { status: 500 })
  }
}
