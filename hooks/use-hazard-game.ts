"use client"

import { useState, useRef, useCallback } from "react"
import useSWR from "swr"
import { useSupabase } from "@/components/providers/supabase-provider"
import type {
  PipelineAnalysisResult,
  PipelineProgress,
  PipelineStage,
} from "@/lib/hazard-game-types"
import { compressImage, fileToBase64 } from "@/lib/image-utils"

interface GameSession {
  id: string
  user_id: string
  analysis_result: PipelineAnalysisResult
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

const EMPTY_GAME_HISTORY: GameHistoryResponse = {
  sessions: [],
  stats: {
    totalSessions: 0,
    averageScore: 0,
    highScore: 0,
    totalHazardsDetected: 0,
  },
}

const STAGE_DELAY_MS = 300

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useHazardGame() {
  const { supabase } = useSupabase()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<PipelineAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress | null>(null)
  const lastAnalyzeAtRef = useRef(0)

  // Fetch game history and stats
  const { data: gameHistory, error: historyError, mutate } = useSWR<GameHistoryResponse>(
    "hazard-game-history",
    async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          // "Auth session missing" is expected when user is not logged in.
          if (!userError.message?.includes("Auth session missing")) {
            console.error("useHazardGame: getUser error", userError)
          }
          return EMPTY_GAME_HISTORY
        }

        if (!user) return EMPTY_GAME_HISTORY

        const response = await fetch("/api/hazard-game/analyze", {
          headers: { Accept: "application/json" },
        })

        if (response.status === 401) {
          return EMPTY_GAME_HISTORY
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch game history (status: ${response.status})`)
        }

        return response.json()
      } catch (fetchError) {
        console.error("useHazardGame: failed to fetch history", fetchError)
        return EMPTY_GAME_HISTORY
      }
    },
    {
      refreshInterval: 30000,
      shouldRetryOnError: false,
    }
  )

  const updateProgress = useCallback((stage: PipelineStage, completed: PipelineStage[], startTime: number) => {
    setPipelineProgress({
      currentStage: stage,
      stagesCompleted: completed,
      startTime,
      elapsedMs: Date.now() - startTime,
    })
  }, [])

  // Analyze image using pipeline
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

    const startTime = Date.now()
    updateProgress("vision", [], startTime)

    try {
      const compressed = await compressImage(imageFile)
      const imageBase64 = await fileToBase64(compressed)

      // Show think stage while API call is in progress
      updateProgress("think", ["vision"], startTime)

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

      if (!response.ok) {
        const ct = response.headers.get('content-type') || ''
        let friendlyMessage = `画像の解析に失敗しました (Status: ${response.status})`

        if (ct.includes('application/json')) {
          try {
            const errorData = await response.json()
            friendlyMessage = errorData.error || errorData.message || friendlyMessage
          } catch (e) {
            console.error('Failed to parse error response:', e)
          }
        } else {
          const text = await response.text()
          if (response.status === 413 || /Too Large|FUNCTION_PAYLOAD_TOO_LARGE/i.test(text)) {
            friendlyMessage = '画像が大きすぎます。5MB超の場合は縮小してから再試行してください。'
          }
          console.error('Non-JSON error body:', text)
        }

        throw new Error(friendlyMessage)
      }

      // Simulate score stage transition
      updateProgress("score", ["vision", "think"], startTime)
      await delay(STAGE_DELAY_MS)

      const responseData = await response.json()

      // Build PipelineAnalysisResult from response
      const result: PipelineAnalysisResult = {
        vision: responseData.vision,
        think: responseData.think,
        score: responseData.score,
        educationalTips: responseData.educationalTips ?? [],
        analysisTimestamp: responseData.analysisTimestamp ?? new Date().toISOString(),
      }

      // Complete
      updateProgress("complete", ["vision", "think", "score"], startTime)
      await delay(STAGE_DELAY_MS)

      setAnalysisResult(result)
      mutate()

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "予期しないエラーが発生しました"
      setError(errorMessage)
      throw err
    } finally {
      setIsAnalyzing(false)
      setPipelineProgress(null)
    }
  }

  const resetAnalysis = () => {
    setAnalysisResult(null)
    setError(null)
    setPipelineProgress(null)
  }

  const getUserRank = (score: number): string => {
    if (score >= 95) return "安全マスター"
    if (score >= 90) return "危険発見エキスパート"
    if (score >= 80) return "安全分析者"
    if (score >= 70) return "危険察知者"
    if (score >= 60) return "安全意識者"
    return "見習い分析者"
  }

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
    pipelineProgress,
    gameHistory: gameHistory?.sessions || [],
    gameStats: gameHistory?.stats || EMPTY_GAME_HISTORY.stats,
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
