"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  Camera,
  Sparkles,
  Map,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Ban,
  Lightbulb,
  Heart,
  Target,
  Trophy,
  TrendingUp,
} from "lucide-react"
import { markTutorialCompleted } from "@/lib/tutorial-storage"

interface UsageTutorialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CardIcon({ icon: Icon, gradient }: { icon: React.ElementType; gradient: string }) {
  return (
    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg`}>
      <Icon className="w-7 h-7 text-white" />
    </div>
  )
}

export default function UsageTutorialDialog({ open, onOpenChange }: UsageTutorialDialogProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const tutorialSteps = useMemo(() => [
    {
      title: "PathGuardianへようこそ",
      description: "あなたの目が、地域の安全を守ります",
      icon: <CardIcon icon={Shield} gradient="from-sky-500 to-blue-600" />,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-800 mb-2">
              お子さんの通学路、本当に安全ですか？
            </p>
            <p className="text-gray-600 leading-relaxed">
              PathGuardianは、あなたが撮った1枚の写真から
              AIが危険を見つけ、地域みんなで安全を守るアプリです。
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col items-center p-3 bg-sky-50 rounded-xl border border-sky-100">
              <Camera className="w-5 h-5 text-sky-600 mb-1.5" />
              <p className="text-xs font-medium text-sky-800 text-center">気になる場所を撮影</p>
            </div>
            <div className="flex flex-col items-center p-3 bg-amber-50 rounded-xl border border-amber-100">
              <Sparkles className="w-5 h-5 text-amber-600 mb-1.5" />
              <p className="text-xs font-medium text-amber-800 text-center">AIが安全性を分析</p>
            </div>
            <div className="flex flex-col items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <Map className="w-5 h-5 text-emerald-600 mb-1.5" />
              <p className="text-xs font-medium text-emerald-800 text-center">マップで共有・確認</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 p-3 rounded-xl border border-sky-100">
            <p className="text-sm text-sky-700 font-medium text-center">
              あなたの1枚の写真が、子どもの通学路を安全にします
            </p>
          </div>
        </div>
      )
    },
    {
      title: "撮影ガイド",
      description: "気になる場所をスマホで撮影するだけ",
      icon: <CardIcon icon={Camera} gradient="from-blue-500 to-indigo-600" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">撮影すべき場所</p>
              </div>
              <ul className="text-xs text-emerald-700 space-y-1.5">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">&#9679;</span>
                  <span>古い建物・ブロック塀</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">&#9679;</span>
                  <span>ひび割れした道路・歩道</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">&#9679;</span>
                  <span>傾いた電柱・標識</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">&#9679;</span>
                  <span>見通しの悪い交差点</span>
                </li>
              </ul>
            </div>
            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
              <div className="flex items-center gap-2 mb-2">
                <Ban className="w-4 h-4 text-red-500" />
                <p className="text-sm font-semibold text-red-800">撮影を避けるもの</p>
              </div>
              <ul className="text-xs text-red-700 space-y-1.5">
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5">&#9679;</span>
                  <span>人の顔が写る写真</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5">&#9679;</span>
                  <span>プライベートな場所</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5">&#9679;</span>
                  <span>車のナンバープレート</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5">&#9679;</span>
                  <span>個人情報が含まれるもの</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                <strong>コツ:</strong> 明るい時間帯に、対象物全体がはっきり写るように撮影しましょう
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "AIが安全性を自動判定",
      description: "写真を送るだけで、AIが総合的に分析します",
      icon: <CardIcon icon={Sparkles} gradient="from-amber-500 to-orange-600" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 text-sm text-center">
            AIが建物の老朽化、道路状況、交通環境、災害リスクなどを
            総合的に分析し、5段階で安全性を評価します。
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-red-50/50">
              <Badge variant="destructive" className="w-14 text-center text-xs">危険</Badge>
              <span className="text-sm text-gray-700">早急な対策が必要</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-orange-50/50">
              <Badge className="w-14 text-center text-xs bg-orange-500 hover:bg-orange-500">注意</Badge>
              <span className="text-sm text-gray-700">継続的な監視が推奨</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-yellow-50/50">
              <Badge className="w-14 text-center text-xs bg-yellow-500 hover:bg-yellow-500">普通</Badge>
              <span className="text-sm text-gray-700">定期点検を推奨</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50/50">
              <Badge className="w-14 text-center text-xs bg-blue-500 hover:bg-blue-500">良好</Badge>
              <span className="text-sm text-gray-700">現状維持で問題なし</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-green-50/50">
              <Badge className="w-14 text-center text-xs bg-green-500 hover:bg-green-500">安全</Badge>
              <span className="text-sm text-gray-700">非常に良好な状態</span>
            </div>
          </div>
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
            <p className="text-xs text-amber-700 text-center">
              詳細な分析レポート（子ども目線・時間帯別リスク・改善提案）は
              報告完了後に確認できます
            </p>
          </div>
        </div>
      )
    },
    {
      title: "マップで地域の安全を確認",
      description: "あなたの報告がリアルタイムでマップに反映されます",
      icon: <CardIcon icon={Map} gradient="from-emerald-500 to-teal-600" />,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-100">
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span><strong>マーカーをタップ</strong>して詳細情報や写真を確認</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span><strong>他のユーザーの報告</strong>も確認できます</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span><strong>フィルター機能</strong>で危険度別に表示を切り替え</span>
              </li>
            </ul>
          </div>
          <div className="bg-sky-50 p-3 rounded-xl border border-sky-100">
            <div className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
              <p className="text-sm text-sky-700">
                報告が増えるほど、安全マップが充実し地域全体の安全が高まります
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "みんなで守る安全なまち",
      description: "あなたの参加が、地域全体の安全につながります",
      icon: <CardIcon icon={Users} gradient="from-violet-500 to-purple-600" />,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 leading-relaxed">
              PathGuardianは一人ひとりの報告で成り立っています。
              あなたが見つけた危険が、誰かの安全を守ります。
            </p>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 p-4 rounded-xl border border-violet-100">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              <p className="text-sm font-semibold text-violet-800">楽しみながら続けられる工夫</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs text-gray-700">バッジ・ポイント</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-xs text-gray-700">ランキング</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                <Target className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-xs text-gray-700">デイリーミッション</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                <Heart className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="text-xs text-gray-700">いいね・コメント</span>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 p-4 rounded-xl border border-sky-100 text-center">
            <p className="text-sm font-semibold text-blue-800 mb-1">
              さあ、まずは周辺の安全を確認してみましょう！
            </p>
            <p className="text-xs text-blue-600">
              マップをタップして、気になる場所を報告できます
            </p>
          </div>
        </div>
      )
    }
  ], [])

  // キーボードナビゲーション
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(currentStep + 1)
          }
          break
        case 'Home':
          e.preventDefault()
          setCurrentStep(0)
          break
        case 'End':
          e.preventDefault()
          setCurrentStep(tutorialSteps.length - 1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, currentStep, tutorialSteps.length])

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleClose = () => {
    setCurrentStep(0)
    onOpenChange(false)
    markTutorialCompleted()
  }

  const currentStepData = tutorialSteps[currentStep]
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* カスタム×ボタン */}
        <DialogClose className="absolute right-4 top-4 rounded-full bg-gray-100 hover:bg-gray-200 p-1.5 transition-colors z-10 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <X className="h-5 w-5 text-gray-600" />
          <span className="sr-only">閉じる</span>
        </DialogClose>

        <DialogHeader className="text-center flex-shrink-0 pr-12">
          <div className="flex justify-center mb-3">
            {currentStepData.icon}
          </div>
          <DialogTitle className="text-xl font-bold">
            {currentStepData.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {currentStepData.description}
          </DialogDescription>
          {/* スクリーンリーダー向けステップ情報 */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            ステップ {currentStep + 1} / {tutorialSteps.length}: {currentStepData.title}
          </div>
        </DialogHeader>

        <div
          key={currentStep}
          className="py-4 overflow-y-auto flex-1 tutorial-step-animate"
          role="tabpanel"
          aria-labelledby={`step-${currentStep}`}
        >
          {currentStepData.content}
        </div>

        {/* プログレスバー + ステップインジケーター */}
        <div className="flex-shrink-0 space-y-3 mb-4">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-400 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-center gap-2" role="tablist" aria-label="チュートリアルステップ">
            {tutorialSteps.map((step, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                role="tab"
                aria-selected={index === currentStep}
                aria-label={`ステップ ${index + 1}: ${step.title}`}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                  index === currentStep
                    ? 'bg-sky-600 scale-125'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ナビゲーションボタン */}
        <div className="flex justify-between gap-3 flex-shrink-0">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2 min-h-[44px] min-w-[80px]"
            aria-label="前のステップへ"
          >
            <ChevronLeft className="w-4 h-4" />
            前へ
          </Button>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleClose}
              className="min-h-[44px] min-w-[80px]"
              aria-label="チュートリアルをスキップ"
            >
              スキップ
            </Button>

            {currentStep === tutorialSteps.length - 1 ? (
              <Button
                onClick={handleClose}
                className="bg-sky-600 hover:bg-sky-700 min-h-[44px] min-w-[80px]"
                aria-label="チュートリアルを完了してアプリを始める"
              >
                始める
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 min-h-[44px] min-w-[80px]"
                aria-label="次のステップへ"
              >
                次へ
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
