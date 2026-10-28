import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ReportRegionFilter } from "@/components/region/report-region-filter"
import { useReportRegionFilter } from "@/hooks/use-report-region-filter"
import {
  CITY_STORAGE_KEY,
  REGION_STORAGE_KEY,
  REPORT_REGION_STORAGE_KEY,
} from "@/lib/user-region"
import { REGION_REQUEST_TIMEOUT_MS } from "@/lib/region-request"

const STATUSES = ["approved"] as const
const REPORT_CITIES: Record<string, string[]> = {
  東京都: ["港区", "千代田区", "港区"],
  大阪府: ["大阪市"],
  鳥取県: [],
}

const fetchMock = vi.fn()
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })
const reportsFor = (input: string) => {
  const prefecture = new URL(input, "https://app.example").searchParams.get("prefecture") ?? ""
  return json({ reports: (REPORT_CITIES[prefecture] ?? []).map((city) => ({ city })) })
}
/** 中止されるまで応答しない(実際の fetch と同じく中止で AbortError を投げる) */
const stalled = (init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
  })
const storedReportRegion = () => JSON.parse(window.localStorage.getItem(REPORT_REGION_STORAGE_KEY) ?? "null")
const citySelect = () => screen.getByRole("combobox", { name: "市町村を選ぶ" })
const choosePrefecture = (prefecture: string) =>
  fireEvent.change(screen.getByRole("combobox", { name: "都道府県を選ぶ" }), { target: { value: prefecture } })

function Harness() {
  const region = useReportRegionFilter({
    client: null,
    table: "danger_reports_public_preview",
    statuses: STATUSES,
  })
  if (!region.mounted) return null
  return (
    <>
      <ReportRegionFilter
        prefecture={region.prefecture}
        city={region.city}
        school={region.school}
        cityOptions={region.cityOptions}
        cityOptionsState={region.cityOptionsState}
        onPrefectureChange={region.handlePrefectureChange}
        onCityChange={region.handleCityChange}
        onSchoolChange={region.handleSchoolChange}
      />
      <output data-testid="scope">{region.scopeLabel}</output>
    </>
  )
}

describe("報告一覧の地域フィルタ(フック+UI)", () => {
  beforeEach(() => {
    window.localStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: string) => reportsFor(input))
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("報告の無い県を選ぶと、市町村セレクトを隠さず無効にして理由を出す", async () => {
    render(<Harness />)

    choosePrefecture("鳥取県")

    expect(await screen.findByText("この都道府県の報告はまだありません")).toBeInTheDocument()
    expect(citySelect()).toBeDisabled()
  })

  it("市町村の候補が時間内に返らなければ理由と再読み込みを出し、再読み込みで回復する", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let stall = true
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) => (stall ? stalled(init) : reportsFor(input)))
    render(<Harness />)

    choosePrefecture("東京都")
    expect(citySelect()).toBeDisabled()
    expect(within(citySelect()).getByRole("option", { name: "読み込み中…" })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REGION_REQUEST_TIMEOUT_MS)
    })

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "市町村の候補を読み込めませんでした。時間内に応答がありませんでした。",
    )
    expect(within(citySelect()).queryByRole("option", { name: "読み込み中…" })).not.toBeInTheDocument()

    stall = false
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }))

    expect(await screen.findByRole("option", { name: "港区" })).toBeInTheDocument()
    expect(citySelect()).toBeEnabled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("県を切り替えると前の県の取得を中止し、前の県の市町村を出さない", async () => {
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) =>
      input.includes(encodeURIComponent("東京都")) ? stalled(init) : reportsFor(input))
    render(<Harness />)

    choosePrefecture("東京都")
    const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal
    choosePrefecture("大阪府")

    expect(firstSignal.aborted).toBe(true)
    expect(await screen.findByRole("option", { name: "大阪市" })).toBeInTheDocument()
    expect(within(citySelect()).queryByRole("option", { name: "港区" })).not.toBeInTheDocument()
  })

  it("選択は報告フィルタ専用のキーへ保存し、旧共有の市町村キーには書かない", async () => {
    render(<Harness />)

    choosePrefecture("東京都")
    await screen.findByRole("option", { name: "港区" })
    fireEvent.change(citySelect(), { target: { value: "港区" } })

    await waitFor(() => {
      expect(storedReportRegion()).toEqual({ prefecture: "東京都", lastCity: { prefecture: "東京都", city: "港区" } })
    })
    expect(window.localStorage.getItem(CITY_STORAGE_KEY)).toBeNull()
    // 都道府県は従来どおり「あなたの地域」にも反映する(Push購読・地図・ニュースの既定)
    expect(window.localStorage.getItem(REGION_STORAGE_KEY)).toBe("東京都")
  })

  it("旧共有キーから県と市町村を引き継いで復元する", async () => {
    window.localStorage.setItem(REGION_STORAGE_KEY, "東京都")
    window.localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify({ prefecture: "東京都", city: "港区" }))

    render(<Harness />)

    await screen.findByRole("option", { name: "港区" })
    expect(citySelect()).toHaveValue("港区")
    expect(screen.getByTestId("scope")).toHaveTextContent("東京都港区")
    expect(storedReportRegion()).toEqual({ prefecture: "東京都", lastCity: { prefecture: "東京都", city: "港区" } })
  })

  it("別の県を見てから戻ると、その県で最後に選んだ市町村を復元する", async () => {
    render(<Harness />)

    choosePrefecture("東京都")
    await screen.findByRole("option", { name: "港区" })
    fireEvent.change(citySelect(), { target: { value: "港区" } })

    choosePrefecture("大阪府")
    await screen.findByRole("option", { name: "大阪市" })
    expect(citySelect()).toHaveValue("")

    choosePrefecture("東京都")
    await screen.findByRole("option", { name: "港区" })
    expect(citySelect()).toHaveValue("港区")
    expect(screen.getByTestId("scope")).toHaveTextContent("東京都港区")
  })
})
