"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Lightbulb, Brain, AlertTriangle, Eye, ArrowUpRight, Target, CheckCircle, XCircle, Search } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AiDisclaimerNote } from "@/components/ui/ai-disclaimer-note"
import type { PipelineAnalysisResultWithComparison, UserMarkingResult, DetectionItem } from "@/lib/hazard-game-types"
import { computeFallbackCell, findNonOverlappingLabelY } from "@/lib/hazard-game-overlay-layout"
import { ScoreBreakdown } from "./score-breakdown"
import { DetectionCategories } from "./detection-categories"
import { SafetyReportCard } from "./safety-report"

interface AnalysisResultsProps {
  result: PipelineAnalysisResultWithComparison
  onPlayAgain: () => void
  sourceImageFile?: File
  userMarking?: UserMarkingResult
}

// Category-based overlay colors
const CATEGORY_COLORS: Record<string, string> = {
  safety_equipment: "rgba(34, 197, 94, 0.25)",
  hazards: "rgba(239, 68, 68, 0.28)",
  traffic: "rgba(59, 130, 246, 0.25)",
  obstructions: "rgba(249, 115, 22, 0.25)",
}

const CATEGORY_BORDER: Record<string, string> = {
  safety_equipment: "rgba(34, 197, 94, 0.6)",
  hazards: "rgba(239, 68, 68, 0.6)",
  traffic: "rgba(59, 130, 246, 0.6)",
  obstructions: "rgba(249, 115, 22, 0.6)",
}

