import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SafeHuntCanvas, SAFE_SURFACE_LABEL } from "@/components/safety-quest/hunter/safe-hunt-canvas"
import { sanitizeSafePoints } from "@/lib/hunter/sanitize"
import { KID_SAFE_REASON_BY_KIND } from "@/lib/hunter/safe-kinds"
import type { HunterSafePoint } from "@/lib/hunter/types"

function safePoint(id: string, region = { x: 0.3, y: 0.3, w: 0.2, h: 0.2 }, extra: Partial<HunterSafePoint> = {}): HunterSafePoint {
  return {
    id,
    type: "ガードレール",
    region,
    whyGood: "くるまから まもってくれるよ",
    safeKind: "guardrail",
    ...extra,
  }
}

const CONTAINER = { left: 0, top: 0, width: 400, height: 300 }
const GUARDRAIL_REASON = KID_SAFE_REASON_BY_KIND.guardrail as string

let rectSpy: ReturnType<typeof vi.spyOn>
let clock = 0

beforeEach(() => {
  rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    ...CONTAINER,
    right: CONTAINER.width,
    bottom: CONTAINER.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
  // タップの間隔を 2 秒ずつあける(連打よけ・よく見たはずれ の判定を実際のプレイに近づける)
  clock = 1_000_000
  vi.spyOn(Date, "now").mockImplementation(() => (clock += 2000))
})

afterEach(() => {
  rectSpy.mockRestore()
  vi.restoreAllMocks()
})

function loadImage() {
  const img = screen.getAllByAltText("つうがくろの しゃしん")[0] as HTMLImageElement
  Object.defineProperty(img, "naturalWidth", { value: CONTAINER.width, configurable: true })
  Object.defineProperty(img, "naturalHeight", { value: CONTAINER.height, configurable: true })
  fireEvent.load(img)
}

function tapAt(x: number, y: number) {
  fireEvent.click(screen.getByLabelText(SAFE_SURFACE_LABEL), { clientX: x * CONTAINER.width, clientY: y * CONTAINER.height })
}

function answer(label: string) {
  const dialog = screen.getByRole("dialog", { name: /どうして あんしんかな/ })
  fireEvent.click(within(dialog).getByRole("button", { name: label }))
}

describe("SafeHuntCanvas — 当たり判定(適当に押しても正解にしない)", () => {
  it("finds a safe point only after the reason is chosen, and never shows the marker before", () => {
    render(<SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />)
    loadImage()
    expect(screen.queryByLabelText(/みつけた あんぜん/)).toBeNull()

    tapAt(0.4, 0.4)
    // 説明は理由を答えたあと(先に出すと答えが分かる)
    expect(screen.queryByText("くるまから まもってくれるよ")).toBeNull()
    answer(GUARDRAIL_REASON)
    expect(screen.getByLabelText("みつけた あんぜん: ガードレール（りゆうも わかった）")).toBeInTheDocument()
    expect(screen.getByText("くるまから まもってくれるよ")).toBeInTheDocument()
  })

  it("counts any part of a long guardrail, but not the photo off the object", () => {
    // 写真の幅いっぱいのガードレール。安全の工夫は「物」なので、細長い物は長い辺を残した帯が当たり
    // (focus のまわりだけにすると、正しく端を押した子が はずれになる)。
    const points = sanitizeSafePoints(
      [{ kidType: "ガードレール", safeKind: "guardrail", region: { x: 0, y: 0.7, w: 1, h: 0.2 }, focus: { x: 0.2, y: 0.8 }, whyGood: "まもって くれるよ。" }],
      { sessionId: "t" },
    )
    render(<SafeHuntCanvas imageUrl="x.jpg" safePoints={points} onDone={vi.fn()} />)
    loadImage()
    // ガードレールの無い場所(空・建物)は はずれ
    tapAt(0.5, 0.3)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("img", { name: "むしめがね のこり 3こ" })).toBeInTheDocument()
    // focus から遠い端でも、ガードレールの上なら当たり
    tapAt(0.95, 0.8)
    expect(screen.getByRole("dialog", { name: /どうして あんしんかな/ })).toBeInTheDocument()
  })

  it("uses up a magnifier on a miss, says so kindly, and locks the photo when they run out", () => {
    render(<SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />)
    loadImage()
    tapAt(0.95, 0.95)
    expect(screen.getByRole("status")).toHaveTextContent("つぎは どこかな")
    for (let i = 0; i < 3; i += 1) tapAt(0.95, 0.95)
    expect(screen.getByRole("img", { name: "むしめがね のこり 0こ" })).toBeInTheDocument()
    expect(screen.getByText("むしめがねを ぜんぶ つかったよ！")).toBeInTheDocument()
    expect(screen.getByLabelText(SAFE_SURFACE_LABEL)).toHaveAttribute("aria-disabled", "true")
    // 使い切ったあとは、正しい場所を押しても数えない(連打で全部見つからない)
    tapAt(0.4, 0.4)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("button", { name: "こたえあわせを する" })).toBeEnabled()
  })

  it("does not double-count or spend a magnifier on an already-found point", () => {
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0"), safePoint("g1", { x: 0.6, y: 0.1, w: 0.2, h: 0.2 })]} onDone={vi.fn()} />,
    )
    loadImage()
    tapAt(0.4, 0.4)
    answer(GUARDRAIL_REASON)
    tapAt(0.4, 0.4)
    expect(screen.getByRole("status")).toHaveTextContent("そこは もう みつけたよ！")
    expect(screen.getByRole("img", { name: "むしめがね のこり 5こ" })).toBeInTheDocument()
  })
})

