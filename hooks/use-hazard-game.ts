"use client"

import { useState, useRef } from "react"
import useSWR from "swr"
import { HazardAnalysisResult } from "@/lib/openai"
import { compressImage, fileToBase64 } from "@/lib/image-utils"

interface GameSession {
  id: string
  user_id: string
  analysis_result: HazardAnalysisResult
  score: number
  hazards_detected: number
  overall_safety: number
  created_at: string
  updated_at: string
}

interface GameStats {
  totalSessions: number
  averageScore: number
  highScore: number
  totalHazardsDetected: number
}

interface GameHistoryResponse {
  sessions: GameSession[]
  stats: GameStats
}

export function useHazardGame() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<HazardAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastAnalyzeAtRef = useRef(0)

  // Fetch game history and stats
  const { data: gameHistory, error: historyError, mutate } = useSWR<GameHistoryResponse>(
    "hazard-game-history",
    async () => {
      const response = await fetch("/api/hazard-game/analyze", { headers: { Accept: 'application/json' } })
      if (!response.ok) {
        throw new Error("Failed to fetch game history")
      }
      return response.json()
    },
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  )

  // Analyze image for hazards
  const analyzeImage = async (
    imageFile: File, 
    userDetectedHazards?: string[],
    promptType: "default" | "expert" | "child" = "default"
  ) => {
    const now = Date.now()
    if (now - lastAnalyzeAtRef.current < 1500) {
      const message = "連続リクエストは少し待ってからお試しください。"
      setError(message)
      throw new Error(message)
    }
    lastAnalyzeAtRef.current = now

    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      // Compress large images, then convert to base64
      const compressed = await compressImage(imageFile)
      const imageBase64 = await fileToBase64(compressed)

      // Call API
      const response = await fetch("/api/hazard-game/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          imageBase64,
          userDetectedHazards,
          promptType,
        }),
      })

      // Robust error handling that doesn’t assume JSON error bodies
      if (!response.ok) {
        const ct = response.headers.get('content-type') || ''
        let friendlyMessage = `画像の解析に失敗しました (Status: ${response.status})`
        let errorData: any = {}

        if (ct.includes('application/json')) {
          try {
            errorData = await response.json()
            friendlyMessage = errorData.error || errorData.message || friendlyMessage
          } catch (e) {
            console.error('Failed to parse error response:', e)
          }
        } else {
          const text = await response.text()
          if (response.status === 413 || /Too Large|FUNCTION_PAYLOAD_TOO_LARGE/i.test(text)) {
            friendlyMessage = '画像が大きすぎます。5MB超の場合は縮小してから再試行してください。'
          } else if (response.status === 406) {
            friendlyMessage = '要求の形式が受け入れられません (406)。Accept や Content-Type をご確認ください。'
          }
          console.error('Non-JSON error body:', text)
        }

        console.error('Response status:', response.status)
        console.error('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))
        if (process.env.NODE_ENV === 'development' && (errorData as any).debugInfo) {
          console.error('Debug info:', JSON.stringify((errorData as any).debugInfo, null, 2))
        }

        throw new Error(friendlyMessage)
      }

      const result = await response.json()
      setAnalysisResult(result)

      // Refresh game history to include new session
      mutate()

      return result as HazardAnalysisResult & { sessionId?: string }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "予期しないエラーが発生しました"
      setError(errorMessage)
      throw err
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Reset analysis state
  const resetAnalysis = () => {
    setAnalysisResult(null)
    setError(null)
  }

  // Calculate user rank based on high score
  const getUserRank = (score: number): string => {
    if (score >= 95) return "安全マスター"
    if (score >= 90) return "危険発見エキスパート"
    if (score >= 80) return "安全分析者"
    if (score >= 70) return "危険察知者"
    if (score >= 60) return "安全意識者"
    return "見習い分析者"
  }

  // Get achievement level based on total sessions
  const getAchievementLevel = (totalSessions: number): string => {
    if (totalSessions >= 100) return "レジェンド"
    if (totalSessions >= 50) return "マスター"
    if (totalSessions >= 25) return "エキスパート"
    if (totalSessions >= 10) return "アマチュア"
    if (totalSessions >= 5) return "初心者"
    return "ビギナー"
  }

  return {
    // State
    isAnalyzing,
    analysisResult,
    error,
    gameHistory: gameHistory?.sessions || [],
    gameStats: gameHistory?.stats || {
      totalSessions: 0,
      averageScore: 0,
      highScore: 0,
      totalHazardsDetected: 0,
    },
    historyError,

    // Actions
    analyzeImage,
    resetAnalysis,
    refreshHistory: mutate,

    // Utilities
    getUserRank,
    getAchievementLevel,
    fileToBase64,
    compressImage,
  }
}
