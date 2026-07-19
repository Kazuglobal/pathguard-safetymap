import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ACCIDENT_IMAGE_CONTEXT_PARAMS,
  adjustYearsForAccidentDataset,
} from "@/lib/accident-stats-year-window"
import { fetchNearbyAccidentStats } from "@/lib/traffic-accident/server"

describe("fetchNearbyAccidentStats", () => {
  afterEach(() => vi.useRealTimers())

  it("uses the shared radius and dataset-anchored effective year window", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-19T00:00:00Z"))
    const rpc = vi.fn().mockResolvedValue({
      data: { total_accidents: 2 },
      error: null,
    })

    const result = await fetchNearbyAccidentStats(
      { rpc } as any,
      { latitude: 40.82, longitude: 140.74 },
      ACCIDENT_IMAGE_CONTEXT_PARAMS,
    )

    expect(result).toEqual({ total_accidents: 2 })
    expect(rpc).toHaveBeenCalledWith("get_nearby_accident_stats", {
      p_latitude: 40.82,
      p_longitude: 140.74,
      p_radius_meters: 300,
      p_years: adjustYearsForAccidentDataset(5, 2026),
    })
    expect(adjustYearsForAccidentDataset(5, 2026)).toBe(7)
  })
})
