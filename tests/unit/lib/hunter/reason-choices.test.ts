import { describe, expect, it } from "vitest"

import {
  CONFUSABLE_KIND_GROUPS,
  KID_DANGER_KINDS,
  KID_REASON_BY_KIND,
  type HunterDangerKind,
} from "@/lib/hunter/kid-copy"
import { buildReasonChoices, canAskReason } from "@/lib/hunter/reason-choices"

const ASKABLE = KID_DANGER_KINDS.filter((k) => k !== "other")

function confusable(a: HunterDangerKind, b: HunterDangerKind): boolean {
  return CONFUSABLE_KIND_GROUPS.some((g) => g.includes(a) && g.includes(b))
}

describe("buildReasonChoices", () => {
  it("returns three distinct choices including the correct reason, for every askable kind", () => {
    for (const kind of ASKABLE) {
      const choices = buildReasonChoices({ id: `s-${kind}`, kind }, [{ kind }])
      expect(choices).toHaveLength(3)
      expect(choices!.map((c) => c.kind)).toContain(kind)
      expect(new Set(choices!.map((c) => c.label)).size).toBe(3)
      for (const c of choices!) expect(c.label).toBe(KID_REASON_BY_KIND[c.kind])
    }
  })

  it("never pairs the answer with a confusable reason", () => {
    for (const kind of ASKABLE) {
      for (let i = 0; i < 20; i += 1) {
        const choices = buildReasonChoices({ id: `seed-${i}`, kind }, [{ kind }])!
        for (const c of choices) if (c.kind !== kind) expect(confusable(kind, c.kind)).toBe(false)
      }
    }
  })

  it("avoids kinds that are present in the same photo when it can", () => {
    const hazards = [{ kind: "blind_corner" as const }, { kind: "narrow_sidewalk" as const }]
    for (let i = 0; i < 20; i += 1) {
      const choices = buildReasonChoices({ id: `p-${i}`, kind: "blind_corner" }, hazards)!
      expect(choices.map((c) => c.kind)).not.toContain("narrow_sidewalk")
    }
  })

  it("falls back to present kinds when too few are left", () => {
    const hazards = (["blind_corner", "crossing_no_signal", "turning_car", "narrow_sidewalk", "falling_object"] as const).map(
      (kind) => ({ kind }),
    )
    const choices = buildReasonChoices({ id: "crowded", kind: "blind_corner" }, hazards)
    expect(choices).toHaveLength(3)
  })

  it("is deterministic per hazard and moves the answer position across hazards", () => {
    expect(buildReasonChoices({ id: "x-1", kind: "turning_car" }, [])).toEqual(
      buildReasonChoices({ id: "x-1", kind: "turning_car" }, []),
    )
    const positions = new Set(
      Array.from({ length: 30 }, (_, i) =>
        buildReasonChoices({ id: `sess-${i}-0`, kind: "turning_car" }, [])!.findIndex((c) => c.kind === "turning_car"),
      ),
    )
    expect(positions.size).toBe(3)
  })

  it("does not ask when the kind is other or missing", () => {
    expect(buildReasonChoices({ id: "a", kind: "other" }, [])).toBeNull()
    expect(buildReasonChoices({ id: "a", kind: undefined }, [])).toBeNull()
    expect(canAskReason("other")).toBe(false)
    expect(canAskReason(undefined)).toBe(false)
    expect(canAskReason("flood_dip")).toBe(true)
  })

  it("keeps reason copy free of English letters and roughly the same length", () => {
    const labels = ASKABLE.map((k) => KID_REASON_BY_KIND[k] as string)
    for (const label of labels) {
      expect(label).not.toMatch(/[A-Za-z]/)
      expect(label.endsWith("から")).toBe(true)
      expect(label.length).toBeLessThanOrEqual(20)
    }
  })
})
