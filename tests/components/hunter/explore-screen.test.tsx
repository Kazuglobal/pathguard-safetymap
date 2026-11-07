import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ExploreScreen } from "@/components/safety-quest/hunter/hunter-game"
import { buildReasonChoices } from "@/lib/hunter/reason-choices"
import type { HunterHazard } from "@/lib/hunter/types"

// 最終 hit の学習カード(なんで危ない?+つぎにすること)を読む時間を保証するため、
// 全発見でも自動で次の画面へ遷移せず、明示 CTA のタップを待つ。
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

const corner: HunterHazard = {
  id: "s-0",
  type: "見通しの悪い角",
  region: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 },
  severity: "high",
  // ルビ(<rt>)が付くと getByText で引けないので、ここは ひらがなだけで書く
  kidExplanation: "みぎの かどの へいで くるまが みえにくいよ。",
  safeAction: "かどの てまえで とまろう。",
  confidence: 0.9,
  kind: "blind_corner",
}

describe("ExploreScreen — 明示的な終了CTA", () => {
  it("shows the remaining count on the CTA while hazards remain", () => {
    render(<ExploreScreen {...base} remaining={2} />)
    expect(screen.getByText("こたえあわせを する（のこり 2）")).toBeInTheDocument()
  })

  it("waits for an explicit tap when everything is found (no auto-transition)", () => {
    const onFinish = vi.fn()
    render(<ExploreScreen {...base} remaining={0} onFinish={onFinish} />)
    expect(screen.getByText("ぜんぶ みつけた！こたえあわせへ")).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
  })
})

describe("ExploreScreen — 場所 + 理由の2段階", () => {
  it("asks 「どうして あぶない？」 after a hit and blocks finishing until it is answered", () => {
    const onReason = vi.fn()
    const choices = buildReasonChoices(corner, [corner])!
    render(
      <ExploreScreen
        {...base}
        hazards={[corner]}
        foundIds={["s-0"]}
        remaining={0}
        pending={{ hazard: corner, choices }}
        onReason={onReason}
      />,
    )
    const dialog = screen.getByRole("dialog", { name: /どうして あぶないかな/ })
    // 答える前に説明は出さない(答えが分かってしまう)
    expect(screen.queryByText(corner.kidExplanation)).toBeNull()
    expect(screen.getByText("りゆうを えらんでね").closest("button")).toBeDisabled()
    fireEvent.click(within(dialog).getByRole("button", { name: "角の むこうが 見えない から" }))
    expect(onReason).toHaveBeenCalledWith("blind_corner")
  })

  it("shows the lesson after answering, and the right reason gently when it was wrong", () => {
    render(
      <ExploreScreen
        {...base}
        hazards={[corner]}
        foundIds={["s-0"]}
        remaining={0}
        lastFound={corner}
        lastReason={{ hazardId: "s-0", reason: "flood_dip", correct: false }}
      />,
    )
    // 見える文と、常設の読み上げ領域の両方で正しい理由を伝える(責めない)
    expect(screen.getAllByText(/おしい！ ほんとうは/)).toHaveLength(2)
    expect(screen.getByText("おしい！ ほんとうは「角の むこうが 見えない から」だよ。")).toHaveAttribute("aria-live", "polite")
    expect(screen.getByText(corner.kidExplanation)).toBeInTheDocument()
    expect(screen.getByText(/つぎに すること/)).toBeInTheDocument()
    // 学びの見出しへフォーカスが移る(答えたあと先頭からたどり直さない)
    expect(document.activeElement?.tagName).toBe("H3")
  })

  it("moves focus to the first reason choice when the question appears", () => {
    const choices = buildReasonChoices(corner, [corner])!
    render(<ExploreScreen {...base} hazards={[corner]} foundIds={["s-0"]} remaining={0} pending={{ hazard: corner, choices }} />)
    expect(document.activeElement).toBe(screen.getByRole("button", { name: choices[0].label }))
  })

  it("locks the photo while the score is being sent (late taps would not be counted)", () => {
    render(<ExploreScreen {...base} hazards={[corner]} remaining={1} busy />)
    expect(screen.getByLabelText("しゃしんの上を タップして、きけんを さがそう")).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByText("まとめているよ…").closest("button")).toBeDisabled()
  })

  it("shows the magnifier meter and the out-of-magnifiers overlay", () => {
    render(
      <ExploreScreen
        {...base}
        hazards={[corner]}
        remaining={1}
        magnifiers={{ left: 0, budget: 4 }}
        outOfMagnifiers
      />,
    )
    expect(screen.getByRole("img", { name: "むしめがね のこり 0こ" })).toBeInTheDocument()
    expect(screen.getByText("むしめがねを ぜんぶ つかったよ！")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "こたえあわせを する" })).toBeEnabled()
  })
})
