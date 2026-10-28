import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ReportRegionFilter } from "@/components/region/report-region-filter"
import { ALL_PREFECTURES, NATIONWIDE } from "@/lib/user-region"

const mocks = vi.hoisted(() => ({
  searchSchools: vi.fn(),
}))

vi.mock("@/lib/school-search", async () => {
  const actual = await vi.importActual<typeof import("@/lib/school-search")>(
    "@/lib/school-search",
  )
  return {
    ...actual,
    searchSchools: mocks.searchSchools,
  }
})

function renderFilter(overrides: Partial<Parameters<typeof ReportRegionFilter>[0]> = {}) {
  const props = {
    prefecture: NATIONWIDE,
    city: null,
    school: null,
    cityOptions: [] as string[],
    onPrefectureChange: vi.fn(),
    onCityChange: vi.fn(),
    onSchoolChange: vi.fn(),
    ...overrides,
  }
  const view = render(<ReportRegionFilter {...props} />)
  return { props, view }
}

describe("ReportRegionFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("都道府県プルダウンに全国+47都道府県すべてが並ぶ", () => {
    renderFilter()

    const select = screen.getByRole("combobox", { name: "都道府県を選ぶ" })
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.value)
    expect(options).toHaveLength(48)
    expect(options[0]).toBe(NATIONWIDE)
    for (const pref of ALL_PREFECTURES) {
      expect(options).toContain(pref)
    }
  })

  it("プルダウンでクイックチップに無い県も選べる", () => {
    const { props } = renderFilter()

    fireEvent.change(screen.getByRole("combobox", { name: "都道府県を選ぶ" }), {
      target: { value: "鳥取県" },
    })

    expect(props.onPrefectureChange).toHaveBeenCalledWith("鳥取県")
  })

  it("クイックチップの押下で県が切り替わる", () => {
    const { props } = renderFilter()

    fireEvent.click(screen.getByRole("button", { name: "東京都" }))

    expect(props.onPrefectureChange).toHaveBeenCalledWith("東京都")
  })

  it("全国選択中は市町村セレクトを出さない", () => {
    renderFilter({ cityOptions: ["千代田区"] })

    expect(screen.queryByRole("combobox", { name: "市町村を選ぶ" })).not.toBeInTheDocument()
  })

  it("復元した市町村が選択肢に無くても選択中として表示する", () => {
    renderFilter({
      prefecture: "東京都",
      city: "謎の市",
      cityOptions: ["千代田区"],
    })

    const select = screen.getByRole("combobox", { name: "市町村を選ぶ" }) as HTMLSelectElement
    expect(select.value).toBe("謎の市")
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.value)
    expect(values).toEqual(["", "千代田区", "謎の市"])
  })

  it("県選択中は市町村セレクトが出て選択を通知する", () => {
    const { props } = renderFilter({
      prefecture: "東京都",
      cityOptions: ["千代田区", "港区"],
    })

    const select = screen.getByRole("combobox", { name: "市町村を選ぶ" })
    fireEvent.change(select, { target: { value: "港区" } })
    expect(props.onCityChange).toHaveBeenCalledWith("港区")

    fireEvent.change(select, { target: { value: "" } })
    expect(props.onCityChange).toHaveBeenCalledWith(null)
  })

  it("学校検索 → 結果選択で onSchoolChange に座標付きで渡す", async () => {
    mocks.searchSchools.mockResolvedValue([
      {
        id: "poi-1",
        name: "テスト小学校",
        address: "東京都千代田区1-1",
        latitude: 35.68,
        longitude: 139.76,
      },
    ])
    const { props } = renderFilter()

    fireEvent.change(screen.getByRole("textbox", { name: "学校名で探す" }), {
      target: { value: "テスト小学校" },
    })
    fireEvent.click(screen.getByRole("button", { name: "学校を検索" }))

    const result = await screen.findByRole("button", { name: /テスト小学校/ })
    fireEvent.click(result)

    expect(props.onSchoolChange).toHaveBeenCalledWith({
      id: "poi-1",
      name: "テスト小学校",
      latitude: 35.68,
      longitude: 139.76,
    })
    expect(mocks.searchSchools).toHaveBeenCalledWith(
      "テスト小学校",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it("新しい学校検索を始めると前回を中止し、古い結果で上書きしない", async () => {
    let resolveFirst: (value: unknown[]) => void = () => {}
    const firstResult = new Promise<unknown[]>((resolve) => {
      resolveFirst = resolve
    })
    mocks.searchSchools
      .mockReturnValueOnce(firstResult)
      .mockResolvedValueOnce([
        {
          id: "poi-new",
          name: "新しい小学校",
          address: "東京都",
          latitude: 35.68,
          longitude: 139.76,
        },
      ])
    renderFilter()

    const input = screen.getByRole("textbox", { name: "学校名で探す" })
    const form = input.closest("form")
    expect(form).not.toBeNull()

    fireEvent.change(input, { target: { value: "古い小学校" } })
    fireEvent.submit(form!)
    const firstSignal = mocks.searchSchools.mock.calls[0][1].signal as AbortSignal

    fireEvent.change(input, { target: { value: "新しい小学校" } })
    fireEvent.submit(form!)

    expect(firstSignal.aborted).toBe(true)
    expect(await screen.findByRole("button", { name: /新しい小学校/ })).toBeInTheDocument()

    resolveFirst([
      {
        id: "poi-old",
        name: "古い小学校",
        address: "東京都",
        latitude: 35.67,
        longitude: 139.75,
      },
    ])
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /古い小学校/ })).not.toBeInTheDocument()
    })
  })

  it("学校検索中にアンマウントするとリクエストを中止する", () => {
    mocks.searchSchools.mockReturnValue(new Promise(() => {}))
    const { view } = renderFilter()

    fireEvent.change(screen.getByRole("textbox", { name: "学校名で探す" }), {
      target: { value: "テスト小学校" },
    })
    fireEvent.click(screen.getByRole("button", { name: "学校を検索" }))
    const signal = mocks.searchSchools.mock.calls[0][1].signal as AbortSignal

    view.unmount()

    expect(signal.aborted).toBe(true)
  })

  it("検索が失敗したらエラーメッセージを表示する", async () => {
    mocks.searchSchools.mockRejectedValue(new Error("boom"))
    renderFilter()

    fireEvent.change(screen.getByRole("textbox", { name: "学校名で探す" }), {
      target: { value: "テスト小学校" },
    })
    fireEvent.click(screen.getByRole("button", { name: "学校を検索" }))

    await waitFor(() => {
      expect(
        screen.getByText("学校検索を利用できませんでした。時間をおいてお試しください。"),
      ).toBeInTheDocument()
    })
  })

  it("0件ならその旨を表示する", async () => {
    mocks.searchSchools.mockResolvedValue([])
    renderFilter()

    fireEvent.change(screen.getByRole("textbox", { name: "学校名で探す" }), {
      target: { value: "存在しない学校" },
    })
    fireEvent.click(screen.getByRole("button", { name: "学校を検索" }))

    await waitFor(() => {
      expect(
        screen.getByText("学校が見つかりませんでした。名称を変えてお試しください。"),
      ).toBeInTheDocument()
    })
  })

  describe("市町村セレクトの読み込み状態", () => {
    const state = (status: "loading" | "ready" | "error", errorMessage: string | null = null) => ({
      status,
      errorMessage,
      retry: vi.fn(),
    })

    it("報告の無い県でも市町村セレクトを出し、理由を添えて無効にする", () => {
      renderFilter({ prefecture: "鳥取県", cityOptions: [], cityOptionsState: state("ready") })

      const select = screen.getByRole("combobox", { name: "市町村を選ぶ" })
      expect(select).toBeDisabled()
      expect(screen.getByText("市区町村で絞り込める報告はまだありません")).toBeInTheDocument()
      expect(select).toHaveAccessibleDescription("市区町村で絞り込める報告はまだありません")
    })

    it("読み込み状態を渡さない呼び出しでも、県を選んだら市町村セレクトを隠さない", () => {
      renderFilter({ prefecture: "鳥取県", cityOptions: [] })

      expect(screen.getByRole("combobox", { name: "市町村を選ぶ" })).toBeDisabled()
      expect(screen.getByText("市区町村で絞り込める報告はまだありません")).toBeInTheDocument()
    })

    it("読み込み中は「読み込み中…」だけを出して無効にし、前の選択肢や復元値を並べない", () => {
      renderFilter({
        prefecture: "大阪府",
        city: "千代田区",
        cityOptions: ["千代田区"],
        cityOptionsState: state("loading"),
      })

      const select = screen.getByRole("combobox", { name: "市町村を選ぶ" })
      expect(select).toBeDisabled()
      const labels = Array.from(select.querySelectorAll("option")).map((o) => o.textContent)
      expect(labels).toEqual(["読み込み中…"])
      expect(screen.queryByText("市区町村で絞り込める報告はまだありません")).not.toBeInTheDocument()
    })

    it("読み込みに失敗したら理由と「もう一度読み込む」を出し、押すと再読み込みする", () => {
      const failed = state("error", "時間内に応答がありませんでした。通信状況を確かめて、もう一度お試しください。")
      renderFilter({ prefecture: "東京都", cityOptions: [], cityOptionsState: failed })

      const select = screen.getByRole("combobox", { name: "市町村を選ぶ" })
      expect(select).toBeDisabled()
      expect(screen.getByRole("alert")).toHaveTextContent(
        "市区町村の一覧を読み込めませんでした。時間内に応答がありませんでした。",
      )
      expect(screen.queryByText("市区町村で絞り込める報告はまだありません")).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }))
      expect(failed.retry).toHaveBeenCalledTimes(1)
    })

    it("読み込みに失敗しても、復元した市町村は「すべて」に戻せる", () => {
      const { props } = renderFilter({
        prefecture: "東京都",
        city: "港区",
        cityOptions: [],
        cityOptionsState: state("error", "通信できませんでした。インターネット接続を確かめてください。"),
      })

      const select = screen.getByRole("combobox", { name: "市町村を選ぶ" })
      expect(select).toBeEnabled()
      expect(select).toHaveValue("港区")
      fireEvent.change(select, { target: { value: "" } })
      expect(props.onCityChange).toHaveBeenCalledWith(null)
    })
  })

  it("学校選択中はチップと解除ボタンを表示し、解除で null を通知する", () => {
    const { props } = renderFilter({
      school: { id: "poi-1", name: "テスト小学校", latitude: 35.68, longitude: 139.76 },
    })

    expect(screen.getByText("テスト小学校")).toBeInTheDocument()
    expect(screen.getByText(/周辺2kmの報告を表示中/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "学校の絞り込みを解除" }))
    expect(props.onSchoolChange).toHaveBeenCalledWith(null)
  })
})
