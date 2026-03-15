import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ReportBottomSheet } from "@/components/report/report-bottom-sheet"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

describe("ReportBottomSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("routes the map action into the report flow", async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(<ReportBottomSheet open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /地図から報告/i }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(pushMock).toHaveBeenCalledWith("/map?report=open")
  })

  it("describes the photo action as a photo-attached report flow", () => {
    render(<ReportBottomSheet open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByRole("button", { name: /写真付きで報告/i })).toBeInTheDocument()
    expect(screen.getByText("地図で場所を選んだあと写真を追加")).toBeInTheDocument()
  })
})
