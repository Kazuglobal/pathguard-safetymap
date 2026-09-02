import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { AuthzError } from '@/lib/db/authz'
import { createRoute, listRoutes } from '@/lib/db/repos/routes.repo'
import { parseRouteWriteInput, toUserRouteJson } from '@/lib/route-api'

export const runtime = 'nodejs'

export async function GET() {
  const actor = await getActor()
  if (actor.kind === 'anon') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const routes = await listRoutes(actor)
  return NextResponse.json({ routes: routes.map(toUserRouteJson) })
}

export async function POST(request: Request) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const route = await createRoute(actor, parseRouteWriteInput(await request.json()))
    return NextResponse.json({ route: toUserRouteJson(route) }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[api/routes] create failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 })
  }
}
