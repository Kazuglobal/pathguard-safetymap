import { describe, expect, it } from "vitest"

import { splitFurigana } from "@/lib/hunter/furigana"

describe("splitFurigana", () => {
  it("annotates dictionary kanji words with readings", () => {
    const tokens = splitFurigana("正面衝突")
    expect(tokens).toEqual([{ t: "正面衝突", r: "しょうめんしょうとつ" }])
  })

  it("passes through non-dictionary text without ruby", () => {
    const tokens = splitFurigana("あぶない")
    expect(tokens).toEqual([{ t: "あぶない" }])
  })

  it("mixes ruby words and plain text in order", () => {
    const tokens = splitFurigana("車に注意")
    expect(tokens).toEqual([
      { t: "車", r: "くるま" },
      { t: "に" },
      { t: "注意", r: "ちゅうい" },
    ])
  })

  it("prefers the longest match (出会い頭 over 角)", () => {
    const tokens = splitFurigana("出会い頭")
    expect(tokens).toEqual([{ t: "出会い頭", r: "であいがしら" }])
  })

  it("reconstructs the original text from token parts", () => {
    const text = "通学路の写真であぶない場所をさがそう"
    const joined = splitFurigana(text)
      .map((tk) => tk.t)
      .join("")
    expect(joined).toBe(text)
  })

  it("returns an empty array for empty input", () => {
    expect(splitFurigana("")).toEqual([])
  })
})
