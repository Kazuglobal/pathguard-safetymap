import { describe, expect, it } from "vitest"

import {
  FALLBACK_SIMULATION_PROMPTS,
  FALLBACK_VIZ_PROMPT,
  SCENE_PRESERVATION_GUARD_SUFFIX,
} from "@/lib/disaster-image-prompt-fallbacks"

/**
 * フォールバックプロンプトの不変条件(恒久ルール)の回帰ガード。
 * - 写っているものだけラベル / アスペクト比維持 / 顔・ナンバー匿名化 は緩和不可。
 * - 'children' 等の児童言及は画像モデルの安全フィルタ誘発リスクのため禁止。
 */
describe("disaster-image-prompt-fallbacks", () => {
  it("FALLBACK_VIZ_PROMPT は固定日本語ラベル・凡例・アスペクト比維持・匿名化を含む", () => {
    expect(FALLBACK_VIZ_PROMPT).toContain("フェンス倒壊注意")
    expect(FALLBACK_VIZ_PROMPT).toContain("電柱倒壊注意")
    expect(FALLBACK_VIZ_PROMPT).toContain("冠水注意")
    expect(FALLBACK_VIZ_PROMPT).toContain("延焼注意")
    expect(FALLBACK_VIZ_PROMPT).toContain("凡例")
    expect(FALLBACK_VIZ_PROMPT).toContain("original aspect ratio")
    expect(FALLBACK_VIZ_PROMPT.toLowerCase()).toContain("face")
    expect(FALLBACK_VIZ_PROMPT.toLowerCase()).toContain("license plate")
  })

  it("FALLBACK_SIMULATION_PROMPTS は4ハザードちょうどで、各値が edit 指示・恒久ルールを含む", () => {
    expect(Object.keys(FALLBACK_SIMULATION_PROMPTS).sort()).toEqual([
      "earthquake",
      "fire",
      "flood",
      "typhoon",
    ])
    for (const prompt of Object.values(FALLBACK_SIMULATION_PROMPTS)) {
      expect(prompt.startsWith("Edit the provided photo")).toBe(true)
      expect(prompt).toContain("aspect ratio")
      expect(prompt).toContain("Do NOT")
      expect(prompt.toLowerCase()).toContain("license plate")
      expect(prompt).toContain("Do not add any text")
    }
  })

  it("児童言及(children)を含まない(画像モデルの安全フィルタ誘発防止)", () => {
    const all = [
      FALLBACK_VIZ_PROMPT,
      ...Object.values(FALLBACK_SIMULATION_PROMPTS),
      SCENE_PRESERVATION_GUARD_SUFFIX,
    ]
    for (const prompt of all) {
      expect(prompt.toLowerCase()).not.toContain("children")
    }
  })

  it("SCENE_PRESERVATION_GUARD_SUFFIX はアスペクト比維持と匿名化を含む", () => {
    expect(SCENE_PRESERVATION_GUARD_SUFFIX).toContain("aspect ratio")
    expect(SCENE_PRESERVATION_GUARD_SUFFIX.toLowerCase()).toContain("face")
    expect(SCENE_PRESERVATION_GUARD_SUFFIX.toLowerCase()).toContain("license plate")
  })
})
