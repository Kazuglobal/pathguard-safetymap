import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ThreeDRoutePocClient from "@/app/3d-route-poc/3d-route-poc-client"

vi.mock("@/components/3d-route/time-of-day-slider", () => ({
  default: () => <div data-testid="time-slider" />,
}))

vi.mock("@/components/3d-route/address-search", () => ({
  default: () => <div data-testid="address-search" />,
}))

vi.mock("@/components/3d-route/elevation-graph", () => ({
  default: () => <div data-testid="elevation-graph" />,
}))

vi.mock("next/dynamic", () => {
  let index = 0
  const ids = ["cesium-viewer", "street-view-panel", "spark-splat-viewer"]

  return {
    default: () => {
      const id = ids[index] ?? `dynamic-${index}`
      index += 1
      return function MockDynamicComponent() {
        return <div data-testid={id} />
      }
    },
  }
})

vi.mock("@/components/3d-route/spark-splat-viewer", () => ({
  PRESET_SPLATS: [{ label: "Sample", url: "/sample.spz" }],
  default: () => <div data-testid="spark-splat-viewer-real" />,
}))

describe("ThreeDRoutePocClient", () => {
  it("Street表示を終了したら StreetViewPanel をアンマウントする", () => {
    render(<ThreeDRoutePocClient />)

    fireEvent.click(screen.getByRole("button", { name: "Street" }))
    expect(screen.getByTestId("street-view-panel")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "3D" }))
    expect(screen.queryByTestId("street-view-panel")).not.toBeInTheDocument()
  })
})
