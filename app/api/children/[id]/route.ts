import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { childErrorMessage, parseChildWriteInput, toChildJson } from '@/lib/children-api'
import { AuthzError } from '@/lib/db/authz'
import { deleteChild, updateChild } from '@/lib/db/repos/children.repo'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

function validId(id: string): boolean { return Boolean(id) && id.length <= 128 }

export async function PATCH(request: Request, context: Context) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await context.params
    if (!validId(id)) return NextResponse.json({ error: 'Invalid child id' }, { status: 400 })
    const child = await updateChild(actor, id, parseChildWriteInput(await request.json()))
    return child
      ? NextResponse.json({ child: toChildJson(child) })
      : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError) return NextResponse.json({ error: childErrorMessage(error) }, { status: 400 })
    if (error instanceof SyntaxError) return NextResponse.json({ error: '入力を確かめてください' }, { status: 400 })
    console.error('[api/children] update failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to update child' }, { status: 500 })
  }
}

/** 子どもを消す。その子の通学路は残し、子どもの指定だけを外す */
export async function DELETE(_request: Request, context: Context) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await context.params
    if (!validId(id)) return NextResponse.json({ error: 'Invalid child id' }, { status: 400 })
    return await deleteChild(actor, id)
      ? NextResponse.json({ deleted: true })
      : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[api/children] delete failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to delete child' }, { status: 500 })
  }
}