describe("SafeHuntCanvas — 「どうして あんしん？」", () => {
  it("shows the right reason gently when the child picks a wrong one", () => {
    render(
      <SafeHuntCanvas
        imageUrl="x.jpg"
        safePoints={[safePoint("g0"), safePoint("m0", { x: 0.7, y: 0.1, w: 0.15, h: 0.2 }, { type: "カーブミラー", safeKind: "curve_mirror" })]}
        onDone={vi.fn()}
      />,
    )
    loadImage()
    tapAt(0.4, 0.4)
    const dialog = screen.getByRole("dialog", { name: /どうして あんしんかな/ })
    const wrong = within(dialog)
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-label") !== GUARDRAIL_REASON)!
    fireEvent.click(wrong)
    expect(screen.getAllByText(/おしい！ ほんとうは/).length).toBeGreaterThan(0)
    expect(screen.getByLabelText("みつけた あんぜん: ガードレール")).toBeInTheDocument()
  })

  it("does not ask when the kind is unknown (other) and just shows why it is safe", () => {
    render(<SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0", undefined, { safeKind: "other", type: "あんぜんの くふう" })]} onDone={vi.fn()} />)
    loadImage()
    tapAt(0.4, 0.4)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByText("くるまから まもってくれるよ")).toBeInTheDocument()
  })
})

describe("SafeHuntCanvas — キーボード", () => {
  it("moves an aiming cursor with the arrow keys and checks the spot with Enter", () => {
    render(<SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0", { x: 0.55, y: 0.4, w: 0.15, h: 0.2 })]} onDone={vi.fn()} />)
    loadImage()
    const surface = screen.getByLabelText(SAFE_SURFACE_LABEL)
    fireEvent.keyDown(surface, { key: "ArrowRight" })
    fireEvent.keyDown(surface, { key: "ArrowRight" })
    fireEvent.keyDown(surface, { key: "Enter" })
    expect(screen.getByRole("dialog", { name: /どうして あんしんかな/ })).toBeInTheDocument()
    // 理由の3択が出たら最初の選択肢へフォーカスが移る
    expect(document.activeElement?.getAttribute("aria-label")).toBeTruthy()
  })
})

describe("SafeHuntCanvas — こたえあわせ", () => {
  it("goes to the answer reveal and shows where the missed point was", () => {
    const onDone = vi.fn()
    render(
      <SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0"), safePoint("g1", { x: 0.6, y: 0.1, w: 0.2, h: 0.2 })]} onDone={onDone} />,
    )
    loadImage()
    tapAt(0.4, 0.4)
    answer(GUARDRAIL_REASON)
    fireEvent.click(screen.getByRole("button", { name: "こたえあわせを する（のこり 1）" }))
    expect(screen.getByRole("group", { name: "こたえあわせの しゃしん" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "1ばん ガードレール（わかった）" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "2ばん ガードレール（つぎは みつけよう）" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "おわる" }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("blocks moving on while a reason is being chosen", () => {
    render(<SafeHuntCanvas imageUrl="x.jpg" safePoints={[safePoint("g0")]} onDone={vi.fn()} />)
    loadImage()
    tapAt(0.4, 0.4)
    expect(screen.getByText("りゆうを えらんでね").closest("button")).toBeDisabled()
  })
})
