import { NextRequest, NextResponse } from 'next/server'
import { tilequeryService } from '@/lib/routing/tilequery'
import type { TilequeryLayer } from '@/lib/routing/tilequery'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, ...options } = body

    switch (type) {
      case 'queryMapFeatures':
        if (!options.coordinates || !Array.isArray(options.coordinates)) {
          return NextResponse.json(
            { error: 'Coordinates array is required' },
            { status: 400 }
          )
        }

        const queryResult = await tilequeryService.queryMapFeatures(options)
        
        if (!queryResult.success) {
          return NextResponse.json(
            { error: queryResult.error || 'Map features query failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(queryResult.data)

      case 'findNearbyPOIs':
        if (!options.location || !Array.isArray(options.location)) {
          return NextResponse.json(
            { error: 'Location coordinates are required' },
            { status: 400 }
          )
        }

        const poisResult = await tilequeryService.findNearbyPOIs(
          options.location,
          options.radius || 1000,
          options.layers || undefined,
          options.limit || 50
        )

        if (!poisResult.success) {
          return NextResponse.json(
            { error: poisResult.error || 'POI search failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(poisResult.data)

      case 'analyzeRoutePOIs':
        if (!options.routeGeometry) {
          return NextResponse.json(
            { error: 'Route geometry is required' },
            { status: 400 }
          )
        }

        const routeAnalysisResult = await tilequeryService.analyzeRoutePOIs(
          options.routeGeometry,
          options.buffer || 500,
          options.layers || undefined,
          options.categories || undefined
        )

        if (!routeAnalysisResult.success) {
          return NextResponse.json(
            { error: routeAnalysisResult.error || 'Route POI analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(routeAnalysisResult.data)

      case 'findEmergencyServices':
        if (!options.location || !Array.isArray(options.location)) {
          return NextResponse.json(
            { error: 'Location coordinates are required' },
            { status: 400 }
          )
        }

        const emergencyResult = await tilequeryService.findEmergencyServices(
          options.location,
          options.radius || 5000,
          options.serviceTypes || ['hospital', 'police', 'fire_station']
        )

        if (!emergencyResult.success) {
          return NextResponse.json(
            { error: emergencyResult.error || 'Emergency services search failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(emergencyResult.data)

      case 'analyzeTransportation':
        if (!options.location || !Array.isArray(options.location)) {
          return NextResponse.json(
            { error: 'Location coordinates are required' },
            { status: 400 }
          )
        }

        const transportResult = await tilequeryService.analyzeTransportation(
          options.location,
          options.radius || 2000,
          options.transportModes || ['bus', 'train', 'subway']
        )

        if (!transportResult.success) {
          return NextResponse.json(
            { error: transportResult.error || 'Transportation analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(transportResult.data)

      case 'findSafetyFeatures':
        if (!options.location || !Array.isArray(options.location)) {
          return NextResponse.json(
            { error: 'Location coordinates are required' },
            { status: 400 }
          )
        }

        const safetyResult = await tilequeryService.findSafetyFeatures(
          options.location,
          options.radius || 1000,
          options.featureTypes || ['emergency_phone', 'lighting', 'cctv']
        )

        if (!safetyResult.success) {
          return NextResponse.json(
            { error: safetyResult.error || 'Safety features search failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(safetyResult.data)

      case 'batchQueryFeatures':
        if (!options.requests || !Array.isArray(options.requests)) {
          return NextResponse.json(
            { error: 'Requests array is required' },
            { status: 400 }
          )
        }

        const batchResult = await tilequeryService.batchQueryFeatures(
          options.requests
        )

        return NextResponse.json(batchResult)

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

    const parsedLayers = searchParams
      .get('layers')
      ?.split(',')
      .filter(Boolean) as TilequeryLayer[] | undefined

    const tilequeryRequest = {
      coordinates,
      radius: searchParams.get('radius') ? parseInt(searchParams.get('radius')!) : 1000,
      layers: parsedLayers,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      dedupe: searchParams.get('dedupe') !== 'false',
      geometry: (searchParams.get('geometry') as any) || 'point'
    }

    const result = await tilequeryService.queryMapFeatures(tilequeryRequest)
    
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
