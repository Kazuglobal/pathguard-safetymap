import { describe, expect, it } from "vitest"
import { compareUserMarkersWithAI } from "@/lib/hazard-game-matching"
import type { DetectionItem, UserMarker } from "@/lib/hazard-game-types"

function createDetection(overrides: Partial<DetectionItem>): DetectionItem {
  return {
    category: "hazards",
    label: "default",
    description: "",
    count: 1,
    confidence: 0.9,
    coverageRatio: 0.1,
    positions: [],
    ...overrides,
  }
}

function createMarker(overrides: Partial<UserMarker>): UserMarker {
  return {
    id: "marker-1",
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.2,
    label: "hazard",
    category: "hazard",
    timestamp: 1,
    ...overrides,
  }
}

describe("hazard-game-matching", () => {
  it("matches multiple user markers to different positions of the same detection item", () => {
    const detections: DetectionItem[] = [
      createDetection({
        category: "hazards",
        label: "guardrail",
        count: 2,
        positions: [
          { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
          { x: 0.6, y: 0.6, width: 0.2, height: 0.2 },
        ],
      }),
    ]

    const markers: UserMarker[] = [
      createMarker({ id: "m1", x: 0.1, y: 0.1, timestamp: 1 }),
      createMarker({ id: "m2", x: 0.6, y: 0.6, timestamp: 2 }),
    ]

    const result = compareUserMarkersWithAI(markers, detections)

    expect(result.matches).toHaveLength(2)
    expect(result.unmatchedUserMarkers).toHaveLength(0)
    expect(result.unmatchedAiDetections).toHaveLength(0)
  })
})
