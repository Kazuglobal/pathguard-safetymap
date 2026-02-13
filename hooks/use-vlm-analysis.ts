"use client"

import { useState, useCallback, useRef } from "react"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useToast } from "@/components/ui/use-toast"
import {
  analyzeHazardWithVLM,
  type VlmAnalysisResult,
  type AnalyzeHazardRequest,
} from "@/lib/vlm-analysis"

export type VlmAnalysisStatus = "idle" | "analyzing" | "completed" | "failed"

export interface UseVlmAnalysisReturn {
  // State
  status: VlmAnalysisStatus
  result: VlmAnalysisResult | null
  error: string | null

  // Actions
  startAnalysis: (params: {
    reportId: string
    imageUrl: string
    additionalContext?: string
  }) => Promise<void>
  reset: () => void
  retry: () => void

  // Derived state
  isAnalyzing: boolean
  isCompleted: boolean
  hasFailed: boolean
}

/**
 * React hook for managing VLM hazard analysis lifecycle and state
 *
 * State machine: idle → analyzing → completed/failed
 *
 * Features:
 * - Concurrent request prevention
 * - Retry support with stored request parameters
 * - Toast notifications for success/error
 * - Graceful error handling
 */
export function useVlmAnalysis(): UseVlmAnalysisReturn {
  const { supabase } = useSupabase()
  const { toast } = useToast()

  const [status, setStatus] = useState<VlmAnalysisStatus>("idle")
  const [result, setResult] = useState<VlmAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Store last request for retry functionality
  const lastRequestRef = useRef<AnalyzeHazardRequest | null>(null)

  // Prevent concurrent requests
  const isAnalyzingRef = useRef(false)

  const startAnalysis = useCallback(
    async (params: {
      reportId: string
      imageUrl: string
      additionalContext?: string
    }) => {
      // Guard against concurrent requests
      if (isAnalyzingRef.current) {
        console.warn("[VLM Analysis] Already analyzing, skipping request")
        return
      }

      // Validation
      if (!params.reportId || !params.imageUrl) {
        toast({
          title: "エラー",
          description: "分析に必要な情報が不足しています",
          variant: "destructive",
        })
        return
      }

      const request: AnalyzeHazardRequest = {
        report_id: params.reportId,
        image_url: params.imageUrl,
        additional_context: params.additionalContext,
      }

      lastRequestRef.current = request
      isAnalyzingRef.current = true
      setStatus("analyzing")
      setError(null)

      try {
        const response = await analyzeHazardWithVLM(supabase, request)

        if (!response.success || !response.analysis) {
          throw new Error(response.error || "分析に失敗しました")
        }

        setResult(response.analysis)
        setStatus("completed")

        toast({
          title: "分析完了",
          description: `${response.analysis.hazards.length}件のリスク要因を検出しました`,
        })
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "予期しないエラーが発生しました"

        setError(errorMessage)
        setStatus("failed")

        toast({
          title: "分析エラー",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        isAnalyzingRef.current = false
      }
    },
    [supabase, toast]
  )

  const retry = useCallback(() => {
    if (!lastRequestRef.current) {
      toast({
        title: "エラー",
        description: "再試行する分析リクエストがありません",
        variant: "destructive",
      })
      return
    }

    startAnalysis({
      reportId: lastRequestRef.current.report_id,
      imageUrl: lastRequestRef.current.image_url,
      additionalContext: lastRequestRef.current.additional_context,
    })
  }, [startAnalysis, toast])

  const reset = useCallback(() => {
    setStatus("idle")
    setResult(null)
    setError(null)
    lastRequestRef.current = null
    isAnalyzingRef.current = false
  }, [])

  return {
    status,
    result,
    error,
    startAnalysis,
    reset,
    retry,
    isAnalyzing: status === "analyzing",
    isCompleted: status === "completed",
    hasFailed: status === "failed",
  }
}
