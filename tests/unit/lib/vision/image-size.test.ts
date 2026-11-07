import { describe, expect, it } from "vitest"

import {
  CLAUDE_HIGH_RES_LIMITS,
  CLAUDE_STANDARD_LIMITS,
  claudeImageLimits,
  claudeProcessedSize,
  parseImageDataUrl,
  readImageSize,
} from "@/lib/vision/image-size"

function dataUrl(mediaType: string, bytes: number[]): string {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]

function sizeOf(url: string) {
  const parsed = parseImageDataUrl(url)
  return parsed ? readImageSize(parsed) : null
}

describe("readImageSize", () => {
  it("reads PNG", () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...be32(13), ...ascii("IHDR"), ...be32(1600), ...be32(1200), 8, 2, 0, 0, 0]
    expect(sizeOf(dataUrl("image/png", png))).toEqual({ width: 1600, height: 1200 })
  })

  it("reads JPEG (skipping APP segments to the SOF marker)", () => {
    const app0 = [0xff, 0xe0, ...be16(16), ...new Array(14).fill(0)]
    const sof0 = [0xff, 0xc0, ...be16(17), 8, ...be16(1200), ...be16(1600), 3, ...new Array(9).fill(0)]
    expect(sizeOf(dataUrl("image/jpeg", [0xff, 0xd8, ...app0, ...sof0]))).toEqual({ width: 1600, height: 1200 })
  })

  it("reads WebP lossy (VP8), lossless (VP8L) and extended (VP8X)", () => {
    const head = (chunk: string) => [...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii(chunk), 0, 0, 0, 0]
    const vp8 = [...head("VP8 "), 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(1600), ...le16(1200)]
    expect(sizeOf(dataUrl("image/webp", vp8))).toEqual({ width: 1600, height: 1200 })
    const bits = (1200 - 1) | ((900 - 1) << 14)
    const vp8l = [...head("VP8L"), 0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff, 0, 0, 0, 0, 0]
    expect(sizeOf(dataUrl("image/webp", vp8l))).toEqual({ width: 1200, height: 900 })
    const vp8x = [...head("VP8X"), 0, 0, 0, 0, ...le24(1600 - 1), ...le24(1200 - 1)]
    expect(sizeOf(dataUrl("image/webp", vp8x))).toEqual({ width: 1600, height: 1200 })
  })

  it("reads GIF", () => {
    expect(sizeOf(dataUrl("image/gif", [...ascii("GIF89a"), ...le16(640), ...le16(480), 0, 0, 0]))).toEqual({ width: 640, height: 480 })
  })

  it("returns null for unsupported types, broken data or a mismatched header", () => {
    expect(parseImageDataUrl("data:image/heic;base64,AAAA")).toBeNull()
    expect(parseImageDataUrl("https://example.com/a.png")).toBeNull()
    expect(sizeOf(dataUrl("image/png", [1, 2, 3]))).toBeNull()
    expect(sizeOf(dataUrl("image/jpeg", ascii("RIFF....WEBP")))).toBeNull()
  })
})

describe("claudeProcessedSize (公式の参照実装と同じ例)", () => {
  it("matches the documented standard-tier resizes", () => {
    expect(claudeProcessedSize({ width: 1075, height: 1520 }, CLAUDE_STANDARD_LIMITS)).toEqual({ width: 924, height: 1307 })
    expect(claudeProcessedSize({ width: 1920, height: 1080 }, CLAUDE_STANDARD_LIMITS)).toEqual({ width: 1456, height: 819 })
    expect(claudeProcessedSize({ width: 1092, height: 1092 }, CLAUDE_STANDARD_LIMITS)).toEqual({ width: 1092, height: 1092 })
  })

  it("matches the documented high-resolution-tier resizes", () => {
    expect(claudeProcessedSize({ width: 1920, height: 1080 }, CLAUDE_HIGH_RES_LIMITS)).toEqual({ width: 1920, height: 1080 })
    expect(claudeProcessedSize({ width: 2000, height: 1500 }, CLAUDE_HIGH_RES_LIMITS)).toEqual({ width: 2000, height: 1500 })
    expect(claudeProcessedSize({ width: 3840, height: 2160 }, CLAUDE_HIGH_RES_LIMITS)).toEqual({ width: 2576, height: 1449 })
  })

  it("keeps the app's photos (long edge 1600px) as they are on Haiku 5.5", () => {
    expect(claudeProcessedSize({ width: 1600, height: 1200 }, claudeImageLimits("claude-haiku-5-5"))).toEqual({ width: 1600, height: 1200 })
    expect(claudeProcessedSize({ width: 1200, height: 1600 }, claudeImageLimits("claude-haiku-5-5"))).toEqual({ width: 1200, height: 1600 })
  })

  it("chooses the tier from the model name", () => {
    expect(claudeImageLimits("claude-haiku-5-5")).toEqual(CLAUDE_HIGH_RES_LIMITS)
    expect(claudeImageLimits("claude-opus-4-7")).toEqual(CLAUDE_HIGH_RES_LIMITS)
    expect(claudeImageLimits("claude-sonnet-5")).toEqual(CLAUDE_HIGH_RES_LIMITS)
    expect(claudeImageLimits("claude-opus-4-6")).toEqual(CLAUDE_STANDARD_LIMITS)
    expect(claudeImageLimits("claude-haiku-4-5")).toEqual(CLAUDE_STANDARD_LIMITS)
    expect(claudeImageLimits("claude-sonnet-4-5-20250929")).toEqual(CLAUDE_STANDARD_LIMITS)
  })
})
