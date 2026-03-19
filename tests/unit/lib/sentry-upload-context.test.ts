import { describe, expect, it, vi } from "vitest"

const sentryMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  setContext: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock("@sentry/nextjs", () => sentryMocks)

async function loadHelper() {
  vi.resetModules()
  return import("@/lib/sentry-upload-context")
}

describe("sentry upload context helper", () => {
  it("adds Sentry context and breadcrumb before reading the file", async () => {
    const { readFileWithSentryContext } = await loadHelper()
    const file = {
      name: "sample.png",
      type: "image/png",
      size: 4,
      arrayBuffer: vi.fn(async () => Uint8Array.from([1, 2, 3, 4]).buffer),
    } as unknown as File

    const buffer = await readFileWithSentryContext({
      route: "/api/gemini/generate-image",
      fieldName: "image",
      file,
    })

    expect(buffer.byteLength).toBe(4)
    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "upload.read",
        message: "/api/gemini/generate-image:image",
      }),
    )
    expect(sentryMocks.setContext).toHaveBeenCalledWith(
      "upload_file",
      expect.objectContaining({
        route: "/api/gemini/generate-image",
        fieldName: "image",
        fileName: "sample.png",
        fileType: "image/png",
        fileSize: 4,
      }),
    )
  })

  it("captures the exception with upload context when arrayBuffer fails", async () => {
    const { readFileWithSentryContext } = await loadHelper()
    const error = new RangeError("Array buffer allocation failed")
    const file = {
      name: "huge.png",
      type: "image/png",
      size: 1024,
      arrayBuffer: vi.fn(async () => {
        throw error
      }),
    } as unknown as File

    await expect(
      readFileWithSentryContext({
        route: "/api/image/process",
        fieldName: "file",
        file,
      }),
    ).rejects.toThrow("Array buffer allocation failed")

    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        contexts: expect.objectContaining({
          upload_file: expect.objectContaining({
            route: "/api/image/process",
            fieldName: "file",
            fileName: "huge.png",
            fileSize: 1024,
            phase: "arrayBuffer",
          }),
        }),
      }),
    )
  })
})
