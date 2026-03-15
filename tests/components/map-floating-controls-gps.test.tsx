/**
 * MapFloatingControls - 「現在地で報告」ボタンのテスト
 *
 * GPSベースの報告ボタンの表示・非表示・クリック・無効状態・ローディング表示を検証。
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import MapFloatingControls from "@/components/map/map-floating-controls"

// useGamification フックをモック
vi.mock("@/hooks/use-gamification", () => ({
  useGamification: () => ({ points: 100, level: 3 }),
}))

vi.mock("@/components/map/map-style-selector", () => ({
  default: () => <div data-testid="map-style-selector" />,
}))

const defaultProps = {
  onAddReport: vi.fn(),
  isReportFormOpen: false,
  mapStyle: "streets-v12",
  setMapStyle: vi.fn(),
  is3DEnabled: false,
  toggle3DMode: vi.fn(),
  isSelectingLocation: false,
  onReportAtCurrentLocation: vi.fn(),
  isMobile: false,
}

describe("MapFloatingControls - 現在地で報告ボタン", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("デスクトップ", () => {
    it("onReportAtCurrentLocation が渡された場合、'現在地で報告' ボタンが表示されること", () => {
      render(<MapFloatingControls {...defaultProps} />)

      expect(
        screen.getByRole("button", { name: /現在地で報告/ })
      ).toBeInTheDocument()
    })

    it("'現在地で報告' ボタンクリックで onReportAtCurrentLocation が呼ばれること", () => {
      render(<MapFloatingControls {...defaultProps} />)

      fireEvent.click(
        screen.getByRole("button", { name: /現在地で報告/ })
      )

      expect(defaultProps.onReportAtCurrentLocation).toHaveBeenCalledTimes(1)
    })

    it("isReportFormOpen=true の場合、'現在地で報告' ボタンが非活性であること", () => {
      render(
        <MapFloatingControls {...defaultProps} isReportFormOpen={true} />
      )

      expect(
        screen.getByRole("button", { name: /現在地で報告/ })
      ).toBeDisabled()
    })

    it("isSelectingLocation=true の場合、'現在地で報告' ボタンが非活性であること", () => {
      render(
        <MapFloatingControls
          {...defaultProps}
          isSelectingLocation={true}
        />
      )

      expect(
        screen.getByRole("button", { name: /現在地で報告/ })
      ).toBeDisabled()
    })

    it("isAcquiringGPS=true の場合、ローディング表示になること", () => {
      render(
        <MapFloatingControls {...defaultProps} isAcquiringGPS={true} />
      )

      expect(
        screen.getByRole("button", { name: /位置取得中/ })
      ).toBeInTheDocument()
    })
  })

  describe("モバイル", () => {
    it("モバイルで '現在地で報告' ボタンが表示されること", () => {
      render(
        <MapFloatingControls {...defaultProps} isMobile={true} />
      )

      expect(
        screen.getByRole("button", { name: /現在地で報告/ })
      ).toBeInTheDocument()
    })

    it("モバイルで isAcquiringGPS=true の場合、ローディング表示になること", () => {
      render(
        <MapFloatingControls
          {...defaultProps}
          isMobile={true}
          isAcquiringGPS={true}
        />
      )

      expect(
        screen.getByRole("button", { name: /位置取得中/ })
      ).toBeInTheDocument()
    })
  })

  describe("onReportAtCurrentLocation 未指定時", () => {
    it("onReportAtCurrentLocation が undefined の場合、'現在地で報告' ボタンが表示されないこと", () => {
      const props = { ...defaultProps, onReportAtCurrentLocation: undefined }
      render(<MapFloatingControls {...props} />)

      expect(
        screen.queryByRole("button", { name: /現在地で報告/ })
      ).not.toBeInTheDocument()
    })
  })
})
