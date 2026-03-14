"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, Map, Route, ShieldAlert, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { markTutorialCompleted } from "@/lib/tutorial-storage"

interface UsageTutorialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function StepIcon({
  icon: Icon,
  className,
}: {
  icon: typeof Route
  className: string
}) {
  return (
    <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${className}`}>
      <Icon className="h-7 w-7 text-white" />
    </div>
  )
}

export default function UsageTutorialDialog({ open, onOpenChange }: UsageTutorialDialogProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const tutorialSteps = useMemo(
    () => [
      {
        title: "通学ルートを選ぶ",
        description: "まずはお子さんが普段使う通学ルートを選択します",
        icon: <StepIcon icon={Route} className="bg-gradient-to-br from-sky-500 to-blue-600" />,
        content: (
          <div className="space-y-4">
            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <p className="text-sm font-semibold text-sky-900">最初にやること</p>
              <p className="mt-2 text-sm leading-6 text-sky-800">
                画面左上のルート選択から、いつもの通学路を1つ選びます。
                まだ登録していない場合は、通学路管理から先に追加してください。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-900">見るポイント</p>
                <ul className="mt-2 space-y-2 text-xs text-slate-600">
                  <li>いつもの登校ルートか</li>
                  <li>雨の日ルートなど代替ルートがあるか</li>
                  <li>家族で共有したいルートか</li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-900">この後の流れ</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  ルートを選ぶと、このルートに対する安全サマリーと危険箇所が確認できます。
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "安全サマリーを見る",
        description: "開いてすぐに今日の通学路が安全かを確認します",
        icon: <StepIcon icon={ShieldAlert} className="bg-gradient-to-br from-amber-500 to-orange-600" />,
        content: (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">最優先で見る場所</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                画面上部の安全サマリーに `安全` `注意` `要確認` のいずれかが表示されます。
                朝はここだけでも確認すれば、今日の判断がしやすくなります。
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <Badge className="bg-emerald-600 hover:bg-emerald-600">安全</Badge>
                <p className="text-sm text-emerald-900">大きな危険情報は見つかっていません</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <Badge className="bg-amber-500 hover:bg-amber-500">注意</Badge>
                <p className="text-sm text-amber-900">気になる地点があるので詳細を確認します</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                <Badge variant="destructive">要確認</Badge>
                <p className="text-sm text-rose-900">登校前に危険箇所を必ず確認します</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "危険箇所を確認する",
        description: "理由、情報源、更新日時を見て納得して判断します",
        icon: <StepIcon icon={Map} className="bg-gradient-to-br from-emerald-500 to-teal-600" />,
        content: (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">詳細で確認すること</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-emerald-800">
                <li>なぜ危険なのか</li>
                <li>どの情報源なのか</li>
                <li>いつ更新された情報なのか</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">使い方の目安</p>
              <ol className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                <li>1. まず安全サマリーで全体判断を見る</li>
                <li>2. 次に判定の根拠で危険箇所を確認する</li>
                <li>3. 必要なら地図や家族共有で詳しく見る</li>
              </ol>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-center">
              <p className="text-sm font-semibold text-sky-900">
                あとから右下の「使い方」ボタンでいつでも見直せます
              </p>
            </div>
          </div>
        ),
      },
    ],
    [],
  )

  useEffect(() => {
    if (!open) {
      setCurrentStep(0)
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return

      if (event.key === "ArrowRight" && currentStep < tutorialSteps.length - 1) {
        event.preventDefault()
        setCurrentStep((step) => step + 1)
      }

      if (event.key === "ArrowLeft" && currentStep > 0) {
        event.preventDefault()
        setCurrentStep((step) => step - 1)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [currentStep, open, tutorialSteps.length])

  const closeTutorial = () => {
    markTutorialCompleted()
    setCurrentStep(0)
    onOpenChange(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      closeTutorial()
      return
    }
    onOpenChange(true)
  }

  const currentStepData = tutorialSteps[currentStep]
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col overflow-hidden sm:max-w-2xl">
        <DialogClose className="absolute right-4 top-4 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-gray-100 p-1.5 transition-colors hover:bg-gray-200">
          <X className="h-5 w-5 text-gray-600" />
          <span className="sr-only">閉じる</span>
        </DialogClose>

        <DialogHeader className="pr-12 text-center">
          <div className="mb-3 flex justify-center">{currentStepData.icon}</div>
          <DialogTitle className="text-xl font-bold">{currentStepData.title}</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {currentStepData.description}
          </DialogDescription>
          <div className="sr-only" aria-atomic="true" aria-live="polite">
            {`ステップ ${currentStep + 1} / ${tutorialSteps.length}: ${currentStepData.title}`}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">{currentStepData.content}</div>

        <div className="mb-4 space-y-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-center gap-2" role="tablist" aria-label="チュートリアルステップ">
            {tutorialSteps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                role="tab"
                aria-selected={index === currentStep}
                aria-label={`ステップ ${index + 1}: ${step.title}`}
                onClick={() => setCurrentStep(index)}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  index === currentStep ? "scale-125 bg-sky-600" : "bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
            disabled={currentStep === 0}
            aria-label="前のステップへ"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            前へ
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={closeTutorial} aria-label="チュートリアルをスキップ">
              スキップ
            </Button>
            {currentStep === tutorialSteps.length - 1 ? (
              <Button onClick={closeTutorial} aria-label="チュートリアルを完了してアプリを始める">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                始める
              </Button>
            ) : (
              <Button
                onClick={() =>
                  setCurrentStep((step) => Math.min(step + 1, tutorialSteps.length - 1))
                }
                aria-label="次のステップへ"
              >
                次へ
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
