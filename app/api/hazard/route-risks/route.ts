import { NextRequest, NextResponse } from "next/server"

import { getHazardScenarioOptions } from "@/lib/hazard-scenarios"
import { createServerClient } from "@/lib/supabase-server"
import type { RouteHazardMarker, UserRoute } from "@/lib/types"

export const runtime = "nodejs"

type RpcMarkerRow = Omit<RouteHazardMarker, "coordinates" | "hazard_type"> & {
  hazard_type: RouteHazardMarker["hazard_type"]
  longitude: number
  latitude: number
}

export async function GET(req: NextRequest) {
  try {
    const routeId = req.nextUrl.searchParams.get("routeId")
    if (!routeId) {
      return NextResponse.json({ error: "routeId is required" }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { data: route, error: routeError } = await supabase
      .from("user_routes")
      .select("*")
      .eq("id", routeId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (routeError) {
      throw routeError
    }

    if (!route) {
      return NextResponse.json({ error: "ルートが見つかりません" }, { status: 404 })
    }

    const typedRoute = route as UserRoute
    if (!typedRoute.route_geometry) {
      return NextResponse.json({ markers: [] })
    }

    const rpcResponse = await (supabase as any).rpc("get_route_hazard_intersections", {
      p_route_geometry: typedRoute.route_geometry,
    })

    if (rpcResponse.error) {
      throw rpcResponse.error
    }

    const markers = ((rpcResponse.data ?? []) as RpcMarkerRow[]).map((row) => ({
      ...row,
      coordinates: [row.longitude, row.latitude] as [number, number],
      scenario_options: getHazardScenarioOptions({
        hazardType: row.hazard_type,
        areaContext: row.area_context,
      }),
    }))

    return NextResponse.json({
      route: {
        id: typedRoute.id,
        name: typedRoute.name,
        route_geometry: typedRoute.route_geometry,
      },
      markers,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
