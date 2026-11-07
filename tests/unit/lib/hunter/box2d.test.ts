import { describe, expect, it } from "vitest"

import { box2dToRegion, detectScale, focusToPoint, normalizeNativeCoords } from "@/lib/hunter/box2d"
import { validateHunterResponse } from "@/lib/hunter/ai-schema"

function close(actual: Record<string, number>, expected: Record<string, number>) {
  for (const key of Object.keys(expected)) expect(actual[key]).toBeCloseTo(expected[key], 10)
}

describe("box2dToRegion", () => {
  it("converts Gemini's native [ymin, xmin, ymax, xmax] on the 0-1000 scale", () => {
    const out = box2dToRegion([520, 400, 720, 580])
    expect(out?.scale).toBe(1000)
    close(out!.region as unknown as Record<string, number>, { x: 0.4, y: 0.52, w: 0.18, h: 0.2 })
  })

  it("repairs swapped min/max and reads 0-1 values, nested arrays and JSON strings", () => {
    close(box2dToRegion([720, 580, 520, 400])!.region as never, { x: 0.4, y: 0.52, w: 0.18, h: 0.2 })
    const unit = box2dToRegion([0.52, 0.4, 0.72, 0.58])
    expect(unit?.scale).toBe(1)
    close(unit!.region as never, { x: 0.4, y: 0.52, w: 0.18, h: 0.2 })
    close(box2dToRegion([[520, 400, 720, 580]])!.region as never, { x: 0.4, y: 0.52 })
    close(box2dToRegion("[520, 400, 720, 580]")!.region as never, { x: 0.4, y: 0.52 })
    close(box2dToRegion(["520", "400", "720", "580"])!.region as never, { x: 0.4, y: 0.52 })
  })

  it("refuses values it cannot read without guessing", () => {
    expect(box2dToRegion([1, 2, 3])).toBeNull()
    expect(box2dToRegion([-5, 0, 100, 100])).toBeNull()
    expect(box2dToRegion([0, 0, 1200, 900])).toBeNull()
    expect(box2dToRegion("not json")).toBeNull()
    expect(box2dToRegion({ x: 1 })).toBeNull()
    expect(box2dToRegion([0, "a", 1, 1])).toBeNull()
  })

  it("decides the scale from all values", () => {
    expect(detectScale([0.1, 0.9, 1.2])).toBe(1)
    expect(detectScale([0.1, 0.9, 500])).toBe(1000)
    expect(detectScale([0.1, -1])).toBeNull()
  })
})

describe("focusToPoint", () => {
  it("converts [y, x] and uses the box's scale when given", () => {
    close(focusToPoint([610, 420])! as never, { x: 0.42, y: 0.61 })
    // box が 0〜1000 なら focus の小さい値(1)も 1000 で割る(0〜1 と取り違えない)
    close(focusToPoint([500, 1], 1000)! as never, { x: 0.001, y: 0.5 })
    close(focusToPoint([0.61, 0.42])! as never, { x: 0.42, y: 0.61 })
    expect(focusToPoint([610])).toBeNull()
    expect(focusToPoint([610, 420], 1)).toBeNull() // 0〜1 の箱に 0〜1000 の点は混ぜない
  })
})

describe("normalizeNativeCoords", () => {
  it("rewrites box_2d/focus into region/focus without touching the input", () => {
    const raw = Object.freeze({ kind: "blind_corner", box_2d: [100, 200, 300, 400], focus: [150, 250] })
    const out = normalizeNativeCoords(raw) as Record<string, unknown>
    close(out.region as never, { x: 0.2, y: 0.1, w: 0.2, h: 0.2 })
    close(out.focus as never, { x: 0.25, y: 0.15 })
    expect(raw).toEqual({ kind: "blind_corner", box_2d: [100, 200, 300, 400], focus: [150, 250] })
  })

  it("leaves legacy region objects alone", () => {
    const legacy = { kind: "blind_corner", region: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }
    expect(normalizeNativeCoords(legacy)).toBe(legacy)
    expect(normalizeNativeCoords(null)).toBeNull()
  })
})

describe("validateHunterResponse with native coordinates", () => {
  it("accepts box_2d danger points and keeps the focus", () => {
    const out = validateHunterResponse({
      imageUsable: true,
      dangerPoints: [
        { kind: "blind_corner", box_2d: [520, 400, 720, 580], focus: [610, 420], confidence: 0.8 },
        { kind: "popout_spot", box_2d: [10, 20, 30] }, // 読めない枠は落とす
      ],
      safePoints: [{ kind: "other", kidType: "ガードレール", box_2d: [800, 0, 1000, 1000], whyGood: "まもって くれるよ。" }],
    })
    expect(out.dangerPoints).toHaveLength(1)
    close(out.dangerPoints[0].region as never, { x: 0.4, y: 0.52, w: 0.18, h: 0.2 })
    close(out.dangerPoints[0].focus as never, { x: 0.42, y: 0.61 })
    close(out.safePoints[0].region as never, { x: 0, y: 0.8, w: 1, h: 0.2 })
  })
})
