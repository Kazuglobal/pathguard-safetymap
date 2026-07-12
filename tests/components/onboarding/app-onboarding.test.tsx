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

    expect(screen.getAllByRole("button", { name: /ページ目/ })).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "ちずを みてみる" }))

    expect(mocks.markTutorialCompleted).toHaveBeenCalledOnce()
    expect(mocks.push).toHaveBeenCalledWith("/map")
  })
})
