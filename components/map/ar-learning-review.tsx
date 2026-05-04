"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, HelpCircle, RotateCcw, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { KidsChecklistItem, KidsQuiz, KidsQuizAnswers } from "@/lib/ar-learning-quiz"
import { gradeKidsQuiz } from "@/lib/ar-learning-quiz"
import type { ARLearningTourSummary } from "@/lib/ar-learning-tour"
import type { RouteLearningProgressSummary } from "@/lib/ar-learning-route-progress"

interface ARLearningReviewCardProps {
  isParentChildMode: boolean
  routeId: string | null
  routeProgressSummary: RouteLearningProgressSummary
  learningSummary: ARLearningTourSummary
  checklist: KidsChecklistItem[]
  quiz: KidsQuiz | null
  quizAnswers: KidsQuizAnswers
  quizScore: number
  quizTotal: number
  quizCompletedAt: string | null
  onToggleChecklistItem: (itemId: string, checked: boolean) => void
  onCompleteQuiz: (answers: KidsQuizAnswers, score: number, total: number) => void
  onRestartTour: () => void
  onClose: () => void
  onQuizLinkClick: () => void
}

export function ARLearningReviewCard({
  isParentChildMode,
  routeId,
  routeProgressSummary,
  learningSummary,
  checklist,
  quiz,
  quizAnswers,
  quizScore,
  quizTotal,
  quizCompletedAt,
  onToggleChecklistItem,
  onCompleteQuiz,
  onRestartTour,
  onClose,
  onQuizLinkClick,
}: ARLearningReviewCardProps) {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [draftAnswers, setDraftAnswers] = useState<KidsQuizAnswers>(quizAnswers)
  const isChecklistComplete = checklist.length > 0 && checklist.every((item) => item.checked)
  const activeQuestion = quiz?.questions[activeQuestionIndex] ?? null

  const completedCount = isParentChildMode
    ? routeProgressSummary.completedCount
    : learningSummary.reviewedCount + learningSummary.savedCount
  const totalCount = isParentChildMode
    ? routeProgressSummary.totalCount
    : learningSummary.totalCount
  const reviewedCount = isParentChildMode
    ? routeProgressSummary.reviewedCount
    : learningSummary.reviewedCount
  const savedCount = isParentChildMode
    ? routeProgressSummary.savedCount
    : learningSummary.savedCount
  const highestRiskTitle = isParentChildMode
    ? routeProgressSummary.highestRiskReport?.title ?? "なし"
    : learningSummary.highestRiskStop?.report.title ?? "なし"

  const revisitItems = useMemo(() => {
    return isParentChildMode
      ? routeProgressSummary.revisitReports
      : learningSummary.revisitStops.map((stop) => stop.report)
  }, [isParentChildMode, learningSummary.revisitStops, routeProgressSummary.revisitReports])

  const handleAnswer = (questionId: string, optionId: string) => {
    if (!quiz) return

    const nextAnswers = {
      ...draftAnswers,
      [questionId]: optionId,
    }
    setDraftAnswers(nextAnswers)

    if (activeQuestionIndex + 1 < quiz.questions.length) {
      setActiveQuestionIndex((current) => current + 1)
      return
    }

    const result = gradeKidsQuiz(quiz, nextAnswers)
    onCompleteQuiz(nextAnswers, result.score, result.total)
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
      <Card className="pointer-events-auto max-h-[calc(100vh-6rem)] overflow-y-auto rounded-3xl bg-white/95 p-5 shadow-2xl backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-emerald-600">TOUR SUMMARY</p>
            <h3 className="text-lg font-bold text-slate-900">通学路の振り返り</h3>
          </div>
          <Badge className="rounded-full bg-emerald-600 text-white">
            {completedCount}/{totalCount}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-slate-100 px-3 py-3">
            <p className="text-xs text-slate-500">確認済み</p>
            <p className="text-lg font-bold text-slate-900">{reviewedCount}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-3 py-3">
            <p className="text-xs text-amber-700">見返し</p>
            <p className="text-lg font-bold text-amber-900">{savedCount}</p>
          </div>
          <div className="rounded-2xl bg-rose-50 px-3 py-3">
            <p className="text-xs text-rose-700">最重要</p>
            <p className="text-sm font-bold text-rose-900">{highestRiskTitle}</p>
          </div>
        </div>

        {revisitItems.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500">あとで見返す地点</p>
            <div className="flex flex-wrap gap-2">
              {revisitItems.map((report) => (
                <Badge key={report.id} variant="secondary" className="rounded-full">
                  {report.title}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {isParentChildMode && (
          <div className="mt-4 space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <h4 className="font-bold text-slate-900">親子チェックリスト</h4>
              </div>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex min-h-11 items-start gap-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-800 shadow-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0"
                      checked={item.checked}
                      onChange={(event) => onToggleChecklistItem(item.id, event.target.checked)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-indigo-700" aria-hidden="true" />
                <h4 className="font-bold text-slate-900">安全クイズ</h4>
              </div>

              {quizCompletedAt && (
                <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                  <p className="text-sm text-slate-600">理解度</p>
                  <p className="text-2xl font-bold text-indigo-700">
                    {quizScore} / {quizTotal}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    親子で答えをふり返って、次に歩くときも同じ行動を確認しましょう。
                  </p>
                </div>
              )}

              {!quizCompletedAt && !isChecklistComplete && (
                <p className="rounded-xl bg-white p-4 text-sm leading-6 text-slate-700">
                  チェックリストをすべて確認すると、最大3問のクイズを始められます。
                </p>
              )}

              {!quizCompletedAt && isChecklistComplete && activeQuestion && (
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="mb-2 text-xs font-semibold text-indigo-700">
                    問題 {activeQuestionIndex + 1} / {quiz?.questions.length ?? 0}
                  </p>
                  <p className="text-base font-bold leading-7 text-slate-900">{activeQuestion.prompt}</p>
                  <div className="mt-4 grid gap-2">
                    {activeQuestion.options.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant="outline"
                        className="min-h-11 justify-start rounded-xl bg-white text-left"
                        onClick={() => handleAnswer(activeQuestion.id, option.id)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button type="button" className="min-h-11 rounded-2xl" onClick={onRestartTour}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            もう一度見る
          </Button>
          {isParentChildMode && routeId && (
            <Button
              type="button"
              asChild
              variant="outline"
              className="min-h-11 rounded-2xl"
              onClick={onQuizLinkClick}
            >
              <Link href={`/route-quiz?routeId=${encodeURIComponent(routeId)}`}>
                地図クイズへ
              </Link>
            </Button>
          )}
          <Button type="button" variant="outline" className="min-h-11 rounded-2xl" onClick={onClose}>
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            閉じる
          </Button>
        </div>
      </Card>
    </div>
  )
}
