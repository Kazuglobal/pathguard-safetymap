import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import DangerReportForm from "@/components/danger-report/danger-report-form"
import type { VlmAnalysisResult } from "@/lib/vlm-analysis"

const mockVlmResult: VlmAnalysisResult = {
  hazards: [
    {
      category: "traffic",
      severity: 4,
      description_ja: "車がスピードを出して通過します",
      description_en: "Cars pass through at high speed",
      child_specific_risk: "子どもの背丈だと運転手から見えにくい",
      recommendation: "白線の内側で待つよう声かけする",
    },
  ],
  overall_safety_score: 58,
  overall_risk_level: 3,
  child_perspective_summary: "車が急に見えて、子どもが判断しづらい場所です。",
  time_weather_risks: {},
  improvement_suggestions: {
    immediate_actions: ["白線の内側を歩く"],
  },
}

const mocks = vi.hoisted(() => ({
  supabase: { from: vi.fn(), rpc: vi.fn() } as any,
  toast: vi.fn(),
  fetchStats: vi.fn(),
  resetAccidentStats: vi.fn(),
  hookState: { enrichCallCount: 0 },
  accidentStats: { total_accidents: 3 } as any,
  startVlmAnalysis: vi.fn(async () => undefined),
  retryVlmAnalysis: vi.fn(async () => undefined),
  resetVlmAnalysis: vi.fn(),
  enrichReportWithAccidents: vi.fn(),
  vlmHookState: {
    status: "idle" as const | "analyzing" | "completed" | "failed",
    result: null as VlmAnalysisResult | null,
    error: null as string | null,
  },
}))

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: vi.fn(() => ({ supabase: mocks.supabase })),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: mocks.toast })),
}))

vi.mock("@/lib/image-utils", () => ({
  compressImage: vi.fn(async (file: File) => file),
  fileToBase64: vi.fn(async () => "data:image/png;base64,AAAA"),
}))

vi.mock("@/lib/disaster-scenario-prompts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/disaster-scenario-prompts")>(
    "@/lib/disaster-scenario-prompts"
  )

  return {
    ...actual,
    allPrompts: [
      {
        id: "child-1",
        name: "避難ルート重ね地図",
        shortName: "子ども①",
        description: "test prompt",
        prompt: "test prompt",
        targetAudience: "children",
      },
    ],
  }
})

vi.mock("@/hooks/use-vlm-analysis", () => ({
  useVlmAnalysis: vi.fn(() => ({
    status: mocks.vlmHookState.status,
    result: mocks.vlmHookState.result,
    error: mocks.vlmHookState.error,
    startAnalysis: mocks.startVlmAnalysis,
    retry: mocks.retryVlmAnalysis,
    reset: mocks.resetVlmAnalysis,
  })),
}))

vi.mock("@/hooks/use-accident-stats", async () => {
  const ReactModule = await import("react")

  return {
    useAccidentStats: () => {
      const [status, setStatus] = ReactModule.useState<"idle" | "loading" | "loaded" | "error">("loaded")

      const enrichReport = ReactModule.useCallback(async () => {
        mocks.hookState.enrichCallCount += 1
        setStatus("loading")
        return new Promise(() => {}) as Promise<never>
      }, [])

      return {
        stats: mocks.accidentStats,
        status,
        error: null,
        isLoading: status === "loading",
        hasData: true,
        fetchStats: mocks.fetchStats,
        enrichReport,
        reset: mocks.resetAccidentStats,
      }
    },
  }
})

vi.mock("@/components/danger-report/accident-stats-panel", () => ({
  default: () => <div data-testid="accident-panel">accident-panel</div>,
  AccidentStatsPanel: () => <div data-testid="accident-panel">accident-panel</div>,
  AccidentStatsLoading: () => <div data-testid="accident-loading">accident-loading</div>,
}))

vi.mock("@/components/danger-report/vlm-analysis-panel", () => ({
  VlmAnalysisPanel: () => null,
}))

vi.mock("@/components/danger-report/image-preview-dialog", () => ({
  default: () => null,
}))

