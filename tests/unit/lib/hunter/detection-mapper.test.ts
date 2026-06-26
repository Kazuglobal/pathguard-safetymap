import { describe, expect, it } from "vitest"

import type { BoundingBox, DetectionItem } from "@/lib/hazard-game-types"
import { mapDetectionsToHunterHazards } from "@/lib/hunter/detection-mapper"

function box(overrides: Partial<BoundingBox> = {}): BoundingBox {
  return { x: 0.1, y: 0.2, width: 0.3, height: 0.4, ...overrides }
}

function detection(overrides: Partial<DetectionItem> = {}): DetectionItem {
  return {
    category: "hazards",
    label: "ブロック塀",
    description: "古いブロック塀",
    count: 1,
    confidence: 0.9,
    coverageRatio: 0.1,
    positions: [box()],
    ...overrides,
  }
}

describe("mapDetectionsToHunterHazards", () => {
  it("excludes safety_equipment items", () => {
    const detections: DetectionItem[] = [
      detection({ category: "safety_equipment", label: "ガードレール" }),
    ]

    const result = mapDetectionsToHunterHazards(detections, { sessionId: "s1" })

    expect(result).toEqual([])
  })

  it("excludes items below the default confidence threshold (0.5)", () => {
    const detections: DetectionItem[] = [detection({ confidence: 0.4 })]

    const result = mapDetectionsToHunterHazards(detections, { sessionId: "s1" })

    expect(result).toEqual([])
  })

  it("respects a custom confidence threshold", () => {
    const detections: DetectionItem[] = [detection({ confidence: 0.6 })]

    const result = mapDetectionsToHunterHazards(detections, {
      sessionId: "s1",
      confidenceThreshold: 0.7,
    })

    expect(result).toEqual([])
  })

  it("keeps items exactly at the threshold", () => {
    const detections: DetectionItem[] = [detection({ confidence: 0.5 })]

    const result = mapDetectionsToHunterHazards(detections, { sessionId: "s1" })

    expect(result).toHaveLength(1)
  })

  it("flattens multiple positions into multiple HunterHazards", () => {
    const detections: DetectionItem[] = [
      detection({
        positions: [
          box({ x: 0.1 }),
          box({ x: 0.5 }),
          box({ x: 0.7 }),
        ],
      }),
    ]

    const result = mapDetectionsToHunterHazards(detections, { sessionId: "s1" })

    expect(result).toHaveLength(3)
    expect(result.map((h) => h.id)).toEqual(["s1-0-0", "s1-0-1", "s1-0-2"])
  })

  it("uses stable detIndex even when earlier detections are excluded", () => {
    const detections: DetectionItem[] = [
      detection({ category: "safety_equipment" }), // index 0, excluded
      detection({ confidence: 0.4 }), // index 1, excluded (low confidence)
      detection({ category: "traffic", positions: [box()] }), // index 2, kept
    ]

    const result = mapDetectionsToHunterHazards(detections, { sessionId: "sess" })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("sess-2-0")
  })

  it("maps severity/type/safeAction for hazards", () => {
    const result = mapDetectionsToHunterHazards(
      [detection({ category: "hazards" })],
      { sessionId: "s1" },
    )

    expect(result[0].severity).toBe("high")
    expect(result[0].type).toBe("きけんなもの")
    expect(result[0].safeAction).toBe("あぶないものの 近くは はなれて 歩こう。")
  })

  it("maps severity/type/safeAction for traffic", () => {
    const result = mapDetectionsToHunterHazards(
      [detection({ category: "traffic" })],
      { sessionId: "s1" },
    )

    expect(result[0].severity).toBe("medium")
    expect(result[0].type).toBe("車に注意")
    expect(result[0].safeAction).toBe("車が来ないか、止まって 左右を 見よう。")
  })

  it("maps severity/type/safeAction for obstructions", () => {
    const result = mapDetectionsToHunterHazards(
      [detection({ category: "obstructions" })],
      { sessionId: "s1" },
    )

    expect(result[0].severity).toBe("low")
    expect(result[0].type).toBe("じゃまなもの")
    expect(result[0].safeAction).toBe(
      "せまい場所では 車道に 出ないように 気をつけよう。",
    )
  })

  it("converts BoundingBox into region (width->w, height->h)", () => {
    const result = mapDetectionsToHunterHazards(
      [
        detection({
          positions: [{ x: 0.11, y: 0.22, width: 0.33, height: 0.44 }],
        }),
      ],
      { sessionId: "s1" },
    )

    expect(result[0].region).toEqual({ x: 0.11, y: 0.22, w: 0.33, h: 0.44 })
  })

  it("uses description as kidExplanation, falling back to label when empty", () => {
    const withDescription = mapDetectionsToHunterHazards(
      [detection({ description: "古いブロック塀", label: "塀" })],
      { sessionId: "s1" },
    )
    const withoutDescription = mapDetectionsToHunterHazards(
      [detection({ description: "", label: "塀" })],
      { sessionId: "s1" },
    )

    expect(withDescription[0].kidExplanation).toBe("古いブロック塀")
    expect(withoutDescription[0].kidExplanation).toBe("塀")
  })

  it("carries confidence from the detection item", () => {
    const result = mapDetectionsToHunterHazards(
      [detection({ confidence: 0.87 })],
      { sessionId: "s1" },
    )

    expect(result[0].confidence).toBe(0.87)
  })

  it("returns an empty array for empty input", () => {
    expect(mapDetectionsToHunterHazards([], { sessionId: "s1" })).toEqual([])
  })
})
