"use client"

import React from "react"
import { Loader2, Eye, Brain, Calculator, CheckCircle, ChevronRight } from "lucide-react"
import type { PipelineProgress, PipelineStage } from "@/lib/hazard-game-types"

interface LoadingAnimationProps {
  pipelineProgress?: PipelineProgress | null
}

const STAGES: {
  id: PipelineStage
  label: string
  activeLabel: string
  icon: typeof Eye
  color: string
  bgActive: string
  bgDone: string
}[] = [
  { id: "vision", label: "画像認識", activeLabel: "画像を分析中...", icon: Eye, color: "text-blue-600", bgActive: "bg-blue-100", bgDone: "bg-blue-500" },
  { id: "think", label: "リスク推論", activeLabel: "リスクを評価中...", icon: Brain, color: "text-green-600", bgActive: "bg-green-100", bgDone: "bg-green-500" },
  { id: "score", label: "スコア算出", activeLabel: "スコアを計算中...", icon: Calculator, color: "text-purple-600", bgActive: "bg-purple-100", bgDone: "bg-purple-500" },
  { id: "complete", label: "完了", activeLabel: "完了", icon: CheckCircle, color: "text-emerald-600", bgActive: "bg-emerald-100", bgDone: "bg-emerald-500" },
]

function getStageState(
  stageId: PipelineStage,
  progress: PipelineProgress
): "pending" | "active" | "done" {
  if (progress.stagesCompleted.includes(stageId)) return "done"
  if (progress.currentStage === stageId) return "active"
  return "pending"
}

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000)
  return `${sec}秒`
}

export function LoadingAnimation({ pipelineProgress }: LoadingAnimationProps) {
  if (!pipelineProgress) {
    // Fallback: simple spinner
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="h-6 w-6 text-blue-400" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">AI が写真を分析中...</h3>
          <p className="text-gray-600 max-w-md">画像から潜在的な危険要素を検出し、安全性を評価しています</p>
        </div>
      </div>
    )
  }

  const activeStage = STAGES.find((s) => s.id === pipelineProgress.currentStage)

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      {/* Active stage label */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {activeStage?.activeLabel ?? "分析中..."}
        </h3>
        <p className="text-sm text-gray-500">
          経過時間: {formatElapsed(pipelineProgress.elapsedMs)}
        </p>
      </div>

      {/* Pipeline stages */}
      <div className="flex items-center space-x-2">
        {STAGES.map((stage, idx) => {
          const state = getStageState(stage.id, pipelineProgress)
          const Icon = stage.icon

          return (
            <React.Fragment key={stage.id}>
              {idx > 0 && (
                <ChevronRight
                  className={`h-4 w-4 flex-shrink-0 ${
                    state === "done" || state === "active"
                      ? "text-gray-400"
                      : "text-gray-200"
                  }`}
                />
              )}
              <div className="flex flex-col items-center space-y-2">
                <div
                  className={`relative p-3 rounded-full transition-all duration-300 ${
                    state === "done"
                      ? `${stage.bgDone} text-white`
                      : state === "active"
                        ? `${stage.bgActive} ${stage.color} animate-pulse`
                        : "bg-gray-100 text-gray-300"
                  }`}
                >
                  {state === "done" ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : state === "active" ? (
                    <>
                      <Icon className="h-5 w-5" />
                      <Loader2 className="absolute -top-1 -right-1 h-4 w-4 animate-spin text-gray-500" />
                    </>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    state === "done"
                      ? "text-gray-700"
                      : state === "active"
                        ? "text-gray-900"
                        : "text-gray-400"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* Hint */}
      <div className="bg-blue-50 rounded-lg p-4 max-w-md text-center">
        <p className="text-sm text-blue-800">
          <strong>PathGuardian Pipeline:</strong> Vision → Think → Score の3段階でAIが安全性を評価しています
        </p>
      </div>
    </div>
  )
}
