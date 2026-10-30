import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

import { LpFeatures } from "@/components/lp/lp-features"
import { LpHero } from "@/components/lp/lp-hero"
import { LpVideo } from "@/components/lp/lp-video"
import { LpFeatureTour } from "@/components/lp/lp-feature-tour"
import { LpProblem } from "@/components/lp/lp-problem"
import { LpPhotoAi } from "@/components/lp/lp-photo-ai"
import { LpFaq } from "@/components/lp/lp-faq"
import { LpHow } from "@/components/lp/lp-how"
import { LpTrust } from "@/components/lp/lp-trust"
import { LpCtaFooter } from "@/components/lp/lp-cta-footer"
import { LpHeader } from "@/components/lp/lp-header"
import { AuthContextProvider } from "@/components/providers/auth-context"
import {
  LP_FAQ,
  LP_FEATURES,
  LP_FEATURE_TOUR,
  LP_HERO,
  LP_HOW,
  LP_CTA,
  LP_META,
  LP_OPEN_APP,
  LP_TRUST,
  LP_VIDEO,
} from "@/lib/lp-content"
import { PRODUCT_FACTS } from "@/lib/product-facts"

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => {
    const { fill: _fill, priority: _priority, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />
  },
}))

describe("lp-content 整合性", () => {
  it("CTAの遷移先が既存ルートを指す", () => {
    expect(LP_HERO.ctaPrimary.href).toBe("/register")
    expect(LP_CTA.primary.href).toBe("/register")
    expect(LP_CTA.secondary.href).toBe("/login")
  })

  it("機能は9件(動画ツアーの「9つの機能」と同じ数)で、きけんハンターと安全クイズを含む(項目2)", () => {
    expect(LP_FEATURES).toHaveLength(9)
    expect(LP_FEATURE_TOUR.caption).toContain("9つの機能")
    expect(LP_FEATURES.map((feature) => feature.title)).toEqual(
      expect.arrayContaining(["きけんハンター(写真で危険さがし)", "安全クイズ"]),
    )
    for (const feature of LP_FEATURES) {
      expect(feature.title.length).toBeGreaterThan(0)
      expect(feature.description.length).toBeGreaterThan(0)
    }
  })

  it("登録・料金・審査の書き方が、実際の登録画面と審査に合っている(項目2)", () => {
    const allText = JSON.stringify({ LP_FAQ, LP_HOW, LP_TRUST, LP_HERO, LP_CTA })
    // 以前の、実態と合わない約束
    expect(allText).not.toContain("メールアドレスだけで登録完了")
    expect(allText).not.toContain("基本機能")
    expect(allText).not.toContain("二重審査")
    expect(allText).not.toMatch(/[A-Za-z0-9぀-ヿ一-鿿]\?/)
    expect(allText).toContain(PRODUCT_FACTS.pricing)
    expect(allText).toContain(PRODUCT_FACTS.moderation.adult)
  })

  it("メタ情報とアセットパスが/publicの規約に従う", () => {
    expect(LP_META.ogImage).toMatch(/^\/images\/lp\//)
    expect(LP_VIDEO.src).toMatch(/^\/videos\/lp\//)
    expect(LP_VIDEO.poster).toMatch(/^\/images\/lp\//)
  })
})

describe("LPセクションのレンダリング", () => {
  it("LpFeatures が9機能すべてを表示する", () => {
    render(<LpFeatures />)
    for (const feature of LP_FEATURES) {
      expect(screen.getByText(feature.title)).toBeInTheDocument()
    }
  })

  it("LpFaq が全設問を表示し、最初の2問(料金・インストール)は開いておく(項目13)", () => {
    render(<LpFaq />)
    for (const item of LP_FAQ) {
      expect(screen.getByText(item.q)).toBeInTheDocument()
    }
    const triggers = screen.getAllByRole("button")
    expect(triggers[0]).toHaveTextContent("利用料金はかかりますか？")
    expect(triggers[0]).toHaveAttribute("aria-expanded", "true")
    expect(triggers[1]).toHaveAttribute("aria-expanded", "true")
    expect(triggers[2]).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText(LP_FAQ[0].a)).toBeVisible()
  })

  it("LpHow は準備2つ(登録・通学路)と、続ける習慣(毎朝3分)を出し、ルペがいる(項目13・15)", () => {
    render(<LpHow />)
    expect(screen.getByText("無料で登録")).toBeInTheDocument()
    expect(screen.getByText("通学路を登録")).toBeInTheDocument()
    expect(screen.getByText("3分の安全チェック")).toBeInTheDocument()
    expect(screen.getAllByText(/^準備 [12]$/)).toHaveLength(2)
    expect(screen.getByText("毎朝")).toBeInTheDocument()
    expect(screen.getByTestId("lupe")).toBeInTheDocument()
  })

  it("LpTrust が安心への配慮3項目を表示する", () => {
    render(<LpTrust />)
    expect(screen.getByText("AIと運営スタッフの確認")).toBeInTheDocument()
    expect(screen.getByText("写真はスマホの中でぼかす")).toBeInTheDocument()
    expect(screen.getByText("すべての機能が無料")).toBeInTheDocument()
  })

  it("LpHeader はログイン済みなら「アプリを開く」、まだなら「ログイン」「無料ではじめる」、確かめている間はどちらも出さない(項目54)", () => {
    const view = (status: "loading" | "authenticated" | "unauthenticated") =>
      render(
        <AuthContextProvider value={{ status, user: null, displayName: null, isLoggingOut: false, logout: vi.fn(), refreshProfile: vi.fn() }}>
          <LpHeader />
        </AuthContextProvider>,
      )

    const signedIn = view("authenticated")
    expect(screen.getByRole("link", { name: "アプリを開く" })).toHaveAttribute("href", "/landing")
    expect(screen.queryByRole("link", { name: "ログイン" })).not.toBeInTheDocument()
    signedIn.unmount()

    const loading = view("loading")
    expect(screen.queryByRole("link", { name: "ログイン" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "アプリを開く" })).not.toBeInTheDocument()
    expect(screen.getByTestId("lp-header-actions-loading")).toBeInTheDocument()
    loading.unmount()

    view("unauthenticated")
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login")
    expect(screen.getByRole("link", { name: "無料ではじめる" })).toHaveAttribute("href", "/register")
    expect(screen.getByTestId("brand-logo")).toHaveTextContent("PathGuardian")
  })

  it("LpHero が見出し・CTA・注記を表示し/registerへ誘導する", () => {
    render(<LpHero />)
    for (const line of LP_HERO.headline) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
    expect(screen.getByRole("link", { name: LP_HERO.ctaPrimary.label })).toHaveAttribute("href", "/register")
    expect(screen.getByText(LP_HERO.note)).toBeInTheDocument()
  })

  it("LpVideo が動画・ポスター・日本語字幕トラックを配線し、IntersectionObserverを解放する", () => {
    const disconnect = vi.fn()
    const observe = vi.fn()
    class MockIntersectionObserver {
      observe = observe
      disconnect = disconnect
      unobserve = vi.fn()
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)
    try {
      const { container, unmount } = render(<LpVideo />)
      const video = container.querySelector("video")
      expect(video).not.toBeNull()
      expect(video).toHaveAttribute("src", LP_VIDEO.src)
      expect(video).toHaveAttribute("poster", LP_VIDEO.poster)
      const track = container.querySelector('track[kind="captions"]')
      expect(track).toHaveAttribute("src", "/videos/lp/pathguardian-intro.ja.vtt")
      expect(observe).toHaveBeenCalledTimes(1)
      unmount()
      expect(disconnect).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("LpProblem が課題カード3枚を表示する", () => {
    render(<LpProblem />)
    expect(screen.getByText("見えない")).toBeInTheDocument()
    expect(screen.getByText("聞けない")).toBeInTheDocument()
    expect(screen.getByText("間に合わない")).toBeInTheDocument()
  })

  it("LpFeatureTour が機能ツアー動画を配線する", () => {
    class MockIntersectionObserver {
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)
    try {
      const { container } = render(<LpFeatureTour />)
      const video = container.querySelector("video")
      expect(video).toHaveAttribute("src", "/videos/lp/pathguardian-features-v2.mp4")
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("LpPhotoAi(目玉機能)が見出し・実画面モック・3ポイントを表示する", () => {
    render(<LpPhotoAi />)
    expect(screen.getByText("写真をとるだけ。")).toBeInTheDocument()
    expect(screen.getByText("AIがキケンを見える化。")).toBeInTheDocument()
    const img = screen.getByAltText(/AIが危険箇所と安全設備を色分け描画/)
    expect(img).toHaveAttribute("src", "/images/lp/mocks/phone-hunter-result.png")
  })

  it("LpCtaFooter に登録導線と規約リンク・公式 Instagram・運営者の表記がある(項目4・13・41)", () => {
    render(<LpCtaFooter />)
    const registerLink = screen.getByRole("link", { name: LP_CTA.primary.label })
    expect(registerLink).toHaveAttribute("href", "/register")
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms")
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy")
    expect(screen.getByRole("link", { name: "お問い合わせ" })).toHaveAttribute("href", "/contact")
    // 「アプリを開く」はヘッダーと同じ文言・同じ行き先
    expect(screen.getByRole("link", { name: LP_OPEN_APP.label })).toHaveAttribute("href", LP_OPEN_APP.href)
    const instagram = screen.getByRole("link", { name: /公式Instagram @kiken_hunter_jp/ })
    expect(instagram).toHaveAttribute("href", "https://www.instagram.com/kiken_hunter_jp/")
    expect(instagram).toHaveAttribute("rel", "noopener noreferrer")
    expect(screen.getByText("運営者の表記は準備中です")).toBeInTheDocument()
  })
})
