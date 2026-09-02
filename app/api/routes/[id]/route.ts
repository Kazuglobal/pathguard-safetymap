import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { AuthzError } from '@/lib/db/authz'
import { deleteRoute, getRouteById, setPrimaryRoute, updateRoute } from '@/lib/db/repos/routes.repo'
import { toUserRouteJson } from '@/lib/route-api'
import { parseRouteWriteInput } from '@/lib/route-api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

function validId(id: string): boolean { return Boolean(id) && id.length <= 128 }

export async function GET(_request: Request, context: Context) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await context.params
    if (!validId(id)) return NextResponse.json({ error: 'Invalid route id' }, { status: 400 })
    const route = await getRouteById(actor, id)
    return route
      ? NextResponse.json({ route: toUserRouteJson(route) })
      : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Failed to get route' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: Context) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await context.params
    if (!validId(id)) return NextResponse.json({ error: 'Invalid route id' }, { status: 400 })
    const body = await request.json() as Record<string, unknown>
    const route = body.primary === true
      ? await setPrimaryRoute(actor, id)
      : await updateRoute(actor, id, parseRouteWriteInput(body))
    return route
      ? NextResponse.json({ route: toUserRouteJson(route) })
      : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: Context) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await context.params
    if (!validId(id)) return NextResponse.json({ error: 'Invalid route id' }, { status: 400 })
    return await deleteRoute(actor, id)
      ? NextResponse.json({ deleted: true })
      : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Failed to delete route' }, { status: 500 })
  }
}
