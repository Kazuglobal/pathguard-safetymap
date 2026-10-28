/**
 * 地図まわりの UIUX改装 項目16・48:
 * - 地図の部品が届くまでの表示(以前は無地のグレー)
 * - 地図サイドバーの見出しが、実際の絞り込みと一致すること
 * - 報告フォームは開いたときだけ読み込むこと
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MapLoadingPlaceholder } from "@/components/map/map-page-client"
import MapSidebar from "@/components/map/map-sidebar"
import { MapReportForms } from "@/components/map/map-report-forms"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/map",
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock("@/components/danger-report/danger-report-form", () => ({
  default: () => <div data-testid="danger-report-form" />,
}))

const sidebarProps = (prefecture: string) => ({
  dangerReports: [],
  isLoading: false,
  selectedReport: null,
  onFilterChange: vi.fn(),
  filterOptions: { dangerType: "all", dangerLevel: "all", dateRange: "all", showPending: true, prefecture },
  onReportSelect: vi.fn(),
})

describe("地図の読み込み中の表示", () => {
  it("無地ではなく、何を待っているかを文字で伝える", () => {
    render(<MapLoadingPlaceholder />)

    const status = screen.getByTestId("map-loading-placeholder")
    expect(status).toHaveAttribute("role", "status")
    expect(status).toHaveTextContent("地図を準備しています")
    expect(status).toHaveTextContent("危険マーカー")
  })
})

describe("地図サイドバーの見出し", () => {
  it("絞り込みなし(全国)なら表示範囲の報告だと書く", () => {
    render(<MapSidebar {...(sidebarProps("全国") as any)} />)
    expect(screen.getByText(/地図の表示範囲内の報告です。/)).toBeInTheDocument()
    expect(screen.queryByText(/全国の報告/)).not.toBeInTheDocument()
  })

  it("都道府県で絞っているときは、絞っていることを書く", () => {
    render(<MapSidebar {...(sidebarProps("千葉県") as any)} />)
    expect(screen.getByText(/千葉県の報告だけにしぼっています/)).toBeInTheDocument()
  })
})

describe("報告フォームの遅延読み込み", () => {
  const formProps = {
    isMobile: false,
    onSubmit: vi.fn(),
    selectedLocation: null,
    locationSource: null,
    selectedRouteId: null,
    selectedRouteName: null,
    onDesktopCancel: vi.fn(),
    onMobileChangeLocation: vi.fn(),
    onMobileClose: vi.fn(),
  } as any

  it("閉じている間はフォームを読み込まない", () => {
    render(<MapReportForms {...formProps} isReportFormOpen={false} />)
    expect(screen.queryByTestId("danger-report-form")).not.toBeInTheDocument()
    expect(screen.queryByText("報告フォームを準備しています…")).not.toBeInTheDocument()
  })

  it("開いたら読み込み中の表示のあとにフォームが出る", async () => {
    render(<MapReportForms {...formProps} isReportFormOpen />)
    expect(await screen.findByTestId("danger-report-form", {}, { timeout: 8000 })).toBeInTheDocument()
  })
})
