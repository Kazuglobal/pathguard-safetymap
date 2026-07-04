import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { tilequeryService } from '@/lib/routing/tilequery'
import type { TilequeryLayer, TilequeryRequest } from '@/lib/routing/tilequery'
import { createServerClient } from '@/lib/supabase-server'
import { checkApiRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'
import { isValidCoordinates } from '@/lib/coordinates'

const MAX_BATCH_SIZE = 10
const MAX_RADIUS_METERS = 5000
const MAX_BUFFER_METERS = 1000
const MAX_LIMIT = 50
const MAX_ROUTE_COORDINATES = 100

const tilequeryLayerSchema = z.enum(['road', 'poi', 'building', 'landuse', 'waterway', 'admin'])
const tilequeryGeometrySchema = z.enum(['polygon', 'linestring', 'point'])

async function requireAuth() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

const coordinatePairSchema = z
  .tuple([z.number(), z.number()])
  .transform(([lng, lat]) => [lng, lat] as [number, number])
  .refine(([lng, lat]) => isValidCoordinates(lat, lng), {
    message: '緯度経度の範囲が不正です',
  })

const radiusSchema = z.number().int().min(1).max(MAX_RADIUS_METERS)
const bufferSchema = z.number().int().min(1).max(MAX_BUFFER_METERS)
const limitSchema = z.number().int().min(1).max(MAX_LIMIT)
const layersSchema = z.array(tilequeryLayerSchema).min(1).max(6)

const tilequeryRequestSchema = z.object({
  coordinates: coordinatePairSchema,
  radius: radiusSchema.default(1000),
  layers: layersSchema.optional(),
  limit: limitSchema.default(50),
  dedupe: z.boolean().default(true),
  geometry: tilequeryGeometrySchema.default('point'),
})

const routeGeometrySchema = z.object({
  type: z.literal('LineString').optional(),
  coordinates: z.array(coordinatePairSchema).min(2).max(MAX_ROUTE_COORDINATES),
})

const batchTilequeryRequestSchema = tilequeryRequestSchema.extend({
  radius: radiusSchema.default(50),
})

function validateCoordinatePair(value: unknown, label: string): NextResponse | null {
  if (!coordinatePairSchema.safeParse(value).success) {
    return NextResponse.json(
      { error: `${label}の座標が不正です` },
      { status: 400 }
    )
  }
  return null
}

function invalidInput(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function parsePositiveIntParam(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined
  if (!/^\d+$/.test(value)) return Number.NaN
  return Number.parseInt(value, 10)
}

function parseLayersParam(value: string | null): TilequeryLayer[] | undefined {
  const layers = value?.split(',').map((layer) => layer.trim()).filter(Boolean)
  return layers && layers.length > 0 ? layers as TilequeryLayer[] : undefined
}

function toTilequeryRequest(value: z.infer<typeof tilequeryRequestSchema>): TilequeryRequest {
  return {
    coordinates: value.coordinates!,
    radius: value.radius,
    layers: value.layers,
    limit: value.limit,
    dedupe: value.dedupe,
    geometry: value.geometry,
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`mapbox-tilequery:${user.id}`)
  if (!rate.success) {
    return rateLimitedResponse(rate.reset)
  }

  try {
    const body = await request.json()
    const { type, ...options } = body

    switch (type) {
      case 'queryMapFeatures': {
        const parsed = tilequeryRequestSchema.safeParse(options)
        if (!parsed.success) return invalidInput('Tilequery parameters are invalid')

        const queryResult = await tilequeryService.queryMapFeatures(toTilequeryRequest(parsed.data))

        if (!queryResult.success) {
          return NextResponse.json(
            { error: queryResult.error || 'Map features query failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(queryResult.data)
      }

      case 'findNearbyPOIs': {
        const parsed = z.object({
          location: coordinatePairSchema,
          radius: radiusSchema.default(1000),
          layers: layersSchema.optional(),
          limit: limitSchema.default(50),
        }).safeParse(options)
        if (!parsed.success) return invalidInput('POI search parameters are invalid')

        const poisResult = await tilequeryService.findNearbyPOIs(
          parsed.data.location,
          parsed.data.radius,
          parsed.data.layers,
          parsed.data.limit
        )

        if (!poisResult.success) {
          return NextResponse.json(
            { error: poisResult.error || 'POI search failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(poisResult.data)
      }

      case 'analyzeRoutePOIs': {
        const parsed = z.object({
          routeGeometry: routeGeometrySchema,
          buffer: bufferSchema.default(500),
          layers: layersSchema.optional(),
          categories: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
        }).safeParse(options)
        if (!parsed.success) return invalidInput('Route POI analysis parameters are invalid')

        const routeAnalysisResult = await tilequeryService.analyzeRoutePOIs(
          { type: 'LineString', coordinates: parsed.data.routeGeometry.coordinates },
          parsed.data.buffer,
          parsed.data.layers,
          parsed.data.categories
        )

        if (!routeAnalysisResult.success) {
          return NextResponse.json(
            { error: routeAnalysisResult.error || 'Route POI analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(routeAnalysisResult.data)
      }

      case 'findEmergencyServices': {
        const parsed = z.object({
          location: coordinatePairSchema,
          radius: radiusSchema.default(5000),
          serviceTypes: z.array(z.string().trim().min(1).max(40)).max(20).default(['hospital', 'police', 'fire_station']),
        }).safeParse(options)
        if (!parsed.success) return invalidInput('Emergency services parameters are invalid')

        const emergencyResult = await tilequeryService.findEmergencyServices(
          parsed.data.location,
          parsed.data.radius,
          parsed.data.serviceTypes
        )

        if (!emergencyResult.success) {
          return NextResponse.json(
            { error: emergencyResult.error || 'Emergency services search failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(emergencyResult.data)
      }

      case 'analyzeTransportation': {
        const parsed = z.object({
          location: coordinatePairSchema,
          radius: radiusSchema.default(2000),
          transportModes: z.array(z.string().trim().min(1).max(40)).max(20).default(['bus', 'train', 'subway']),
        }).safeParse(options)
        if (!parsed.success) return invalidInput('Transportation analysis parameters are invalid')

        const transportResult = await tilequeryService.analyzeTransportation(
          parsed.data.location,
          parsed.data.radius,
          parsed.data.transportModes
        )

        if (!transportResult.success) {
          return NextResponse.json(
            { error: transportResult.error || 'Transportation analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(transportResult.data)
      }

      case 'findSafetyFeatures': {
        const parsed = z.object({
          location: coordinatePairSchema,
          radius: radiusSchema.default(1000),
          featureTypes: z.array(z.string().trim().min(1).max(40)).max(20).default(['emergency_phone', 'lighting', 'cctv']),
        }).safeParse(options)
        if (!parsed.success) return invalidInput('Safety feature parameters are invalid')

        const safetyResult = await tilequeryService.findSafetyFeatures(
          parsed.data.location,
          parsed.data.radius,
          parsed.data.featureTypes
        )

        if (!safetyResult.success) {
          return NextResponse.json(
            { error: safetyResult.error || 'Safety features search failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(safetyResult.data)
      }

      case 'batchQueryFeatures': {
        const parsed = z.object({
          requests: z.array(batchTilequeryRequestSchema).min(1).max(MAX_BATCH_SIZE),
        }).safeParse(options)
        if (!parsed.success) return invalidInput(`requestsは最大${MAX_BATCH_SIZE}件まで、各リクエストは半径${MAX_RADIUS_METERS}m以内です`)

        const batchResult = await tilequeryService.batchQueryFeatures(
          parsed.data.requests.map(toTilequeryRequest)
        )

        return NextResponse.json(batchResult)
      }

      default:
        return NextResponse.json(
          { error: 'Invalid operation type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Tilequery API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`mapbox-tilequery:${user.id}`)
  if (!rate.success) {
    return rateLimitedResponse(rate.reset)
  }

  try {
    const { searchParams } = new URL(request.url)
    const coordinatesParam = searchParams.get('coordinates')

    if (!coordinatesParam) {
      return NextResponse.json(
        { error: 'Coordinates parameter is required' },
        { status: 400 }
      )
    }

    // Parse coordinates from query parameter
    // Expected format: "lng,lat"
    const [lng, lat] = coordinatesParam.split(',').map(Number)
    const coordinates: [number, number] = [lng, lat]

    const coordinatesError = validateCoordinatePair(coordinates, 'coordinates')
    if (coordinatesError) return coordinatesError

    const parsed = tilequeryRequestSchema.safeParse({
      coordinates,
      radius: parsePositiveIntParam(searchParams.get('radius')) ?? 1000,
      layers: parseLayersParam(searchParams.get('layers')),
      limit: parsePositiveIntParam(searchParams.get('limit')) ?? 50,
      dedupe: searchParams.get('dedupe') !== 'false',
      geometry: (searchParams.get('geometry') as any) || 'point'
    })
    if (!parsed.success) return invalidInput('Tilequery parameters are invalid')

    const result = await tilequeryService.queryMapFeatures(toTilequeryRequest(parsed.data))

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Map features query failed' },
        { status: 500 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Tilequery GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
