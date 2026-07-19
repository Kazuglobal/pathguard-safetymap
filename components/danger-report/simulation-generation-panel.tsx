"use client"

import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react"

import {
  allPrompts,
  defaultSituations,
  getPromptById,
  promptCategories,
  type DefaultSituation,
  type TargetAudience,
} from "@/lib/disaster-scenario-prompts"
import { tankenTokens } from "@/lib/design/tanken"
import { PaperCard, TankenButton } from "./wizard/ui"

export type BatchSimulationImage = {
  promptId: string
  name: string
  shortName: string
  targetAudience: TargetAudience
  blobUrl: string
  file: File
}

type BatchProgress = {
  current: number
  total: number
  currentName: string
}

type SimulationGenerationPanelProps = {
  situation: DefaultSituation
  onSituationChange: (situation: DefaultSituation) => void
  floodEnabled: boolean
  floodDisabledReason?: string
  accidentEnabled: boolean
  accidentDisabledReason: string
  regenerationLoading: boolean
  hasOriginalImage: boolean
  onRegenerate: () => void
  advancedOpen: boolean
  onAdvancedOpenChange: (open: boolean) => void
  selectedCategory: TargetAudience
  onCategoryChange: (category: TargetAudience) => void
  selectedPromptId: string
  onSelectedPromptChange: (promptId: string) => void
  showPromptDetails: boolean
  onShowPromptDetailsChange: (show: boolean) => void
  batchLoading: boolean
  batchProgress: BatchProgress | null
  onBatchGenerate: () => void
  batchImages: BatchSimulationImage[]
  showBatchResults: boolean
  onShowBatchResultsChange: (show: boolean) => void
  onAddBatchImage: (image: BatchSimulationImage) => void
}

const C = tankenTokens.color

