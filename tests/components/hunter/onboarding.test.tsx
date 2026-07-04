import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ONBOARDING_KEY,
  Onboarding,
  hasSeenOnboarding,
  markOnboardingSeen,
} from "@/components/safety-quest/hunter/onboarding"

describe("hunter onboarding", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("uses page buttons without incomplete tab semantics", () => {
    render(<Onboarding onDone={vi.fn()} onSkip={vi.fn()} />)

    const firstPage = screen.getByRole("button", { name: "1ページ目" })
    expect(firstPage).toHaveAttribute("aria-current", "step")
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  })

  it("moves through all pages and completes", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<Onboarding onDone={onDone} onSkip={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "2ページ目" }))
    expect(screen.getByRole("button", { name: "2ページ目" })).toHaveAttribute("aria-current", "step")
    await user.click(screen.getByRole("button", { name: "4ページ目" }))
    await user.click(screen.getByRole("button", { name: "ぼうけんに でかける！" }))

    expect(onDone).toHaveBeenCalledOnce()
  })

  it("persists and reads completion", () => {
    expect(hasSeenOnboarding()).toBe(false)
    markOnboardingSeen()
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBe("1")
    expect(hasSeenOnboarding()).toBe(true)
  })
})
