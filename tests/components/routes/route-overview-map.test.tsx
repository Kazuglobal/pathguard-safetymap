import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

// 地図は描かず、最初の表示（initialViewState）だけを data 属性に残す
vi.mock("react-map-gl/mapbox", async () => {
  const { forwardRef } = await import("react")
  return {
    default: forwardRef(function MockMap(
      { children, initialViewState }: { children?: ReactNode; initialViewState?: unknown },
      _ref
    ) {
      return (
        <div data-testid="mock-map" data-initial-view={JSON.stringify(initialViewState)}>
          {children}
        </div>
      )
    }),
    Layer: () => null,
    Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  }
})

import { RouteOverviewMap } from "@/components/routes/route-overview-map"
import type { UserRoute } from "@/lib/types"
import { mockRoutes } from "../../fixtures/routes"

function initialView() {
  return JSON.parse(screen.getByTestId("mock-map").dataset.initialView ?? "null")
}

describe("RouteOverviewMap の最初の表示", () => {
  it("使える座標が 1 つも無いときは、東京ではなく日本全体を見せる", () => {
    const routeWithEmptyGeometry: UserRoute = {
      ...mockRoutes[0],
      route_geometry: { type: "LineString", coordinates: [] },
    }

    render(<RouteOverviewMap routes={[routeWithEmptyGeometry]} mapToken="pk.test-token" />)

    expect(initialView()).toEqual({ longitude: 137, latitude: 37.5, zoom: 4.6 })
  })

  it("ルートの座標があれば、これまでどおり登録ルート全体の中心から始める", () => {
    const routes = [mockRoutes[0], mockRoutes[1]]
    const coordinates = routes.flatMap((route) => route.route_geometry!.coordinates)
    const lngs = coordinates.map(([lng]) => lng)
    const lats = coordinates.map(([, lat]) => lat)

    render(<RouteOverviewMap routes={routes} mapToken="pk.test-token" />)

    const view = initialView()
    expect(view.zoom).toBe(13)
    expect(view.longitude).toBeCloseTo((Math.min(...lngs) + Math.max(...lngs)) / 2, 10)
    expect(view.latitude).toBeCloseTo((Math.min(...lats) + Math.max(...lats)) / 2, 10)
  })
})
