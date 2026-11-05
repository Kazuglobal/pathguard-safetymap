import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, waitFor } from "@testing-library/react"

const { alertsSpy } = vi.hoisted(() => ({ alertsSpy: vi.fn() }))

vi.mock("@/hooks/use-local-safety-alerts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-local-safety-alerts")>()
  return {
    ...actual,
    useLocalSafetyAlerts: (options: { prefecture?: string }) => {
      alertsSpy(options.prefecture)
      return { alerts: [], isLoading: false, error: null }
    },
  }
})

vi.mock("@/hooks/use-news-read-state", () => ({
  useNewsReadState: () => ({ hydrated: true, isRead: () => false, markRead: vi.fn(), streakDays: 0 }),
}))

vi.mock("@/hooks/use-push-subscription", () => ({
  syncPushSubscriptionRegion: vi.fn(),
}))

import { NewsFeedClient } from "@/components/school-route-news/news-feed-client"
import { REGION_STORAGE_KEY } from "@/lib/user-region"

describe("安全ニュース: 通知から開いたときの地域", () => {
  beforeEach(() => {
    alertsSpy.mockClear()
    window.localStorage.clear()
  })
  afterEach(() => {
    window.history.replaceState(null, "", "/")
  })

  it("?region= の都道府県でアラートを読み、保存済みの地域は書き換えない", async () => {
    window.localStorage.setItem(REGION_STORAGE_KEY, "大阪府")
    window.history.replaceState(null, "", `/school-route-news?region=${encodeURIComponent("東京都")}`)

    render(<NewsFeedClient items={[]} />)

    await waitFor(() => expect(alertsSpy).toHaveBeenLastCalledWith("東京都"))
    expect(window.localStorage.getItem(REGION_STORAGE_KEY)).toBe("大阪府")
  })

  it("?region= がなければ保存済みの地域を使う", async () => {
    window.localStorage.setItem(REGION_STORAGE_KEY, "大阪府")
    window.history.replaceState(null, "", "/school-route-news")

    render(<NewsFeedClient items={[]} />)

    await waitFor(() => expect(alertsSpy).toHaveBeenLastCalledWith("大阪府"))
  })
})
