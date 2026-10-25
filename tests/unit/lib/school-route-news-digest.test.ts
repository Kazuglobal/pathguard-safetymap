import { describe, expect, it } from "vitest"
import {
  getTodaysDigest,
  toJstDateKey,
  NEWS_ITEMS,
} from "@/lib/school-route-news"
import { findLatestWeeklyTrend } from "@/lib/school-route-news-feed"
import {
  getActionPhraseForAlert,
  LOCAL_ALERT_ACTION_PHRASES,
} from "@/lib/local-alert-action-phrases"
import { isWithinQuietHoursJst } from "@/lib/push-notifications/notify-local-alert"
import { ALL_PREFECTURES, NATIONWIDE } from "@/lib/user-region"

describe("toJstDateKey", () => {
  it("rolls UTC evening over to the next JST calendar day", () => {
    expect(toJstDateKey("2026-07-05T23:00:00Z")).toBe("2026-07-06")
    expect(toJstDateKey("2026-07-06T14:59:00Z")).toBe("2026-07-06")
    expect(toJstDateKey("2026-07-06T15:00:00Z")).toBe("2026-07-07")
  })

  it("handles JST-offset ISO strings as-is", () => {
    expect(toJstDateKey("2026-04-20T15:00:00+09:00")).toBe("2026-04-20")
  })

  it("returns empty string for invalid input", () => {
    expect(toJstDateKey("not-a-date")).toBe("")
  })
})

describe("getTodaysDigest", () => {
  it("counts items published on the same JST day, split by prefecture", () => {
    // 基準日とその日の本数を直書きすると、90日の保持期間ポリシーで該当記事が落ちた瞬間に
    // このテストが壊れる（2026-07-26 の4本を直書きしていたため、実際に赤になった）。
    // NEWS_ITEMS の最新公開日を基準にして、同じ日の件数と都道府県の内訳を検証する。
    const newestIso = NEWS_ITEMS.reduce(
      (acc, item) =>
        new Date(item.publishedDate).getTime() > new Date(acc).getTime() ? item.publishedDate : acc,
      NEWS_ITEMS[0].publishedDate
    )
    const dateKey = toJstDateKey(newestIso)
    const sameDay = NEWS_ITEMS.filter((item) => toJstDateKey(item.publishedDate) === dateKey)
    const now = new Date(newestIso)
    expect(sameDay.length).toBeGreaterThan(0)

    const national = getTodaysDigest("全国", now)
    expect(national.date).toBe(dateKey)
    expect(national.nationalCount).toBe(sameDay.length)
    expect(national.localNewsCount).toBe(sameDay.length)

    const targetPrefecture = sameDay
      .map((item) => item.location.prefecture)
      .find((prefecture) => prefecture !== NATIONWIDE)
    expect(targetPrefecture).toBeTruthy()
    const expectedLocal = sameDay.filter(
      (item) => item.location.prefecture === targetPrefecture
    ).length
    const local = getTodaysDigest(targetPrefecture as string, now)
    expect(local.nationalCount).toBe(sameDay.length)
    expect(local.localNewsCount).toBe(expectedLocal)

    const absentPrefecture = ALL_PREFECTURES.find(
      (prefecture) => !sameDay.some((item) => item.location.prefecture === prefecture)
    )
    expect(absentPrefecture).toBeTruthy()
    const none = getTodaysDigest(absentPrefecture as string, now)
    expect(none.nationalCount).toBe(sameDay.length)
    expect(none.localNewsCount).toBe(0)
  })

  it("returns zero counts on a day without published items", () => {
    const digest = getTodaysDigest("全国", new Date("2027-01-01T09:00:00+09:00"))
    expect(digest.nationalCount).toBe(0)
    expect(digest.localNewsCount).toBe(0)
  })
})

describe("getActionPhraseForAlert (そなえの一言)", () => {
  it("returns the same phrase for the same alert id (deterministic)", () => {
    const first = getActionPhraseForAlert("alert-123", "suspicious")
    const second = getActionPhraseForAlert("alert-123", "suspicious")
    expect(first).toBe(second)
    expect(LOCAL_ALERT_ACTION_PHRASES.suspicious).toContain(first)
  })

  it("falls back to the general phrases for unknown categories", () => {
    const phrase = getActionPhraseForAlert("alert-999", "unknown_category")
    expect(LOCAL_ALERT_ACTION_PHRASES.other).toContain(phrase)
  })

  it("covers every alert category with at least one phrase", () => {
    for (const phrases of Object.values(LOCAL_ALERT_ACTION_PHRASES)) {
      expect(phrases.length).toBeGreaterThan(0)
    }
  })
})

describe("isWithinQuietHoursJst (静音時間帯 JST 22:00〜7:30)", () => {
  it("treats late night and early morning as quiet hours", () => {
    expect(isWithinQuietHoursJst(new Date("2026-07-06T13:00:00Z"))).toBe(true) // JST 22:00
    expect(isWithinQuietHoursJst(new Date("2026-07-06T17:00:00Z"))).toBe(true) // JST 02:00
    expect(isWithinQuietHoursJst(new Date("2026-07-05T22:29:00Z"))).toBe(true) // JST 07:29
  })

  it("allows daytime delivery from 7:30 JST", () => {
    expect(isWithinQuietHoursJst(new Date("2026-07-05T22:30:00Z"))).toBe(false) // JST 07:30
    expect(isWithinQuietHoursJst(new Date("2026-07-06T03:00:00Z"))).toBe(false) // JST 12:00
    expect(isWithinQuietHoursJst(new Date("2026-07-06T12:59:00Z"))).toBe(false) // JST 21:59
  })
})

describe("findLatestWeeklyTrend (週次傾向のピン留め)", () => {
  const daily = (publishedDate: string) => ({ publishedDate, newsType: undefined })
  const weekly = (publishedDate: string) => ({ publishedDate, newsType: "weekly_trend" as const })

  it("returns the newest weekly_trend item even when the input is unsorted", () => {
    const older = weekly("2026-06-22T07:00:00+09:00")
    const newer = weekly("2026-06-29T07:00:00+09:00")
    const items = [daily("2026-07-01T09:00:00+09:00"), older, daily("2026-06-25T09:00:00+09:00"), newer]

    expect(findLatestWeeklyTrend(items)).toBe(newer)
  })

  it("returns undefined when no weekly_trend item exists", () => {
    expect(findLatestWeeklyTrend([daily("2026-07-01T09:00:00+09:00")])).toBeUndefined()
  })

  it("derives the pinned weekly trend from NEWS_ITEMS (no hard-coded slug)", () => {
    // 保持期間ポリシー（90日）で記事が入れ替わってもテストが壊れないよう、
    // 固定スラッグではなく NEWS_ITEMS からの導出が一致することを検証する。
    const newest = [...NEWS_ITEMS]
      .filter((item) => item.newsType === "weekly_trend")
      .sort((a, b) => Date.parse(b.publishedDate) - Date.parse(a.publishedDate))[0]
    const pinned = findLatestWeeklyTrend(NEWS_ITEMS)

    expect(pinned?.slug).toBe(newest?.slug)
    if (newest) {
      expect(pinned?.tags).toContain("週次傾向")
      expect(pinned?.actionAdvice).toBeTruthy()
    }
  })

  it("does not mutate the input array order", () => {
    const items = [daily("2026-07-01T09:00:00+09:00"), weekly("2026-06-29T07:00:00+09:00")]
    const snapshot = [...items]
    findLatestWeeklyTrend(items)
    expect(items).toEqual(snapshot)
  })
})
