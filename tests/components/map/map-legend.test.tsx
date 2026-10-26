import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { MapLegendButton, MapLegendCompact, MapLegendDetails } from "@/components/map/map-legend"
import { getDangerLevelPresentation } from "@/lib/report-generation/danger-level-presentation"

const TYPE_LABELS = ["交通", "犯罪", "災害", "不審者", "その他"]

describe("MapLegendCompact", () => {
  it("5つの種類をすべて文字つきで並べる", () => {
    render(<MapLegendCompact />)

    const list = screen.getByRole("list", { name: "ピンの絵と種類" })
    for (const label of TYPE_LABELS) {
      expect(within(list).getByText(label)).toBeInTheDocument()
    }
  })

  it("色が「あぶなさ」を表すことを4段階の色で示す", () => {
    render(<MapLegendCompact />)

    expect(screen.getByText("あぶなさ")).toBeInTheDocument()
    for (const level of [1, 2, 3, 4]) {
      const presentation = getDangerLevelPresentation(level)
      expect(screen.getByTitle(`${presentation.stars} ${presentation.kidLabel}`)).toBeInTheDocument()
    }
  })
})

describe("MapLegendDetails", () => {
  it("種類・あぶなさ・かたちの3つを説明する", () => {
    render(<MapLegendDetails />)

    for (const label of TYPE_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    for (const level of [1, 2, 3, 4]) {
      expect(screen.getByText(getDangerLevelPresentation(level).kidLabel)).toBeInTheDocument()
    }
    expect(screen.getByText(/しずく形/)).toBeInTheDocument()
    expect(screen.getByText(/まとめて表示/)).toBeInTheDocument()
    expect(screen.getByText(/洪水・津波ハザード/)).toBeInTheDocument()
  })
})

describe("MapLegendButton", () => {
  it("押すまでは凡例を出さず、押すと開く", async () => {
    const user = userEvent.setup()
    render(<MapLegendButton />)

    expect(screen.queryByTestId("map-legend-details")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "ピンの見方を表示" }))

    expect(await screen.findByTestId("map-legend-details")).toBeInTheDocument()
  })
})
