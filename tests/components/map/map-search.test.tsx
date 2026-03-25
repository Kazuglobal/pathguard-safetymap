import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import MapSearch from "@/components/map/map-search"

const mockFlyTo = vi.fn()
const mockGetCenter = vi.fn(() => ({ lng: 139.75, lat: 35.68 }))

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
    expect(screen.getByPlaceholderText("学校・施設・住所を検索...")).toHaveClass("custom-input")
  })

  it("renders results after search and selects a location", async () => {
    const onSelectLocation = vi.fn()
    vi.spyOn(global, "fetch").mockResolvedValue({
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
        onSelectLocation={onSelectLocation}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText("学校・施設・住所を検索..."), {
      target: { value: "東京" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!)

    expect(await screen.findByText("東京都千代田区")).toBeInTheDocument()

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
            place_name: "〇〇小学校, 東京都千代田区",
            center: [139.75, 35.68],
            place_type: ["poi"],
            properties: { category: "school" },
          },
        ],
      }),
    } as Response)

    render(
      <MapSearch
        map={{ flyTo: mockFlyTo, getCenter: mockGetCenter } as never}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText("学校・施設・住所を検索..."), {
      target: { value: "〇〇小学校" },
    })
    fireEvent.submit(screen.getByRole("button", { name: /search/i }).closest("form")!)

    expect(await screen.findByText("〇〇小学校, 東京都千代田区")).toBeInTheDocument()

    // 学校アイコンが表示されていること（MapPinではなくSchoolアイコン）
    const icon = screen.getByText("〇〇小学校, 東京都千代田区").closest("li")?.querySelector("svg")
    expect(icon).toBeInTheDocument()
  })

  it("hides results when an external dismiss signal changes without clearing the query", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
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

    const { rerender } = render(
      <MapSearch
        map={{ flyTo: mockFlyTo, getCenter: mockGetCenter } as never}
        dismissResultsSignal={0}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText("学校・施設・住所を検索..."), {
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
    expect(screen.getByPlaceholderText("学校・施設・住所を検索...")).toHaveValue("東京")
  })
})
