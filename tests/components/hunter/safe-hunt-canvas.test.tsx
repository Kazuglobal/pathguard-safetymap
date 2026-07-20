import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SafeHuntCanvas } from "@/components/safety-quest/hunter/safe-hunt-canvas"
import type { HunterSafePoint } from "@/lib/hunter/types"

function safePoint(id: string, region = { x: 0.3, y: 0.3, w: 0.2, h: 0.2 }): HunterSafePoint {
  return {
    id,
    type: "ガードレール",
    region,
    whyGood: "くるまから まもってくれるよ",
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

function loadImage() {
  const img = screen.getByAltText("つうがくろの しゃしん") as HTMLImageElement
  Object.defineProperty(img, "naturalWidth", { value: CONTAINER.width, configurable: true })
  Object.defineProperty(img, "naturalHeight", { value: CONTAINER.height, configurable: true })
  fireEvent.load(img)
}

const SURFACE_LABEL = "しゃしんの上を タップして、安全の くふうを さがそう"

describe("SafeHuntCanvas — tap-to-find", () => {
  it("does not reveal the exact safe-point marker before it is found", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />,
    )
    loadImage()
    expect(screen.queryByLabelText("みつけた あんぜん: ガードレール")).toBeNull()

    fireEvent.click(screen.getByLabelText(SURFACE_LABEL), { clientX: 160, clientY: 120 })
    expect(screen.getByLabelText("みつけた あんぜん: ガードレール")).toBeInTheDocument()
  })

  it("finds a safe point when tapped inside its (margin-expanded) region", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />,
    )
    loadImage()
    fireEvent.click(screen.getByLabelText(SURFACE_LABEL), { clientX: 160, clientY: 120 }) // center of the region
    expect(screen.getByText("1/1")).toBeInTheDocument()
  })

  it("does not find anything when tapped well outside any region/margin", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />,
    )
    loadImage()
    fireEvent.click(screen.getByLabelText(SURFACE_LABEL), { clientX: 390, clientY: 290 })
    expect(screen.getByText("0/1")).toBeInTheDocument()
  })

  it("does not accept a tap clearly outside a safe point", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />,
    )
    loadImage()
    // region right edge is x=0.5 (200px); x=0.58 (232px) was accepted by the old 0.12 margin.
    fireEvent.click(screen.getByLabelText(SURFACE_LABEL), { clientX: 232, clientY: 120 })
    expect(screen.getByText("0/1")).toBeInTheDocument()
  })

  it("does not double-count a repeated tap on an already-found point", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0"), safePoint("g1", { x: 0.6, y: 0.1, w: 0.2, h: 0.2 })]} onDone={vi.fn()} />,
    )
    loadImage()
    const surface = screen.getByLabelText(SURFACE_LABEL)
    fireEvent.click(surface, { clientX: 160, clientY: 120 })
    fireEvent.click(surface, { clientX: 160, clientY: 120 })
    expect(screen.getByText("1/2")).toBeInTheDocument()
  })

  it("shows the tapped point's type/whyGood in the info panel and announces it via aria-live", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />,
    )
    loadImage()
    fireEvent.click(screen.getByLabelText(SURFACE_LABEL), { clientX: 160, clientY: 120 })
    expect(screen.getByText("くるまから まもってくれるよ")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("くるまから まもってくれるよ")
  })

  it("supports keyboard activation (Enter) as an alternative to a pointer tap", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0", { x: 0.4, y: 0.4, w: 0.2, h: 0.2 })]} onDone={vi.fn()} />,
    )
    loadImage()
    // 中央(200,150)がちょうど region 内(0.4-0.6, 0.4-0.6 の範囲は 160-240, 120-180)
    fireEvent.keyDown(screen.getByLabelText(SURFACE_LABEL), { key: "Enter" })
    expect(screen.getByText("1/1")).toBeInTheDocument()
  })

  it("switches the CTA label once every safe point is found", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />,
    )
    loadImage()
    expect(screen.getByText("おわる")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(SURFACE_LABEL), { clientX: 160, clientY: 120 })
    expect(screen.getByText("ぜんぶ みつけた！おわる")).toBeInTheDocument()
  })
})

// 範囲外タップが完全な無反応(無フィードバック)にならないこと。
// 正しい実物をタップしても AI 枠の外なら沈黙する、が最悪の子ども体験なので、
// ミスにはやさしい応答を返し、続くようならヒントを出す。
describe("SafeHuntCanvas — miss feedback", () => {
  it("acknowledges a missed tap via the speech bubble and aria-live (never silent)", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />,
    )
    loadImage()
    fireEvent.click(screen.getByLabelText(SURFACE_LABEL), { clientX: 390, clientY: 290 })
    expect(screen.getByText("0/1")).toBeInTheDocument()
    expect(screen.getByText("うーん、そこには なさそう。ちがう ところも さがしてみよう！")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("そこには なさそう")
  })

  it("shows soft hint markers on undiscovered points after 3 consecutive misses", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />,
    )
    loadImage()
    const surface = screen.getByLabelText(SURFACE_LABEL)
    fireEvent.click(surface, { clientX: 390, clientY: 290 })
    fireEvent.click(surface, { clientX: 390, clientY: 290 })
    expect(screen.queryAllByLabelText(/ヒント/)).toHaveLength(0)
    fireEvent.click(surface, { clientX: 390, clientY: 290 })
    expect(screen.getAllByLabelText(/ヒント/)).toHaveLength(1)
    expect(screen.getByText("ふわっと ひかる ところを さがしてみよう！")).toBeInTheDocument()
  })

  it("clears the miss streak and hints once a safe point is found", () => {
    render(
      <SafeHuntCanvas
        imageUrl="x.jpg"
        safePoints={[safePoint("g0"), safePoint("g1", { x: 0.6, y: 0.1, w: 0.2, h: 0.2 })]}
        onDone={vi.fn()}
      />,
    )
    loadImage()
    const surface = screen.getByLabelText(SURFACE_LABEL)
    fireEvent.click(surface, { clientX: 390, clientY: 290 })
    fireEvent.click(surface, { clientX: 390, clientY: 290 })
    fireEvent.click(surface, { clientX: 390, clientY: 290 })
    expect(screen.getAllByLabelText(/ヒント/)).toHaveLength(2)

    fireEvent.click(surface, { clientX: 160, clientY: 120 }) // g0 center → hit
    expect(screen.queryAllByLabelText(/ヒント/)).toHaveLength(0)
    expect(screen.getByRole("status")).toHaveTextContent("くるまから まもってくれるよ")
  })
})
