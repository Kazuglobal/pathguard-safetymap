import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { getAllNewsItems, getLatestNews, NEWS_ITEMS } from "@/lib/school-route-news"
import { getLandingNewsPreview } from "@/lib/landing-news-preview"
import { ALL_PREFECTURES, NATIONWIDE } from "@/lib/user-region"

const ROOT = process.cwd()

describe("school route news release readiness regressions", () => {
  it("keeps the newest editorial items at the top of the school-route-news feed", () => {
    const allNewsItems = getAllNewsItems()
    const latestNews = getLatestNews(5)

    expect(allNewsItems[0]?.slug).toBe("naha-matsukawa-schoolzone-motorcycle-20260716")
    expect(allNewsItems[1]?.slug).toBe("nishitokyo-izumicho-crosswalk-fatal-20260716")
    expect(allNewsItems[2]?.slug).toBe("komaki-muranaka-crosswalk-fatal-20260715")
    expect(allNewsItems[3]?.slug).toBe("hamamatsu-chuo-crosswalk-accident-20260703")
    expect(allNewsItems[4]?.slug).toBe("sendai-miyagino-tsurugaya-suspicious-20260710")
    expect(latestNews.map((item) => item.slug)).toEqual([
      "naha-matsukawa-schoolzone-motorcycle-20260716",
      "nishitokyo-izumicho-crosswalk-fatal-20260716",
      "komaki-muranaka-crosswalk-fatal-20260715",
      "hamamatsu-chuo-crosswalk-accident-20260703",
      "sendai-miyagino-tsurugaya-suspicious-20260710",
    ])
  })

  it("keeps NEWS_ITEMS within the 90-day retention window", () => {
    const now = new Date("2026-07-17T00:00:00+09:00")
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    for (const item of NEWS_ITEMS) {
      expect(new Date(item.publishedDate).getTime(), `${item.slug} is older than the 90-day retention window`)
        .toBeGreaterThanOrEqual(cutoff.getTime())
    }
  })

  it("does not pin a linux-only rollup binary as a direct application dependency", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))

    expect(packageJson.packageManager).toMatch(/^pnpm@/)
    expect(packageJson.dependencies?.["@rollup/rollup-linux-x64-gnu"]).toBeUndefined()
  })

  it("keeps pnpm lockfile aligned with direct school-route-news markdown dependencies", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))
    const pnpmLock = fs.readFileSync(path.join(ROOT, "pnpm-lock.yaml"), "utf8")

    expect(packageJson.dependencies?.["remark-gfm"]).toBe("^4.0.1")
    expect(pnpmLock).toContain("remark-gfm")
  })
})

describe("daily habit v3 data quality gates", () => {
  it("normalizes location.prefecture to formal prefecture names or 全国", () => {
    const validRegions = new Set<string>([NATIONWIDE, ...ALL_PREFECTURES])
    for (const item of NEWS_ITEMS) {
      expect(validRegions.has(item.location.prefecture), `${item.slug}: ${item.location.prefecture}`).toBe(true)
    }
  })

  it("keeps ids and slugs unique across the feed", () => {
    const ids = NEWS_ITEMS.map((item) => item.id)
    const slugs = NEWS_ITEMS.map((item) => item.slug)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("attaches そなえの一言 (actionAdvice) to every accident/suspicious item", () => {
    const riskItems = NEWS_ITEMS.filter(
      (item) => item.category === "accident" || item.category === "suspicious"
    )
    expect(riskItems.length).toBeGreaterThan(0)
    for (const item of riskItems) {
      expect(item.actionAdvice, `${item.slug} is missing actionAdvice`).toBeTruthy()
      expect(item.actionAdvice!.length, `${item.slug}: actionAdvice too long`).toBeLessThanOrEqual(60)
      expect(item.actionAdvice, `${item.slug}: actionAdvice must be a concrete action`).not.toContain(
        "気をつけましょう"
      )
    }
  })

  it("references only existing thumbnail files", () => {
    for (const item of NEWS_ITEMS) {
      if (!item.thumbnailUrl) continue
      const filePath = path.join(ROOT, "public", item.thumbnailUrl)
      expect(fs.existsSync(filePath), `${item.slug}: missing ${item.thumbnailUrl}`).toBe(true)
    }
  })

  it("derives the landing preview from NEWS_ITEMS (no manual array drift)", () => {
    const preview = getLandingNewsPreview(5)
    const top5 = getAllNewsItems().slice(0, 5)

    expect(preview.map((p) => p.slug)).toEqual(top5.map((i) => i.slug))
    expect(preview.map((p) => p.thumbnailUrl)).toEqual(top5.map((i) => i.thumbnailUrl))
    expect(preview.map((p) => p.title)).toEqual(top5.map((i) => i.title))
  })
})
