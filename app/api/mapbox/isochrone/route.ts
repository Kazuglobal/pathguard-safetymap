import { NextRequest, NextResponse } from 'next/server'
import { isochroneService } from '@/lib/routing/isochrone'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, ...options } = body

    switch (type) {
      case 'generateIsochrone':
        if (!options.center || !Array.isArray(options.center)) {
          return NextResponse.json(
            { error: 'Center coordinates are required' },
            { status: 400 }
          )
        }

        if (!options.contours || !Array.isArray(options.contours)) {
          return NextResponse.json(
            { error: 'Contours array is required' },
            { status: 400 }
          )
        }

        const isochroneResult = await isochroneService.generateIsochrone(options)
        
        if (!isochroneResult.success) {
          return NextResponse.json(
            { error: isochroneResult.error || 'Isochrone generation failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(isochroneResult.data)

      case 'batchGenerateIsochrones':
        if (!options.locations || !Array.isArray(options.locations)) {
          return NextResponse.json(
            { error: 'Locations array is required' },
            { status: 400 }
          )
        }

        if (!options.contours || !Array.isArray(options.contours)) {
          return NextResponse.json(
            { error: 'Contours array is required' },
            { status: 400 }
          )
        }

        const batchResult = await isochroneService.batchGenerateIsochrones(options)
        
        if (!batchResult.success) {
          return NextResponse.json(
            { error: batchResult.error || 'Batch isochrone generation failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(batchResult.data)

      case 'analyzeSchoolZone':
        if (!options.schoolLocation || !Array.isArray(options.schoolLocation)) {
          return NextResponse.json(
            { error: 'School location coordinates are required' },
            { status: 400 }
          )
        }

        if (!options.schoolName) {
          return NextResponse.json(
            { error: 'School name is required' },
            { status: 400 }
          )
        }

        const schoolAnalysisResult = await isochroneService.analyzeSchoolZone(
          options.schoolLocation,
          options.schoolName,
          options.schoolType || 'elementary'
        )

        if (!schoolAnalysisResult.success) {
          return NextResponse.json(
            { error: schoolAnalysisResult.error || 'School zone analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(schoolAnalysisResult.data)

      case 'analyzeEvacuationZone':
        if (!options.evacuationSite) {
          return NextResponse.json(
            { error: 'Evacuation site information is required' },
            { status: 400 }
          )
        }

        if (!options.evacuationSite.coordinates || !Array.isArray(options.evacuationSite.coordinates)) {
          return NextResponse.json(
            { error: 'Evacuation site coordinates are required' },
            { status: 400 }
          )
        }

        const evacuationAnalysisResult = await isochroneService.analyzeEvacuationZone(
          options.evacuationSite
        )

        if (!evacuationAnalysisResult.success) {
          return NextResponse.json(
            { error: evacuationAnalysisResult.error || 'Evacuation zone analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(evacuationAnalysisResult.data)

      case 'analyzeAccessibility':
        if (!options.location || !Array.isArray(options.location)) {
          return NextResponse.json(
            { error: 'Location coordinates are required' },
            { status: 400 }
          )
        }

        const accessibilityResult = await isochroneService.analyzeAccessibility(
          options.location,
          options.serviceTypes || ['hospital', 'school', 'shopping']
        )

        if (!accessibilityResult.success) {
          return NextResponse.json(
            { error: accessibilityResult.error || 'Accessibility analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(accessibilityResult.data)

      case 'compareReachability':
        if (!options.locations || !Array.isArray(options.locations)) {
          return NextResponse.json(
            { error: 'Locations array is required' },
            { status: 400 }
          )
        }

        const reachabilityResult = await isochroneService.compareReachability(
          options.locations,
          options.contours || [10, 15, 20],
          options.profile || 'walking'
        )

        if (!reachabilityResult.success) {
          return NextResponse.json(
            { error: reachabilityResult.error || 'Reachability comparison failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(reachabilityResult.data)

      default:
        return NextResponse.json(
          { error: 'Invalid operation type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Isochrone API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const centerParam = searchParams.get('center')
    const contoursParam = searchParams.get('contours')
    
    if (!centerParam) {
      return NextResponse.json(
        { error: 'Center parameter is required' },
        { status: 400 }
      )
    }

    if (!contoursParam) {
      return NextResponse.json(
        { error: 'Contours parameter is required' },
        { status: 400 }
      )
    }

    // Parse center coordinates from query parameter
    // Expected format: "lng,lat"
    const [lng, lat] = centerParam.split(',').map(Number)
    const center: [number, number] = [lng, lat]

    // Parse contours from query parameter
    // Expected format: "5,10,15,20"
    const contours = contoursParam.split(',').map(Number)

    const isochroneRequest = {
      center,
      contours,
      profile: (searchParams.get('profile') as any) || 'walking',
      colors: searchParams.get('colors')?.split(','),
      denoise: searchParams.get('denoise') ? parseFloat(searchParams.get('denoise')!) : undefined,
      generalize: searchParams.get('generalize') ? parseFloat(searchParams.get('generalize')!) : undefined,
      polygons: searchParams.get('polygons') !== 'false'
    }

    const result = await isochroneService.generateIsochrone(isochroneRequest)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Isochrone generation failed' },
        { status: 500 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Isochrone GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}