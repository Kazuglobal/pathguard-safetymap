import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ACCIDENT_IMAGE_CONTEXT_PARAMS,
  adjustYearsForAccidentDataset,
} from "@/lib/accident-stats-year-window"

const mocked = vi.hoisted(() => ({
  getActor: vi.fn(),
  nearbyStats: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocked.getActor }))
vi.mock('@/lib/db/repos/accidents.repo', () => ({ nearbyStats: mocked.nearbyStats }))

import { fetchNearbyAccidentStats } from "@/lib/traffic-accident/server"

describe("fetchNearbyAccidentStats", () => {
  afterEach(() => vi.useRealTimers())

  it("uses the shared radius and dataset-anchored effective year window", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-19T00:00:00Z"))
    mocked.getActor.mockResolvedValue({ kind: 'user', id: 'user-1', email: null, isAdmin: false })
    mocked.nearbyStats.mockResolvedValue({ total_accidents: 2 })

    const result = await fetchNearbyAccidentStats(
      { latitude: 40.82, longitude: 140.74 },
      ACCIDENT_IMAGE_CONTEXT_PARAMS,
    )

    expect(result).toEqual({ total_accidents: 2 })
    expect(mocked.nearbyStats).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'user', id: 'user-1' }),
      {
        latitude: 40.82,
        longitude: 140.74,
        radiusMeters: 300,
        years: adjustYearsForAccidentDataset(5, 2026),
      },
    )
    expect(adjustYearsForAccidentDataset(5, 2026)).toBe(7)
  })
})
