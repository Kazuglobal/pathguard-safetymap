// @vitest-environment node
import { describe, expect, it } from "vitest"

import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { isProtectedPath, PROTECTED_PREFIXES } from "@/lib/auth/protected-paths"
import { LP_FAQ, LP_FEATURES, LP_HERO, LP_META } from "@/lib/lp-content"
import { getAllArticles } from "@/lib/safe-magazine"
import { getAllNewsItems } from "@/lib/school-route-news"
import { SITE_URL, buildLpJsonLd, jsonLdString } from "@/lib/seo"

describe("robots.txt", () => {
  const rules = robots().rules
  const rule = Array.isArray(rules) ? rules[0] : rules
  const disallow = [rule?.disallow ?? []].flat()

  it("ログインが要る画面と API をすべて検索から外す", () => {
    for (const prefix of PROTECTED_PREFIXES) {
      expect(disallow.some((path) => prefix === path || prefix.startsWith(path)), prefix).toBe(true)
    }
    expect(disallow).toContain("/api/")
  })

  it("紹介ページ・ニュース・マガジンは外さず、サイトマップを示す", () => {
    for (const path of ["/lp", "/school-route-news", "/safe-magazine"]) {
      expect(disallow.some((d) => path.startsWith(d)), path).toBe(false)
    }
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })
})

describe("sitemap.xml", () => {
  const entries = sitemap()
  const paths = entries.map((entry) => new URL(entry.url).pathname)

  it("ログインが要るページを載せない", () => {
    expect(paths.filter((path) => isProtectedPath(path))).toEqual([])
  })

  it("紹介ページと、すべてのニュース・マガジン記事を絶対URLで載せる", () => {
    expect(paths).toContain("/lp")
    for (const item of getAllNewsItems()) expect(paths).toContain(`/school-route-news/${item.slug}`)
    for (const article of getAllArticles()) expect(paths).toContain(`/safe-magazine/${article.slug}`)
    for (const entry of entries) expect(entry.url.startsWith(SITE_URL)).toBe(true)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe("紹介ページの検索向けの文", () => {
  it("タイトル・説明・見出しの近くに「通学路」「危険」「キケン」を入れる", () => {
    expect(LP_META.title).toMatch(/通学路/)
    expect(LP_META.title).toMatch(/危険/)
    expect(LP_META.title).toMatch(/キケン/)
    expect(LP_META.description).toMatch(/通学路の危険箇所/)
    expect(LP_HERO.eyebrow).toMatch(/通学路の危険/)
    expect(LP_FAQ.some((item) => item.q.includes("通学路の危険箇所"))).toBe(true)
  })

  it("構造化データのよくある質問と機能は、画面に出している文と同じ", () => {
    const data = buildLpJsonLd({ description: LP_META.description, faq: LP_FAQ, features: LP_FEATURES.map((f) => f.title) })
    const graph = data["@graph"] as Array<Record<string, unknown>>
    const faq = graph.find((node) => node["@type"] === "FAQPage") as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> }
    expect(faq.mainEntity.map((q) => q.name)).toEqual(LP_FAQ.map((item) => item.q))
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(LP_FAQ.map((item) => item.a))
    const app = graph.find((node) => node["@type"] === "WebApplication") as { offers: { price: string }; featureList: string[] }
    expect(app.offers.price).toBe("0")
    expect(app.featureList).toEqual(LP_FEATURES.map((f) => f.title))
  })

  it("JSON-LD を <script> に埋めても閉じタグで抜け出せない", () => {
    expect(jsonLdString({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>")
  })
})
