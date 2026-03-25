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
    expect(url.searchParams.get("country")).toBe("JP")
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

  it.each([
    ["elementary_school", "〇〇小学校"],
    ["middle_school", "〇〇中学校"],
    ["junior_high_school", "△△中学校"],
    ["high_school", "〇〇高校"],
    ["nursery", "〇〇保育園"],
    ["nursery_school", "〇〇保育所"],
    ["preschool", "〇〇幼稚園"],
    ["vocational_school", "〇〇専門学校"],
    ["special_education_school", "〇〇特別支援学校"],
    ["secondary_school", "〇〇中等教育学校"],
    ["technical_school", "〇〇技術専門学校"],
    ["trade_school", "〇〇職業訓練校"],
  ])(
    "renders a school icon for poi_category %s (%s)",
    async (category, facilityName) => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              id: `poi.${category}`,
              geometry: { coordinates: [139.75, 35.68] },
              properties: {
                name: facilityName,
                full_address: `${facilityName}, 東京都千代田区`,
                feature_type: "poi",
                poi_category: [category],
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
        target: { value: facilityName },
      })
      fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!)

      expect(await screen.findByText(`${facilityName}, 東京都千代田区`)).toBeInTheDocument()

      const icon = screen
        .getByText(`${facilityName}, 東京都千代田区`)
        .closest("li")
        ?.querySelector("svg.text-blue-600")
      expect(icon).toBeInTheDocument()
    },
  )

  it("does not render a school icon when feature_type is not poi even if poi_category contains a school category", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "street.1",
            geometry: { coordinates: [139.75, 35.68] },
            properties: {
              name: "千代田区立小学校通り",
              full_address: "千代田区立小学校通り, 東京都",
              feature_type: "street",
              poi_category: ["elementary_school"],
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
      target: { value: "小学校通り" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!)

    expect(await screen.findByText("千代田区立小学校通り, 東京都")).toBeInTheDocument()

    const icon = screen
      .getByText("千代田区立小学校通り, 東京都")
      .closest("li")
      ?.querySelector("svg.text-blue-600")
    expect(icon).not.toBeInTheDocument()
  })

  it("renders a school icon when poi_category contains an extended category alongside others", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "poi.school.2",
            geometry: { coordinates: [139.75, 35.68] },
            properties: {
              name: "〇〇高等学校",
              full_address: "〇〇高等学校, 東京都港区",
              feature_type: "poi",
              poi_category: ["education", "high_school"],
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
      target: { value: "〇〇高等学校" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!)

    expect(await screen.findByText("〇〇高等学校, 東京都港区")).toBeInTheDocument()

    const icon = screen
      .getByText("〇〇高等学校, 東京都港区")
      .closest("li")
      ?.querySelector("svg.text-blue-600")
    expect(icon).toBeInTheDocument()
  })

  it("falls back to geocoding when Search Box returns no results", async () => {
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              id: "place.1",
              place_name: "東京都千代田区",
              center: [139.75, 35.68],
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
      target: { value: "東京" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!)

    expect(await screen.findByText("東京都千代田区")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(firstUrl.origin + firstUrl.pathname).toBe("https://api.mapbox.com/search/searchbox/v1/forward")

    const secondUrl = String(fetchMock.mock.calls[1]?.[0])
    expect(secondUrl).toContain("https://api.mapbox.com/geocoding/v5/mapbox.places/")
    expect(secondUrl).toContain("country=JP")
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
