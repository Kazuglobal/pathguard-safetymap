import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { accidentsInBbox } from '@/lib/db/repos/accidents.repo'

import { requiredNumber, routeError, trueOrNull } from '../route-utils'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (actor.kind === 'anon') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const params = request.nextUrl.searchParams
    const severityValue = params.get('severity') ?? 'all'
    if (severityValue !== 'all' && severityValue !== 'fatal') {
      throw new RangeError('severity must be all or fatal')
    }

    const result = await accidentsInBbox(actor, {
      minLng: requiredNumber(params, 'minLng'),
      minLat: requiredNumber(params, 'minLat'),
      maxLng: requiredNumber(params, 'maxLng'),
      maxLat: requiredNumber(params, 'maxLat'),
      minYear: requiredNumber(params, 'minYear'),
      maxYear: requiredNumber(params, 'maxYear'),
      severity: severityValue,
      child: trueOrNull(params, 'child'),
      young: trueOrNull(params, 'young'),
      pedestrian: trueOrNull(params, 'pedestrian'),
      limit: requiredNumber(params, 'limit'),
    })
    return NextResponse.json(result)
  } catch (error) {
    return routeError(error)
  }
}
