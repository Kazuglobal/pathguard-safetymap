"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import type { ProviderCost, EndpointCost } from "@/components/admin/costs/cost-dashboard"

interface CostBreakdownChartProps {
  readonly providers: readonly ProviderCost[]
  readonly endpointBreakdown: readonly EndpointCost[]
}

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "#3b82f6",
  openai: "#22c55e",
  mapbox: "#f97316",
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  mapbox: "Mapbox",
}

const pieChartConfig = {
  gemini: { label: "Gemini", color: "#3b82f6" },
  openai: { label: "OpenAI", color: "#22c55e" },
  mapbox: { label: "Mapbox", color: "#f97316" },
} as const

const barChartConfig = {
  cost_usd: {
    label: "コスト (USD)",
    color: "hsl(var(--chart-1))",
  },
} as const

const ENDPOINT_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
  "#eab308",
]

export default function CostBreakdownChart({
  providers,
  endpointBreakdown,
}: CostBreakdownChartProps) {
  const totalCost = providers.reduce((sum, p) => sum + p.total_cost_usd, 0)

  const pieData = providers.map((p) => ({
    name: PROVIDER_LABELS[p.provider] ?? p.provider,
    value: p.total_cost_usd,
    percentage: totalCost > 0 ? ((p.total_cost_usd / totalCost) * 100).toFixed(1) : "0",
    fill: PROVIDER_COLORS[p.provider] ?? "#94a3b8",
  }))

  const barData = endpointBreakdown.map((ep) => ({
    ...ep,
    shortName: ep.endpoint.length > 20 ? `${ep.endpoint.slice(0, 20)}...` : ep.endpoint,
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Provider breakdown (pie chart) */}
      <Card>
        <CardHeader>
          <CardTitle>プロバイダー別コスト内訳</CardTitle>
          <CardDescription>APIプロバイダーごとのコスト割合</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={pieChartConfig}
            className="aspect-square h-[280px] sm:h-[320px]"
          >
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`provider-cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => {
                      const numValue = typeof value === "number" ? value : Number(value)
                      return `$${numValue.toFixed(2)}`
                    }}
                  />
                }
              />
            </PieChart>
          </ChartContainer>
          {/* Legend */}
          <div className="mt-4 flex justify-center gap-4">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Endpoint breakdown (bar chart) */}
      <Card>
        <CardHeader>
          <CardTitle>エンドポイント別コスト</CardTitle>
          <CardDescription>各APIエンドポイントのコスト（USD）</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={barChartConfig}
            className="aspect-auto h-[280px] sm:h-[320px]"
          >
            <BarChart data={barData} layout="vertical">
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `$${value}`}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                tickLine={false}
                axisLine={false}
                width={120}
                tickMargin={4}
                className="text-xs"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => {
                      const numValue = typeof value === "number" ? value : Number(value)
                      return `$${numValue.toFixed(4)}`
                    }}
                  />
                }
              />
              <Bar dataKey="cost_usd" radius={[0, 4, 4, 0]}>
                {barData.map((_, index) => (
                  <Cell
                    key={`endpoint-cell-${index}`}
                    fill={ENDPOINT_COLORS[index % ENDPOINT_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
