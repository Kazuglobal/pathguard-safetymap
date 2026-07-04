import { describe, expect, it, vi } from "vitest"
import {
  createDangerReportSignedUrl,
  extractDangerReportStoragePath,
} from "@/lib/danger-report-image-access"

describe("extractDangerReportStoragePath", () => {
  it("extracts the storage path from a getPublicUrl-style URL", () => {
    const url =
      "https://xyz.supabase.co/storage/v1/object/public/danger-reports/user1/report1/photo.jpg"
    expect(extractDangerReportStoragePath(url)).toBe("user1/report1/photo.jpg")
  })

  it("returns the value unchanged when it is already a bare path", () => {
    expect(extractDangerReportStoragePath("user1/report1/photo.jpg")).toBe(
      "user1/report1/photo.jpg",
    )
  })

  it("returns null for an unrelated URL", () => {
    expect(extractDangerReportStoragePath("https://example.com/foo.jpg")).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(extractDangerReportStoragePath("")).toBeNull()
  })
})

describe("createDangerReportSignedUrl", () => {
  it("resolves the signed URL when storage succeeds", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example.com/x" },
      error: null,
    })
    const client = { storage: { from: () => ({ createSignedUrl }) } } as any

    const result = await createDangerReportSignedUrl(
      client,
      "https://xyz.supabase.co/storage/v1/object/public/danger-reports/u/r/photo.jpg",
    )

    expect(result).toBe("https://signed.example.com/x")
    expect(createSignedUrl).toHaveBeenCalledWith("u/r/photo.jpg", 3600)
  })

  it("returns null when the path cannot be extracted", async () => {
    const client = { storage: { from: () => ({ createSignedUrl: vi.fn() }) } } as any
    const result = await createDangerReportSignedUrl(client, "https://example.com/unrelated.jpg")
    expect(result).toBeNull()
  })

  it("returns null when storage returns an error", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: new Error("boom") })
    const client = { storage: { from: () => ({ createSignedUrl }) } } as any

    const result = await createDangerReportSignedUrl(client, "u/r/photo.jpg")
    expect(result).toBeNull()
  })
})
