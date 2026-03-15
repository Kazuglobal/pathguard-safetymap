import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import MapStyleSelector from "@/components/map/map-style-selector"

describe("MapStyleSelector", () => {
  it("renders an explicit display trigger label", () => {
    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        compactLabel={false}
        buttonLabel="表示"
      />,
    )

    expect(screen.getByRole("button", { name: "表示" })).toBeInTheDocument()
  })

  it("opens grouped display content on mobile", async () => {
    const user = userEvent.setup()

    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={() => {}}
        isMobile
        buttonLabel="表示"
        overlayOptions={[
          {
            id: "route",
            label: "通学路",
            description: "通学路を表示",
            selected: true,
            onSelect: vi.fn(),
          },
          {
            id: "danger",
            label: "危険・注意",
            description: "危険情報を表示",
            selected: false,
            onSelect: vi.fn(),
          },
        ]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "表示" }))

    expect(screen.getByText("表示する情報")).toBeInTheDocument()
    expect(screen.getByText("地図の見た目")).toBeInTheDocument()
    expect(screen.getByText("地図に重ねる情報")).toBeInTheDocument()
    expect(screen.getByText("通学路")).toBeInTheDocument()
    expect(screen.getByText("危険・注意")).toBeInTheDocument()
    expect(screen.getByText("表示中")).toBeInTheDocument()
  })

  it("still supports the simple style-only dropdown contract", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <MapStyleSelector
        currentStyle="streets-v12"
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole("button"))
    await user.click(screen.getByText("航空写真"))

    expect(onChange).toHaveBeenCalledWith("satellite-v9")
  })
})
