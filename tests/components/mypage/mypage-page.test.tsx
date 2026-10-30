import React from "react"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PushSubscriptionState } from "@/hooks/use-push-subscription"

const mocks = vi.hoisted(() => ({
  pushState: "unsubscribed" as PushSubscriptionState,
  unavailableReason: "browser" as "ios-needs-home-screen" | "ios-too-old" | "browser",
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("framer-motion", () => {
  const strip = (tag: "header" | "div") =>
    React.forwardRef<HTMLElement, Record<string, unknown>>(function Motion({ initial: _i, animate: _a, transition: _t, ...props }, ref) {
      return React.createElement(tag, { ref, ...props })
    })
  return { motion: { header: strip("header"), div: strip("div") }, useReducedMotion: () => true }
})

vi.mock("@/components/providers/supabase-provider", () => ({ useSupabase: () => ({ supabase: {} }) }))
vi.mock("@/components/providers/auth-context", () => ({ useOptionalAuth: () => null }))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/profile/profile-edit-dialog", () => ({ ProfileEditDialog: () => null }))
vi.mock("@/hooks/use-gamification", () => ({ useGamification: () => ({ level: 1, points: 120, isLoading: false }) }))
vi.mock("@/hooks/use-missions", () => ({
  useMissions: () => ({
    missions: [{ id: "1", title: "危険を1つ見つけよう", description: null, period: "daily", target_value: 1, reward_points: 5, reward_badge_id: null, target_type: "report" }],
    progress: {},
    isLoading: false,
  }),
}))
vi.mock("@/hooks/use-user-routes", () => ({ useUserRoutes: () => ({ routes: [], isLoading: false }) }))
vi.mock("@/hooks/use-push-subscription", () => ({
  usePushSubscription: () => ({
    state: mocks.pushState,
    preferences: { danger_reports: true, news: true, magazine: true, local_alerts: true, daily_digest: true },
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    updatePreferences: vi.fn(),
  }),
}))
vi.mock("@/lib/pwa-install", () => ({ getPushUnavailableReason: () => mocks.unavailableReason }))
vi.mock("@/lib/danger-report-image-access", () => ({
  useDangerReportSignedImageUrls: (_supabase: unknown, urls: string[]) => urls.map(() => null),
}))
vi.mock("@/components/settings/children-settings", () => ({ ChildrenSettings: () => <div>お子さまの設定</div> }))
vi.mock("@/components/settings/location-precision-settings", () => ({ LocationPrecisionSettings: () => <div>位置の設定</div> }))
vi.mock("@/components/settings/account-credentials-settings", () => ({ AccountCredentialsSettings: () => <div>メールとパスワードの設定</div> }))
vi.mock("@/components/settings/account-deletion-settings", () => ({ AccountDeletionSettings: () => <div>退会の設定</div> }))

import MyPage from "@/app/mypage/page"

const REPORTS = [
  { id: "r1", title: "見通しの悪い交差点", created_at: new Date().toISOString(), status: "pending", ai_moderation_status: "needs_review", ai_moderation_reason: null, image_url: null, processed_image_urls: [] },
  { id: "r2", title: "歩道のない道", created_at: "2026-01-05T00:00:00.000Z", status: "published", ai_moderation_status: "approved", ai_moderation_reason: null, image_url: null, processed_image_urls: [] },
]

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (String(input).startsWith("/api/profile")) {
        return new Response(JSON.stringify({ profile: { display_name: "さくら" } }), { status: 200 })
      }
      return new Response(JSON.stringify({ reports: REPORTS }), { status: 200 })
    }),
  )
}

async function renderPage() {
  render(<MyPage />)
  await screen.findByRole("heading", { level: 1, name: "こんにちは、さくらさん" })
}

