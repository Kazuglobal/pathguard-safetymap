import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import DashboardCharts from "@/components/dashboard/dashboard-charts"
import type { DangerReport } from "@/lib/types"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
}))

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: ({ content }: { content: React.ReactNode }) => <div data-testid="chart-tooltip">{content}</div>,
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content" />,
}))

const unknownOnlyReport: DangerReport = {
  id: "report-1",
  user_id: "user-1",
  title: "未知カテゴリの報告",
  description: null,
  latitude: 35.0,
  longitude: 139.0,
  danger_type: "歩行者危険",
  danger_level: 9,
  status: "pending",
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

describe("DashboardCharts", () => {
  it("shows empty states for type and level charts when reports do not map to recognized buckets", () => {
    render(
      <DashboardCharts
        pendingCount={1}
        approvedCount={0}
        resolvedCount={0}
        allReports={[unknownOnlyReport]}
      />,
    )

    expect(screen.getAllByText("データがありません")).toHaveLength(2)
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument()
  })
})
