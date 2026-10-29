import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  detectFaces: vi.fn(),
  images: [] as Array<{ onload: (() => void) | null }>,
}))

vi.mock("@/lib/media/face-detection", () => ({
  detectFaces: mocks.detectFaces,
  releaseMediaPipeFaceDetector: vi.fn(),
}))
vi.mock("@/lib/media/canvas-mask", () => ({ applyBlurRegion: vi.fn() }))

import { MaskConfirm } from "@/components/safety-quest/hunter/mask-confirm"

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 1200
  naturalHeight = 900
  width = 1200
  height = 900
  src = ""
  constructor() {
    mocks.images.push(this)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.images.length = 0
  vi.stubGlobal("Image", FakeImage)
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), strokeRect: vi.fn(), setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function renderLoaded() {
  render(<MaskConfirm file={new File(["x"], "photo.jpg", { type: "image/jpeg" })} onConfirm={vi.fn()} onCancel={vi.fn()} />)
  await act(async () => {
    mocks.images[mocks.images.length - 1]?.onload?.()
  })
}

describe("MaskConfirm の顔の自動検出(UIUX改装 項目57)", () => {
  it("この端末で顔を自動でさがせないときは、そう知らせ、ゆびで隠したと確かめるまで進めない", async () => {
    mocks.detectFaces.mockResolvedValue({ faces: [], available: false })
    await renderLoaded()

    expect(await screen.findByText(/かおを じどうで かくせなかったよ/)).toBeInTheDocument()
    // 「見つからなかった」とは言わない(さがせなかっただけ)
    expect(screen.queryByText(/かおは 見つからなかったよ/)).not.toBeInTheDocument()
    const cta = screen.getByRole("button", { name: /この しゃしんを つかう/ })
    expect(cta).toBeDisabled()

    fireEvent.click(screen.getByRole("checkbox", { name: /うつっている かおは ぜんぶ ゆびで かくしたよ/ }))
    expect(cta).toBeEnabled()
  })

  it("顔をさがせて、見つからなかったときは、確かめなしで進める", async () => {
    mocks.detectFaces.mockResolvedValue({ faces: [], available: true })
    await renderLoaded()

    expect(await screen.findByText(/かおは 見つからなかったよ/)).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /この しゃしんを つかう/ })).toBeEnabled()
  })
})
