import { NextRequest, NextResponse } from "next/server"

import { getActor } from '@/lib/auth/actor'
import { routeIntersections } from '@/lib/db/repos/hazard.repo'
import { getRouteById } from '@/lib/db/repos/routes.repo'
import { getHazardScenarioOptions } from "@/lib/hazard-scenarios"
import type { HazardAreaContext, HazardType } from "@/lib/types"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const routeId = req.nextUrl.searchParams.get("routeId")
    if (!routeId) {
      return NextResponse.json({ error: "routeId is required" }, { status: 400 })
    }

    const actor = await getActor()
    if (actor.kind === 'anon') {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const route = await getRouteById(actor, routeId)
    if (!route) {
      return NextResponse.json({ error: "ルートが見つかりません" }, { status: 404 })
    }

    if (!route.routeGeometry) {
      return NextResponse.json({ markers: [] })
    }

    const result = await routeIntersections(actor, route.routeGeometry as unknown as GeoJSON.LineString)
    const markers = result.markers.map((row) => ({
      ...row,
      hazard_type: row.hazard_type as HazardType,
      area_context: row.area_context as HazardAreaContext,
      coordinates: [row.longitude, row.latitude] as [number, number],
      scenario_options: getHazardScenarioOptions({
        hazardType: row.hazard_type as HazardType,
        areaContext: row.area_context as HazardAreaContext,
      }),
    }))

    return NextResponse.json({
      route: {
        id: route.id,
        name: route.name,
        route_geometry: route.routeGeometry,
      },
      markers,
      truncated: result.truncated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
