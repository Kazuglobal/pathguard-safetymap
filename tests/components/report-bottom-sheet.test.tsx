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

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  SheetDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
}))

describe("ReportBottomSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ReportBottomSheet は「きけんハンター」ショートカットシートへ全面刷新され、
  // 旧「地図から報告 / 写真付きで報告」導線は廃止された。テストは現行のハンター/
  // 不審者アラート導線に合わせて検証する。
  it("routes the hunter action into the hunter flow", async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(<ReportBottomSheet open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /きけんハンターを はじめる/ }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(pushMock).toHaveBeenCalledWith("/safety-quest/hunter")
  })

  it("routes the suspicious-alert action into the map alert flow", async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(<ReportBottomSheet open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /不審者アラートを地図化/ }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(pushMock).toHaveBeenCalledWith("/map?suspiciousAlert=1")
  })
})
