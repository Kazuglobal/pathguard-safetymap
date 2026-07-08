"use client"

import { Heart, Shield, Sparkles, Target, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { BattleHp, GameHeader, ItemChip, StatusPill } from "@/components/safety-quest/quest-primitives"
import { DangerCloud } from "@/components/safety-quest/quest-characters"
import { StreetPhotoScene } from "@/components/safety-quest/street-photo-scene"

export function QuizBattleScreen({
  answer,
  isCorrect,
  onAnswer,
  onBack,
  onRetry,
  onReward,
}: {
  answer: string | null
  isCorrect: boolean
  onAnswer: (answer: string) => void
  onBack: () => void
  onRetry: () => void
  onReward: () => void
}) {
  const answers = [
    ["danger", "とてもあぶない!"],
    ["watch", "気をつければOK"],
    ["rush", "すぐにわたる!"],
  ]

  return (
    <div className="flex h-full flex-col bg-[#e8f5ff]">
      <GameHeader
        title="ルートクイズバトル"
        compact
        onBack={onBack}
        right={<StatusPill icon={<Sparkles className="h-4 w-4 text-[#f59e0b]" />} value="350 pt" />}
      />
      <div className="relative flex-1 overflow-hidden">
        <StreetPhotoScene />
        <div className="absolute left-5 right-5 top-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <BattleHp name="そうた" hp="80/100" value={80} />
          <span className="rounded-full border-4 border-white bg-[#ff8b18] px-3 py-2 text-2xl font-black text-white shadow-lg">VS</span>
          <BattleHp name="あぶないゾーン" hp="60/100" value={60} align="right" />
        </div>
        <div className="absolute left-1/2 top-[23%] h-48 w-56 -translate-x-1/2">
          <DangerCloud />
        </div>
        <div className="absolute left-[21%] top-[27%] rotate-[-16deg] rounded-[16px] border-4 border-[#e35d00] bg-[#ffb43b] p-3 shadow-lg">
          <span className="text-3xl font-black text-[#7c2d12]">注意</span>
        </div>
        <div className="absolute right-[21%] top-[32%] rotate-[12deg] rounded-[14px] border-4 border-[#facc15] bg-[#1f2937] p-3 shadow-lg">
          <Target className="h-10 w-10 text-[#facc15]" />
        </div>
      </div>
      <div className="bg-[#ffbd45] p-4">
        <div className="mx-auto max-w-[920px] rounded-[22px] border-4 border-white bg-white p-4 shadow-xl">
          <p className="mb-3 rounded-full bg-[#0d66c4] px-3 py-1 text-xs font-black text-white">問題</p>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-black">車のかげからとび出すのは、どうかな?</p>
            {answer && (
              <button type="button" onClick={isCorrect ? onReward : onRetry} className="rounded-full bg-[#ff8b18] px-6 py-2 text-sm font-black text-white shadow">
                {isCorrect ? "報酬へ" : "もう一度"}
              </button>
            )}
          </div>
          <div className="grid gap-2">
            {answers.map(([value, label], index) => {
              const selected = answer === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onAnswer(value)}
                  className={cn(
                    "rounded-full border-4 px-5 py-3 text-lg font-black text-white shadow transition hover:scale-[1.01]",
                    index === 0 && "border-[#93e7a6] bg-[#2fbf62]",
                    index === 1 && "border-[#9bd7ff] bg-[#1785d7]",
                    index === 2 && "border-[#ffc293] bg-[#f97316]",
                    selected && "ring-4 ring-white ring-offset-2 ring-offset-[#ffbd45]",
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <ItemChip icon={<Zap className="h-7 w-7 text-[#0ea5e9]" />} label="ひらめきヒント" value="残り2回" />
            <ItemChip icon={<Shield className="h-7 w-7 text-[#0d66c4]" />} label="まもりシールド" value="ダメージ-20!" />
            <ItemChip icon={<Heart className="h-7 w-7 fill-[#ef4444] text-[#ef4444]" />} label="かいふくハート" value="HPを20回復!" />
            {answer && (
              <button type="button" onClick={isCorrect ? onReward : onRetry} className="rounded-[16px] bg-[#ff8b18] px-6 py-3 font-black text-white shadow">
                {isCorrect ? "報酬へ" : "もう一度"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
