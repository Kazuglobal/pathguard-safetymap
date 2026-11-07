import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ExploreCanvas } from "@/components/safety-quest/hunter/explore-canvas"
import type { HunterHazard, HunterTapOutcome } from "@/lib/hunter/types"

function hazard(id: string): HunterHazard {
  return {
    id,
    type: "見通しの悪い角",
    region: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 },
    severity: "high",
    kidExplanation: "あぶないよ",
    safeAction: "とまろう",
    confidence: 0.9,
  }
}

const CONTAINER = { left: 0, top: 0, width: 400, height: 300 }

let rectSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    ...CONTAINER,
    right: CONTAINER.width,
    bottom: CONTAINER.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
})

afterEach(() => {
  rectSpy.mockRestore()
})

function loadImage(naturalW: number, naturalH: number) {
  const img = screen.getByAltText("つうがくろの しゃしん") as HTMLImageElement
  Object.defineProperty(img, "naturalWidth", { value: naturalW, configurable: true })
  Object.defineProperty(img, "naturalHeight", { value: naturalH, configurable: true })
  fireEvent.load(img)
}

describe("ExploreCanvas — letterbox tap correction", () => {
  it("ignores taps on the pillarbox margin of a portrait photo", () => {
    const onTap = vi.fn()
    render(
      <ExploreCanvas imageUrl="x.jpg" hazards={[hazard("A")]} foundIds={[]} onTap={onTap} lastTap={null} lastOutcome={null} />,
    )
    // portrait 300x400 into 400x300 box → drawW=225, offsetX=87.5 (left/right bars)
    loadImage(300, 400)
    const surface = screen.getByLabelText("しゃしんの上を タップして、きけんを さがそう")
    fireEvent.click(surface, { clientX: 10, clientY: 150 }) // inside left bar
    expect(onTap).not.toHaveBeenCalled()
  })

  it("maps an in-image tap to corrected image-relative coordinates", () => {
    const onTap = vi.fn()
    render(
      <ExploreCanvas imageUrl="x.jpg" hazards={[hazard("A")]} foundIds={[]} onTap={onTap} lastTap={null} lastOutcome={null} />,
    )
    loadImage(300, 400)
    const surface = screen.getByLabelText("しゃしんの上を タップして、きけんを さがそう")
    fireEvent.click(surface, { clientX: 200, clientY: 150 }) // center of drawn area
    expect(onTap).toHaveBeenCalledTimes(1)
    const arg = onTap.mock.calls[0][0]
    expect(arg.x).toBeCloseTo(0.5, 2)
    expect(arg.y).toBeCloseTo(0.5, 2)
  })
})

