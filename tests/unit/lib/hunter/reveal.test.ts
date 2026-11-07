import { describe, expect, it } from "vitest"

import { buildRevealItems, countReveal, focusTransform, REVEAL_MAX_SCALE } from "@/lib/hunter/reveal"
import { KID_REASON_BY_KIND } from "@/lib/hunter/kid-copy"
import type { HunterHazard } from "@/lib/hunter/types"

function hazard(id: string, extra: Partial<HunterHazard> = {}): HunterHazard {
  return {
    id,
    type: "t",
    region: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    severity: "high",
    kidExplanation: "x",
    safeAction: "y",
    confidence: 0.8,
    kind: "blind_corner",
    ...extra,
  }
}

describe("buildRevealItems", () => {
  it("numbers hazards in AI priority order and marks understood / found / missed", () => {
    const hazards = [hazard("a"), hazard("b", { kind: "turning_car" }), hazard("c", { kind: "other" })]
    const items = buildRevealItems(
      hazards,
      [
        { hazardId: "b", understood: false },
        { hazardId: "a", understood: true },
      ],
      [{ hazardId: "a", evidence: "角の へいが 車を かくす" }],
    )
    expect(items.map((i) => [i.number, i.hazard.id, i.status])).toEqual([
      [1, "a", "understood"],
      [2, "b", "found"],
      [3, "c", "missed"],
    ])
    expect(items[0].evidence).toBe("角の へいが 車を かくす")
    expect(items[1].evidence).toBeNull()
    expect(items[1].reason).toBe(KID_REASON_BY_KIND.turning_car)
    expect(items[2].reason).toBeNull()
    expect(countReveal(items)).toEqual({ understood: 1, found: 1, missed: 1 })
  })
})

describe("focusTransform", () => {
  it("returns the whole photo when nothing is selected", () => {
    expect(focusTransform(null)).toEqual({ scale: 1, tx: 0, ty: 0 })
  })

  it("zooms toward a small region and never shows outside the photo", () => {
    const t = focusTransform({ x: 0.8, y: 0.8, w: 0.15, h: 0.15 })
    expect(t.scale).toBe(REVEAL_MAX_SCALE)
    // 右下の角: これ以上動かすと写真の外が見えるので、端で止まる
    expect(t.tx).toBeCloseTo(1 - t.scale, 10)
    expect(t.ty).toBeCloseTo(1 - t.scale, 10)
  })

  it("centers a mid-photo region", () => {
    const t = focusTransform({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 })
    // 中心(0.5, 0.5)は画面の真ん中に来る: tx + scale·0.5 = 0.5
    expect(t.tx + t.scale * 0.5).toBeCloseTo(0.5, 10)
    expect(t.ty + t.scale * 0.5).toBeCloseTo(0.5, 10)
  })

  it("does not zoom a large region", () => {
    expect(focusTransform({ x: 0, y: 0, w: 0.9, h: 0.9 }).scale).toBe(1)
  })
})
