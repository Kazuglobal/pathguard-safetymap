import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { compressImage } from "@/lib/image-utils"

let loadOutcome: "load" | "error" = "load"

class FakeImage {
  onload: (() => void) | null = null
  onerror: ((error: unknown) => void) | null = null
  width = 400
  height = 300
  set src(_value: string) {
    queueMicrotask(() => (loadOutcome === "load" ? this.onload?.() : this.onerror?.(new Error("decode"))))
  }
}

beforeEach(() => {
  loadOutcome = "load"
  vi.stubGlobal("Image", FakeImage)
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:photo") })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/webp;base64,AAAA")
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback: BlobCallback, type?: string) {
    callback(new Blob(["re-encoded"], { type: type ?? "image/png" }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("compressImage(UIUX改装 項目38・57)", () => {
  it("小さい写真でも必ず描き直す(撮影場所などの EXIF を残さない)", async () => {
    const small = new File(["tiny-with-exif"], "small.jpg", { type: "image/jpeg" })

    const result = await compressImage(small)

    expect(result).not.toBe(small)
    expect(result.type).toBe("image/webp")
    expect(result.size).toBe("re-encoded".length)
  })

  it("描き直せない写真は、元の写真を返さずに失敗を知らせる", async () => {
    loadOutcome = "error"
    const broken = new File(["???"], "broken.jpg", { type: "image/jpeg" })

    await expect(compressImage(broken)).rejects.toThrow("写真を読み込めませんでした")
  })
})
