import { afterEach, describe, expect, it, vi } from "vitest"

import { collectDangerReportImageDataUrls } from "@/lib/danger-report-moderation-images"

describe("collectDangerReportImageDataUrls", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("abandons a storage download that exceeds the moderation budget", async () => {
    vi.useFakeTimers()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const download = vi.fn(
      () => new Promise(() => undefined),
    )
    const supabaseAdmin = {
      storage: {
        from: vi.fn(() => ({ download })),
      },
    }

    const resultPromise = collectDangerReportImageDataUrls(
      supabaseAdmin,
      {
        image_url:
          "https://example.supabase.co/storage/v1/object/public/danger-reports/report-1/photo.jpg",
        processed_image_urls: [],
      },
    )

    await vi.advanceTimersByTimeAsync(10_001)

    await expect(resultPromise).resolves.toEqual([])
    expect(download).toHaveBeenCalledOnce()
  })

  it("downloads up to three moderation images concurrently", async () => {
    const pending: Array<{
      resolve: (value: { data: Blob; error: null }) => void
      promise: Promise<{ data: Blob; error: null }>
    }> = []
    const download = vi.fn(() => {
      let resolve!: (value: { data: Blob; error: null }) => void
      const promise = new Promise<{ data: Blob; error: null }>(
        (done) => {
          resolve = done
        },
      )
      pending.push({ resolve, promise })
      return promise
    })
    const supabaseAdmin = {
      storage: {
        from: vi.fn(() => ({ download })),
      },
    }
    const base =
      "https://example.supabase.co/storage/v1/object/public/danger-reports/report-1"

    const resultPromise = collectDangerReportImageDataUrls(
      supabaseAdmin,
      {
        image_url: `${base}/original.jpg`,
        processed_image_urls: [
          `${base}/processed-1.jpg`,
          `${base}/processed-2.jpg`,
        ],
      },
    )

    await Promise.resolve()
    expect(download).toHaveBeenCalledTimes(3)

    for (const item of pending) {
      item.resolve({
        data: {
          size: 5,
          type: "image/jpeg",
          arrayBuffer: async () => new ArrayBuffer(5),
        } as Blob,
        error: null,
      })
    }
    await expect(resultPromise).resolves.toHaveLength(3)
  })

  it("clears the download timeout after a fast storage response", async () => {
    vi.useFakeTimers()
    const download = vi.fn().mockResolvedValue({
      data: {
        size: 5,
        type: "image/jpeg",
        arrayBuffer: async () => new ArrayBuffer(5),
      } as Blob,
      error: null,
    })
    const supabaseAdmin = {
      storage: {
        from: vi.fn(() => ({ download })),
      },
    }

    await collectDangerReportImageDataUrls(supabaseAdmin, {
      image_url:
        "https://example.supabase.co/storage/v1/object/public/danger-reports/report-1/photo.jpg",
      processed_image_urls: [],
    })

    expect(vi.getTimerCount()).toBe(0)
  })
})
