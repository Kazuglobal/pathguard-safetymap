import { describe, it, expect } from "vitest"
import type { DangerReport } from "@/lib/types"
import {
  resolveAlertRadius,
  DEFAULT_ALERT_RADIUS_M,
  buildAlertCircle,
  buildAlertCircleCollection,
  getAlertFitBounds,
  getAlertBBox,
  buildSuspiciousAlertStaticMapUrl,
  buildCenterPinOverlay,
  SUSPICIOUS_DANGER_TYPE,
} from "@/lib/suspicious-alert"

const TOKYO: [number, number] = [139.767, 35.681]

function makeReport(overrides: Partial<DangerReport>): DangerReport {
  return {
    id: "r1",
    user_id: "u1",
    title: "t",
    description: null,
    latitude: TOKYO[1],
    longitude: TOKYO[0],
    danger_type: SUSPICIOUS_DANGER_TYPE,
    danger_level: 4,
    status: "approved",
    image_url: null,
    processed_image_url: null,
    processed_image_urls: null,
    prefecture: null,
    prefecture_code: null,
    city: null,
    municipality_code: null,
    town: null,
    postal_code: null,
    geocode_source: null,
    geocoded_at: null,
    geocode_confidence: null,
    address_hash: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  } as DangerReport
}

describe("resolveAlertRadius", () => {
  it("returns the default for undefined / invalid input", () => {
    expect(resolveAlertRadius(undefined)).toBe(DEFAULT_ALERT_RADIUS_M)
    expect(resolveAlertRadius("nope")).toBe(DEFAULT_ALERT_RADIUS_M)
    expect(resolveAlertRadius(null)).toBe(DEFAULT_ALERT_RADIUS_M)
  })

  it("passes through allowed values", () => {
    expect(resolveAlertRadius(200)).toBe(200)
    expect(resolveAlertRadius(300)).toBe(300)
    expect(resolveAlertRadius(500)).toBe(500)
    expect(resolveAlertRadius(1000)).toBe(1000)
  })

  it("snaps out-of-set numbers to the nearest allowed value", () => {
    expect(resolveAlertRadius(350)).toBe(300)
    expect(resolveAlertRadius(900)).toBe(1000)
    expect(resolveAlertRadius(10)).toBe(200)
  })
})

describe("buildAlertCircle", () => {
  it("returns a closed polygon with steps+1 coordinates", () => {
    const circle = buildAlertCircle(TOKYO, 300, {}, 64)
    expect(circle).not.toBeNull()
    const ring = circle!.geometry.coordinates[0]
    expect(ring.length).toBe(65)
    expect(ring[0]).toEqual(ring[ring.length - 1])
    expect(circle!.properties?.radiusM).toBe(300)
  })

  it("returns null for invalid centers", () => {
    expect(buildAlertCircle([999, 999] as [number, number], 300)).toBeNull()
  })
})

describe("buildAlertCircleCollection", () => {
  it("includes only suspicious reports", () => {
    const reports = [
      makeReport({ id: "a", danger_type: SUSPICIOUS_DANGER_TYPE }),
      makeReport({ id: "b", danger_type: "traffic" }),
      makeReport({ id: "c", danger_type: SUSPICIOUS_DANGER_TYPE, alert_radius_m: 500 }),
    ]
    const fc = buildAlertCircleCollection(reports)
    expect(fc.type).toBe("FeatureCollection")
    expect(fc.features).toHaveLength(2)
    const ids = fc.features.map((f) => f.properties?.id)
    expect(ids).toContain("a")
    expect(ids).toContain("c")
    expect(ids).not.toContain("b")
  })
})

describe("getAlertBBox / getAlertFitBounds", () => {
  it("returns a bbox that contains the center", () => {
    const bbox = getAlertBBox(TOKYO, 300)
    expect(bbox).not.toBeNull()
    const [w, s, e, n] = bbox!
    expect(w).toBeLessThan(TOKYO[0])
    expect(e).toBeGreaterThan(TOKYO[0])
    expect(s).toBeLessThan(TOKYO[1])
    expect(n).toBeGreaterThan(TOKYO[1])
  })

  it("returns fitBounds-shaped [[w,s],[e,n]]", () => {
    const bounds = getAlertFitBounds(TOKYO, 300)
    expect(bounds).not.toBeNull()
    expect(bounds!).toHaveLength(2)
    expect(bounds![0]).toHaveLength(2)
  })
})

describe("buildSuspiciousAlertStaticMapUrl", () => {
  const token = "pk.test_token"

  it("builds a url with center pin and circle path overlay", () => {
    const result = buildSuspiciousAlertStaticMapUrl({ center: TOKYO, radiusM: 300, mapboxToken: token })
    expect(result).not.toBeNull()
    expect(result!.fallback).toBe(false)
    expect(result!.url).toContain("api.mapbox.com")
    expect(result!.url).toContain("pin-l")
    expect(result!.url).toContain("path-")
    expect(result!.url).toContain(encodeURIComponent(token))
  })

  it("falls back to a center-pin-only url when the circle path is too long", () => {
    const result = buildSuspiciousAlertStaticMapUrl({
      center: TOKYO,
      radiusM: 1000,
      mapboxToken: token,
      steps: 5000,
    })
    expect(result).not.toBeNull()
    expect(result!.fallback).toBe(true)
    expect(result!.url).toContain(buildCenterPinOverlay(TOKYO))
    expect(result!.url).not.toContain("path-")
  })

  it("returns null without a token or with an invalid center", () => {
    expect(buildSuspiciousAlertStaticMapUrl({ center: TOKYO, mapboxToken: "" })).toBeNull()
    expect(
      buildSuspiciousAlertStaticMapUrl({ center: [999, 999] as [number, number], mapboxToken: token }),
    ).toBeNull()
  })
})
