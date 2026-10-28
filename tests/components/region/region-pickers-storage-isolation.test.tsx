import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LocalSafetyAlertsSection } from "@/components/landing/LocalSafetyAlertsSection"
import { ReportRegionFilter } from "@/components/region/report-region-filter"
import { useReportRegionFilter } from "@/hooks/use-report-region-filter"
import {
  ALERTS_REGION_STORAGE_KEY,
  CITY_STORAGE_KEY,
  REGION_STORAGE_KEY,
  REPORT_REGION_STORAGE_KEY,
} from "@/lib/user-region"

// 地域アラート(学区マスターの市区町村名)と報告フィルタ(報告データの city)を
// 同じ画面に並べ、片方の選択・検証がもう片方の保存値を消さないことを確かめる。

vi.mock("@/hooks/use-push-subscription", () => ({ syncPushSubscriptionRegion: vi.fn() }))

const STATUSES = ["approved"] as const
const district = {
  id: "13104:B1",
  municipalityCode: "13104",
  schoolCode: "B1",
  prefecture: "東京都",
  city: "新宿区",
  name: "第一小学校",
  dataYear: 2023,
  sourceUrl: "https://nlftp.mlit.go.jp/",
}
// 学区マスターの東京都には新宿区だけがある。報告データ側の市町村は港区・大阪市
const SCHOOL_CITIES: Record<string, string[]> = { 東京都: ["新宿区"], 大阪府: ["大阪市"] }
const REPORT_CITIES: Record<string, string[]> = { 東京都: ["港区"], 大阪府: ["大阪市"] }

const fetchMock = vi.fn()
const json = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } })
function respond(input: string) {
  const url = new URL(input, "https://app.example")
  const prefecture = url.searchParams.get("prefecture") ?? ""
  if (url.pathname === "/api/school-districts") {
    const city = url.searchParams.get("city")
    return json({
      cities: SCHOOL_CITIES[prefecture] ?? [],
      districts: city === "新宿区" ? [district] : [],
    })
  }
  if (url.pathname === "/api/reports") {
    return json({ reports: (REPORT_CITIES[prefecture] ?? []).map((city) => ({ city })) })
  }
  return json({ alerts: [] })
}

function ReportPicker() {
  const region = useReportRegionFilter({ client: null, table: "danger_reports_public_preview", statuses: STATUSES })
  if (!region.mounted) return null
  return (
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
  )
}

function Page() {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <LocalSafetyAlertsSection />
      <ReportPicker />
    </SWRConfig>
  )
}

const alertsCity = () => screen.getByLabelText("市区町村")
const reportCity = () => screen.getByRole("combobox", { name: "市町村を選ぶ" })
const read = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? "null")

describe("地域アラートと報告フィルタの保存の分離", () => {
  beforeEach(() => {
    window.localStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: string) => respond(input))
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("地域アラートが学区マスターに無い市町村を外しても、報告フィルタの市町村は消えない", async () => {
    // 旧版で報告フィルタが共有キーへ書いた状態(港区は学区マスターに無い)
    window.localStorage.setItem(REGION_STORAGE_KEY, "東京都")
    window.localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify({ prefecture: "東京都", city: "港区" }))

    const view = render(<Page />)

    // 地域アラートの市区町村一覧が届き、港区を検証した後でも…
    await screen.findByRole("option", { name: "新宿区" })
    await screen.findByRole("option", { name: "港区" })
    // …報告フィルタの保存値は消されない(旧実装はここで共有キーを消していた)
    expect(read(CITY_STORAGE_KEY)).toEqual({ prefecture: "東京都", city: "港区" })
    expect(reportCity()).toHaveValue("港区")
    expect(read(REPORT_REGION_STORAGE_KEY)).toEqual({ prefecture: "東京都", lastCity: { prefecture: "東京都", city: "港区" } })
    // 地域アラート側は自分の選択からだけ港区を外す
    await waitFor(() => expect(read(ALERTS_REGION_STORAGE_KEY)).toEqual({ prefecture: "東京都", city: null, schoolDistrictId: null }))
    expect(alertsCity()).toHaveValue("")

    view.unmount()
    render(<Page />)

    await screen.findByRole("option", { name: "港区" })
    expect(reportCity()).toHaveValue("港区")
  })

  it("それぞれの選択は別々に保存され、再表示でそれぞれ自分の選択に戻る", async () => {
    const view = render(<Page />)

    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } })
    await screen.findByRole("option", { name: "新宿区" })
    fireEvent.change(alertsCity(), { target: { value: "新宿区" } })
    await screen.findByRole("option", { name: "第一小学校" })
    fireEvent.change(screen.getByLabelText("小学校区"), { target: { value: district.id } })

    fireEvent.change(screen.getByRole("combobox", { name: "都道府県を選ぶ" }), { target: { value: "大阪府" } })
    await waitFor(() => expect(reportCity()).toBeEnabled())
    fireEvent.change(reportCity(), { target: { value: "大阪市" } })

    // 報告フィルタで県を変えても、地域アラートの選択はそのまま
    expect(screen.getByLabelText("都道府県")).toHaveValue("東京都")
    expect(alertsCity()).toHaveValue("新宿区")
    expect(screen.getByLabelText("小学校区")).toHaveValue(district.id)
    await waitFor(() => {
      expect(read(ALERTS_REGION_STORAGE_KEY)).toEqual({ prefecture: "東京都", city: "新宿区", schoolDistrictId: district.id })
      expect(read(REPORT_REGION_STORAGE_KEY)).toEqual({ prefecture: "大阪府", lastCity: { prefecture: "大阪府", city: "大阪市" } })
    })

    view.unmount()
    render(<Page />)

    await waitFor(() => expect(screen.getByLabelText("小学校区")).toHaveValue(district.id))
    expect(screen.getByLabelText("都道府県")).toHaveValue("東京都")
    expect(alertsCity()).toHaveValue("新宿区")
    await waitFor(() => expect(reportCity()).toHaveValue("大阪市"))
    expect(screen.getByRole("combobox", { name: "都道府県を選ぶ" })).toHaveValue("大阪府")
  })
})
