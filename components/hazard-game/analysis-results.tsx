"use client"

import React from "react"
import { AlertTriangle, Shield, Lightbulb, Trophy, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { HazardAnalysisResult } from "@/lib/openai"

interface AnalysisResultsProps {
  result: HazardAnalysisResult
  onPlayAgain: () => void
}

export function AnalysisResults({ result, onPlayAgain }: AnalysisResultsProps) {
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