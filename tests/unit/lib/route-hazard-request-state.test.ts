import { describe, expect, it } from "vitest"

import { getRouteHazardRequestState } from "@/lib/route-hazard-request-state"

describe("getRouteHazardRequestState", () => {
  it("clears loading when no route geometry is available", () => {
    expect(
      getRouteHazardRequestState(null, {
        flood: true,
        tsunami: false,
      }),
    ).toEqual({
      shouldFetch: false,
      isLoading: false,
    })
  })

  it("clears loading when every hazard layer is disabled", () => {
    expect(
      getRouteHazardRequestState(
        {
          route_geometry: {
            type: "LineString",
            coordinates: [
              [139.7, 35.6],
              [139.8, 35.7],
            ],
          },
        },
        {
          flood: false,
          tsunami: false,
        },
      ),
    ).toEqual({
      shouldFetch: false,
      isLoading: false,
    })
  })

  it("requests hazards and enters loading when a route and visible layer exist", () => {
    expect(
      getRouteHazardRequestState(
        {
          route_geometry: {
            type: "LineString",
            coordinates: [
              [139.7, 35.6],
              [139.8, 35.7],
            ],
          },
        },
        {
          flood: true,
          tsunami: false,
        },
      ),
    ).toEqual({
      shouldFetch: true,
      isLoading: true,
    })
  })
})
