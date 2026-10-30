import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Lupe } from "@/components/brand/lupe"
import { Mascot as QuestMascot } from "@/components/safety-quest/quest-characters"
import { Mascot as HunterMascot } from "@/components/safety-quest/hunter/theme"

/** ルペの登場箇所をそろえる(UIUX改装 項目15) */
describe("相棒のルペ", () => {
  it("きけんハンターのマスコットは、紹介HP・ログインの画面と同じルペ", () => {
    expect(HunterMascot).toBe(Lupe)
    render(<HunterMascot mood="cheer" />)
    expect(screen.getByRole("img", { name: "おうえんする ルペ" })).toBeInTheDocument()
  })

  it("セーフティクエストの相棒も、以前の青い盾のキャラではなくルペ", () => {
    const { container } = render(<QuestMascot pose="point" />)
    expect(screen.getByTestId("lupe")).toBeInTheDocument()
    expect(container.innerHTML).not.toContain("#174b87")
  })

  it("近くの文字で説明しているときは、読み上げから外せる", () => {
    render(<Lupe decorative />)
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByTestId("lupe")).toHaveAttribute("aria-hidden", "true")
  })
})
