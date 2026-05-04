import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import ARView from "@/components/map/ar-view"
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
      retry: vi.fn(),
    })
  })

  it("親子モードではルート名と子ども名を表示する", async () => {
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
})
