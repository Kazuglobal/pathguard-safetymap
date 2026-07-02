import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HunterQuizPanel } from "@/components/safety-quest/hunter/quiz-panel"
import type { HunterQuizItem } from "@/lib/hunter/types"

const choiceItem: HunterQuizItem = {
  id: "q-choice-0",
  kind: "choice",
  theme: null,
  question: "どうする？",
  choices: [
    { id: "c0", label: "とまる" },
    { id: "c1", label: "はしる" },
  ],
  correctChoiceId: "c0",
  explanation: "とまろう",
  accidentLink: null,
}

describe("HunterQuizPanel — choice flow", () => {
  it("shows せいかい and the explanation when the correct choice is picked", async () => {
    const user = userEvent.setup()
    render(<HunterQuizPanel items={[choiceItem]} imageUrl="x.jpg" onComplete={vi.fn()} />)
    await user.click(screen.getByText("とまる"))
    expect(screen.getByRole("status")).toHaveTextContent("せいかい")
    expect(screen.getByRole("status")).toHaveTextContent("とまろう")
  })

  it("shows おしい (not せいかい) when a wrong choice is picked and completes with the answer", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<HunterQuizPanel items={[choiceItem]} imageUrl="x.jpg" onComplete={onComplete} />)
    await user.click(screen.getByText("はしる"))
    expect(screen.getByRole("status")).toHaveTextContent("おしい")
    expect(screen.getByRole("status")).not.toHaveTextContent("せいかい")

    await user.click(screen.getByText("けっかを みる"))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete.mock.calls[0][0]).toEqual([{ itemId: "q-choice-0", choiceId: "c1" }])
  })
})

const CONTAINER = { left: 0, top: 0, width: 400, height: 300 }

const placeItem1: HunterQuizItem = {
  id: "q-place-0",
  kind: "place",
  theme: null,
  question: "どこかな？",
  answerHazardId: "h0",
  answerRegion: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 },
  explanation: "ここだよ",
  accidentLink: null,
}

const placeItem2: HunterQuizItem = {
  ...placeItem1,
  id: "q-place-1",
  question: "つぎは どこかな？",
}

describe("HunterQuizPanel — place flow across multiple questions (regression)", () => {
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

  function loadQuizImage() {
    const img = screen.getByAltText("クイズの しゃしん") as HTMLImageElement
    Object.defineProperty(img, "naturalWidth", { value: CONTAINER.width, configurable: true })
    Object.defineProperty(img, "naturalHeight", { value: CONTAINER.height, configurable: true })
    fireEvent.load(img)
  }

  it("still accepts taps on a later place question sharing the same photo (natural must not get stuck null)", () => {
    render(
      <HunterQuizPanel items={[placeItem1, placeItem2]} imageUrl="shared.jpg" onComplete={vi.fn()} />,
    )

    loadQuizImage()
    fireEvent.click(screen.getByLabelText("しゃしんの上を タップして こたえよう"), {
      clientX: 200,
      clientY: 150,
    })
    // Q1 タップが通ったことは「つぎの もんだいへ」ボタンの出現(revealed済み)で確認する。
    fireEvent.click(screen.getByText("つぎの もんだいへ"))

    // Q2 reuses the same <img src>, so onLoad will NOT fire again naturally. If `natural`
    // were reset to null on every question transition (the pre-fix bug), this tap would be
    // silently swallowed by handleImageTap's `if (revealed || !contain) return` guard, and
    // "けっかを みる" (only rendered once revealed) would never appear.
    fireEvent.click(screen.getByLabelText("しゃしんの上を タップして こたえよう"), {
      clientX: 200,
      clientY: 150,
    })
    expect(screen.getByText("けっかを みる")).toBeInTheDocument()
  })
})
