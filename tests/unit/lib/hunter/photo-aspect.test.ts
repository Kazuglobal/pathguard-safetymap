import { describe, expect, it } from "vitest"

import { DEFAULT_PHOTO_ASPECT, photoAspectRatio } from "@/lib/hunter/photo-aspect"

describe("photoAspectRatio", () => {
  it("follows the photo but clamps extreme ratios to 3:4..4:3", () => {
    expect(photoAspectRatio(null)).toBe(DEFAULT_PHOTO_ASPECT)
    expect(photoAspectRatio({ w: 0, h: 10 })).toBe(DEFAULT_PHOTO_ASPECT)
    expect(photoAspectRatio({ w: 3000, h: 4000 })).toBe("750 / 1000")
    expect(photoAspectRatio({ w: 1080, h: 1920 })).toBe("750 / 1000")
    expect(photoAspectRatio({ w: 4000, h: 3000 })).toBe("1333 / 1000")
    expect(photoAspectRatio({ w: 1920, h: 1080 })).toBe("1333 / 1000")
    expect(photoAspectRatio({ w: 1000, h: 1000 })).toBe("1000 / 1000")
  })
})
