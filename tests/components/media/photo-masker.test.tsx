import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  detectFaces: vi.fn(),
  applyBlurRegion: vi.fn(),
  images: [] as Array<{ onload: (() => void) | null; onerror: (() => void) | null }>,
}))

vi.mock("@/lib/media/face-detection", () => ({
  detectFaces: mocks.detectFaces,
  releaseMediaPipeFaceDetector: vi.fn(),
}))
vi.mock("@/lib/media/canvas-mask", () => ({ applyBlurRegion: mocks.applyBlurRegion }))

import { PhotoMasker } from "@/components/media/photo-masker"
import { useMaskedPhotoPicker } from "@/components/media/use-masked-photo-picker"

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 4032
  naturalHeight = 3024
  width = 4032
  height = 3024
  src = ""
  constructor() {
    mocks.images.push(this)
  }
}

const photo = () => new File(["raw"], "IMG_0001.jpg", { type: "image/jpeg" })

let webpSupported = true

beforeEach(() => {
  vi.clearAllMocks()
  mocks.images.length = 0
  webpSupported = true
  vi.stubGlobal("Image", FakeImage)
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:raw") })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
  mocks.detectFaces.mockResolvedValue({ faces: [{ x: 0.4, y: 0.2, width: 0.1, height: 0.1, score: 0.9 }], available: true })
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), strokeRect: vi.fn(), setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation((type?: string) => (
    type === "image/webp" && webpSupported ? "data:image/webp;base64,AAAA" : "data:image/png;base64,AAAA"
  ))
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback: BlobCallback, type?: string) {
    callback(new Blob(["masked"], { type: type ?? "image/png" }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function loadImage() {
  await act(async () => {
    mocks.images[mocks.images.length - 1]?.onload?.()
  })
}

describe("PhotoMasker(写真を端末でぼかす)", () => {
  it("準備中は進めず、ぼかした写真だけを保存し AI(Gemini・Claude・OpenAI)の確認に送ると伝える", () => {
    render(<PhotoMasker file={photo()} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText(/写真の中の顔をさがしています/)).toBeInTheDocument()
    expect(screen.getByTestId("photo-masker-ai-notice")).toHaveTextContent("Google Gemini・Anthropic Claude・OpenAI")
    expect(screen.getByTestId("photo-masker-ai-notice")).toHaveTextContent("元の写真は端末の外に出しません")
    expect(screen.getByRole("button", { name: "この写真で進む" })).toBeDisabled()
  })

  it("顔を自動でぼかし、確定するとぼかした WebP だけを返す(元の写真は返さない)", async () => {
    const onConfirm = vi.fn()
    render(<PhotoMasker file={photo()} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await loadImage()

    expect(await screen.findByText(/顔は自動でぼかしました\(1か所\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "この写真で進む" }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    const result = onConfirm.mock.calls[0]![0] as { file: File; faces: number; manual: number }
    expect(result.faces).toBe(1)
    expect(result.manual).toBe(0)
    expect(result.file.type).toBe("image/webp")
    expect(result.file.name).toBe("masked.webp")
    // 中身は canvas で描き直したもの("masked" の6バイト)。選んだ元の写真("raw" の3バイト)ではない
    expect(result.file.size).toBe(6)
    expect(mocks.applyBlurRegion).toHaveBeenCalled()
  })

  it("この端末で顔の自動ぼかしが使えないときは、そう知らせ、指で隠したと確かめるまで進めない", async () => {
    mocks.detectFaces.mockResolvedValue({ faces: [], available: false })
    const onConfirm = vi.fn()
    render(<PhotoMasker file={photo()} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await loadImage()

    expect(await screen.findByTestId("photo-masker-detection-unavailable")).toHaveTextContent("顔の自動ぼかしが使えませんでした")
    // 「0か所ぼかしました」とは言わない(顔が無かったのではない)
    expect(screen.queryByText(/顔は自動でぼかしました/)).not.toBeInTheDocument()
    const proceed = screen.getByRole("button", { name: "この写真で進む" })
    expect(proceed).toBeDisabled()

    fireEvent.click(screen.getByRole("checkbox", { name: /写っている顔は、すべて指で隠しました/ }))
    expect(proceed).toBeEnabled()
    fireEvent.click(proceed)
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
  })

  it("WebP を書き出せないブラウザでは JPEG にする", async () => {
    webpSupported = false
    const onConfirm = vi.fn()
    render(<PhotoMasker file={photo()} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await loadImage()
    fireEvent.click(await screen.findByRole("button", { name: "この写真で進む" }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect((onConfirm.mock.calls[0]![0] as { file: File }).file).toMatchObject({ type: "image/jpeg", name: "masked.jpg" })
  })

  it("開けない写真(HEIC など)は理由を出し、選び直してもらう", async () => {
    const onCancel = vi.fn()
    render(<PhotoMasker file={photo()} onConfirm={vi.fn()} onCancel={onCancel} />)
    await act(async () => {
      mocks.images[mocks.images.length - 1]?.onerror?.()
    })

    expect(screen.getByRole("alert")).toHaveTextContent("この写真は開けませんでした")
    fireEvent.click(screen.getByRole("button", { name: "写真を選び直す" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe("useMaskedPhotoPicker", () => {
  function Harness({ onResult }: { onResult: (value: unknown) => void }) {
    const { requestMaskedPhoto, photoMaskerDialog } = useMaskedPhotoPicker()
    return (
      <>
        <button type="button" onClick={() => { void requestMaskedPhoto(photo()).then(onResult) }}>pick</button>
        {photoMaskerDialog}
      </>
    )
  }

  it("やめたら null、ぼかしたら写真を返し、画面を閉じる", async () => {
    const onResult = vi.fn()
    render(<Harness onResult={onResult} />)

    fireEvent.click(screen.getByRole("button", { name: "pick" }))
    expect(await screen.findByTestId("photo-masker")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "写真を選び直す" }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(null))
    expect(screen.queryByTestId("photo-masker")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "pick" }))
    await loadImage()
    fireEvent.click(await screen.findByRole("button", { name: "この写真で進む" }))
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ faces: 1 })))
  })
})
