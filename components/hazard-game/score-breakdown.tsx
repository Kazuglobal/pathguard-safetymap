"use client"

import React from "react"
import { Trophy, Shield, AlertTriangle, Car, Ban, Brain, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { SafetyScore, DetectionCategory } from "@/lib/hazard-game-types"

interface ScoreBreakdownProps {
  score: SafetyScore
}

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  safe: { label: "安全", color: "text-green-700", bg: "bg-green-100" },
  caution: { label: "注意", color: "text-yellow-700", bg: "bg-yellow-100" },
  warning: { label: "警告", color: "text-orange-700", bg: "bg-orange-100" },
  danger: { label: "危険", color: "text-red-700", bg: "bg-red-100" },
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  safety_equipment: { label: "安全設備", icon: Shield, color: "text-green-600" },
  hazards: { label: "危険要素", icon: AlertTriangle, color: "text-red-600" },
  traffic: { label: "交通", icon: Car, color: "text-blue-600" },
  obstructions: { label: "障害物", icon: Ban, color: "text-orange-600" },
  contextual: { label: "文脈リスク", icon: Brain, color: "text-purple-600" },
}

export function ScoreBreakdown({ score }: ScoreBreakdownProps) {
  const [showDetails, setShowDetails] = React.useState(false)
  const levelConfig = LEVEL_CONFIG[score.level] ?? LEVEL_CONFIG.caution

  const scoreColor =
    score.score >= 80 ? "text-green-600" :
    score.score >= 60 ? "text-blue-600" :
    score.score >= 40 ? "text-yellow-600" :
    "text-red-600"

  const scoreRating =
    score.score >= 95 ? "完璧！" :
    score.score >= 80 ? "素晴らしい！" :
    score.score >= 60 ? "良い分析！" :
    score.score >= 40 ? "もう少し" :
    "要改善"

  return (
    <div className="space-y-4">
      {/* Main score */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-0">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center mb-3">
            <Trophy className={`h-8 w-8 mr-2 ${scoreColor}`} />
            <span className={`text-4xl font-bold ${scoreColor}`}>{score.score}</span>
            <span className="text-2xl text-gray-500 ml-1">点</span>
          </div>
          <p className={`text-lg font-medium ${scoreColor} mb-2`}>{scoreRating}</p>
          <Badge className={`${levelConfig.bg} ${levelConfig.color} border-0`}>
            {levelConfig.label}
          </Badge>
          <Progress value={score.score} className="mt-4" />
        </CardContent>
      </Card>

      {/* Detection summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { key: "safety_equipment", count: score.detectionSummary.safetyEquipmentCount },
          { key: "hazards", count: score.detectionSummary.hazardCount },
          { key: "traffic", count: score.detectionSummary.trafficCount },
          { key: "obstructions", count: score.detectionSummary.obstructionCount },
        ] as const).map(({ key, count }) => {
          const config = CATEGORY_CONFIG[key]
          const Icon = config.icon
          return (
            <Card key={key} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3 text-center">
                <Icon className={`h-5 w-5 mx-auto mb-1 ${config.color}`} />
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{config.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Think summary */}
      {score.thinkSummary.contextualRiskCount > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">文脈リスク:</span>
              <div className="flex items-center space-x-3">
                {score.thinkSummary.highSeverityCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    高 {score.thinkSummary.highSeverityCount}
                  </Badge>
                )}
                {score.thinkSummary.mediumSeverityCount > 0 && (
                  <Badge variant="default" className="text-xs bg-yellow-500">
                    中 {score.thinkSummary.mediumSeverityCount}
                  </Badge>
                )}
                {score.thinkSummary.lowSeverityCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    低 {score.thinkSummary.lowSeverityCount}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown details */}
      {score.breakdown.length > 0 && (
        <Card>
          <CardHeader
            className="pb-2 cursor-pointer"
            onClick={() => setShowDetails((v) => !v)}
          >
            <CardTitle className="text-sm flex items-center justify-between">
              <span>スコア内訳 ({score.breakdown.length}項目)</span>
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
          {showDetails && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="text-xs text-gray-400 flex justify-between px-1">
                  <span>項目</span>
                  <span>減点</span>
                </div>
                {score.breakdown.map((item, i) => {
                  const catConfig = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.contextual
                  const CatIcon = catConfig.icon
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50 text-sm"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <CatIcon className={`h-3.5 w-3.5 flex-shrink-0 ${catConfig.color}`} />
                        <span className="truncate text-gray-700">{item.reason}</span>
                      </div>
                      <span
                        className={`font-mono font-medium ml-2 flex-shrink-0 ${
                          item.points < 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {item.points > 0 ? "+" : ""}{item.points}
                      </span>
                    </div>
                  )
                })}
                <div className="flex justify-between pt-2 border-t text-sm font-medium">
                  <span>基準点: 100</span>
                  <span className={scoreColor}>最終: {score.score}</span>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
