import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DangerClusterBadge, DangerPin } from "@/components/map/danger-pin"
import { PIN_PATH } from "@/lib/map/pin-shape"
import { getDangerLevelPresentation } from "@/lib/report-generation/danger-level-presentation"

describe("DangerPin", () => {
  it("外形は危険度の色で塗り、内側に輪を持たないしずく形を使う", () => {
    const { container } = render(<DangerPin dangerType="traffic" dangerLevel={4} />)

    const body = container.querySelector(".danger-pin-body")
    expect(body).toHaveAttribute("d", PIN_PATH)
    expect(body).toHaveAttribute("fill", getDangerLevelPresentation(4).colorHex)
    // 絵の背景は塗りつぶしの白丸1つだけ(輪=ストロークだけの円は置かない)
    const circles = container.querySelectorAll(".danger-pin-shape circle")
    expect(circles).toHaveLength(1)
    expect(circles[0]).toHaveAttribute("fill", "#fff")
    expect(circles[0]).not.toHaveAttribute("stroke")
  })

  it("種類ごとに絵が変わる", () => {
    const iconMarkup = (dangerType: string) => {
      const { container, unmount } = render(<DangerPin dangerType={dangerType} dangerLevel={2} />)
      const markup = container.querySelector(".danger-pin-icon")?.innerHTML
      unmount()
      return markup
    }

    const markups = ["traffic", "crime", "disaster", "suspicious", "other"].map(iconMarkup)
    expect(markups.every(Boolean)).toBe(true)
    expect(new Set(markups).size).toBe(5)
  })

  it("未知の種類は「その他」の絵で描く", () => {
    const iconMarkup = (dangerType: string) => {
      const { container, unmount } = render(<DangerPin dangerType={dangerType} dangerLevel={2} />)
      const markup = container.querySelector(".danger-pin-icon")?.innerHTML
      unmount()
      return markup
    }

    expect(iconMarkup("something-new")).toBe(iconMarkup("other"))
  })

  it("showLabel が false のときは文字ラベルを出さない", () => {
    render(<DangerPin dangerType="traffic" dangerLevel={3} />)

    expect(screen.queryByTestId("danger-pin-label")).not.toBeInTheDocument()
  })

  it("showLabel が true のときは種類名と段階(★)を出す", () => {
    render(<DangerPin dangerType="suspicious" dangerLevel={3} showLabel />)

    const label = screen.getByTestId("danger-pin-label")
    expect(label).toHaveTextContent("不審者")
    expect(label).toHaveTextContent(getDangerLevelPresentation(3).stars)
    expect(label).not.toHaveTextContent("確認中")
  })

  it("確認中の報告はラベルに「確認中」を付ける", () => {
    render(<DangerPin dangerType="crime" dangerLevel={1} isPending showLabel />)

    expect(screen.getByTestId("danger-pin-label")).toHaveTextContent("確認中")
  })
})

describe("DangerClusterBadge", () => {
  it("件数を「N件」で表示する", () => {
    const { container } = render(<DangerClusterBadge count={12} />)

    expect(container.querySelector(".danger-cluster-count")).toHaveTextContent("12件")
  })
})
