import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { hotspotsInBbox } from '@/lib/db/repos/accident-hotspots.repo'

import { optionalNumber, requiredNumber, routeError } from '../route-utils'

/** 地図の表示範囲内の事故多発地点。 */
export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (actor.kind === 'anon') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const params = request.nextUrl.searchParams
    const result = await hotspotsInBbox(actor, {
      minLng: requiredNumber(params, 'minLng'),
      minLat: requiredNumber(params, 'minLat'),
      maxLng: requiredNumber(params, 'maxLng'),
      maxLat: requiredNumber(params, 'maxLat'),
      limit: optionalNumber(params, 'limit'),
    })
    return NextResponse.json(result)
  } catch (error) {
    return routeError(error)
  }
}
