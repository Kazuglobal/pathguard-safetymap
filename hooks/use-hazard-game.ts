"use client"

import { useState } from "react"
import useSWR from "swr"
import { useSupabase } from "@/components/providers/supabase-provider"
import { HazardAnalysisResult } from "@/lib/openai"

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
  const { supabase } = useSupabase()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<HazardAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch game history and stats
  const { data: gameHistory, error: historyError, mutate } = useSWR<GameHistoryResponse>(
    "hazard-game-history",
    async () => {
      const response = await fetch("/api/hazard-game/analyze")
      if (!response.ok) {
        throw new Error("Failed to fetch game history")
      }
      return response.json()
    },
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  )

  // Convert image file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        // Remove data:image/...;base64, prefix
        const base64 = result.split(",")[1]
        resolve(base64)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  // Analyze image for hazards
  const analyzeImage = async (imageFile: File, userDetectedHazards?: string[]) => {
    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      // Convert image to base64
      const imageBase64 = await fileToBase64(imageFile)

      // Call API
      const response = await fetch("/api/hazard-game/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64,
          userDetectedHazards,
        }),
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        
        console.error('API Error Response:', JSON.stringify(errorData, null, 2))
        console.error('Response status:', response.status)
        console.error('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))
        
        // Show more detailed error information in development
        if (process.env.NODE_ENV === 'development' && errorData.debugInfo) {
          console.error('Debug info:', JSON.stringify(errorData.debugInfo, null, 2))
        }
        
        throw new Error(errorData.error || errorData.message || `画像の分析に失敗しました (Status: ${response.status})`)
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
  }
}