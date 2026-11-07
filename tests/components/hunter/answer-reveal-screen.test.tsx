import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: (_t, tag) => ({ children, initial, animate, exit, transition, ...p }: any) => {
    const Tag = String(tag) as any
    return <Tag {...p}>{children}</Tag>
  } }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
}))

import { AnswerRevealScreen } from "@/components/safety-quest/hunter/answer-reveal/answer-reveal-screen"
import type { HunterAccidentSummary, HunterHazard } from "@/lib/hunter/types"

function hazard(id: string, type: string, extra: Partial<HunterHazard> = {}): HunterHazard {
  return {
    id,
    type,
    region: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 },
    severity: "high",
    kidExplanation: "みぎの かどが みえにくいよ。",
    safeAction: "とまって みよう。",
    confidence: 0.8,
    kind: "blind_corner",
    ...extra,
  }
}

const hazards = [
  hazard("a", "見通しの悪い角"),
  hazard("b", "曲がってくる車", { kind: "turning_car", severity: "medium", kidExplanation: "くるまが まがって くるよ。" }),
  hazard("c", "水がたまる道", { kind: "flood_dip", severity: "low", kidExplanation: "みずが たまるよ。" }),
]

const accident: HunterAccidentSummary = {
  hasData: true,
  riskScore: 50,
  riskLevel: "medium",
  riskLabel: "",
  riskEmoji: "",
  totalAccidents: 12,
  childInvolved: 2,
  topAccidentType: "出会い頭",
  peakTimeSlot: null,
  kidMessage: "",
}

function renderScreen(onDone = vi.fn()) {
  render(
    <AnswerRevealScreen
      imageUrl="x.jpg"
      hazards={hazards}
      discoveries={[
        { hazardId: "a", understood: true },
        { hazardId: "b", understood: false },
      ]}
      parentNotes={[{ hazardId: "a", evidence: "角の へいが 右から来る車を かくしている" }]}
      accident={accident}
      doneLabel="けっかを みる"
      onDone={onDone}
    />,
  )
  return onDone
}

describe("AnswerRevealScreen", () => {
  it("puts a numbered, labelled marker on the photo for every hazard (found or missed)", () => {
    renderScreen()
    expect(screen.getByRole("button", { name: "1ばん 見通しの悪い角（わかった）" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "2ばん 曲がってくる車（みつけた）" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "3ばん 水がたまる道（つぎは みつけよう）" })).toBeInTheDocument()
    // ルビ(<rt>)で文字が分かれるので、段落の textContent で確かめる
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && /ところが 3こ あったよ/.test(el.textContent ?? "")),
    ).toBeInTheDocument()
  })

  it("walks through hazards one by one with the photo marker selected", () => {
    renderScreen()
    fireEvent.click(screen.getByRole("button", { name: "1ばんから 見る" }))
    expect(screen.getByRole("button", { name: "1ばん 見通しの悪い角（わかった）" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("みぎの かどが みえにくいよ。")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "まえの きけん" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "つぎの きけん" }))
    expect(screen.getByRole("button", { name: "2ばん 曲がってくる車（みつけた）" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("くるまが まがって くるよ。")).toBeInTheDocument()

    // 写真のマーカーをタップしても、そのカードへ移る
    fireEvent.click(screen.getByRole("button", { name: "3ばん 水がたまる道（つぎは みつけよう）" }))
    expect(screen.getByText("みずが たまるよ。")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "つぎの きけん" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: /ぜんたいを 見る/ }))
    expect(screen.getByRole("button", { name: "1ばんから 見る" })).toBeInTheDocument()
  })

  it("shows parent details only when the switch is on, with honest wording about nearby accidents", () => {
    renderScreen()
    fireEvent.click(screen.getByRole("button", { name: "1ばんから 見る" }))
    const toggle = screen.getByRole("switch", { name: /おうちの人むけ/ })
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(screen.queryByText("角の へいが 右から来る車を かくしている")).toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-checked", "true")
    expect(screen.getByText("角の へいが 右から来る車を かくしている")).toBeInTheDocument()
    expect(screen.getByText(/半径300m以内/)).toHaveTextContent("この写真の道で起きたとは限りません")
    expect(screen.getByText(/AIの見立ては目安です/)).toBeInTheDocument()
  })

  it("goes on to the result with the bottom button", () => {
    const onDone = renderScreen()
    fireEvent.click(screen.getByRole("button", { name: "けっかを みる" }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
