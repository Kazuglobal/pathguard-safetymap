import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import ARView from "@/components/map/ar-view"
import type { ARHazardData } from "@/lib/ar-utils"
import type { DangerReport } from "@/lib/types"

const stopCamera = vi.fn()
const retryCamera = vi.fn()
const retryLocation = vi.fn()
const retryOrientation = vi.fn()
const onClose = vi.fn()

const mockState: {
  heading: number
  hazards: ARHazardData[]
} = {
  heading: 0,
  hazards: [],
}

vi.mock("@/hooks/use-ar-camera", () => ({
  useARCamera: () => ({
    videoRef: { current: document.createElement("video") },
    isCameraActive: true,
    isLoading: false,
    loadingStep: "",
    estimatedFov: null,
    cameraPermission: true,
    error: null,
    stopCamera,
    retry: retryCamera,
  }),
}))

vi.mock("@/hooks/use-ar-location", () => ({
  useARLocation: () => ({
    userLocation: { lat: 35.6812, lon: 139.7671 },
    locationPermission: true,
    error: null,
    retry: retryLocation,
  }),
}))

vi.mock("@/hooks/use-ar-orientation", () => ({
  useAROrientation: () => ({
    userHeading: mockState.heading,
    orientationPermission: true,
    retry: retryOrientation,
  }),
}))

vi.mock("@/lib/ar-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ar-utils")>("@/lib/ar-utils")
  return {
    ...actual,
    calculateARHazardData: vi.fn(() => mockState.hazards),
  }
})

vi.mock("@/lib/ar-canvas-renderer", () => ({
  drawHazardOverlay: vi.fn(),
}))

vi.mock("@/components/map/ar-settings-panel", () => ({
  ARSettingsPanel: () => null,
}))

vi.mock("@/components/map/ar-hazard-card", () => ({
  ARPrimaryHazardCard: ({
    hazard,
    progressLabel,
    onMarkReviewed,
    onSaveForLater,
  }: {
    hazard: ARHazardData
    progressLabel?: string
    onMarkReviewed?: () => void
    onSaveForLater?: () => void
  }) => (
    <div data-testid="primary-hazard-card">
      <p data-testid="primary-title">{hazard.report.title}</p>
      {progressLabel && <p data-testid="progress-label">{progressLabel}</p>}
      <button type="button" onClick={onMarkReviewed}>
        mark reviewed
      </button>
      <button type="button" onClick={onSaveForLater}>
        save for later
      </button>
    </div>
  ),
  ARSecondaryHazardCard: ({ hazard }: { hazard: ARHazardData }) => (
    <div data-testid="secondary-title">{hazard.report.title}</div>
  ),
}))

function createReport(id: string, title: string, dangerLevel: number): DangerReport {
  return {
    id,
    user_id: `user-${id}`,
    title,
    description: `${title} の説明`,
    latitude: 35.6812,
    longitude: 139.7671,
    danger_type: "traffic",
    danger_level: dangerLevel,
    status: "published",
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
}

function createHazard(report: DangerReport, distance: number): ARHazardData {
  return {
    report,
    distance,
    bearing: 30,
    relativeAngle: 0,
    x: 0,
    y: 0,
    z: 0.1,
  }
}

beforeAll(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        drawImage: vi.fn(),
      }) as unknown as CanvasRenderingContext2D
  )
})

beforeEach(() => {
  vi.clearAllMocks()
  mockState.heading = 0
  mockState.hazards = []
})

describe("ARView learning tour", () => {
  it("keeps reviewed progress when a stop temporarily leaves the visible hazards", () => {
    const reportA = createReport("report-a", "交差点A", 4)
    const reportB = createReport("report-b", "交差点B", 3)
    const reports = [reportA, reportB]

    mockState.hazards = [createHazard(reportA, 40), createHazard(reportB, 80)]

    const { rerender } = render(<ARView reports={reports} onClose={onClose} />)

    fireEvent.click(screen.getByRole("button", { name: "mark reviewed" }))
    expect(screen.getByTestId("primary-title")).toHaveTextContent("交差点B")

    act(() => {
      mockState.heading = 45
      mockState.hazards = [createHazard(reportB, 80)]
      rerender(<ARView reports={reports} onClose={onClose} />)
    })

    act(() => {
      mockState.heading = 90
      mockState.hazards = [createHazard(reportA, 40), createHazard(reportB, 80)]
      rerender(<ARView reports={reports} onClose={onClose} />)
    })

    fireEvent.click(screen.getByRole("button", { name: "mark reviewed" }))

    expect(screen.getByText("通学路の振り返り")).toBeInTheDocument()
    expect(screen.getByText("2/2")).toBeInTheDocument()
  })

  it("advances to the remaining pending stop even when hazard order changes", () => {
    const reportA = createReport("report-a", "交差点A", 4)
    const reportB = createReport("report-b", "交差点B", 3)
    const reportC = createReport("report-c", "交差点C", 5)
    const reports = [reportA, reportB, reportC]

    mockState.hazards = [
      createHazard(reportA, 30),
      createHazard(reportB, 60),
      createHazard(reportC, 90),
    ]

    const { rerender } = render(<ARView reports={reports} onClose={onClose} />)

    fireEvent.click(screen.getByRole("button", { name: "mark reviewed" }))
    expect(screen.getByTestId("primary-title")).toHaveTextContent("交差点B")

    act(() => {
      mockState.heading = 135
      mockState.hazards = [createHazard(reportC, 35), createHazard(reportB, 70)]
      rerender(<ARView reports={reports} onClose={onClose} />)
    })

    fireEvent.click(screen.getByRole("button", { name: "mark reviewed" }))

    expect(screen.getByTestId("primary-title")).toHaveTextContent("交差点C")
    expect(screen.getByTestId("progress-label")).toHaveTextContent("1 / 2")
  })
})
