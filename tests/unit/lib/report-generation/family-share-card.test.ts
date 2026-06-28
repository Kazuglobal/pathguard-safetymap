import { beforeEach, describe, expect, it, vi } from "vitest"

const html2canvasMock = vi.hoisted(() =>
  vi.fn(async () => ({
    toBlob: (callback: (blob: Blob | null) => void) =>
      callback(new Blob(["family-share-card"], { type: "image/png" })),
  })),
)

vi.mock("html2canvas", () => ({
  default: html2canvasMock,
}))

import {
  buildFamilyShareCardText,
  renderFamilyShareCardBlob,
  shareFamilyShareCard,
} from "@/lib/report-generation/family-share-card"

describe("family-share-card", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    Object.defineProperty(window, "URL", {
      configurable: true,
      value: {
        createObjectURL: vi.fn(() => "blob:test"),
        revokeObjectURL: vi.fn(),
      },
    })
  })

  it("falls back to download when the browser cannot share files", async () => {
    const cardElement = document.createElement("div")
    document.body.appendChild(cardElement)

    const canShare = vi.fn(() => false)
    Object.defineProperty(window.navigator, "canShare", {
      configurable: true,
      value: canShare,
    })

    const originalCreateElement = document.createElement.bind(document)
    const anchor = originalCreateElement("a")
    const clickMock = vi.spyOn(anchor, "click").mockImplementation(() => {})
    const removeMock = vi.spyOn(anchor, "remove").mockImplementation(() => {})
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation(((tagName: string) => {
        if (tagName === "a") {
          return anchor
        }
        return originalCreateElement(tagName)
      }) as typeof document.createElement)

    const result = await shareFamilyShareCard({
      cardElement,
      card: {
        title: "見通しの悪い交差点",
        summary: "小学生の目線では車が急に見える",
        action: "白線の内側を歩く",
        mapLabel: "東京・千代田区",
        imageUrl: "/hazard.png",
      },
    })

    expect(result.mode).toBe("download")
    expect(canShare).toHaveBeenCalled()
    expect(window.navigator.share).not.toHaveBeenCalled()
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("見通しの悪い交差点"),
    )
    expect(clickMock).toHaveBeenCalledTimes(1)
    expect(removeMock).toHaveBeenCalledTimes(1)

    createElementSpy.mockRestore()
  })

  it("buildFamilyShareCardText ignores mapImageUrl and photoImageUrl and produces the same text", () => {
    const base = {
      title: "不審者アラート",
      summary: "公園付近で不審な人物を目撃",
      action: "一人で通らない",
      mapLabel: "東京・練馬区",
    }

    const textWithout = buildFamilyShareCardText(base)
    const textWith = buildFamilyShareCardText({
      ...base,
      imageUrl: "/old.png",
      mapImageUrl: "/map.png",
      photoImageUrl: "/photo.jpg",
    })

    expect(textWith).toBe(textWithout)
    expect(textWith).toContain("不審者アラート")
    expect(textWith).toContain("東京・練馬区")
    expect(textWith).toContain("公園付近で不審な人物を目撃")
    expect(textWith).toContain("一人で通らない")
  })

  it("waits for card images to load before rendering the canvas", async () => {
    const cardElement = document.createElement("div")
    const image = document.createElement("img")
    let imageLoaded = false

    Object.defineProperty(image, "complete", {
      configurable: true,
      get: () => imageLoaded,
    })
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      get: () => (imageLoaded ? 120 : 0),
    })

    cardElement.appendChild(image)

    const renderPromise = renderFamilyShareCardBlob(cardElement)

    expect(html2canvasMock).not.toHaveBeenCalled()

    imageLoaded = true
    image.dispatchEvent(new Event("load"))

    const blob = await renderPromise

    expect(blob).toBeInstanceOf(Blob)
    expect(html2canvasMock).toHaveBeenCalledTimes(1)
  })
})
