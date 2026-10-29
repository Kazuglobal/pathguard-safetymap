import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ forVisionTasks: vi.fn() }))

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mocks.forVisionTasks },
  FaceDetector: { createFromOptions: vi.fn() },
}))

import { detectFaces, releaseMediaPipeFaceDetector } from "@/lib/media/face-detection"

afterEach(() => {
  releaseMediaPipeFaceDetector()
  delete (window as unknown as { FaceDetector?: unknown }).FaceDetector
  vi.restoreAllMocks()
})

describe("detectFaces(端末内の顔検出。UIUX改装 項目57)", () => {
  it("MediaPipe もブラウザの FaceDetector も使えないときは、顔が無かったのではなく「使えなかった」と返す", async () => {
    mocks.forVisionTasks.mockRejectedValue(new Error("wasm failed"))
    vi.spyOn(console, "warn").mockImplementation(() => undefined)

    await expect(detectFaces(new Image(), 1200, 900)).resolves.toEqual({ faces: [], available: false })
  })

  it("MediaPipe が使えなくても、ブラウザの FaceDetector で見つけた顔は返す", async () => {
    mocks.forVisionTasks.mockRejectedValue(new Error("wasm failed"))
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    ;(window as unknown as { FaceDetector: unknown }).FaceDetector = class {
      async detect() {
        return [{ boundingBox: { x: 120, y: 90, width: 240, height: 180 } }]
      }
    }

    await expect(detectFaces(new Image(), 1200, 900)).resolves.toEqual({
      faces: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }],
      available: true,
    })
  })

  it("ブラウザの FaceDetector が失敗したときも「使えなかった」と返す", async () => {
    mocks.forVisionTasks.mockRejectedValue(new Error("wasm failed"))
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    ;(window as unknown as { FaceDetector: unknown }).FaceDetector = class {
      async detect(): Promise<never> {
        throw new Error("not allowed")
      }
    }

    await expect(detectFaces(new Image(), 1200, 900)).resolves.toEqual({ faces: [], available: false })
  })
})
