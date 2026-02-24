"use client"

import React, { useMemo, useCallback, useState } from "react"
import { FileText, Download, Users, Building2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PipelineAnalysisResult } from "@/lib/hazard-game-types"
import {
  generateSafetyReport,
  formatReportAsText,
  type ReportType,
  type SafetyReport as SafetyReportData,
} from "@/lib/hazard-game-report"

interface SafetyReportProps {
  result: PipelineAnalysisResult
}

const REPORT_TYPES: {
  type: ReportType
  label: string
  icon: typeof Users
  description: string
}[] = [
  {
    type: "parent",
    label: "保護者向け",
    icon: Users,
    description: "わかりやすいスコアと主要リスクのまとめ",
  },
  {
    type: "municipality",
    label: "行政向け",
    icon: Building2,
    description: "全検出結果と定量データの詳細レポート",
  },
]

function ReportSections({ report }: { report: SafetyReportData }) {
  return (
    <div className="space-y-3">
      {report.sections.map((section, i) => (
        <div key={i} className="border rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <h4 className="text-sm font-medium text-gray-800">{section.title}</h4>
            {section.severity && (
              <Badge
                variant={
                  section.severity === "high"
                    ? "destructive"
                    : section.severity === "medium"
                      ? "default"
                      : "secondary"
                }
                className="text-xs"
              >
                {section.severity === "high" ? "高" : section.severity === "medium" ? "中" : "低"}
              </Badge>
            )}
          </div>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">
            {section.content}
          </pre>
        </div>
      ))}

      {report.recommendations.length > 0 && (
        <div className="border rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-800 mb-2">推奨事項</h4>
          <ul className="space-y-1">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start">
                <span className="text-blue-500 mr-2 flex-shrink-0">{i + 1}.</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function SafetyReportCard({ result }: SafetyReportProps) {
  const [activeType, setActiveType] = useState<ReportType>("parent")

  const report = useMemo(
    () => generateSafetyReport(result, activeType),
    [result, activeType]
  )

  const handleDownload = useCallback(() => {
    const text = formatReportAsText(report)
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `safety-report-${activeType}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [report, activeType])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-5 w-5 mr-2 text-indigo-600" />
            安全レポート
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center text-sm font-normal text-blue-600 hover:text-blue-800"
          >
            <Download className="h-4 w-4 mr-1" />
            ダウンロード
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type selector */}
        <div className="flex space-x-2">
          {REPORT_TYPES.map((rt) => {
            const Icon = rt.icon
            const isActive = activeType === rt.type
            return (
              <button
                key={rt.type}
                onClick={() => setActiveType(rt.type)}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{rt.label}</span>
              </button>
            )
          })}
        </div>

        {/* Report content */}
        <ReportSections report={report} />
      </CardContent>
    </Card>
  )
}
