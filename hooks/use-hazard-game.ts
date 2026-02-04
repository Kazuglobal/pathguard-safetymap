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

  // Maximum file size for API requests (3MB to stay under Gemini limits after Base64 encoding)
  const MAX_API_FILE_SIZE = 3 * 1024 * 1024

  // Compress large images on the client to avoid 413 from Vercel/Gemini
  const compressImage = async (
    file: File,
    maxDimension: number = 1200,
    quality: number = 0.7,
    targetMaxSize: number = MAX_API_FILE_SIZE,
  ): Promise<File> => {
    try {
      const objectUrl = URL.createObjectURL(file)
      const img: HTMLImageElement = await new Promise((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = objectUrl
      })
      URL.revokeObjectURL(objectUrl)

      const { width, height } = img

      // Helper function to create compressed file
      const createCompressedFile = async (
        targetW: number,
        targetH: number,
        q: number
      ): Promise<File> => {
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')
        ctx.drawImage(img, 0, 0, targetW, targetH)

        const supportsWebp = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0

        const blob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            b => (b ? resolve(b) : reject(new Error('Failed to create blob from canvas'))),
            supportsWebp ? 'image/webp' : 'image/jpeg',
            q,
          )
        })

        const extension = supportsWebp ? 'webp' : 'jpg'
        const mime = supportsWebp ? 'image/webp' : 'image/jpeg'
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-compressed.${extension}`, {
          type: mime,
          lastModified: Date.now(),
        })
      }

      // Initial compression with default settings
      let scale = Math.min(1, maxDimension / Math.max(width, height))
      let targetW = Math.max(1, Math.round(width * scale))
      let targetH = Math.max(1, Math.round(height * scale))

      // Skip compression for small files that don't need resizing
      if (scale === 1 && file.size <= targetMaxSize * 0.8) {
        return file
      }

      let compressedFile = await createCompressedFile(targetW, targetH, quality)

      // Progressive compression if still too large
      let attempts = 0
      const maxAttempts = 4
      let currentQuality = quality
      let currentMaxDim = maxDimension

      while (compressedFile.size > targetMaxSize && attempts < maxAttempts) {
        attempts++
        currentQuality = Math.max(0.4, currentQuality - 0.1)
        currentMaxDim = Math.max(800, currentMaxDim - 200)

        scale = Math.min(1, currentMaxDim / Math.max(width, height))
        targetW = Math.max(1, Math.round(width * scale))
        targetH = Math.max(1, Math.round(height * scale))

        console.log(`[compressImage] Retry ${attempts}: dim=${currentMaxDim}, quality=${currentQuality.toFixed(2)}`)
        compressedFile = await createCompressedFile(targetW, targetH, currentQuality)
      }

      if (compressedFile.size > targetMaxSize) {
        console.warn(`[compressImage] Could not compress below ${targetMaxSize / 1024 / 1024}MB, final size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
      } else {
        console.log(`[compressImage] Compressed to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
      }

      return compressedFile
    } catch {
      return file
    }
  }

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
  const analyzeImage = async (
    imageFile: File, 
    userDetectedHazards?: string[],
    promptType: "default" | "expert" | "child" = "default"
  ) => {
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
    compressImage,
  }
}
