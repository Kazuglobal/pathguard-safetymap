import { describe, expect, it } from "vitest"

import { splitFurigana } from "@/lib/hunter/furigana"
import { buildSafeReasonChoices, canAskSafeReason } from "@/lib/hunter/reason-choices"
import {
  CONFUSABLE_SAFE_KIND_GROUPS,
  HUNTER_SAFE_KINDS,
  inferSafeKind,
  KID_SAFE_REASON_BY_KIND,
  normalizeSafeKind,
} from "@/lib/hunter/safe-kinds"

const KANJI = /[㐀-鿿]/

describe("safe kinds", () => {
  it("infers the kind from the kid label (横断歩道 before 歩道)", () => {
    expect(inferSafeKind("横断歩道")).toBe("crosswalk")
    expect(inferSafeKind("歩道")).toBe("sidewalk")
    expect(inferSafeKind("ガードレール")).toBe("guardrail")
    expect(inferSafeKind("カーブミラー")).toBe("curve_mirror")
    expect(inferSafeKind("信号")).toBe("traffic_signal")
    expect(inferSafeKind("街灯")).toBe("street_light")
    expect(inferSafeKind("きれいな はな")).toBe("other")
    expect(inferSafeKind(undefined)).toBe("other")
  })

  it("prefers a known AI kind, and falls back to the label when the AI says other or something unknown", () => {
    expect(normalizeSafeKind("curve_mirror", "ガードレール")).toBe("curve_mirror")
    expect(normalizeSafeKind("other", "ガードレール")).toBe("guardrail")
    expect(normalizeSafeKind("bogus", "歩道")).toBe("sidewalk")
    expect(normalizeSafeKind(undefined, "なにか")).toBe("other")
  })

  it("has reason copy with dictionary-covered kanji and correct readings", () => {
    const read = (text: string) => splitFurigana(text).map((tk) => tk.r ?? tk.t).join("")
    const uncovered = (text: string) =>
      splitFurigana(text).flatMap((tk) => (tk.r ? [] : [...tk.t].filter((ch) => KANJI.test(ch))))
    for (const kind of HUNTER_SAFE_KINDS) {
      const reason = KID_SAFE_REASON_BY_KIND[kind]
      if (!reason) continue
      expect(uncovered(reason)).toEqual([])
      expect(reason).not.toMatch(/[A-Za-z]/)
      expect(reason.endsWith("から")).toBe(true)
    }
    expect(read(KID_SAFE_REASON_BY_KIND.guardrail!)).toBe("くるまが あるく ところに はいらない から")
    expect(read(KID_SAFE_REASON_BY_KIND.curve_mirror!)).toBe("かどの むこうの くるまが みえる から")
    expect(read(KID_SAFE_REASON_BY_KIND.traffic_signal!)).toBe("とまる じゅんばんが きまる から")
  })
})

describe("buildSafeReasonChoices", () => {
  it("returns 3 distinct choices with the right one, never pairing confusable kinds", () => {
    const askable = HUNTER_SAFE_KINDS.filter((k) => k !== "other")
    for (const kind of askable) {
      for (let i = 0; i < 10; i += 1) {
        const choices = buildSafeReasonChoices({ id: `p-${kind}-${i}`, safeKind: kind }, [{ safeKind: kind }])!
        expect(choices).toHaveLength(3)
        expect(choices.map((c) => c.kind)).toContain(kind)
        const group = CONFUSABLE_SAFE_KIND_GROUPS.find((g) => g.includes(kind)) ?? [kind]
        for (const c of choices) if (c.kind !== kind) expect(group).not.toContain(c.kind)
      }
    }
  })

  it("does not ask for other / missing kinds", () => {
    expect(buildSafeReasonChoices({ id: "a", safeKind: "other" }, [])).toBeNull()
    expect(buildSafeReasonChoices({ id: "a" }, [])).toBeNull()
    expect(canAskSafeReason("guardrail")).toBe(true)
    expect(canAskSafeReason(undefined)).toBe(false)
  })
})
