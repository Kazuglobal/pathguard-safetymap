"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis } from "recharts"
import type { DailyTrend } from "@/components/admin/costs/cost-dashboard"

interface CostTrendChartProps {
  readonly dailyTrends: readonly DailyTrend[]
}

const chartConfig = {
  gemini: {
    label: "Gemini",
    color: "#3b82f6",
  },
  openai: {
    label: "OpenAI",
    color: "#22c55e",
  },
  mapbox: {
    label: "Mapbox",
    color: "#f97316",
  },
} as const

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export default function CostTrendChart({ dailyTrends }: CostTrendChartProps) {
  const chartData = dailyTrends.map((trend) => ({
    ...trend,
    dateLabel: formatDateLabel(trend.date),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>コスト推移</CardTitle>
        <CardDescription>日別のAPIコスト推移（USD）</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[300px] sm:h-[350px]"
        >
          <LineChart data={chartData}>
            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: number) => `$${value}`}
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
            <Line
              type="monotone"
              dataKey="gemini"
              stroke="var(--color-gemini)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="openai"
              stroke="var(--color-openai)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="mapbox"
              stroke="var(--color-mapbox)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
