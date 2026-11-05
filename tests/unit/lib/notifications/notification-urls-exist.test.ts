import { describe, it, expect } from "vitest"
import { existsSync } from "node:fs"
import path from "node:path"
import {
  buildDailyDigestPushPayload,
  buildDangerReportPushPayload,
  buildEscalationPushPayload,
  buildLocalAlertBatchPushPayload,
  buildLocalAlertPushPayload,
  buildMagazinePushPayload,
  buildModerationOperationalAlertPushPayload,
  buildModerationResultPushPayload,
  buildNewsPushPayload,
} from "@/lib/notifications/builders"
import { readRegionFromSearch } from "@/lib/user-region"

// 通知をタップしたときの遷移先が、実在するページであることを確かめる。
// 以前、不審者アラートの通知が存在しない /local-alerts を開いて 404 になっていた。
const APP_DIR = path.resolve(__dirname, "../../../../app")

/** 遷移先のページがあるか。動的セグメント([slug])に当ててよいのは、記事ごとの通知(allowDynamic)だけ */
function pageExists(pathname: string, allowDynamic: boolean): boolean {
  const segments = pathname.split("/").filter(Boolean)
  let dir = APP_DIR
  for (const segment of segments) {
    const exact = path.join(dir, segment)
    if (existsSync(exact)) {
      dir = exact
      continue
    }
    const dynamic = path.join(dir, "[slug]")
    if (allowDynamic && existsSync(dynamic)) {
      dir = dynamic
      continue
    }
    return false
  }
  return existsSync(path.join(dir, "page.tsx"))
}

// 記事ごとのページ(app/<name>/[slug])を開く通知
const DYNAMIC_PAYLOADS = new Set(["news", "magazine"])

function pathnameOf(url: string): string {
  return new URL(url, "https://example.test").pathname
}

const PAYLOADS = {
  dangerReport: buildDangerReportPushPayload({ reportId: "r1", dangerType: "traffic" }),
  moderationResult: buildModerationResultPushPayload({ reportId: "r1", verdictStatus: "approved" }),
  escalation: buildEscalationPushPayload({ reportId: "r1" }),
  operationalAlert: buildModerationOperationalAlertPushPayload({
    reasons: ["pending_backlog"],
    fallbackRate: 0,
    pendingUnmoderated: 3,
  }),
  news: buildNewsPushPayload({ slug: "sample", title: "ニュース" }),
  localAlert: buildLocalAlertPushPayload({
    alertId: "a1",
    category: "suspicious",
    prefecture: "東京都",
    city: "千代田区",
    description: "声かけ事案",
  }),
  localAlertBatch: buildLocalAlertBatchPushPayload({ prefecture: "東京都", count: 3, latestAlertId: "a1" }),
  dailyDigest: buildDailyDigestPushPayload({ date: "2026-11-05", newsCount: 1, alertCount: 1 }),
  regionalDigest: buildDailyDigestPushPayload({
    date: "2026-11-05",
    newsCount: 1,
    alertCount: 1,
    prefecture: "東京都",
    localAlertCount: 1,
  }),
  magazine: buildMagazinePushPayload({ slug: "sample", title: "記事" }),
}

describe("通知の遷移先", () => {
  it.each(Object.entries(PAYLOADS))("%s の遷移先ページが app/ にある", (name, payload) => {
    const url = payload.data.url
    expect(url.startsWith("/")).toBe(true)
    expect(pageExists(pathnameOf(url), DYNAMIC_PAYLOADS.has(name))).toBe(true)
  })

  it("記事でない遷移先は [slug] に当てない(以前の /local-alerts のような誤りを見逃さない)", () => {
    expect(pageExists("/school-route-news/local-alerts", false)).toBe(false)
    expect(pageExists("/local-alerts", false)).toBe(false)
  })

  it("不審者アラートの通知は、その都道府県のアラート一覧を開く", () => {
    const url = new URL(PAYLOADS.localAlert.data.url, "https://example.test")
    expect(url.pathname).toBe("/school-route-news")
    expect(readRegionFromSearch(url.search)).toBe("東京都")
  })

  it.each(["localAlertBatch", "regionalDigest"] as const)("%s も、その都道府県の一覧を開く", (name) => {
    const url = new URL(PAYLOADS[name].data.url, "https://example.test")
    expect(url.pathname).toBe("/school-route-news")
    expect(readRegionFromSearch(url.search)).toBe("東京都")
  })
})

describe("readRegionFromSearch", () => {
  it("知らない地域名は無視する", () => {
    expect(readRegionFromSearch("?region=%E3%81%82")).toBeNull()
    expect(readRegionFromSearch("")).toBeNull()
  })

  it("全国も受け付ける", () => {
    expect(readRegionFromSearch(`?region=${encodeURIComponent("全国")}`)).toBe("全国")
  })
})
