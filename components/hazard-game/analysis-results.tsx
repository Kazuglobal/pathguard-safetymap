"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Shield, Lightbulb, Trophy, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { HazardAnalysisResult } from "@/lib/openai"

type GenImage = { mimeType: string; dataUrl: string }

interface AnalysisResultsProps {
  result: HazardAnalysisResult
  onPlayAgain: () => void
  sourceImageFile?: File
}

export function AnalysisResults({ result, onPlayAgain, sourceImageFile }: AnalysisResultsProps) {
  const [vizLoading, setVizLoading] = useState(false)
  const [vizError, setVizError] = useState<string | null>(null)
  const [vizImages, setVizImages] = useState<GenImage[]>([])

  const previewUrl = useMemo(() => (sourceImageFile ? URL.createObjectURL(sourceImageFile) : null), [sourceImageFile])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const buildVisualizationPrompt = useCallback(() => {
    const hazardBullets = result.hazards.slice(0, 8).map(h => `- ${h.type}: ${h.description}`).join("\n")
    const base = [
      "Generate a single photorealistic 2K infographic based on the uploaded street photo.",
      "Maintain the exact viewpoint and daylight. Overlay semi-transparent hazard markings and Japanese labels.",
      "- Collapsed fence: red translucent shading with exclamation icons, label 'フェンス倒壊'.",
      "- Fallen utility pole: red circle + arrow, label '電柱倒壊'.",
      "- Flooding risk: blue translucent shading with droplet icon, label '冠水'.",
      "- Fire spread risk: orange flame icon, label '延焼'.",
      "Use minimal, clean annotations. No people. No watermarks. Do not mention model names.",
      "Japanese suburban street aesthetics; realistic shadows and reflections.",
    ].join(" ")
    const findings = hazardBullets ? `\nBase on the following findings (not visible in output text):\n${hazardBullets}` : ""
    return base + findings
  }, [result.hazards])

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
    const ctx = canvas.getContext('2d')!

    // Draw original
    ctx.drawImage(img, 0, 0)

    // Overlay helper
    const colorFor = (t: string) => {
      const s = t.toLowerCase()
      if (s.includes('冠水') || s.includes('flood')) return 'rgba(37, 99, 235, 0.28)'
      if (s.includes('延焼') || s.includes('fire') || s.includes('炎')) return 'rgba(234, 88, 12, 0.28)'
      if (s.includes('電柱') || s.includes('pole') || s.includes('倒壊')) return 'rgba(220, 38, 38, 0.28)'
      if (s.includes('フェンス') || s.includes('fence')) return 'rgba(220, 38, 38, 0.28)'
      return 'rgba(234, 179, 8, 0.25)'
    }

    const pad = Math.max(8, Math.round(Math.min(canvas.width, canvas.height) * 0.01))
    const fontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.022))
    ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI`
    ctx.textBaseline = 'top'

    // Compute fallback boxes if bbox missing
    const hazards = result.hazards
    const rows = Math.max(1, Math.ceil(hazards.length / 2))
    let idx = 0

    for (const h of hazards) {
      const anyH = h as any
      let x = 0.05, y = 0.05, w = 0.4, hh = 0.25
      if (anyH?.bbox && typeof anyH.bbox === 'object') {
        x = Math.max(0, Math.min(1, Number(anyH.bbox.x)))
        y = Math.max(0, Math.min(1, Number(anyH.bbox.y)))
        w = Math.max(0.05, Math.min(1, Number(anyH.bbox.width)))
        hh = Math.max(0.05, Math.min(1, Number(anyH.bbox.height)))
      } else {
        // fallback grid positions
        const col = idx % 2
        const row = Math.floor(idx / 2)
        const cellW = 0.45
        const cellH = 1 / (rows + 1)
        x = 0.05 + col * (cellW + 0.05)
        y = 0.05 + row * (cellH)
        w = cellW
        hh = cellH * 0.8
      }
      idx++

      const rx = Math.round(x * canvas.width)
      const ry = Math.round(y * canvas.height)
      const rw = Math.round(w * canvas.width)
      const rh = Math.round(hh * canvas.height)

      // shaded area
      ctx.fillStyle = colorFor(h.type)
      ctx.fillRect(rx, ry, rw, rh)
      // border
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * 0.004))
      ctx.strokeRect(rx, ry, rw, rh)

      // label background
      const label = `${h.type} / ${Math.round(h.confidence * 100)}%`
      const textW = ctx.measureText(label).width
      const lbPadX = Math.round(fontSize * 0.5)
      const lbPadY = Math.round(fontSize * 0.35)
      const lbW = Math.round(textW + lbPadX * 2)
      const lbH = Math.round(fontSize + lbPadY * 2)
      const lbX = rx + pad
      const lbY = Math.max(pad, ry + pad)

      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(lbX, lbY, lbW, lbH)
      ctx.fillStyle = 'white'
      ctx.fillText(label, lbX + lbPadX, lbY + lbPadY)
    }

    const out = canvas.toDataURL('image/png')
    URL.revokeObjectURL(imgUrl)
    return out
  }, [sourceImageFile, result.hazards])

  const onVisualize = useCallback(async () => {
    if (!sourceImageFile) {
      setVizError("元の写真が必要です。アップロードからやり直してください。")
      return
    }
    setVizError(null)
    setVizLoading(true)
    setVizImages([])
    try {
      const dataUrl = await drawLocalOverlay()
      setVizImages([{ mimeType: 'image/png', dataUrl }])
    } catch (e) {
      setVizError(e instanceof Error ? e.message : "不明なエラー")
    } finally {
      setVizLoading(false)
    }
  }, [sourceImageFile, drawLocalOverlay])
  const getSafetyColor = (level: number) => {
    if (level <= 2) return "text-red-600 bg-red-100"
    if (level <= 3) return "text-yellow-600 bg-yellow-100"
    return "text-green-600 bg-green-100"
  }

  const getSafetyLabel = (level: number) => {
    switch (level) {
      case 1: return "非常に危険"
      case 2: return "危険"
      case 3: return "注意が必要"
      case 4: return "比較的安全"
      case 5: return "安全"
      default: return "不明"
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 80) return "text-blue-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreRating = (score: number) => {
    if (score >= 95) return "完璧！"
    if (score >= 90) return "素晴らしい！"
    if (score >= 80) return "良い分析！"
    if (score >= 70) return "まずまず"
    if (score >= 60) return "もう少し"
    return "頑張りましょう"
  }

  return (
    <div className="space-y-6">
      {/* Visualization CTA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">写真上でハザードを可視化</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">元の写真プレビュー</p>
              {previewUrl ? (
                <img src={previewUrl} alt="source preview" className="w-full h-auto rounded border" />
              ) : (
                <div className="w-full h-40 border rounded flex items-center justify-center text-gray-400 text-sm">写真が未指定です</div>
              )}
            </div>
            <div className="flex flex-col justify-between">
              <p className="text-sm text-gray-700">
                解析結果に基づき、アップロード写真上に危険箇所を半透明の色分けやアイコンで描画したバージョンを生成します。
              </p>
              <div className="mt-3">
                <button
                  onClick={onVisualize}
                  disabled={vizLoading || !sourceImageFile}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
                >
                  {vizLoading ? "生成中..." : "写真上で可視化する"}
                </button>
                {vizError && <p className="text-sm text-red-600 mt-2">{vizError}</p>}
              </div>
            </div>
          </div>

          {vizImages.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">生成結果</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {vizImages.map((img, idx) => (
                  <div key={idx} className="rounded border p-2">
                    <img src={img.dataUrl} alt={`viz-${idx}`} className="w-full h-auto" />
                    <p className="text-xs text-gray-500 mt-1">{img.mimeType}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-0">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <Trophy className={`h-8 w-8 mr-2 ${getScoreColor(result.score)}`} />
            <span className={`text-4xl font-bold ${getScoreColor(result.score)}`}>
              {result.score}
            </span>
            <span className="text-2xl text-gray-500 ml-1">点</span>
          </div>
          <p className={`text-lg font-medium ${getScoreColor(result.score)}`}>
            {getScoreRating(result.score)}
          </p>
          <Progress value={result.score} className="mt-4" />
        </CardContent>
      </Card>

      {/* Overall Safety */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <Shield className="h-5 w-5 mr-2" />
            全体的な安全レベル
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Badge className={getSafetyColor(result.overallSafety)}>
              レベル {result.overallSafety}: {getSafetyLabel(result.overallSafety)}
            </Badge>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((level) => (
                <Star
                  key={level}
                  className={`h-5 w-5 ${
                    level <= result.overallSafety
                      ? "text-yellow-400 fill-current"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detected Hazards */}
      {result.hazards.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
              発見された危険要素 ({result.hazards.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.hazards.map((hazard, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{hazard.type}</h4>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={hazard.severity >= 4 ? "destructive" : hazard.severity >= 3 ? "default" : "secondary"}
                    >
                      深刻度: {hazard.severity}/5
                    </Badge>
                    <Badge variant="outline">
                      確信度: {Math.round(hazard.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
                <p className="text-gray-700 mb-2">{hazard.description}</p>
                <p className="text-sm text-gray-500">
                  <strong>場所:</strong> {hazard.location}
                </p>
              </div>
            ))}
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

      {/* Play Again Button */}
      <div className="text-center pt-4">
        <button
          onClick={onPlayAgain}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors"
        >
          もう一度プレイ
        </button>
      </div>
    </div>
  )
}
