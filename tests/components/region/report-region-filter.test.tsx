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
