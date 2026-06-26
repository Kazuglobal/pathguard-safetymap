import { describe, expect, it } from "vitest"

import { getPipelinePromptByType } from "@/lib/gemini-hazard"

const SENTINEL = "【この地点の過去の事故傾向】テスト用の注入文（出会い頭が多い）"

describe("getPipelinePromptByType accident context injection", () => {
  it("injects the accident context string into the prompt", () => {
    const prompt = getPipelinePromptByType("child", undefined, SENTINEL)
    expect(prompt).toContain(SENTINEL)
  })

  it("does not include the sentinel when no accident context is given", () => {
    const prompt = getPipelinePromptByType("child")
    expect(prompt).not.toContain(SENTINEL)
  })

  it("treats an empty/whitespace accident context as no injection", () => {
    const base = getPipelinePromptByType("child")
    const withEmpty = getPipelinePromptByType("child", undefined, "   ")
    expect(withEmpty).toBe(base)
  })

  it("keeps the JSON-only instruction after injection", () => {
    const prompt = getPipelinePromptByType("child", undefined, SENTINEL)
    expect(prompt).toContain("必ずJSONのみを出力")
    // 注入文は JSON 指示より前に置かれる
    expect(prompt.indexOf(SENTINEL)).toBeLessThan(prompt.indexOf("必ずJSONのみを出力"))
  })

  it("works alongside user markers (both suffixes present)", () => {
    const prompt = getPipelinePromptByType(
      "child",
      [{ id: "m1", x: 0.1, y: 0.2, width: 0.1, height: 0.1, label: "hazard", category: "hazard", timestamp: 1 }],
      SENTINEL,
    )
    expect(prompt).toContain(SENTINEL)
    expect(prompt).toContain("ユーザーマーキング情報")
  })
})