export function AnalysisResults({ result, onPlayAgain, sourceImageFile, userMarking }: AnalysisResultsProps) {
  const [vizLoading, setVizLoading] = useState(false)
  const [vizError, setVizError] = useState<string | null>(null)
  const [vizDataUrl, setVizDataUrl] = useState<string | null>(null)

  const previewUrl = useMemo(() => (sourceImageFile ? URL.createObjectURL(sourceImageFile) : null), [sourceImageFile])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Flatten all detection items with their category for overlay
  const allDetections = useMemo(() => {
    const categorize = (category: string, list: readonly DetectionItem[]) =>
      list.map((item) => ({ ...item, _category: category }))

    return [
      ...categorize("safety_equipment", result.vision.safetyEquipment),
      ...categorize("hazards", result.vision.hazards),
      ...categorize("traffic", result.vision.traffic),
      ...categorize("obstructions", result.vision.obstructions),
    ]
  }, [result.vision])

  const drawLocalOverlay = useCallback(async (): Promise<string> => {
    if (!sourceImageFile) throw new Error("元の写真が必要です")
    const imgUrl = URL.createObjectURL(sourceImageFile)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = imgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error("Canvas context could not be created")
    ctx.drawImage(img, 0, 0)

    const pad = Math.max(8, Math.round(Math.min(canvas.width, canvas.height) * 0.01))
    const baseFontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.022))
    const fontSize = allDetections.length > 10
      ? Math.round(baseFontSize * 0.8)
      : baseFontSize
    ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI`
    ctx.textBaseline = 'top'

    const maxLabelWidth = Math.round(canvas.width * 0.55)

    const truncateText = (text: string, maxW: number): string => {
      if (ctx.measureText(text).width <= maxW) return text
      let truncated = text
      while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxW) {
        truncated = truncated.slice(0, -1)
      }
      return truncated + '…'
    }

    const placedLabels: Array<{x: number; y: number; w: number; h: number}> = []
    let idx = 0

    for (const item of allDetections) {
      const fillColor = CATEGORY_COLORS[item._category] ?? "rgba(234, 179, 8, 0.25)"
      const strokeColor = CATEGORY_BORDER[item._category] ?? "rgba(0,0,0,0.4)"

      let x = 0.05, y = 0.05, w = 0.4, hh = 0.25
      if (item.positions.length > 0) {
        const pos = item.positions[0]
        x = Math.max(0, Math.min(1, pos.x))
        y = Math.max(0, Math.min(1, pos.y))
        w = Math.max(0.05, Math.min(1, pos.width))
        hh = Math.max(0.05, Math.min(1, pos.height))
      } else {
        const cell = computeFallbackCell(
          idx,
          allDetections.length,
          canvas.height,
          fontSize,
          pad
        )
        x = cell.x
        y = cell.y
        w = cell.w
        hh = cell.h
      }
      idx++

      const rx = Math.round(x * canvas.width)
      const ry = Math.round(y * canvas.height)
      const rw = Math.round(w * canvas.width)
      const rh = Math.round(hh * canvas.height)

      ctx.fillStyle = fillColor
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * 0.004))
      ctx.strokeRect(rx, ry, rw, rh)

      const rawLabel = `${item.label} (${Math.round(item.confidence * 100)}%)`
      const label = truncateText(rawLabel, maxLabelWidth)
      const textW = ctx.measureText(label).width
      const lbPadX = Math.round(fontSize * 0.5)
      const lbPadY = Math.round(fontSize * 0.35)
      const lbW = Math.round(textW + lbPadX * 2)
      const lbH = Math.round(fontSize + lbPadY * 2)
      const lbX = Math.max(pad, Math.min(rx, canvas.width - lbW - pad))
      const gapAbove = Math.round(fontSize * 0.2)
      const idealAboveY = ry - lbH - gapAbove
      const initialLbY = idealAboveY >= pad ? idealAboveY : Math.max(pad, ry + rh + pad)
      const lbY = findNonOverlappingLabelY({
        lbX,
        initialY: initialLbY,
        lbW,
        lbH,
        rectBottomY: ry + rh,
        canvasHeight: canvas.height,
        placedLabels,
      })

      placedLabels.push({ x: lbX, y: lbY, w: lbW, h: lbH })

      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(lbX, lbY, lbW, lbH)
      ctx.fillStyle = 'white'
      ctx.fillText(label, lbX + lbPadX, lbY + lbPadY)
    }

    const out = canvas.toDataURL('image/png')
    URL.revokeObjectURL(imgUrl)
    return out
  }, [sourceImageFile, allDetections])

  const onVisualize = useCallback(async () => {
    if (!sourceImageFile) {
      setVizError("元の写真が必要です。アップロードからやり直してください。")
      return
    }
    setVizError(null)
    setVizLoading(true)
    setVizDataUrl(null)
    try {
      const dataUrl = await drawLocalOverlay()
      setVizDataUrl(dataUrl)
    } catch (e) {
      setVizError(e instanceof Error ? e.message : "不明なエラー")
    } finally {
      setVizLoading(false)
    }
  }, [sourceImageFile, drawLocalOverlay])

  return (
    <div className="space-y-6">
      {/* Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <Eye className="h-5 w-5 mr-2 text-blue-600" />
            写真上でハザードを可視化
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-2">元の写真プレビュー</p>
              {previewUrl ? (
                <img src={previewUrl} alt="source preview" className="w-full h-auto rounded border" />
              ) : (
                <div className="w-full h-40 border rounded flex items-center justify-center text-gray-400 text-xs sm:text-sm">
                  写真が未指定です
                </div>
              )}
            </div>
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-700 mb-2">
                  カテゴリ別に色分けして危険箇所を描画します:
                </p>
                <div className="grid grid-cols-2 gap-1 text-[10px] sm:text-xs">
                  <span className="flex items-center"><span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-green-400 mr-1" /> 安全設備</span>
                  <span className="flex items-center"><span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-red-400 mr-1" /> 危険要素</span>
                  <span className="flex items-center"><span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-blue-400 mr-1" /> 交通</span>
                  <span className="flex items-center"><span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-orange-400 mr-1" /> 障害物</span>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={onVisualize}
                  disabled={vizLoading || !sourceImageFile}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded text-sm disabled:opacity-50"
                >
                  {vizLoading ? "生成中..." : "写真上で可視化する"}
                </button>
                {vizError && <p className="text-xs sm:text-sm text-red-600 mt-2">{vizError}</p>}
              </div>
            </div>
          </div>

          {vizDataUrl && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">生成結果</p>
              <div className="rounded border p-2">
                <img src={vizDataUrl} alt="visualized hazards" className="w-full h-auto" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Marking Comparison */}
      {userMarking && userMarking.markers.length > 0 && result.comparison && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Target className="h-5 w-5 mr-2 text-purple-600" />
              あなたのマーキング vs AI検出
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-green-50 p-2 sm:p-3 rounded-lg border border-green-200 text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">マッチ数</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">
                  {result.comparison.matches.length}
                  <span className="text-xs sm:text-sm font-normal text-gray-400">
                    /{userMarking.markers.length}
                  </span>
                </p>
              </div>
              <div className="bg-blue-50 p-2 sm:p-3 rounded-lg border border-blue-200 text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">精度スコア</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600">
                  {result.comparison.accuracyScore}%
                </p>
              </div>
              <div className="bg-purple-50 p-2 sm:p-3 rounded-lg border border-purple-200 text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">ボーナス</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600">
                  +{result.comparison.bonusPoints}pt
                </p>
              </div>
            </div>

            {/* Matched markers */}
            {result.comparison.matches.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                  マッチした箇所 ({result.comparison.matches.length})
                </h4>
                <div className="space-y-2">
                  {result.comparison.matches.map((match, i) => (
                    <div key={i} className="bg-gray-50 rounded p-2 sm:p-3 text-xs sm:text-sm">
                      <div className="flex items-start sm:items-center justify-between gap-2 mb-1">
                        <span className="font-medium text-gray-900 min-w-0 break-words">
                          {match.userMarker.label} → {match.aiDetection.label}
                        </span>
                        <Badge
                          variant={
                            match.overlapRatio >= 0.7
                              ? "default"
                              : match.overlapRatio >= 0.4
                                ? "secondary"
                                : "outline"
                          }
                          className="text-[10px] sm:text-xs flex-shrink-0"
                        >
                          {Math.round(match.overlapRatio * 100)}%一致
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500">
                        {match.categoryMatch && (
                          <span className="text-green-600">カテゴリ一致 +5pt</span>
                        )}
                        <span>
                          {match.overlapRatio >= 0.7 ? "+20pt" : match.overlapRatio >= 0.4 ? "+10pt" : "+5pt"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched user markers */}
            {result.comparison.unmatchedUserMarkers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <XCircle className="h-4 w-4 mr-1 text-orange-500" />
                  AIが検出しなかった箇所 ({result.comparison.unmatchedUserMarkers.length})
                </h4>
                <div className="space-y-1">
                  {result.comparison.unmatchedUserMarkers.map((marker, i) => (
                    <div key={i} className="text-sm text-gray-600 flex items-start">
                      <span className="text-orange-400 mr-2">-</span>
                      {marker.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched AI detections */}
            {result.comparison.unmatchedAiDetections.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Search className="h-4 w-4 mr-1 text-blue-500" />
                  AIが追加検出した箇所 ({result.comparison.unmatchedAiDetections.length})
                </h4>
                <div className="space-y-1">
                  {result.comparison.unmatchedAiDetections.map((detection, i) => (
                    <div key={i} className="text-sm text-gray-600 flex items-start">
                      <span className="text-blue-400 mr-2">-</span>
                      <span>
                        <span className="font-medium">{detection.label}</span>: {detection.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Score Breakdown */}
      <ScoreBreakdown score={result.score} />

      {/* Detection Categories */}
      <DetectionCategories vision={result.vision} />

      {/* AI分析の免責文言(T-10) */}
      <AiDisclaimerNote />

      {/* Think Results */}
      {(result.think.contextualRisks.length > 0 ||
        result.think.priorityImprovements.length > 0 ||
        result.think.latentRisks.length > 0 ||
        result.think.childPerspectiveRisks.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <Brain className="h-5 w-5 mr-2 text-purple-600" />
              AI リスク推論
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contextual risks */}
            {result.think.contextualRisks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1 text-red-500" />
                  文脈的リスク
                </h4>
                <div className="space-y-2">
                  {result.think.contextualRisks.map((risk, i) => (
                    <div key={i} className="bg-gray-50 rounded p-2 sm:p-3 text-xs sm:text-sm">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-gray-900 min-w-0">{risk.description}</span>
                        <Badge
                          variant={risk.severity === "high" ? "destructive" : risk.severity === "medium" ? "default" : "secondary"}
                          className="text-[10px] sm:text-xs flex-shrink-0"
                        >
                          {risk.severity === "high" ? "高" : risk.severity === "medium" ? "中" : "低"}
                        </Badge>
                      </div>
                      {risk.relatedDetections.length > 0 && (
                        <p className="text-xs text-gray-400">
                          関連: {risk.relatedDetections.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority improvements */}
            {result.think.priorityImprovements.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <ArrowUpRight className="h-4 w-4 mr-1 text-blue-500" />
                  改善提案
                </h4>
                <ul className="space-y-1">
                  {result.think.priorityImprovements.map((item, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start">
                      <span className="text-blue-500 mr-2 flex-shrink-0">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Latent risks */}
            {result.think.latentRisks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">潜在リスク</h4>
                <ul className="space-y-1">
                  {result.think.latentRisks.map((item, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start">
                      <span className="text-orange-500 mr-2 flex-shrink-0">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Child perspective */}
            {result.think.childPerspectiveRisks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">子どもの目線のリスク</h4>
                <ul className="space-y-1">
                  {result.think.childPerspectiveRisks.map((item, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start">
                      <span className="text-green-500 mr-2 flex-shrink-0">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Educational Tips */}
      {result.educationalTips.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <Lightbulb className="h-5 w-5 mr-2 text-yellow-500" />
              安全に関するアドバイス
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {result.educationalTips.map((tip, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-blue-600 text-sm font-medium">{index + 1}</span>
                  </div>
                  <p className="text-gray-700">{tip}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Safety Report (A10) */}
      <SafetyReportCard result={result} />

      {/* Play Again Button */}
      <div className="text-center pt-4 px-2 sm:px-0">
        <button
          onClick={onPlayAgain}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors text-sm sm:text-base"
        >
          もう一度プレイ
        </button>
      </div>
    </div>
  )
}
