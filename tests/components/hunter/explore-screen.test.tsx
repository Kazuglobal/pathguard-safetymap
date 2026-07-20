import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ExploreScreen } from "@/components/safety-quest/hunter/hunter-game"

// 最終 hit の学習カード(なんで危ない?+つぎにすること)を読む時間を保証するため、
// 全発見でも自動で結果画面へ遷移せず、明示 CTA のタップを待つ。
const base = {
  accident: null,
  maskedUrl: "x.jpg",
  hazards: [] as const,
  foundIds: [] as const,
  lastTap: null,
  lastOutcome: null,
  busy: false,
  onTap: vi.fn(),
  onFinish: vi.fn(),
}

describe("ExploreScreen — 明示的な終了CTA", () => {
  it("shows the remaining count on the CTA while hazards remain", () => {
    render(<ExploreScreen {...base} remaining={2} />)
    expect(screen.getByText("けっかを みる（のこり 2）")).toBeInTheDocument()
  })

  it("waits for an explicit tap when everything is found (no auto-transition)", () => {
    const onFinish = vi.fn()
    render(<ExploreScreen {...base} remaining={0} onFinish={onFinish} />)
    expect(screen.getByText("ぜんぶ みつけた！けっかを みる")).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
  })
})
