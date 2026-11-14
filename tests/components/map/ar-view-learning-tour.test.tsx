import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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

describe("ARView の情報切り替えタブ", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useARCamera.mockReturnValue({
      videoRef: { current: null }, isCameraActive: true, isLoading: false, loadingStep: "",
      estimatedFov: null, cameraPermission: true, error: null, stopCamera: vi.fn(), retry: vi.fn(),
    })
    mocks.useARLocation.mockReturnValue({
      userLocation: { lat: 35.6895, lon: 139.6917, accuracy: 12 }, locationPermission: true, error: null, retry: vi.fn(),
    })
    mocks.useAROrientation.mockReturnValue({
      userHeading: 0, orientationPermission: true, error: null, retry: vi.fn(),
    })
  })

  it("通常モードでは中身が読める名前と、近くの報告の件数を出す", () => {
    render(
      <ARView
        mode={{
          kind: "nearby",
          reports: [
            createMockDangerReport({ id: "r1", title: "フェンスの倒壊", latitude: 35.6896, longitude: 139.6917 }),
            createMockDangerReport({ id: "r2", title: "見通しの悪い交差点", latitude: 35.68955, longitude: 139.6918 }),
          ],
        }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "事故と浸水の公的データ" })).toBeInTheDocument()
    const reports = screen.getByRole("button", { name: "みんなの報告（近くに2件）" })
    expect(reports).toBeInTheDocument()
    expect(reports).toHaveTextContent("2")
    expect(screen.queryByRole("button", { name: "投稿の学習" })).not.toBeInTheDocument()
  })

  it("親子モードでは学習であることが分かる名前にする", async () => {
    const user = userEvent.setup()
    render(
      <ARView
        mode={{
          kind: "parent_child_route", routeId: "route-1", routeName: "通学路A",
          childId: "child-sakura", childName: "さくら", sessionId: "session-1",
          reports: [createMockDangerReport({ id: "r1", latitude: 35.6896, longitude: 139.6917 })],
        }}
        onClose={vi.fn()}
      />,
    )
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "同意して開始" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "通学路の学習" })).toBeInTheDocument())
  })
})

describe("ARView の位置情報待ちの案内", () => {
  const camera = {
    videoRef: { current: null }, isCameraActive: true, isLoading: false, loadingStep: "",
    estimatedFov: null, cameraPermission: true, error: null, stopCamera: vi.fn(), retry: vi.fn(),
  }
  const orientation = { userHeading: 0, orientationPermission: true, error: null, retry: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useARCamera.mockReturnValue(camera)
    mocks.useAROrientation.mockReturnValue(orientation)
  })

  it("位置が取れるまでは、黙って空にせず取得中だと伝える", () => {
    mocks.useARLocation.mockReturnValue({
      userLocation: null, locationPermission: false, timedOut: false, error: null, retry: vi.fn(),
    })
    render(<ARView mode={{ kind: "nearby", reports: [] }} onClose={vi.fn()} />)

    expect(screen.getByText("位置情報を取得しています…")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "実事故と浸水想定" })).not.toBeInTheDocument()
  })

  it("時間切れのときは理由と再取得の操作を出す", () => {
    const retry = vi.fn()
    mocks.useARLocation.mockReturnValue({
      userLocation: null, locationPermission: false, timedOut: true, error: null, retry,
    })
    render(<ARView mode={{ kind: "nearby", reports: [] }} onClose={vi.fn()} />)

    expect(screen.getByText("位置情報を取得できません")).toBeInTheDocument()
    expect(screen.getByText(/位置情報サービス/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "位置情報をもう一度取得する" }))
    expect(retry).toHaveBeenCalled()
  })

  it("位置が取れたら案内を消す", () => {
    mocks.useARLocation.mockReturnValue({
      userLocation: { lat: 35.6895, lon: 139.6917, accuracy: 12 }, locationPermission: true, timedOut: false, error: null, retry: vi.fn(),
    })
    render(<ARView mode={{ kind: "nearby", reports: [] }} onClose={vi.fn()} />)

    expect(screen.queryByText("位置情報を取得しています…")).not.toBeInTheDocument()
    expect(screen.queryByText("位置情報を取得できません")).not.toBeInTheDocument()
  })
})

// 最後の地点を「あとで見返す」にすると回り終えたことになり、報告のシートが消える。
// それでも振り返りから、その地点の写真と確認ポイントを開き直せること
describe("ARView 回り終えたあとの見返し", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useARCamera.mockReturnValue({
      videoRef: { current: null }, isCameraActive: true, isLoading: false, loadingStep: "",
      estimatedFov: null, cameraPermission: true, error: null, stopCamera: vi.fn(), retry: vi.fn(),
    })
    mocks.useAROrientation.mockReturnValue({ userHeading: 0, orientationPermission: true, error: null, retry: vi.fn() })
    mocks.useARLocation.mockReturnValue({
      userLocation: { lat: 35.6895, lon: 139.6917, accuracy: 12 }, locationPermission: true, timedOut: false, error: null, retry: vi.fn(),
    })
  })

  it("振り返りから地点を開き直し、「確認した」に変えて振り返りへ戻れる", async () => {
    const user = userEvent.setup()
    render(
      <ARView
        mode={{
          kind: "nearby",
          reports: [
            createMockDangerReport({
              id: "danger-last",
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

    await user.click(screen.getByRole("button", { name: /みんなの報告/ }))
    await user.click(await screen.findByRole("button", { name: "あとで見返す" }))

    // 回り終えた: 報告のシートは消え、振り返りが出る
    expect(await screen.findByText("通学路の振り返り")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "あとで見返す" })).not.toBeInTheDocument()

    // 振り返りから開き直す
    await user.click(screen.getByRole("button", { name: "見通しの悪い交差点 をもう一度見る" }))
    expect(screen.queryByText("通学路の振り返り")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ふりかえりにもどる" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /くわしく見る/ })).toBeInTheDocument()

    // 「確認した」に変えると振り返りへ戻り、見返す地点は無くなる
    await user.click(screen.getByRole("button", { name: "確認した" }))
    expect(await screen.findByText("通学路の振り返り")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "見通しの悪い交差点 をもう一度見る" })).not.toBeInTheDocument()
  })

  it("開き直したあと、何も変えずに振り返りへ戻れる", async () => {
    const user = userEvent.setup()
    render(
      <ARView
        mode={{
          kind: "nearby",
          reports: [createMockDangerReport({ id: "danger-last", title: "見通しの悪い交差点", danger_type: "traffic", latitude: 35.6896, longitude: 139.6917 })],
        }}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: /みんなの報告/ }))
    await user.click(await screen.findByRole("button", { name: "あとで見返す" }))
    await user.click(await screen.findByRole("button", { name: "見通しの悪い交差点 をもう一度見る" }))
    await user.click(screen.getByRole("button", { name: "ふりかえりにもどる" }))

    expect(await screen.findByText("通学路の振り返り")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "見通しの悪い交差点 をもう一度見る" })).toBeInTheDocument()
  })
})
