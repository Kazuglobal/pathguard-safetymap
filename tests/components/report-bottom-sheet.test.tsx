import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ReportBottomSheet } from "@/components/report/report-bottom-sheet"

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), prefetch: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  // 本物の useRouter と同じく、描画のたびに同じインスタンスを返す
  useRouter: () => router,
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
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith("/safety-quest/hunter")
    // シートを閉じてから遷移する
    expect(onOpenChange.mock.invocationCallOrder[0]).toBeLessThan(router.push.mock.invocationCallOrder[0])
  })

  it("routes the suspicious-alert action into the map alert flow", async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(<ReportBottomSheet open={true} onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /不審者アラートを地図化/ }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith("/map?suspiciousAlert=1")
    expect(onOpenChange.mock.invocationCallOrder[0]).toBeLessThan(router.push.mock.invocationCallOrder[0])
  })

  // きけんハンターはログイン確認つきの動的ページ(本番は専用 Worker)。押してから取りに行くと
  // 起動待ちの数秒間なにも起きないように見えたため、シートを開いた時点で両方を先読みする。
  it("prefetches both destinations as soon as the sheet opens", () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(<ReportBottomSheet open={false} onOpenChange={onOpenChange} />)

    expect(router.prefetch).not.toHaveBeenCalled()

    rerender(<ReportBottomSheet open={true} onOpenChange={onOpenChange} />)

    expect(router.prefetch).toHaveBeenCalledTimes(2)
    expect(router.prefetch).toHaveBeenCalledWith("/safety-quest/hunter")
    expect(router.prefetch).toHaveBeenCalledWith("/map?suspiciousAlert=1")
    expect(router.push).not.toHaveBeenCalled()
  })

  it("does not prefetch again on re-render while the sheet stays open", () => {
    const { rerender } = render(<ReportBottomSheet open={true} onOpenChange={vi.fn()} />)
    expect(router.prefetch).toHaveBeenCalledTimes(2)

    rerender(<ReportBottomSheet open={true} onOpenChange={vi.fn()} />)

    expect(router.prefetch).toHaveBeenCalledTimes(2)
  })
})
