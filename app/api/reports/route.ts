import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { getServiceActor } from '@/lib/auth/service-actor'
import { toDangerReportJson, toPublicDangerReportPreviewJson } from '@/lib/danger-report-api'
import { AuthzError } from '@/lib/db/authz'
import {
  createDangerReport,
  listDangerReports,
  type CreateDangerReportInput,
  type DangerReportListInput,
} from '@/lib/db/repos/danger-reports.repo'
import { incrementPoints } from '@/lib/db/repos/gamification.repo'
import { createRouteReportNotification } from '@/lib/db/repos/notifications.repo'

export const runtime = 'nodejs'

type JsonObject = Record<string, unknown>

function nullableString(value: unknown): string | null | undefined {
  return value == null ? undefined : typeof value === 'string' ? value : null
}

function geocodeSource(value: unknown): CreateDangerReportInput['geocodeSource'] {
  if (value == null) return undefined
  if (value === 'mapbox' || value === 'gsi' || value === 'osm' || value === 'manual' || value === 'batch') {
    return value
  }
  throw new RangeError('Invalid geocode source')
}

function parseInput(body: JsonObject): CreateDangerReportInput {
  const input: CreateDangerReportInput = {
    title: typeof body.title === 'string' ? body.title : '',
    description: nullableString(body.description),
    dangerType: typeof body.danger_type === 'string' ? body.danger_type : '',
    dangerLevel: Number(body.danger_level),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    prefecture: nullableString(body.prefecture),
    city: nullableString(body.city),
    municipalityCode: nullableString(body.municipality_code),
    town: nullableString(body.town),
    postalCode: nullableString(body.postal_code),
    geocodeSource: geocodeSource(body.geocode_source),
    geocodeConfidence: body.geocode_confidence == null ? undefined : Number(body.geocode_confidence),
    geocodedAt: nullableString(body.geocoded_at),
    addressHash: nullableString(body.address_hash),
    alertRadiusM: body.alert_radius_m == null ? undefined : Number(body.alert_radius_m),
  }
  if (body.prefecture_code != null) input.prefectureCode = Number(body.prefecture_code)
  return input
}

function finiteParam(params: URLSearchParams, name: string): number | undefined {
  const raw = params.get(name)
  if (raw == null || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new RangeError(`Invalid ${name}`)
  return value
}

function parseListInput(params: URLSearchParams): DangerReportListInput {
  const statuses = params.getAll('status').flatMap((value) => value.split(',')).filter(Boolean)
  const minLng = finiteParam(params, 'minLng')
  const minLat = finiteParam(params, 'minLat')
  const maxLng = finiteParam(params, 'maxLng')
  const maxLat = finiteParam(params, 'maxLat')
  const boundsValues = [minLng, minLat, maxLng, maxLat]
  if (boundsValues.some((value) => value !== undefined) && boundsValues.some((value) => value === undefined)) {
    throw new RangeError('Incomplete bounds')
  }
  return {
    ...(statuses.length ? { statuses } : {}),
    ...(params.get('owner') === 'me' ? { ownerId: '__ACTOR__' } : {}),
    ...(params.get('prefecture') ? { prefecture: params.get('prefecture')! } : {}),
    ...(params.get('city') ? { city: params.get('city')! } : {}),
    ...(params.get('dangerType') && params.get('dangerType') !== 'all'
      ? { dangerType: params.get('dangerType')! }
      : {}),
    ...(finiteParam(params, 'minimumDangerLevel') != null
      ? { minimumDangerLevel: finiteParam(params, 'minimumDangerLevel') }
      : {}),
    ...(finiteParam(params, 'dangerLevel') != null ? { exactDangerLevel: finiteParam(params, 'dangerLevel') } : {}),
    ...(params.get('createdAfter') ? { createdAfter: params.get('createdAfter')! } : {}),
    ...(minLng != null && minLat != null && maxLng != null && maxLat != null
      ? { bounds: { minLng, minLat, maxLng, maxLat } }
      : {}),
    ...(finiteParam(params, 'limit') != null ? { limit: finiteParam(params, 'limit') } : {}),
  }
}

export async function GET(request: Request) {
  try {
    const actor = await getActor()
    const input = parseListInput(new URL(request.url).searchParams)
    if (input.ownerId === '__ACTOR__') {
      if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      input.ownerId = actor.id
    }
    const reports = await listDangerReports(actor, input)
    const serialize = actor.kind === 'anon' ? toPublicDangerReportPreviewJson : toDangerReportJson
    return NextResponse.json({ reports: reports.map(serialize) })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('[api/reports] list failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to list danger reports' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const actor = await getActor()
  if (actor.kind === 'anon') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json() as unknown
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const bodyObject = body as JsonObject
    const report = await createDangerReport(actor, parseInput(bodyObject))
    const routeName = typeof bodyObject.route_context_name === 'string'
      ? bodyObject.route_context_name.trim()
      : ''
    if (routeName) {
      try {
        await createRouteReportNotification(actor, {
          reportId: report.id,
          reportTitle: report.title,
          routeId: typeof bodyObject.route_context_id === 'string' ? bodyObject.route_context_id : null,
          routeName,
        })
      } catch (error) {
        console.error('[api/reports] route notification failed', error instanceof Error ? error.message : 'unknown')
      }
    }
    let pointsAwarded = 0
    try {
      await incrementPoints(getServiceActor(), actor.id, 20)
      pointsAwarded = 20
    } catch (error) {
      console.error('[api/reports] failed to award points', error instanceof Error ? error.message : 'unknown')
    }
    return NextResponse.json({ report: toDangerReportJson(report), pointsAwarded }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof RangeError || error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid danger report' }, { status: 400 })
    }
    console.error('[api/reports] create failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Failed to create danger report' }, { status: 500 })
  }
}
