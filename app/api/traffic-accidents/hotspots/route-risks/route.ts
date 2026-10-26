import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { hotspotsAlongRoute } from '@/lib/db/repos/accident-hotspots.repo'
import { getRouteById } from '@/lib/db/repos/routes.repo'

import { routeError } from '../../route-utils'

/** 登録した通学路（本人のルートのみ）の近くを通る事故多発地点。 */
export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (actor.kind === 'anon') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const routeId = request.nextUrl.searchParams.get('routeId')
    if (!routeId || routeId.length > 128) throw new RangeError('routeId is required')

    const route = await getRouteById(actor, routeId)
    if (!route) return NextResponse.json({ error: 'ルートが見つかりません' }, { status: 404 })

    const geometry = route.routeGeometry as { type?: unknown; coordinates?: unknown } | null
    if (!geometry || geometry.type !== 'LineString') {
      return NextResponse.json({ hotspots: [], truncated: false })
    }
    return NextResponse.json(await hotspotsAlongRoute(actor, geometry.coordinates))
  } catch (error) {
    return routeError(error)
  }
}