export function SimulationGenerationPanel({
  situation,
  onSituationChange,
  floodEnabled,
  floodDisabledReason,
  accidentEnabled,
  accidentDisabledReason,
  regenerationLoading,
  hasOriginalImage,
  onRegenerate,
  advancedOpen,
  onAdvancedOpenChange,
  selectedCategory,
  onCategoryChange,
  selectedPromptId,
  onSelectedPromptChange,
  showPromptDetails,
  onShowPromptDetailsChange,
  batchLoading,
  batchProgress,
  onBatchGenerate,
  batchImages,
  showBatchResults,
  onShowBatchResultsChange,
  onAddBatchImage,
}: SimulationGenerationPanelProps) {
  const selectedPrompt = selectedPromptId ? getPromptById(selectedPromptId) : undefined

  return (
    <PaperCard className="space-y-3 p-3">
      <p className="text-[13px] font-black" style={{ color: C.ink }}>
        「もしも」を えらんで つくりなおす
      </p>
      <div className="flex flex-wrap gap-1.5">
        {defaultSituations.map((item) => {
          const active = !advancedOpen && situation === item.id
          const floodDisabled = item.id === "flood" && !floodEnabled
          const accidentDisabled = item.id === "accident" && !accidentEnabled
          const disabled = floodDisabled || accidentDisabled
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              title={
                floodDisabled
                  ? floodDisabledReason
                  : accidentDisabled
                    ? accidentDisabledReason
                    : undefined
              }
              onClick={() => {
                onAdvancedOpenChange(false)
                onSituationChange(item.id)
              }}
              className={`rounded-full border-2 px-3 py-1.5 text-[12px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tankenTokens.cls.focus}`}
              style={{
                background: active ? C.primary : "#fff",
                color: active ? "#fff" : C.inkSoft,
                borderColor: active ? C.primaryStrong : "rgba(67,57,43,.14)",
              }}
            >
              {item.name}
            </button>
          )
        })}
      </div>

      <TankenButton
        variant="paper"
        className="w-full min-h-[46px]"
        onClick={onRegenerate}
        disabled={
          regenerationLoading ||
          !hasOriginalImage ||
          (advancedOpen && !selectedPromptId) ||
          (!advancedOpen && situation === "flood" && !floodEnabled) ||
          (!advancedOpen && situation === "accident" && !accidentEnabled)
        }
      >
        {regenerationLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            つくっているよ…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {advancedOpen ? "えらんだ おだいで つくる" : "この「もしも」で つくる"}
          </>
        )}
      </TankenButton>

      <div className="border-t pt-2" style={{ borderColor: tankenTokens.border.faint }}>
        <button
          type="button"
          className={`flex items-center gap-1 text-[12px] font-black ${tankenTokens.cls.focus}`}
          style={{ color: C.inkSoft }}
          onClick={() => onAdvancedOpenChange(!advancedOpen)}
          aria-expanded={advancedOpen}
        >
          {advancedOpen
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />}
          くわしい設定（おうちの人向け: 防災プロンプト・一括生成）
        </button>

        {advancedOpen && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {promptCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`rounded-full border-2 px-2.5 py-1 text-[11.5px] font-black ${tankenTokens.cls.focus}`}
                  style={{
                    background: selectedCategory === category.id ? C.primarySoft : "#fff",
                    color: selectedCategory === category.id ? C.primaryStrong : C.inkSoft,
                    borderColor:
                      selectedCategory === category.id
                        ? "rgba(21,158,114,.45)"
                        : "rgba(67,57,43,.14)",
                  }}
                  onClick={() => onCategoryChange(category.id)}
                >
                  {category.icon} {category.name}
                </button>
              ))}
            </div>

            <select
              className="w-full rounded-[12px] border-2 bg-white px-2 py-2 text-[13px] font-bold"
              style={{ borderColor: tankenTokens.border.soft, color: C.ink }}
              value={selectedPromptId}
              onChange={(event) => onSelectedPromptChange(event.target.value)}
              aria-label="防災プロンプトを選択"
            >
              <option value="">-- おだいを えらぶ --</option>
              {promptCategories
                .find((category) => category.id === selectedCategory)
                ?.prompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.shortName}: {prompt.name}
                  </option>
                ))}
            </select>

            {selectedPrompt && (
              <div
                className="rounded-[12px] border bg-white p-2 text-[11.5px] font-bold"
                style={{ borderColor: tankenTokens.border.faint, color: C.inkSoft }}
              >
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => onShowPromptDetailsChange(!showPromptDetails)}
                >
                  {showPromptDetails
                    ? <ChevronUp className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />}
                  {selectedPrompt.description}
                </button>
                {showPromptDetails && (
                  <div
                    className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded p-2"
                    style={{ background: C.paperDeep }}
                  >
                    {selectedPrompt.prompt.slice(0, 500)}
                    {selectedPrompt.prompt.length > 500 && "..."}
                  </div>
                )}
              </div>
            )}

            <TankenButton
              variant="paper"
              className="w-full min-h-[44px] text-[13px]"
              onClick={onBatchGenerate}
              disabled={batchLoading}
            >
              {batchLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {batchProgress
                    ? `つくっているよ ${batchProgress.current}/${batchProgress.total} — ${batchProgress.currentName}`
                    : "じゅんびちゅう..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  全プロンプト一括生成（{allPrompts.length}件）
                </>
              )}
            </TankenButton>

            {batchImages.length > 0 && (
              <div className="border-t pt-2" style={{ borderColor: tankenTokens.border.faint }}>
                <button
                  type="button"
                  className="mb-2 flex items-center gap-1 text-[11.5px] font-black"
                  style={{ color: C.inkSoft }}
                  onClick={() => onShowBatchResultsChange(!showBatchResults)}
                >
                  {showBatchResults
                    ? <ChevronUp className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />}
                  一括生成結果（{batchImages.length}/{allPrompts.length}件）
                </button>
                {showBatchResults && (
                  <div className="space-y-3">
                    {promptCategories.map((category) => {
                      const categoryImages = batchImages.filter(
                        (image) => image.targetAudience === category.id,
                      )
                      if (categoryImages.length === 0) return null
                      return (
                        <div key={category.id}>
                          <p className="mb-1 text-[11px] font-bold" style={{ color: C.inkFaint }}>
                            {category.name}
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {categoryImages.map((image) => (
                              <div key={image.promptId} className="w-24 flex-none">
                                <div
                                  className="group relative h-20 cursor-pointer overflow-hidden rounded-[10px] border"
                                  style={{ borderColor: tankenTokens.border.faint }}
                                  onClick={() => onAddBatchImage(image)}
                                  title={`${image.name} — タップしてレポートに追加`}
                                >
                                  <img
                                    src={image.blobUrl}
                                    alt={image.name}
                                    className="h-full w-full object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                    <span className="text-xs font-black text-white">ついか</span>
                                  </div>
                                </div>
                                <p className="mt-0.5 truncate text-[10.5px] font-bold" style={{ color: C.inkFaint }}>
                                  {image.shortName}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PaperCard>
  )
}
