import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AppOnboarding from "@/components/onboarding/app-onboarding"

const mocks = vi.hoisted(() => ({
  markTutorialCompleted: vi.fn(),
  push: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/landing",
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: any) => <img {...props} />,
}))

vi.mock("@/lib/tutorial-storage", () => ({
  markTutorialCompleted: mocks.markTutorialCompleted,
}))

describe("AppOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("moves focus into the modal, traps it, and restores the opener", async () => {
    const user = userEvent.setup()
    const opener = document.createElement("button")
    document.body.appendChild(opener)
    opener.focus()

    const { rerender } = render(<AppOnboarding open onClose={vi.fn()} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveFocus()

    await user.tab({ shift: true })
    expect(screen.getByTestId("onboarding-next")).toHaveFocus()

    rerender(<AppOnboarding open={false} onClose={vi.fn()} />)
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it("provides a 44px target for every page selector", () => {
    render(<AppOnboarding open onClose={vi.fn()} />)

    for (const button of screen.getAllByRole("button", { name: /ページ目/ })) {
      expect(button).toHaveClass("h-11", "w-11")
    }
  })

  it("marks the guide complete when skipped", () => {
    const onClose = vi.fn()
    render(<AppOnboarding open onClose={onClose} />)

    fireEvent.click(screen.getByTestId("onboarding-skip"))

    expect(mocks.markTutorialCompleted).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("shows a one-page summary that opens the map", () => {
    render(<AppOnboarding open onClose={vi.fn()} summaryOnly />)

    // 1ページだけなので、ページの点と最後のページの代わりの導線(空の枠)は出さず、その高さを絵に回す
    expect(screen.queryAllByRole("button", { name: /ページ目/ })).toHaveLength(0)
    expect(screen.queryByTestId("onboarding-open-map")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "ちずを みてみる" }))

    expect(mocks.markTutorialCompleted).toHaveBeenCalledOnce()
    expect(mocks.push).toHaveBeenCalledWith("/map")
  })

  it("keeps the picture whole: the picture area shrinks instead of the text", () => {
    render(<AppOnboarding open onClose={vi.fn()} summaryOnly />)

    const area = screen.getByTestId("onboarding-picture-area")
    // 高さが足りないときに縮むのは絵の場所。中の白い枠は高さに合わせて幅ごと小さくなる(切り取らない)
    expect(area).toHaveClass("shrink")
    expect(area.style.height).toContain("100cqw")
    // 中の白い枠の幅(min(100%, 420px, 高さから計算した幅))は jsdom が読めないので、実際のブラウザの撮影で確かめる
    expect(screen.getByTestId("onboarding-slide-text").parentElement).toHaveClass("shrink-0")
  })

  it("reserves the tallest page's text height so the picture keeps one size across pages", () => {
    render(<AppOnboarding open onClose={vi.fn()} />)

    // 見えているページの見出しだけが読める。ほかのページの文章は見えない状態で高さだけ取る
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("かぞくでつかう")
    const textArea = screen.getByTestId("onboarding-slide-text").parentElement as HTMLElement
    const ghosts = Array.from(textArea.children).filter((el) => el.getAttribute("aria-hidden") === "true")
    expect(ghosts).toHaveLength(3)
    for (const ghost of ghosts) expect((ghost as HTMLElement).style.visibility).toBe("hidden")

    fireEvent.click(screen.getByTestId("onboarding-next"))
    // めくる途中は前のページも一瞬残るので、新しいページの見出しがあることだけを確かめる
    expect(screen.getAllByRole("heading", { level: 2 }).some((h) => h.textContent?.includes("ちずを ひらくと"))).toBe(true)
  })
})
