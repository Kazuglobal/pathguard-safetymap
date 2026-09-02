import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { nearbyStats } from '@/lib/db/repos/accidents.repo'

import { optionalNumber, requiredNumber, routeError } from '../route-utils'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (actor.kind === 'anon') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const params = request.nextUrl.searchParams
    const result = await nearbyStats(actor, {
      latitude: requiredNumber(params, 'latitude'),
      longitude: requiredNumber(params, 'longitude'),
      radiusMeters: optionalNumber(params, 'radiusMeters'),
      years: optionalNumber(params, 'years'),
    })
    return NextResponse.json(result)
  } catch (error) {
    return routeError(error)
  }
}
