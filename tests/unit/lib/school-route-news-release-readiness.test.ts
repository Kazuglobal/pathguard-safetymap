import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { getAllNewsItems, getLatestNews } from "@/lib/school-route-news"

const ROOT = process.cwd()

describe("school route news release readiness regressions", () => {
  it("keeps the newest editorial items at the top of the school-route-news feed", () => {
    const allNewsItems = getAllNewsItems()
    const latestNews = getLatestNews(2)

    expect(allNewsItems[0]?.slug).toBe("kitakyushu-kokurakita-izumidai-suspicious-sns-20260420")
    expect(allNewsItems[1]?.slug).toBe("hakodate-aoyagi-candy-handover-20260417")
    expect(latestNews.map((item) => item.slug)).toEqual([
      "kitakyushu-kokurakita-izumidai-suspicious-sns-20260420",
      "hakodate-aoyagi-candy-handover-20260417",
    ])
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
