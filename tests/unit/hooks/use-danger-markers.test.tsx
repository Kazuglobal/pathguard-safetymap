import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useDangerMarkers } from "@/hooks/use-danger-markers"

const mocks = vi.hoisted(() => ({
  markers: [] as Array<{ remove: ReturnType<typeof vi.fn>; options?: unknown }>,
  roots: [] as Array<{ render: ReturnType<typeof vi.fn>; unmount: ReturnType<typeof vi.fn> }>,
}))

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => {
    const root = { render: vi.fn(), unmount: vi.fn() }
    mocks.roots.push(root)
    return root
  }),
}))

vi.mock("mapbox-gl", () => ({
  default: {
    Marker: class {
      remove = vi.fn()
      options?: unknown

      constructor(options?: unknown) {
        this.options = options
        mocks.markers.push(this)
      }

      setLngLat() {
        return this
      }

      addTo() {
        return this
      }
    },
  },
}))

vi.mock("@/lib/gamification", () => ({ addPoints: vi.fn() }))

describe("useDangerMarkers", () => {
  beforeEach(() => {
    mocks.markers.length = 0
    mocks.roots.length = 0
  })

  it("ズーム再描画とアンマウント時にMapbox MarkerとReact rootを破棄する", () => {
    const handlers = new Map<string, () => void>()
    const map = {
      getZoom: vi.fn(() => 15),
      on: vi.fn((event: string, handler: () => void) => handlers.set(event, handler)),
      off: vi.fn((event: string, handler: () => void) => {
        if (handlers.get(event) === handler) handlers.delete(event)
      }),
      easeTo: vi.fn(),
    }
    const report = {
      id: "report-1",
      user_id: "user-1",
      title: "危険箇所",
      description: null,
      latitude: 35.68,
      longitude: 139.7,
      danger_type: "traffic",
      danger_level: 2,
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
    }

    const { unmount } = renderHook(() =>
      useDangerMarkers({
        mapRef: { current: map } as never,
        mapInitializedRef: { current: true },
        dangerReports: [report],
        pendingReports: [],
        showPending: false,
        supabase: null,
        onSelectReport: vi.fn(),
      }),
    )

    expect(mocks.markers).toHaveLength(1)
    const markerOptions = mocks.markers[0].options as {
      anchor: string
      element: HTMLElement
    }
    expect(markerOptions.anchor).toBe("bottom")
    expect(markerOptions.element).toHaveClass(
      "danger-marker",
      "danger-level-2",
      "danger-marker-traffic",
    )
    expect(markerOptions.element).toHaveAttribute(
      "aria-label",
      "交通の危険報告。詳細を開きます",
    )
    expect(markerOptions.element.style.width).toBe("")
    expect(markerOptions.element.style.height).toBe("")
    expect(mocks.roots[0].render).toHaveBeenCalledTimes(1)

    handlers.get("zoomend")?.()
    expect(mocks.markers[0].remove).toHaveBeenCalledTimes(1)
    expect(mocks.roots[0].unmount).toHaveBeenCalledTimes(1)

    expect(mocks.markers).toHaveLength(2)
    unmount()
    expect(mocks.markers[1].remove).toHaveBeenCalledTimes(1)
    expect(mocks.roots[1].unmount).toHaveBeenCalledTimes(1)
    expect(map.off).toHaveBeenCalledWith("zoomend", expect.any(Function))
  })
})
