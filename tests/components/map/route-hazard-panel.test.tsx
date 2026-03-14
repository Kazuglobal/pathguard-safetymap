import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

import { RouteHazardPanel } from "@/components/map/route-hazard-panel"
import type { RouteHazardMarker, UserRoute } from "@/lib/types"

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
  child_id: null,
  child_name: null,
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

const mockHazards: RouteHazardMarker[] = [
  {
    id: "hazard-marker-1",
    route_id: mockRoute.id,
    hazard_type: "flood",
    source_layer: "flood-zone",
    risk_level: 4,
    depth_min_m: 0.3,
    depth_max_m: 0.5,
    depth_label: "0.3m - 0.5m",
    area_context: "intersection",
    area_label: "通学路Aの交差点",
    title: "横断歩道の前で冠水しやすい地点",
    summary: "雨の日に足元が見えにくくなります",
    explanation: "横断待ちで車との距離が近くなりやすいです",
    evacuation_points: ["歩道橋側へ移動"],
    coordinates: [139.0, 35.0],
    scenario_options: [],
    scenario_key: "flood-default",
  },
]

const defaultProps = {
  routes: [mockRoute],
  selectedRouteId: mockRoute.id,
  selectedHazardsCount: 3,
  summary: {
    status: "caution" as const,
    label: "注意",
    headline: "いつもの通学路は注意が必要です",
    detail: "洪水ハザードと危険報告を確認してください",
    reasons: ["洪水ハザードが1件あります", "危険報告が2件あります"],
    score: 48,
    hazardCount: 1,
    dangerCount: 2,
  },
  evidenceItems: [
    {
      id: "hazard-1",
      title: "冠水しやすい交差点",
      reason: "大雨時に足元が見えづらくなります",
      source: "洪水浸水想定区域",
      updatedLabel: "2026-03-14 09:30",
      kind: "hazard" as const,
    },
  ],
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
  hazards: mockHazards,
  onHazardSelect: vi.fn(),
}

describe("RouteHazardPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("desktop ではハザードカードを常時表示する", () => {
    render(<RouteHazardPanel {...defaultProps} />)

    expect(screen.getByText("通学ルートハザード")).toBeInTheDocument()
    expect(screen.getByText("いつもの通学路は注意が必要です")).toBeInTheDocument()
    expect(screen.getByText("冠水しやすい交差点")).toBeInTheDocument()
    expect(screen.getByText("情報源: 洪水浸水想定区域")).toBeInTheDocument()
    expect(screen.getByText("更新: 2026-03-14 09:30")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "ハザード・地図設定を開く" })).not.toBeInTheDocument()
  })

  it("mobile ではトリガーからハザード・地図設定ドロワーを開ける", () => {
    render(<RouteHazardPanel {...defaultProps} isMobile={true} />)

    expect(screen.getAllByText("いつもの通学路は注意が必要です")).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "通学路の注意点を開く" }))

    expect(screen.getByRole("heading", { name: "通学路の注意点" })).toBeInTheDocument()
    expect(screen.getByTestId("map-style-selector")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "3D表示切替" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ARビューを開く" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "事故ヒートマップ表示切替" })).toBeInTheDocument()
  })

  it("一覧の危険箇所を押すと選択イベントを返す", () => {
    const onHazardSelect = vi.fn()
    render(
      <RouteHazardPanel
        {...defaultProps}
        onHazardSelect={onHazardSelect}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: /横断歩道の前で冠水しやすい地点/i })
    )

    expect(onHazardSelect).toHaveBeenCalledWith(mockHazards[0])
  })
})
