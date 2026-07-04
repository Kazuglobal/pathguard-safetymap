"use client"

import React, { useId, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Sparkles,
  Car,
  Eye,
  Footprints,
  ShieldCheck,
  Lightbulb,
  Mountain,
  Construction,
  CornerDownRight,
  TrafficCone,
  Cloud,
  Users,
  Brain,
  Camera,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { LucideProps } from "lucide-react"
import {
  HAZARD_CATEGORY_MAP,
  extractSimulationQuickSummary,
  getSeverityVariant,
  getRiskLevelLabel,
  type VlmAnalysisResult,
  type VlmHazard,
  type HazardCategory,
} from "@/lib/vlm-analysis"
import type { VlmAnalysisStatus } from "@/hooks/use-vlm-analysis"
import { AiDisclaimerNote } from "@/components/ui/ai-disclaimer-note"
import { SimulationQuickSummary } from "./simulation-quick-summary"

interface VlmAnalysisPanelProps {
  status: VlmAnalysisStatus
  result: VlmAnalysisResult | null
  error: string | null
  onRetry: () => void
}

// Icon mapping for all 15 hazard categories
const CATEGORY_ICONS: Record<HazardCategory, React.ComponentType<LucideProps>> = {
  traffic: Car,
  visibility: Eye,
  pedestrian_space: Footprints,
  barriers: ShieldCheck,
  lighting: Lightbulb,
  terrain: Mountain,
  infrastructure: Construction,
  crossings: CornerDownRight,
  signage: TrafficCone,
  environmental: Cloud,
  social: Users,
  emergency: AlertCircle,
  behavioral: Brain,
  surveillance: Camera,
  maintenance: Wrench,
}

// Explicit Tailwind class mapping to prevent purging during build
const CATEGORY_COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-100", text: "text-blue-600" },
  yellow: { bg: "bg-yellow-100", text: "text-yellow-600" },
  green: { bg: "bg-green-100", text: "text-green-600" },
  indigo: { bg: "bg-indigo-100", text: "text-indigo-600" },
  amber: { bg: "bg-amber-100", text: "text-amber-600" },
  stone: { bg: "bg-stone-100", text: "text-stone-600" },
  orange: { bg: "bg-orange-100", text: "text-orange-600" },
  teal: { bg: "bg-teal-100", text: "text-teal-600" },
  red: { bg: "bg-red-100", text: "text-red-600" },
  sky: { bg: "bg-sky-100", text: "text-sky-600" },
  purple: { bg: "bg-purple-100", text: "text-purple-600" },
  rose: { bg: "bg-rose-100", text: "text-rose-600" },
  pink: { bg: "bg-pink-100", text: "text-pink-600" },
  slate: { bg: "bg-slate-100", text: "text-slate-600" },
  zinc: { bg: "bg-zinc-100", text: "text-zinc-600" },
}

/**
 * Main panel component for displaying VLM hazard analysis results
 */
export function VlmAnalysisPanel({
  status,
  result,
  error,
  onRetry,
}: VlmAnalysisPanelProps) {
  // Don't render anything in idle state
  if (status === "idle") {
    return null
  }

  return (
    <Card className="mt-4 border-2 border-blue-100 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">AI危険度分析</CardTitle>
          </div>
          <AnalysisStatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent>
        {status === "analyzing" && <AnalyzingView />}
        {status === "completed" && result && <CompletedView result={result} />}
        {status === "failed" && <FailedView error={error} onRetry={onRetry} />}
      </CardContent>
    </Card>
  )
}

/**
 * Status badge component (analyzing/completed/failed)
 */
function AnalysisStatusBadge({ status }: { status: VlmAnalysisStatus }) {
  switch (status) {
    case "analyzing":
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          分析中
        </Badge>
      )
    case "completed":
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          完了
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          失敗
        </Badge>
      )
    default:
      return null
  }
}

/**
 * Loading state view
 */
function AnalyzingView() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
      <p className="text-sm text-gray-600">画像を解析しています...</p>
      <p className="text-xs text-gray-500 mt-1">
        Claude Haiku Visionで危険要因を検出中
      </p>
    </div>
  )
}

/**
 * Error state view with retry button
 */
function FailedView({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
      <p className="text-sm font-medium text-gray-800 mb-2">
        分析に失敗しました
      </p>
      {error && <p className="text-xs text-gray-600 mb-4">{error}</p>}
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="flex items-center gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        再試行
      </Button>
    </div>
  )
}

/**
 * Completed state view with full analysis results.
 * Uses a collapsible accordion so the panel doesn't push the form
 * content too far down, especially on mobile devices.
 */