vi.mock("@/lib/traffic-accident-data", () => ({
  enrichReportWithAccidents: mocks.enrichReportWithAccidents,
}))

describe("DangerReportForm", () => {
  const originalCreateObjectUrl = URL.createObjectURL
  const originalRevokeObjectUrl = URL.revokeObjectURL

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "get_hazard_zones_at_point") {
        return {
          data: [{
            id: "zone-1",
            hazard_type: "flood",
            source_layer: "国土数値情報 A31",
            risk_level: 2,
            depth_min_m: 0.5,
            depth_max_m: 3,
            area_context: "residential-school-route",
          }],
          error: null,
        }
      }
      return { data: true, error: null }
    })
    mocks.hookState.enrichCallCount = 0
    mocks.accidentStats = { total_accidents: 3 }
    mocks.fetchStats.mockResolvedValue({ total_accidents: 3 })
    mocks.enrichReportWithAccidents.mockResolvedValue({ id: "report-123" })
    mocks.vlmHookState.status = "idle"
    mocks.vlmHookState.result = null
    mocks.vlmHookState.error = null
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl
    URL.revokeObjectURL = originalRevokeObjectUrl
    vi.unstubAllGlobals()
  })

  /** ウィザードを「おくる」ステップまで進める */
  const goToSendStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByTestId("wizard-next")) // きけん → しゃしん
    await user.click(screen.getByTestId("wizard-next")) // しゃしん → おくる
  }

  const uploadOriginalPhoto = async (
    user: ReturnType<typeof userEvent.setup>,
    container: HTMLElement,
  ) => {
    URL.createObjectURL = vi.fn(() => "blob:original") as typeof URL.createObjectURL
    await user.click(screen.getByTestId("wizard-next"))
    const originalInput = container.querySelectorAll('input[type="file"]')[0] as HTMLInputElement
    const pngFile = new File(
      [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "school-route.png",
      { type: "image/png" },
    )
    await user.upload(originalInput, pngFile)
  }

  it("keeps accident stats panel stable after submit and bypasses hook enrich state", async () => {
    const onSubmit = vi.fn(async () => ({ reportId: "report-123", imageUrl: null }))
    const onCancel = vi.fn()
    const user = userEvent.setup()

    render(
      <DangerReportForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        selectedLocation={[139.7004, 35.6595]}
      />
    )

    await waitFor(() => {
      expect(mocks.resetAccidentStats).toHaveBeenCalled()
      expect(mocks.fetchStats).toHaveBeenCalledWith({
        latitude: 35.6595,
        longitude: 139.7004,
      })
    })

    await goToSendStep(user)

    expect(screen.getByTestId("accident-panel")).toBeInTheDocument()
    expect(screen.queryByTestId("accident-loading")).not.toBeInTheDocument()

    await user.type(screen.getByRole("textbox", { name: "この場所の名前" }), "交差点の見通しが悪い")
    await user.click(screen.getByTestId("wizard-submit"))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(mocks.enrichReportWithAccidents).toHaveBeenCalledWith("report-123")
    })

    expect(mocks.hookState.enrichCallCount).toBe(0)
    expect(screen.queryByTestId("accident-loading")).not.toBeInTheDocument()
  })

  it("selected route context is shown and included in submit payload", async () => {
    const onSubmit = vi.fn(async () => ({ reportId: "report-456", imageUrl: null }))
    const user = userEvent.setup()

    render(
      <DangerReportForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        selectedLocation={[139.7004, 35.6595]}
        selectedRouteId="route-1"
        selectedRouteName="さくらの通学路"
      />
    )

    expect(screen.getByTestId("route-report-context")).toHaveTextContent("さくらの通学路")

    await goToSendStep(user)
    await user.type(screen.getByRole("textbox", { name: "この場所の名前" }), "見通しの悪い角")
    await user.click(screen.getByTestId("wizard-submit"))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          route_context_id: "route-1",
          route_context_name: "さくらの通学路",
        })
      )
    })
  })

  it("renders a quick simulation summary before submit when analysis is ready", async () => {
    mocks.vlmHookState.status = "completed"
    mocks.vlmHookState.result = mockVlmResult
    const user = userEvent.setup()

    render(
      <DangerReportForm
        onSubmit={vi.fn(async () => ({ reportId: "report-789", imageUrl: null }))}
        onCancel={vi.fn()}
        selectedLocation={[139.7004, 35.6595]}
      />
    )

    await user.click(screen.getByTestId("wizard-next")) // きけん → しゃしん

    expect(screen.getByText("シミュレーション要約")).toBeInTheDocument()
    expect(screen.getByText("危険要約")).toBeInTheDocument()
    expect(screen.getByText("回避行動")).toBeInTheDocument()
    expect(screen.queryByText("投稿前プレビュー")).not.toBeInTheDocument()
    expect(screen.getByText("車が急に見えて、子どもが判断しづらい場所です。")).toBeInTheDocument()
    expect(screen.getByText("白線の内側を歩く")).toBeInTheDocument()
  })

  it("starts the hazard analysis request after the manual analysis button is clicked", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ hazards: [] }),
      text: async () => "",
    }))
    vi.stubGlobal("fetch", fetchMock)

    const { container, unmount } = render(
      <DangerReportForm
        onSubmit={vi.fn(async () => ({ reportId: "report-analysis", imageUrl: null }))}
        onCancel={vi.fn()}
        selectedLocation={[139.7004, 35.6595]}
      />
    )

    await user.click(screen.getByTestId("wizard-next"))
    const originalInput = container.querySelectorAll('input[type="file"]')[0] as HTMLInputElement
    const pngFile = new File(
      [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "manual-analysis.png",
      { type: "image/png" }
    )
    await user.upload(originalInput, pngFile)
    await user.click(await screen.findByTestId("analyze-photo"))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/hazard-game/analyze",
        expect.objectContaining({ method: "POST" }),
      )
    })

    unmount()
  })

  it("creates an independent processed preview url when adding a batch image to the report", async () => {
    const user = userEvent.setup()
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:batch-result")
      .mockReturnValueOnce("blob:report-added")
    const revokeObjectURL = vi.fn()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        images: [{ dataUrl: "data:image/png;base64,AAAA" }],
      }),
    }))

    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", vi.fn(() => true))
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL

    const { container } = render(
      <DangerReportForm
        onSubmit={vi.fn(async () => ({ reportId: "report-999", imageUrl: null }))}
        onCancel={vi.fn()}
        selectedLocation={[139.7004, 35.6595]}
      />
    )

    await user.click(screen.getByTestId("wizard-next")) // きけん → しゃしん
    await screen.findByText(/ばしょの しゃしんを とろう/)

    const originalInput = container.querySelectorAll('input[type="file"]')[0] as HTMLInputElement
    const pngFile = new File(
      [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "school-route.png",
      { type: "image/png" }
    )
    await user.upload(originalInput, pngFile)


    await screen.findByTestId("analyze-photo")
    // くわしい設定(防災プロンプト・一括生成)を開く
    await user.click(screen.getByRole("button", { name: /くわしい設定/ }))
    await user.click(await screen.findByRole("button", { name: "全プロンプト一括生成（1件）" }))

    const batchThumbnail = await screen.findByAltText("避難ルート重ね地図")
    expect(batchThumbnail).toHaveAttribute("src", "blob:batch-result")

    await user.click(batchThumbnail)

    const processedPreview = await screen.findByAltText("かこう画像 1")
    expect(processedPreview).toHaveAttribute("src", "blob:report-added")
    expect(createObjectURL).toHaveBeenCalledTimes(2)

    const deleteButtons = screen.getAllByRole("button", { name: "この画像を けす" })
    await user.click(deleteButtons.at(-1)!)

    await waitFor(() => {
      expect(screen.queryByAltText("かこう画像 1")).not.toBeInTheDocument()
    })
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report-added")
    expect(screen.getByAltText("避難ルート重ね地図")).toHaveAttribute("src", "blob:batch-result")
  })

  it("disables flood simulation outside the mapped zone with the non-safety warning", async () => {
    mocks.supabase.rpc.mockImplementation(async (name: string) =>
      name === "get_hazard_zones_at_point"
        ? { data: [], error: null }
        : { data: true, error: null },
    )
    const user = userEvent.setup()
    const { container } = render(
      <DangerReportForm
        onSubmit={vi.fn(async () => ({ reportId: "report-outside", imageUrl: null }))}
        onCancel={vi.fn()}
        selectedLocation={[140.74, 40.82]}
      />,
    )

    await uploadOriginalPhoto(user, container)

    const floodButton = await screen.findByRole("button", { name: "冠水" })
    await waitFor(() => expect(floodButton).toBeDisabled())
    expect(floodButton).toHaveAttribute(
      "title",
      "この地点は洪水・津波の浸水想定区域外のため、浸水シミュレーション画像は生成できません。※区域外であることは安全を保証するものではありません",
    )
    expect(mocks.supabase.rpc).toHaveBeenCalledWith(
      "get_hazard_zones_at_point",
      expect.objectContaining({
        p_longitude: 140.74,
        p_latitude: 40.82,
        p_hazard_type: "flood",
        p_tolerance_m: 0,
      }),
    )
  })

  it("shows official flood depth and source when the selected point is inside", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <DangerReportForm
        onSubmit={vi.fn(async () => ({ reportId: "report-inside", imageUrl: null }))}
        onCancel={vi.fn()}
        selectedLocation={[140.74, 40.82]}
      />,
    )

    await uploadOriginalPhoto(user, container)

    const floodButton = await screen.findByRole("button", { name: "冠水" })
    await waitFor(() => expect(floodButton).toBeEnabled())
    expect(screen.getByText("洪水浸水想定区域内（想定浸水深 0.5〜3.0m）")).toBeInTheDocument()
    expect(screen.getByText(
      "この地点の想定最大浸水深: 3.0m（出典: 国土数値情報 A31）※画像は表現を抑えたイメージです",
    )).toBeInTheDocument()
  })

  it("enables the accident-data situation when nearby accident statistics exist", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <DangerReportForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        selectedLocation={[139.7004, 35.6595]}
      />
    )

    await uploadOriginalPhoto(user, container)

    const accidentButton = await screen.findByRole("button", { name: "じこデータ" })
    expect(accidentButton).toBeEnabled()
    expect(accidentButton).not.toHaveAttribute("title")
  })

  it("sends only the accident situation and point context when regenerating", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/gemini/generate-image") {
        return {
          ok: true,
          json: async () => ({ images: [] }),
        }
      }
      throw new Error(`unexpected request: ${String(input)}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(
      <DangerReportForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        selectedLocation={[139.7004, 35.6595]}
      />
    )

    await uploadOriginalPhoto(user, container)
    await user.click(await screen.findByRole("button", { name: "じこデータ" }))
    await user.click(screen.getByRole("button", { name: "この「もしも」で つくる" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gemini/generate-image",
        expect.objectContaining({ method: "POST" }),
      )
    })
    const imageCall = fetchMock.mock.calls.find(([input]) => String(input) === "/api/gemini/generate-image")
    const formData = imageCall?.[1]?.body as FormData
    expect(formData.get("situation")).toBe("accident")
    expect(formData.get("longitude")).toBe("139.7004")
    expect(formData.get("latitude")).toBe("35.6595")
    expect(formData.get("prompt")).toContain("客観的な交通事故統計")
    expect([...formData.keys()]).not.toContain("accidentStats")
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/gemini/generate-prompts")).toBe(false)
  })

  it("disables the accident-data situation when nearby accident statistics are empty", async () => {
    mocks.accidentStats = { total_accidents: 0 }
    const user = userEvent.setup()
    const { container } = render(
      <DangerReportForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        selectedLocation={[139.7004, 35.6595]}
      />
    )

    await uploadOriginalPhoto(user, container)

    const accidentButton = await screen.findByRole("button", { name: "じこデータ" })
    expect(accidentButton).toBeDisabled()
    expect(accidentButton).toHaveAttribute(
      "title",
      "この地点周辺の事故統計データはありません",
    )
  })
})
