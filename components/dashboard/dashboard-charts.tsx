"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { DangerReport } from "@/lib/types"

interface DashboardChartsProps {
  pendingCount: number
  approvedCount: number
  resolvedCount: number
  allReports: DangerReport[]
}

export default function DashboardCharts({
  pendingCount,
  approvedCount,
  resolvedCount,
  allReports,
}: DashboardChartsProps) {
  // ステータス別の分布データ
  const statusData = [
    { name: "審査中", value: pendingCount, color: "#facc15" },
    { name: "承認済み", value: approvedCount, color: "#3b82f6" },
    { name: "解決済み", value: resolvedCount, color: "#4ade80" },
  ]

  // 危険タイプ別の分布データを計算
  const dangerTypeCount = allReports.reduce(
    (acc, report) => {
      const type = report.danger_type
      acc[type] = (acc[type] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const dangerTypeData = [
    { name: "交通危険", value: dangerTypeCount["traffic"] || 0, color: "#f87171" },
    { name: "犯罪危険", value: dangerTypeCount["crime"] || 0, color: "#60a5fa" },
    { name: "災害危険", value: dangerTypeCount["disaster"] || 0, color: "#fbbf24" },
    { name: "その他", value: dangerTypeCount["other"] || 0, color: "#a3a3a3" },
  ]

  // 危険度レベル別の分布データを計算
  const dangerLevelCount = allReports.reduce(
    (acc, report) => {
      const level = report.danger_level
      acc[level] = (acc[level] || 0) + 1
      return acc
    },
    {} as Record<number, number>,
  )

  const dangerLevelData = [
    { name: "レベル1", value: dangerLevelCount[1] || 0 },
    { name: "レベル2", value: dangerLevelCount[2] || 0 },
    { name: "レベル3", value: dangerLevelCount[3] || 0 },
    { name: "レベル4", value: dangerLevelCount[4] || 0 },
    { name: "レベル5", value: dangerLevelCount[5] || 0 },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>ステータス別分布</CardTitle>
          <CardDescription>報告のステータス別の分布</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>危険タイプ別分布</CardTitle>
          <CardDescription>報告された危険タイプの分布</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={dangerTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {dangerTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>危険度レベル別分布</CardTitle>
          <CardDescription>報告された危険度レベルの分布</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              value: {
                label: "報告数",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-80"
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dangerLevelData}>
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