function CompletedView({ result }: { result: VlmAnalysisResult }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const detailsSectionId = useId()
  const quickSummary = extractSimulationQuickSummary(result)

  return (
    <div className="space-y-4">
      {quickSummary ? (
        <SimulationQuickSummary
          summary={quickSummary.summary}
          action={quickSummary.action}
          compact={true}
        />
      ) : null}

      {/* Overall Safety Score - always visible, acts as toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between p-3 bg-white rounded-lg border hover:border-blue-300 transition-colors text-left"
        aria-expanded={isExpanded}
        aria-controls={detailsSectionId}
        aria-label={isExpanded ? "分析詳細を折りたたむ" : "分析詳細を展開"}
      >
        <div>
          <p className="text-xs text-gray-500">総合安全スコア</p>
          <p className="text-2xl font-bold text-gray-800">
            {result.overall_safety_score}
            <span className="text-sm text-gray-500">/100</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={getSeverityVariant(result.overall_risk_level)}
            className="text-sm"
          >
            {getRiskLevelLabel(result.overall_risk_level)}
          </Badge>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Collapsed hint */}
      {!isExpanded && (
        <p className="text-xs text-gray-500 text-center">
          {result.hazards.length > 0
            ? `タップして詳細を表示（リスク要因 ${result.hazards.length}件）`
            : "タップして詳細を表示（分析サマリーを確認）"}
        </p>
      )}

      {/* Expandable detail section */}
      {isExpanded && (
        <div id={detailsSectionId}>
          {/* Hazards List */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">
              検出されたリスク要因 ({result.hazards.length}件)
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto overscroll-y-contain md:max-h-64">
              {result.hazards.map((hazard, idx) => (
                <HazardItem key={idx} hazard={hazard} />
              ))}
            </div>
          </div>

          {/* Tabs for additional info */}
          <Tabs defaultValue="child" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="child">子供視点</TabsTrigger>
              <TabsTrigger value="time">時間・天候</TabsTrigger>
              <TabsTrigger value="improve">改善提案</TabsTrigger>
            </TabsList>

            <TabsContent value="child" className="space-y-2">
              <p className="text-sm text-gray-700">
                {result.child_perspective_summary}
              </p>
            </TabsContent>

            <TabsContent value="time" className="space-y-2">
              {Object.entries(result.time_weather_risks).map(
                ([key, value]) =>
                  value && (
                    <div key={key} className="text-sm">
                      <p className="font-medium text-gray-700">
                        {formatTimeWeatherKey(key)}
                      </p>
                      <p className="text-gray-600">{value}</p>
                    </div>
                  )
              )}
            </TabsContent>

            <TabsContent value="improve" className="space-y-3">
              {renderImprovementSuggestions(result.improvement_suggestions)}
            </TabsContent>
          </Tabs>
        </div>
      )}

      <AiDisclaimerNote />
    </div>
  )
}

/**
 * Individual hazard item card
 */
function HazardItem({ hazard }: { hazard: VlmHazard }) {
  const categoryInfo = HAZARD_CATEGORY_MAP[hazard.category]
  const Icon = CATEGORY_ICONS[hazard.category]
  const colors = CATEGORY_COLOR_CLASSES[categoryInfo.color] ?? {
    bg: "bg-gray-100",
    text: "text-gray-600",
  }

  return (
    <div className="flex items-start gap-2 p-2 bg-white rounded border hover:border-blue-300 transition-colors">
      <div className={`p-1.5 rounded ${colors.bg}`}>
        <Icon className={`h-4 w-4 ${colors.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-700">
            {categoryInfo.label}
          </span>
          <Badge
            variant={getSeverityVariant(hazard.severity)}
            className="text-xs"
          >
            レベル{hazard.severity}
          </Badge>
        </div>
        <p className="text-sm text-gray-600">{hazard.description_ja}</p>
        {hazard.child_specific_risk && (
          <p className="text-xs text-orange-600 mt-1">
            子供への影響: {hazard.child_specific_risk}
          </p>
        )}
        {hazard.recommendation && (
          <p className="text-xs text-blue-600 mt-1">
            対策: {hazard.recommendation}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Format time/weather risk key to Japanese label
 */
function formatTimeWeatherKey(key: string): string {
  const labels: Record<string, string> = {
    morning_commute: "朝の通学時",
    evening_return: "夕方の帰宅時",
    rainy_conditions: "雨天時",
    winter_conditions: "冬季",
  }
  return labels[key] || key
}

/**
 * Render improvement suggestions with categorized lists
 */
function renderImprovementSuggestions(
  suggestions: VlmAnalysisResult["improvement_suggestions"]
) {
  return (
    <>
      {suggestions.immediate_actions &&
        suggestions.immediate_actions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">即時対策</p>
            <ul className="list-disc list-inside space-y-1">
              {suggestions.immediate_actions.map((action, idx) => (
                <li key={idx} className="text-sm text-gray-600">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}
      {suggestions.medium_term_improvements &&
        suggestions.medium_term_improvements.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">
              中長期改善
            </p>
            <ul className="list-disc list-inside space-y-1">
              {suggestions.medium_term_improvements.map((item, idx) => (
                <li key={idx} className="text-sm text-gray-600">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      {suggestions.community_involvement &&
        suggestions.community_involvement.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">
              地域での取り組み
            </p>
            <ul className="list-disc list-inside space-y-1">
              {suggestions.community_involvement.map((item, idx) => (
                <li key={idx} className="text-sm text-gray-600">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
    </>
  )
}

export default VlmAnalysisPanel
