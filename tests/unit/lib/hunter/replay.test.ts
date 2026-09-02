import { describe, expect, it } from "vitest"

import { detectionsToHazards } from "@/lib/hunter/replay"

const good = {
  type: "見通しの悪い角",
  kind: "blind_corner",
  accidentLink: "出会い頭",
  region: { x: 0.4, y: 0.5, w: 0.2, h: 0.2 },
  severity: "high",
  kidExplanation: "みぎの かどの むこうが 見えないよ",
  safeAction: "とまって みぎを 見よう",
  confidence: 0.9,
}

describe("hunter replay — stored detections → hazards", () => {
  it("rebuilds hazards with deterministic ids and the closed kind vocabulary", () => {
    const hazards = detectionsToHazards([good, { ...good, kind: "???", severity: "urgent", confidence: null }], "sess")
    expect(hazards).toHaveLength(2)
    expect(hazards[0]).toMatchObject({ id: "sess-0", kind: "blind_corner", severity: "high", accidentLink: "出会い頭", confidence: 0.9 })
    expect(hazards[1]).toMatchObject({ id: "sess-1", kind: "other", severity: "medium", confidence: 0.7 })
  })

  it("drops rows whose region or kid copy is unusable instead of showing a broken target", () => {
    const hazards = detectionsToHazards([
      { ...good, region: null },
      { ...good, region: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 } },
      { ...good, region: { x: "0.1", y: 0.1, w: 0.1, h: 0.1 } },
      { ...good, kidExplanation: "  " },
      { ...good, safeAction: null },
      { ...good, type: null },
      good,
    ], "sess")
    expect(hazards).toHaveLength(1)
    expect(hazards[0].id).toBe("sess-0")
  })
})
