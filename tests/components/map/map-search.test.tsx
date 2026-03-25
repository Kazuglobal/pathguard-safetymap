import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import MapSearch from "@/components/map/map-search"

const mockFlyTo = vi.fn()
const mockGetCenter = vi.fn(() => ({ lng: 139.75, lat: 35.68 }))
const SEARCH_PLACEHOLDER = "学校・施設・住所を検索..."

afterEach(() => {
  vi.restoreAllMocks()
  mockFlyTo.mockReset()
})

describe("MapSearch", () => {
  it("accepts custom shell classes so it can render inside the top overlay", () => {
    render(
      <MapSearch
        map={{ flyTo: mockFlyTo, getCenter: mockGetCenter } as never}
        className="custom-shell"
        inputClassName="custom-input"
      />,
    )

    expect(screen.getByTestId("map-search-root")).toHaveClass("custom-shell")
    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toHaveClass("custom-input")
  })

  it("renders results after search and selects a location", async () => {
    const onSelectLocation = vi.fn()
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "place.1",
            geometry: { coordinates: [139.75, 35.68] },
            properties: {
              name: "東京都千代田区",
              feature_type: "place",
              full_address: "東京都千代田区",
            },
          },
        ],
      }),
    } as Response)

    render(
      <MapSearch
        map={{ flyTo: mockFlyTo, getCenter: mockGetCenter } as never}
        onSelectLocation={onSelectLocation}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: "東京" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!)

    expect(await screen.findByText("東京都千代田区")).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const endpoint = String(fetchMock.mock.calls[0]?.[0])
    const url = new URL(endpoint)
    expect(url.origin + url.pathname).toBe("https://api.mapbox.com/search/searchbox/v1/forward")
    expect(url.searchParams.get("q")).toBe("東京")
    expect(url.searchParams.get("country")).toBe("jp")
    expect(url.searchParams.get("language")).toBe("ja")
    expect(url.searchParams.get("auto_complete")).toBe("true")
    expect(url.searchParams.get("types")).toContain("poi")

    fireEvent.click(screen.getByText("東京都千代田区"))

    expect(mockFlyTo).toHaveBeenCalled()
    expect(onSelectLocation).toHaveBeenCalledWith([139.75, 35.68])
  })

  it("renders a school icon for school POI results", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "poi.1",
            geometry: { coordinates: [139.75, 35.68] },
            properties: {
              name: "〇〇小学校",
              full_address: "〇〇小学校, 東京都千代田区",
              feature_type: "poi",
              poi_category: ["school"],
            },
          },
        ],
      }),
    } as Response)

    render(
      <MapSearch
        map={{ flyTo: mockFlyTo, getCenter: mockGetCenter } as never}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: "〇〇小学校" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!)

    expect(await screen.findByText("〇〇小学校, 東京都千代田区")).toBeInTheDocument()

    const icon = screen
      .getByText("〇〇小学校, 東京都千代田区")
      .closest("li")
      ?.querySelector("svg.text-blue-600")
    expect(icon).toBeInTheDocument()
  })

  it("hides results when an external dismiss signal changes without clearing the query", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "place.1",
            geometry: { coordinates: [139.75, 35.68] },
            properties: {
              name: "東京都千代田区",
              feature_type: "place",
              full_address: "東京都千代田区",
            },
          },
        ],
      }),
    } as Response)

    const { rerender } = render(
      <MapSearch
        map={{ flyTo: mockFlyTo, getCenter: mockGetCenter } as never}
        dismissResultsSignal={0}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: "東京" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!)

    expect(await screen.findByText("東京都千代田区")).toBeInTheDocument()

    rerender(
      <MapSearch
        map={{ flyTo: mockFlyTo, getCenter: mockGetCenter } as never}
        dismissResultsSignal={1}
      />,
    )

    expect(screen.queryByText("東京都千代田区")).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toHaveValue("東京")
  })
})
