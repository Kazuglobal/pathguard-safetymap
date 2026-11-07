import { describe, expect, it, vi } from "vitest"

import { encodeMaskedCanvas, MASKED_IMAGE_QUALITY } from "@/lib/hunter/masked-image"

describe("encodeMaskedCanvas", () => {
  it("writes WebP where the browser can", () => {
    const toDataURL = vi.fn((type: string) => `data:${type};base64,AAAA`)
    expect(encodeMaskedCanvas({ toDataURL })).toBe("data:image/webp;base64,AAAA")
    expect(toDataURL).toHaveBeenCalledTimes(1)
    expect(toDataURL).toHaveBeenCalledWith("image/webp", MASKED_IMAGE_QUALITY)
  })

  it("falls back to JPEG on Safari, which silently returns PNG for WebP (a PNG cannot be saved and is several MB)", () => {
    const toDataURL = vi.fn((type: string) => (type === "image/webp" ? "data:image/png;base64,PPPP" : `data:${type};base64,JJJJ`))
    expect(encodeMaskedCanvas({ toDataURL })).toBe("data:image/jpeg;base64,JJJJ")
    expect(toDataURL).toHaveBeenLastCalledWith("image/jpeg", MASKED_IMAGE_QUALITY)
  })
})
