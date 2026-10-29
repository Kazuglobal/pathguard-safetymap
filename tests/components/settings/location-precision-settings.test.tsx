import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LocationPrecisionSettings } from "@/components/settings/location-precision-settings"

let saved: unknown[] = []

beforeEach(() => {
  saved = []
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      saved.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify({ profile: {} }), { status: 200 })
    }
    return new Response(JSON.stringify({ profile: { location_precision: "standard" } }), { status: 200 })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("LocationPrecisionSettings(位置の保存のしかた)", () => {
  it("いまの設定を選んだ状態で出し、どちらでも自宅と学校の場所は保存しないと伝える", async () => {
    render(<LocationPrecisionSettings />)

    await waitFor(() => expect(screen.getByRole("radio", { name: /ふつう/ })).toBeChecked())
    expect(screen.getByText("どちらでも、自宅と学校の場所は保存しません。")).toBeInTheDocument()
  })

  it("粗く保存は、保存済みの道すじも消えることを画面の中で確かめてから保存する", async () => {
    const confirmSpy = vi.spyOn(window, "confirm")
    const user = userEvent.setup()
    render(<LocationPrecisionSettings />)
    await waitFor(() => expect(screen.getByRole("radio", { name: /ふつう/ })).toBeChecked())

    await user.click(screen.getByRole("radio", { name: /粗く保存/ }))
    expect(saved).toEqual([])
    expect(screen.getByText(/保存済みの通学路からも道すじを消します/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "粗く保存にする" }))

    await waitFor(() => expect(saved).toEqual([{ location_precision: "coarse" }]))
    expect(await screen.findByRole("status")).toHaveTextContent("粗く保存にしました")
    expect(screen.getByRole("radio", { name: /粗く保存/ })).toBeChecked()
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it("「やめる」なら保存しない", async () => {
    const user = userEvent.setup()
    render(<LocationPrecisionSettings />)
    await waitFor(() => expect(screen.getByRole("radio", { name: /ふつう/ })).toBeChecked())

    await user.click(screen.getByRole("radio", { name: /粗く保存/ }))
    await user.click(screen.getByRole("button", { name: "やめる" }))

    expect(saved).toEqual([])
    expect(screen.getByRole("radio", { name: /ふつう/ })).toBeChecked()
  })
})
