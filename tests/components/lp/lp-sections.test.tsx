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
import { LP_FAQ, LP_FEATURES, LP_HERO, LP_CTA, LP_META, LP_VIDEO } from "@/lib/lp-content"

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

  it("機能は6件で、タイトル・説明が空でない", () => {
    expect(LP_FEATURES).toHaveLength(6)
    for (const feature of LP_FEATURES) {
      expect(feature.title.length).toBeGreaterThan(0)
      expect(feature.description.length).toBeGreaterThan(0)
    }
  })

  it("メタ情報とアセットパスが/publicの規約に従う", () => {
    expect(LP_META.ogImage).toMatch(/^\/images\/lp\//)
    expect(LP_VIDEO.src).toMatch(/^\/videos\/lp\//)
    expect(LP_VIDEO.poster).toMatch(/^\/images\/lp\//)
  })
})

describe("LPセクションのレンダリング", () => {
  it("LpFeatures が6機能すべてを表示する", () => {
    render(<LpFeatures />)
    for (const feature of LP_FEATURES) {
      expect(screen.getByText(feature.title)).toBeInTheDocument()
    }
  })

  it("LpFaq が全設問を表示する", () => {
    render(<LpFaq />)
    for (const item of LP_FAQ) {
      expect(screen.getByText(item.q)).toBeInTheDocument()
    }
  })

  it("LpHow が3ステップを表示する", () => {
    render(<LpHow />)
    expect(screen.getByText("無料登録")).toBeInTheDocument()
    expect(screen.getByText("通学路をチェック")).toBeInTheDocument()
    expect(screen.getByText("毎朝の安全習慣")).toBeInTheDocument()
  })

  it("LpTrust が安心への配慮3項目を表示する", () => {
    render(<LpTrust />)
    expect(screen.getByText("AI と人の二重審査")).toBeInTheDocument()
    expect(screen.getByText("個人情報への配慮")).toBeInTheDocument()
    expect(screen.getByText("無料で使える")).toBeInTheDocument()
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

  it("LpCtaFooter に登録導線と規約リンクがある", () => {
    render(<LpCtaFooter />)
    const registerLink = screen.getByRole("link", { name: LP_CTA.primary.label })
    expect(registerLink).toHaveAttribute("href", "/register")
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms")
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy")
  })
})