describe("ExploreCanvas — feedback and no auto-discovery", () => {
  it("announces a found tap and renders no marker for unfound hazards", () => {
    const outcome: HunterTapOutcome = { result: "hit", hazardId: "A", points: 150 }
    render(
      <ExploreCanvas
        imageUrl="x.jpg"
        hazards={[hazard("A"), hazard("B")]}
        foundIds={[]}
        onTap={vi.fn()}
        lastTap={{ x: 0.4, y: 0.4 }}
        lastOutcome={outcome}
      />,
    )
    // hit を渡しても、発見済みは foundIds 由来のみ(自動発見しない)
    expect(screen.queryByLabelText(/みつけた きをつけるところ/)).toBeNull()
    // 読み上げ要約に発見が反映される
    expect(screen.getByRole("status")).toHaveTextContent("みつけたね！")
  })

  it("does not give the answer away right after a hit (the reason question comes first)", () => {
    const outcome: HunterTapOutcome = { result: "hit", hazardId: "A", points: 150 }
    render(
      <ExploreCanvas
        imageUrl="x.jpg"
        hazards={[hazard("A")]}
        foundIds={["A"]}
        onTap={vi.fn()}
        lastTap={{ x: 0.4, y: 0.4 }}
        lastOutcome={outcome}
        activeHazardId="A"
      />,
    )
    // 説明は理由を答えたあと(ReasonSheet)。キャンバスには出さない
    expect(screen.queryByText("あぶないよ")).toBeNull()
    // 答え待ちの危険はスタンプではなく、ふちどりで見せる
    expect(screen.queryByLabelText(/みつけた きをつけるところ/)).toBeNull()
  })

  it("stamps a found hazard, and says when the reason was understood too", () => {
    render(
      <ExploreCanvas
        imageUrl="x.jpg"
        hazards={[hazard("A"), hazard("B")]}
        foundIds={["A", "B"]}
        understoodIds={["A"]}
        onTap={vi.fn()}
        lastTap={null}
        lastOutcome={null}
      />,
    )
    expect(screen.getByLabelText("みつけた きをつけるところ: 見通しの悪い角（りゆうも わかった）")).toBeInTheDocument()
    expect(screen.getAllByLabelText("みつけた きをつけるところ: 見通しの悪い角")).toHaveLength(1)
  })

  it("tells the child a found spot was already found instead of counting a miss", () => {
    const again: HunterTapOutcome = { result: "miss", hazardId: null, points: 0, nearestId: null, alreadyFound: true }
    render(
      <ExploreCanvas imageUrl="x.jpg" hazards={[hazard("A")]} foundIds={["A"]} onTap={vi.fn()} lastTap={{ x: 0.4, y: 0.4 }} lastOutcome={again} />,
    )
    expect(screen.getByRole("status")).toHaveTextContent("そこは もう みつけたよ！")
  })

  it("ignores taps once the round is locked (out of magnifiers)", () => {
    const onTap = vi.fn()
    render(
      <ExploreCanvas imageUrl="x.jpg" hazards={[hazard("A")]} foundIds={[]} onTap={onTap} lastTap={null} lastOutcome={null} locked />,
    )
    loadImage(400, 300)
    const surface = screen.getByLabelText("しゃしんの上を タップして、きけんを さがそう")
    expect(surface).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(surface, { clientX: 200, clientY: 150 })
    expect(onTap).not.toHaveBeenCalled()
  })

  it("escalates to a warm + direction announcement after repeated misses", () => {
    const near = (): HunterTapOutcome => ({
      result: "near",
      hazardId: "A",
      points: 0,
      nearestId: "A",
      temperature: "warm",
      direction: "right",
    })
    const props = {
      imageUrl: "x.jpg",
      hazards: [hazard("A")],
      foundIds: [],
      onTap: vi.fn(),
      lastTap: { x: 0.1, y: 0.4 },
    }
    const { rerender } = render(<ExploreCanvas {...props} lastOutcome={near()} />)
    // 2回連続で外すと Lv1 ヒント(温度+方向)が読み上げに出る(distinct object で effect 再発火)
    rerender(<ExploreCanvas {...props} lastOutcome={near()} />)
    expect(screen.getByRole("status")).toHaveTextContent("みぎ")
  })

  it("does not escalate hints from rapid-fire misses (spam cannot pull hints)", () => {
    const spam = (): HunterTapOutcome => ({
      result: "near",
      hazardId: "A",
      points: 0,
      nearestId: "A",
      temperature: "warm",
      direction: "right",
      deliberate: false,
    })
    const props = { imageUrl: "x.jpg", hazards: [hazard("A")], foundIds: [], onTap: vi.fn(), lastTap: { x: 0.1, y: 0.4 } }
    const { rerender } = render(<ExploreCanvas {...props} lastOutcome={spam()} />)
    for (let i = 0; i < 5; i += 1) rerender(<ExploreCanvas {...props} lastOutcome={spam()} />)
    expect(screen.getByRole("status")).not.toHaveTextContent("みぎ")
    expect(screen.getByRole("status")).toHaveTextContent("おしい")
  })
})
