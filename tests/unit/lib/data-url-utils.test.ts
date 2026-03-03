import { describe, expect, it, vi } from "vitest"
import { urlOrDataUrlToBlob } from "@/lib/data-url-utils"

describe("urlOrDataUrlToBlob", () => {
  it("decodes data URLs without using fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const blob = await urlOrDataUrlToBlob("data:image/png;base64,aGVsbG8=")

    expect(blob.type).toBe("image/png")
    expect(blob.size).toBe(5)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it("uses fetch for normal URLs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("abc", {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    )

    const out = await urlOrDataUrlToBlob("https://example.com/a.png")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(out.type).toBe("image/png")
    expect(out.size).toBe(3)
    fetchSpy.mockRestore()
  })
})
