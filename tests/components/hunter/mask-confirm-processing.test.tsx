import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  calculateMaskedOutputSize,
  MaskConfirm,
} from "@/components/safety-quest/hunter/mask-confirm"

class PendingImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  width = 0
  height = 0
  src = ""
}

describe("MaskConfirm processing state", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("Image", PendingImage)
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("shows progress and both recovery actions while the photo is being prepared", async () => {
    const onCancel = vi.fn()
    render(<MaskConfirm file={new File(["x"], "photo.jpg", { type: "image/jpeg" })} onConfirm={vi.fn()} onCancel={onCancel} />)

    expect(screen.getByText("しゃしんを じゅんび中 2/3")).toBeInTheDocument()
    expect(screen.getByText("かおや なまえを かくしています")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "しゃしんの じゅんびを やりなおす" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "べつの写真をえらぶ" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("times out with a concrete retry message", () => {
    render(<MaskConfirm file={new File(["x"], "photo.jpg", { type: "image/jpeg" })} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    act(() => vi.advanceTimersByTime(12_000))

    expect(screen.getByRole("alert")).toHaveTextContent("じかんが かかっています")
    expect(screen.getByRole("button", { name: "しゃしんの じゅんびを やりなおす" })).toBeEnabled()
  })
})

describe("MaskConfirm upload image size", () => {
  it("shrinks a large phone photo to a 1600px long edge before upload", () => {
    expect(calculateMaskedOutputSize(4032, 3024)).toEqual({ width: 1600, height: 1200 })
  })
})