describe("マイページ(UIUX改装 項目6・7・37)", () => {
  beforeEach(() => {
    mocks.pushState = "unsubscribed"
    mocks.unavailableReason = "browser"
    mockFetch()
  })

  it("「自分の記録」「あそぶ」「設定」の3つのグループをこの順に並べる", async () => {
    await renderPage()

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["自分の記録", "あそぶ", "設定"])
  })

  it("自分の記録に、もとのダッシュボードのポイント・レベル・確認中の件数を出す", async () => {
    await renderPage()
    const records = screen.getByRole("region", { name: "自分の記録" })

    await waitFor(() => expect(within(records).getByText("確認中の報告").parentElement).toHaveTextContent("1件"))
    expect(within(records).getByText("ポイント").parentElement).toHaveTextContent("120pt")
    expect(within(records).getByText("ポイント").parentElement).toHaveTextContent("レベル 1")
    expect(within(records).getByText("見通しの悪い交差点")).toBeInTheDocument()
  })

  it("報告の入口は「危険を報告する」で地図つきの報告フォームへ。ダッシュボードへのリンクは残さない", async () => {
    await renderPage()

    expect(screen.getByRole("link", { name: "危険を報告する" })).toHaveAttribute("href", "/map?report=open")
    expect(screen.queryByText("MAPで報告する")).toBeNull()
    expect(document.querySelector('a[href="/dashboard"]')).toBeNull()
  })

  it("あそぶ には、きけんハンター・ミッション・バッジ・ランキングを1つずつ置く(同じ行き先を重ねない)", async () => {
    await renderPage()
    const play = screen.getByRole("region", { name: "あそぶ" })

    expect(within(play).getByText("きけんハンター", { selector: "p" })).toBeInTheDocument()
    for (const href of ["/safety-quest/hunter", "/missions", "/badges", "/leaderboard"]) {
      expect(document.querySelectorAll(`a[href="${href}"]`)).toHaveLength(1)
    }
  })

  it("通知が未設定なら、いちばん上(自分の記録より前)に通知のカードを出し、設定には場所の案内だけを出す", async () => {
    await renderPage()

    const card = screen.getByRole("button", { name: /通知をオンにする/ })
    const records = screen.getByRole("heading", { level: 2, name: "自分の記録" })
    expect(card.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.getElementById("notifications")).toContainElement(card)

    const settings = screen.getByRole("region", { name: "設定" })
    expect(within(settings).getByRole("link", { name: "このページのいちばん上" })).toHaveAttribute("href", "#notifications")
  })

  it("通知を受け取っているなら、上には出さず、設定のグループで受け取る内容を切り替えられる", async () => {
    mocks.pushState = "subscribed"
    await renderPage()

    const settings = screen.getByRole("region", { name: "設定" })
    expect(within(settings).getByText("お知らせを受け取っています")).toBeInTheDocument()
    expect(document.getElementById("notifications")).toBe(within(settings).getByText("お知らせを受け取っています").closest("#notifications"))
    expect(within(settings).queryByRole("link", { name: "このページのいちばん上" })).toBeNull()
  })

  it("iPhone のブラウザで開いているときは、カードを消さずにホーム画面に追加する手順を出す", async () => {
    mocks.pushState = "unsupported"
    mocks.unavailableReason = "ios-needs-home-screen"
    await renderPage()

    const card = screen.getByTestId("mypage-notification-unavailable")
    expect(within(card).getByText("ホーム画面に追加すると通知を受け取れます")).toBeInTheDocument()
    expect(within(card).getByText(/「ホーム画面に追加」を選択/)).toBeInTheDocument()
  })

  it("通知に対応していないブラウザでも、カードを消さずに理由を出す", async () => {
    mocks.pushState = "unsupported"
    mocks.unavailableReason = "browser"
    await renderPage()

    expect(screen.getByTestId("mypage-notification-unavailable")).toHaveTextContent("このブラウザでは通知を受け取れません")
  })

  it("報告を読み込めなかったときは0件と出さず、「読み込めませんでした」ともう一度ためす道を出す", async () => {
    let reportCalls = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (String(input).startsWith("/api/profile")) {
          return new Response(JSON.stringify({ profile: { display_name: "さくら" } }), { status: 200 })
        }
        reportCalls += 1
        return reportCalls === 1
          ? new Response("{}", { status: 500 })
          : new Response(JSON.stringify({ reports: REPORTS }), { status: 200 })
      }),
    )
    render(<MyPage />)

    const records = await screen.findByRole("region", { name: "自分の記録" })
    await within(records).findByText("報告を読み込めませんでした")
    expect(within(records).getByText("確認中の報告").parentElement).toHaveTextContent("—")
    expect(within(records).queryByText(/まだ報告はありません/)).toBeNull()
    // 「1件報告する」が済んだか分からないので、はじめの一歩は出さない
    expect(screen.queryByText("はじめの一歩")).toBeNull()

    fireEvent.click(within(records).getByRole("button", { name: "もう一度ためす" }))

    expect(await within(records).findByText("見通しの悪い交差点")).toBeInTheDocument()
  })

  it("読み込んだ報告が上限(50件)に届いたら、件数は最近の50件から数えていると書く", async () => {
    const many = Array.from({ length: 50 }, (_, index) => ({ ...REPORTS[1], id: `r-${index}` }))
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        String(input).startsWith("/api/profile")
          ? new Response(JSON.stringify({ profile: { display_name: "さくら" } }), { status: 200 })
          : new Response(JSON.stringify({ reports: many }), { status: 200 }),
      ),
    )
    render(<MyPage />)

    expect(await screen.findByText("報告の件数は、最近の50件から数えています。")).toBeInTheDocument()
  })

  it("設定に、表示名とアイコン・お子さま・位置・メールとパスワード・退会・ログアウトを並べる", async () => {
    await renderPage()
    const settings = screen.getByRole("region", { name: "設定" })

    expect(within(settings).getByTestId("profile-edit-button")).toHaveTextContent("表示名とアイコンを変える")
    for (const text of ["お子さまの設定", "位置の設定", "メールとパスワードの設定", "退会の設定"]) {
      expect(within(settings).getByText(text)).toBeInTheDocument()
    }
    expect(within(settings).getByTestId("mypage-logout-button")).toBeInTheDocument()
  })
})
