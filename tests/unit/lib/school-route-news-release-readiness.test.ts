import { createHash } from "crypto"
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

    const latestSlugs = latestNews.map((item) => item.slug)
    expect(latestSlugs).toHaveLength(5)
    expect(latestSlugs).toEqual(expect.arrayContaining([
      "shimotsuke-koganei-photographed-tochigi-following-20261023",
      "shizuoka-highschool-bicycle-helmet-ordinance-20261015",
      "tokushima-oshin-higashisadakata-schoolway-girl-hit-20261023",
      "itoigawa-yokomachi-two-voice-calls-20261023",
      "gifu-city-watch-network-expansion-20261022",
    ]))
    expect(allNewsItems.map((item) => item.slug)).toEqual(expect.arrayContaining([
      "matsumoto-arigasaki-hitandrun-referral-20261019",
      "saga-kamimine-takeo-voice-call-chase-20261022",
      "matsuyama-jobomen-crosswalk-girl-hit-20261019",
    ]))
    expect(allNewsItems.map((item) => item.slug)).toEqual(expect.arrayContaining([
      "matsumoto-arigasaki-hitandrun-referral-20261019",
      "saga-kamimine-takeo-voice-call-chase-20261022",
      "iwaki-jobanshimoyunagaya-crosswalk-juniorhigh-20261022",
      "kawaguchi-shibahinotsume-voice-call-20261022",
      "oita-sunset-3set-campaign-20261020",
      "shunan-ogochi-crosswalk-highschool-girl-20261021",
      "nagasaki-hoei-shindo-camera-voice-call-20261015",
      "tatebayashi-highschool-bicycle-safety-class-20261020",
      "suwa-nakasu-schoolway-hitandrun-20261015",
      "matsuyama-hatadera-following-20261017",
      "kagawa-bicycle-safety-day-20261020",
      "kumamoto-kita-two-days-stalking-20261015",
      "ofunato-masaki-bicycle-hitandrun-20261011",
      "asahikawa-higashikou-voice-call-20261008",
      "tendo-ekinishi-candy-lure-voice-call-20261002",
      "gifu-schools-intruder-drill-20261015",
      "omaezaki-sakura-schoolway-boy-hit-20261013",
      "suzuka-schoolway-crosswalk-hitandrun-arrest-20261014",
      "hiroshima-city-october-voice-calls-20261009",
      "okinoshima-schoolway-security-camera-20261001",
      "national-school-safety-volunteer-award-20261013",
      "kochi-city-schoolway-indecent-exposure-arrest-20261007",
      "sagamihara-minami-shimomizo-children-confinement-20261005",
      "matsue-higashitsuda-wrist-grabbed-20261006",
      "tsuru-schoolway-joint-inspection-20261006",
      "namerikawa-schoolway-safety-inspection-20261007",
      "isesaki-hashie-bicycle-commute-collision-20261007",
      "inzai-kikari-crosswalk-hitandrun-20261001",
      "ikoma-tawaraguchi-knife-sighting-20261002",
      "tokushima-kokufu-hiraki-voice-call-20261001",
      "kumamoto-higashi-nagamineminami-following-20261006",
      "setagaya-kinuta-elementary-girl-touched-20260929",
      "joetsu-saijomachi-schoolway-following-20260928",
      "kurume-agetsu-bicycle-commute-collision-20260925",
      "kumamoto-late-september-girl-approach-cluster-20260924",
      "saitama-iwatsuki-kakura-stalking-20260924",
      "fukuoka-late-august-child-approach-cluster-20260828",
      "national-living-road-casualty-analysis-20260910",
      "ichinomiya-fuji-bicycle-collision-20260910",
      "kumamoto-kita-shimizukamei-stalking-20260909",
      "hiroshima-city-september-voice-calls-20260903",
      "gifu-kano-schoolguard-watch-20260828",
    ]))
  })

  it("keeps NEWS_ITEMS within the 90-day retention window", () => {
    // 基準日を直書きすると、更新を止めた瞬間にゲートが素通りになる
    // （2026-10-02 に固定されたまま期限切れ記事が9本残っていた）。
    // 最新記事の公開日を基準にして、フィードの幅が90日を超えないことを検証する。
    const DAY_MS = 24 * 60 * 60 * 1000
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000
    // 保持期間は「日」単位なので、最新記事の JST の日付の0時を基準にする
    // （時刻まで含めると、同じ日に公開された記事が数分差で落ちる）。
    const jstDayStart = (ms: number) => Math.floor((ms + JST_OFFSET_MS) / DAY_MS) * DAY_MS - JST_OFFSET_MS
    const newest = Math.max(...NEWS_ITEMS.map((item) => new Date(item.publishedDate).getTime()))
    const cutoff = jstDayStart(newest) - 90 * DAY_MS
    for (const item of NEWS_ITEMS) {
      expect(new Date(item.publishedDate).getTime(), `${item.slug} is older than the 90-day retention window`)
        .toBeGreaterThanOrEqual(cutoff)
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

describe("thumbnail coverage", () => {
  it("gives every news item a thumbnailUrl whose file exists", () => {
    for (const item of NEWS_ITEMS) {
      expect(item.thumbnailUrl, `${item.slug}: thumbnailUrl is missing`).toBeTruthy()
      const file = path.join(ROOT, "public", item.thumbnailUrl as string)
      expect(fs.existsSync(file), `${item.slug}: ${item.thumbnailUrl} does not exist`).toBe(true)
    }
  })

  it("keeps every contentImages entry pointing at an existing file", () => {
    for (const item of NEWS_ITEMS) {
      for (const image of item.contentImages ?? []) {
        expect(image.description.length, `${item.slug}/${image.id}: description is empty`).toBeGreaterThan(0)
        expect(fs.existsSync(path.join(ROOT, "public", image.url)), `${item.slug}/${image.id}: ${image.url} does not exist`).toBe(true)
      }
    }
  })

  // 存在チェックだけでは ImageMagick の暫定画像（数十KBの図形）がすり抜ける。
  // 実画像（Gemini 生成）は 500KB 以上になるため、小さすぎる・JPEG でない・同一内容の画像を弾く。
  // 失敗したら: 該当ファイルを削除して `npx tsx scripts/generate-missing-images.ts news` で本生成する。
  it("uses generated artwork, not placeholder images, for every referenced image", () => {
    const MIN_GENERATED_BYTES = 100_000
    const seen = new Map<string, string>()
    for (const item of NEWS_ITEMS) {
      const urls = [item.thumbnailUrl, ...(item.contentImages ?? []).map((image) => image.url)].filter((url): url is string => Boolean(url))
      for (const url of urls) {
        const bytes = fs.readFileSync(path.join(ROOT, "public", url))
        const label = `${item.slug}: ${url}`
        expect(bytes.length, `${label} is ${bytes.length} bytes (placeholder?)`).toBeGreaterThanOrEqual(MIN_GENERATED_BYTES)
        expect(bytes[0] === 0xff && bytes[1] === 0xd8, `${label} is not a JPEG`).toBe(true)
        expect(url, `${label} must use a .jpg extension`).toMatch(/\.jpe?g$/)
        const digest = createHash("md5").update(bytes).digest("hex")
        expect(seen.get(digest), `${label} duplicates ${seen.get(digest)}`).toBeUndefined()
        seen.set(digest, label)
      }
    }
  })
})
