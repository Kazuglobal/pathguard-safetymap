import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import UsageTutorialDialog from "@/components/map/usage-tutorial-dialog"

const mocks = vi.hoisted(() => ({
  markTutorialCompleted: vi.fn(),
}))

vi.mock("@/lib/tutorial-storage", () => ({
  markTutorialCompleted: mocks.markTutorialCompleted,
}))

describe("UsageTutorialDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows a parent-focused 3-step onboarding flow", () => {
    render(<UsageTutorialDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText("通学ルートを選ぶ")).toBeInTheDocument()
    expect(screen.getAllByRole("tab")).toHaveLength(3)

    fireEvent.click(screen.getByRole("button", { name: "次のステップへ" }))
    expect(screen.getByText("安全サマリーを見る")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "次のステップへ" }))
    expect(screen.getByText("危険箇所を確認する")).toBeInTheDocument()
  })

  it("marks the tutorial as completed when the user closes it", () => {
    const onOpenChange = vi.fn()

    render(<UsageTutorialDialog open={true} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole("button", { name: "チュートリアルをスキップ" }))

    expect(mocks.markTutorialCompleted).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
