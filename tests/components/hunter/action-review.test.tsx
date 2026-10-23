import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ActionReview } from "@/components/safety-quest/hunter/action-review"
import type { HunterHazard } from "@/lib/hunter/types"

const hazard: HunterHazard = {
  id: "h1", type: "車のかげ", severity: "high", confidence: 0.9,
  region: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
  kidExplanation: "むこうが 見えにくいよ。", safeAction: "とまって たしかめよう。",
}

afterEach(() => vi.unstubAllGlobals())

describe("ActionReview", () => {
  it("updates the review memo when a conversation is checked and unchecked", () => {
    render(<ActionReview hazards={[hazard]} />)
    const memo = screen.getByLabelText("ふりかえりメモ")
    expect((memo as HTMLTextAreaElement).value).toContain("話し合い: これから")
    fireEvent.click(screen.getByRole("checkbox"))
    expect((memo as HTMLTextAreaElement).value).toContain("話し合い: 確認した")
    fireEvent.click(screen.getByRole("checkbox"))
    expect((memo as HTMLTextAreaElement).value).toContain("話し合い: これから")
  })

  it("copies only after an explicit click, including the action and AI limitation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    render(<ActionReview hazards={[hazard]} />)
    expect(writeText).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("おうちの人・先生に わたす メモ"))
    fireEvent.click(screen.getByRole("button", { name: "メモを コピーする" }))
    expect(await screen.findByText(/メモを コピーしたよ/)).toBeInTheDocument()
    const memo = writeText.mock.calls[0][0]
    expect(memo).toContain(hazard.safeAction)
    expect(memo).toContain("現地の安全を保証するものではありません")
    expect(memo).not.toContain(hazard.id)
  })

  it("keeps selectable text available when clipboard access fails", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } })
    render(<ActionReview hazards={[hazard]} />)
    fireEvent.click(screen.getByText("おうちの人・先生に わたす メモ"))
    fireEvent.click(screen.getByRole("button", { name: "メモを コピーする" }))
    expect(await screen.findByText(/コピーできなかったよ/)).toBeInTheDocument()
    expect((screen.getByLabelText("ふりかえりメモ") as HTMLTextAreaElement).value).toContain(hazard.safeAction)
  })

  it("supports an empty analysis without presenting a safe verdict", () => {
    render(<ActionReview hazards={[]} />)
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect((screen.getByLabelText("ふりかえりメモ") as HTMLTextAreaElement).value).toContain("気づきの候補は得られませんでした")
  })
})
