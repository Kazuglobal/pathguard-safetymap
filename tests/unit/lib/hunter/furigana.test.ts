import { describe, expect, it } from "vitest"

import { splitFurigana } from "@/lib/hunter/furigana"
import {
  KID_COPY_BY_KIND,
  KID_DANGER_KINDS,
  KID_LABEL_BY_KIND,
} from "@/lib/hunter/kid-copy"
import { GUIDE_COPY_BY_REASON, selectGuideQuiz } from "@/lib/hunter/fallback-hazards"
import { KID_ACCIDENT_LABELS, childRiskHint, kidAccidentLabel } from "@/lib/hunter/accident-context"

const KANJI = /[㐀-鿿]/

/** ルビが付かないまま残った漢字を返す(辞書未登録の検出)。 */
function uncoveredKanji(text: string): string[] {
  const out: string[] = []
  for (const tk of splitFurigana(text)) {
    if (tk.r) continue
    for (const ch of tk.t) {
      if (KANJI.test(ch)) out.push(ch)
    }
  }
  return out
}

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

describe("kid-facing vocabulary furigana coverage", () => {
  it("covers every kanji in KID_LABEL_BY_KIND", () => {
    for (const kind of KID_DANGER_KINDS) {
      expect(uncoveredKanji(KID_LABEL_BY_KIND[kind])).toEqual([])
    }
  })

  it("covers every kanji in KID_COPY_BY_KIND (why / action)", () => {
    for (const kind of KID_DANGER_KINDS) {
      const copy = KID_COPY_BY_KIND[kind]
      expect(uncoveredKanji(copy.whyDangerous)).toEqual([])
      expect(uncoveredKanji(copy.safeAction)).toEqual([])
    }
  })

  it("covers every kanji in GUIDE_COPY_BY_REASON", () => {
    for (const text of Object.values(GUIDE_COPY_BY_REASON)) {
      expect(uncoveredKanji(text)).toEqual([])
    }
  })

  it("covers every kanji in the guide quiz bank", () => {
    for (const item of selectGuideQuiz(null, 4)) {
      expect(uncoveredKanji(item.question)).toEqual([])
      expect(uncoveredKanji(item.explanation)).toEqual([])
      for (const choice of item.choices ?? []) {
        expect(uncoveredKanji(choice.label)).toEqual([])
      }
    }
  })

  it("covers every kanji in childRiskHint at all risk levels", () => {
    for (const score of [0, 30, 60]) {
      expect(uncoveredKanji(childRiskHint(score))).toEqual([])
    }
  })

  it("covers every kanji produced by kidAccidentLabel for every KID_ACCIDENT_LABELS entry", () => {
    for (const [raw] of KID_ACCIDENT_LABELS) {
      expect(uncoveredKanji(kidAccidentLabel(raw))).toEqual([])
    }
  })

  it("reads 進路 as しんろ, not the homograph-ambiguous 進(すす) in 進路変更", () => {
    const tokens = splitFurigana(kidAccidentLabel("進路変更"))
    const shinro = tokens.find((tk) => tk.t === "進路")
    expect(shinro?.r).toBe("しんろ")
    expect(tokens.some((tk) => tk.t === "進" && tk.r === "すす")).toBe(false)
  })

  it("reads 外れる as はずれる, not the homograph-ambiguous 外(そと) in 路外逸脱", () => {
    const tokens = splitFurigana(kidAccidentLabel("路外逸脱"))
    const hazureru = tokens.find((tk) => tk.t === "外れる")
    expect(hazureru?.r).toBe("はずれる")
    expect(tokens.some((tk) => tk.t === "外" && tk.r === "そと")).toBe(false)
  })
})
