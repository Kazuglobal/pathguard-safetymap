import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"

import ARView from "@/components/map/ar-view"
import { createARError } from "@/lib/ar-constants"
import { createMockDangerReport } from "@/tests/fixtures/dangers"

const mocks = vi.hoisted(() => ({
  useARCamera: vi.fn(),
  useARLocation: vi.fn(),
  useAROrientation: vi.fn(),
  drawHazardOverlay: vi.fn(),
}))

vi.mock("@/hooks/use-ar-camera", () => ({
  useARCamera: mocks.useARCamera,
}))

vi.mock("@/hooks/use-ar-location", () => ({
  useARLocation: mocks.useARLocation,
}))

vi.mock("@/hooks/use-ar-orientation", () => ({
  useAROrientation: mocks.useAROrientation,
}))

vi.mock("@/lib/ar-canvas-renderer", () => ({
  drawHazardOverlay: mocks.drawHazardOverlay,
}))

vi.mock("@/components/map/ar-image-gallery", () => ({
  ARImageGallery: () => <div data-testid="ar-image-gallery" />,
}))

describe("ARView parent-child route mode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useARCamera.mockReturnValue({
      videoRef: { current: null },
      isCameraActive: true,
      isLoading: false,
      loadingStep: "",
      estimatedFov: null,
      cameraPermission: true,
      error: null,
      stopCamera: vi.fn(),
      retry: vi.fn(),
    })
    mocks.useARLocation.mockReturnValue({
      userLocation: { lat: 35.6895, lon: 139.6917, accuracy: 12 },
      locationPermission: true,
      error: null,
      retry: vi.fn(),
    })
    mocks.useAROrientation.mockReturnValue({
      userHeading: 0,
      orientationPermission: true,
      error: null,
      retry: vi.fn(),
    })
  })

  it("親子モードではルート名と子ども名を表示する", async () => {
    const user = userEvent.setup()

    render(
      <ARView
        mode={{
          kind: "parent_child_route",
          routeId: "route-1",
          routeName: "通学路A",
          childId: "child-sakura",
          childName: "さくら",
          sessionId: "session-1",
          reports: [
            createMockDangerReport({
              id: "danger-near",
              title: "見通しの悪い交差点",
              danger_type: "traffic",
              latitude: 35.6896,
              longitude: 139.6917,
            }),
          ],
        }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole("alertdialog", { name: "立ち止まって親子で確認" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "同意して開始" })).toBeDisabled()

    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "同意して開始" }))

    await waitFor(() => {
      expect(screen.getByText("親子で通学路確認")).toBeInTheDocument()
      expect(screen.getByText("通学路A")).toBeInTheDocument()
      expect(screen.getByText("さくら")).toBeInTheDocument()
      expect(screen.getByRole("alert")).toHaveTextContent("ここでは止まって、みぎ・ひだりを見よう")
    })
  })

  it("通常ARモードでは既存タイトルを維持する", async () => {
    render(
      <ARView
        mode={{
          kind: "nearby",
          reports: [],
        }}
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("AR危険個所ビュー")).toBeInTheDocument()
      expect(screen.queryByText("親子で通学路確認")).not.toBeInTheDocument()
    })
  })

  it("位置情報が拒否された親子モードでは手動確認へフォールバックできる", async () => {
    const user = userEvent.setup()
    mocks.useARLocation.mockReturnValue({
      userLocation: null,
      locationPermission: false,
      error: createARError("location_denied"),
      retry: vi.fn(),
    })

    render(
      <ARView
        mode={{
          kind: "parent_child_route",
          routeId: "route-manual",
          routeName: "通学路B",
          childId: null,
          childName: null,
          sessionId: "session-manual",
          reports: [
            createMockDangerReport({
              id: "danger-manual",
              title: "歩道がせまい道",
              danger_type: "pedestrian",
              latitude: 35.6896,
              longitude: 139.6917,
            }),
          ],
        }}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "同意して開始" }))

    expect(await screen.findByRole("button", { name: "手動で確認を続ける" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "手動で確認を続ける" }))

    await waitFor(() => {
      expect(screen.getByText("位置情報なし: 手動確認中")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "ここに着いた" })).toBeInTheDocument()
      expect(screen.getByText("歩道がせまい道")).toBeInTheDocument()
    })
  })

  it("方位センサー拒否時は通常マップ確認へ誘導する", async () => {
    const user = userEvent.setup()
    mocks.useAROrientation.mockReturnValue({
      userHeading: 0,
      orientationPermission: false,
      error: createARError("orientation_denied"),
      retry: vi.fn(),
    })

    render(
      <ARView
        mode={{
          kind: "parent_child_route",
          routeId: "route-orientation",
          routeName: "通学路C",
          childId: null,
          childName: null,
          sessionId: "session-orientation",
          reports: [
            createMockDangerReport({
              id: "danger-orientation",
              title: "見通しの悪い交差点",
              danger_type: "traffic",
              latitude: 35.6896,
              longitude: 139.6917,
            }),
          ],
        }}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "同意して開始" }))

    expect(await screen.findByText("デバイスの向き検出が拒否されました")).toBeInTheDocument()
    expect(
      screen.getByText("カメラ向きを使えないため、AR表示を停止しました。通常マップで危険個所を確認してください。")
    ).toBeInTheDocument()
  })
})
