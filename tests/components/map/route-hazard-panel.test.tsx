import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

import { RouteHazardPanel } from "@/components/map/route-hazard-panel"
import type { UserRoute } from "@/lib/types"

vi.mock("@/components/map/map-style-selector", () => ({
  default: () => <div data-testid="map-style-selector">style-selector</div>,
}))

vi.mock("@/components/map/map-3d-toggle", () => ({
  default: () => <button type="button" aria-label="3D表示切替">3D</button>,
}))

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) => (
    <div data-state={open ? "open" : "closed"}>{children}</div>
  ),
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

const mockRoute: UserRoute = {
  id: "route-1",
  user_id: "user-1",
  name: "いつもの通学路",
  description: null,
  start_lat: 35.0,
  start_lng: 139.0,
  end_lat: 35.1,
  end_lng: 139.1,
  start_address: "出発地",
  end_address: "到着地",
  route_geometry: null,
  distance_meters: 1200,
  estimated_time_minutes: 16,
  is_favorite: true,
  created_at: "2026-03-07T00:00:00.000Z",
  updated_at: "2026-03-07T00:00:00.000Z",
}

const defaultProps = {
  routes: [mockRoute],
  selectedRouteId: mockRoute.id,
  selectedHazardsCount: 3,
  toggles: {
    flood: true,
    tsunami: false,
  },
  isLoading: false,
  onRouteChange: vi.fn(),
  onToggleChange: vi.fn(),
  isMobile: false,
  mapStyle: "streets-v12",
  onMapStyleChange: vi.fn(),
  is3DEnabled: false,
  onToggle3D: vi.fn(),
  onToggleAR: vi.fn(),
  isARMode: false,
  onToggleHeatmap: vi.fn(),
  isHeatmapVisible: false,
}

describe("RouteHazardPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("desktop ではハザードカードを常時表示する", () => {
    render(<RouteHazardPanel {...defaultProps} />)

    expect(screen.getByText("通学ルートハザード")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "ハザード・地図設定を開く" })).not.toBeInTheDocument()
  })

  it("mobile ではトリガーからハザード・地図設定ドロワーを開ける", () => {
    render(<RouteHazardPanel {...defaultProps} isMobile={true} />)

    fireEvent.click(screen.getByRole("button", { name: "ハザード・地図設定を開く" }))

    expect(screen.getByText("ハザード・地図設定")).toBeInTheDocument()
    expect(screen.getByTestId("map-style-selector")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "3D表示切替" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ARビューを開く" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "事故ヒートマップ表示切替" })).toBeInTheDocument()
  })
})
