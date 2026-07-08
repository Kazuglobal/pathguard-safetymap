"use client"

import { useState } from "react"
import { ArrowLeft, ChevronRight, Flag, Shield, Sparkles } from "lucide-react"
import { GameHeader, ProgressBar, StatusPill } from "@/components/safety-quest/quest-primitives"
import { Mascot } from "@/components/safety-quest/quest-characters"

export function PatrolScreen({ onBack, onReward }: { onBack: () => void; onReward: () => void }) {
  const [safePower, setSafePower] = useState(3)
  const movePatrol = (delta: number) => setSafePower((current) => Math.max(0, Math.min(5, current + delta)))

  return (
    <div className="flex h-full flex-col bg-[#d8f6ff]">
      <GameHeader
        title="まもるんとパトロール"
        subtitle="公園通りルート"
        onBack={onBack}
        right={<StatusPill icon={<Sparkles className="h-4 w-4 text-[#f59e0b]" />} value="ステージ 2/5" />}
      />
      <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-[#6ec7ff] via-[#b9ecff] to-[#1b6ea8]">
        <div className="absolute left-10 right-10 top-4">
          <div className="flex items-center gap-2">
            <Flag className="h-6 w-6 fill-[#ef4444] text-[#ef4444]" />
            <ProgressBar value={70} color="#22c55e" />
            <Flag className="h-6 w-6 fill-[#ef4444] text-[#ef4444]" />
          </div>
        </div>
        <div className="absolute left-10 top-20 rounded-[18px] border-2 border-[#d7e7f8] bg-white p-4 shadow-lg">
          <p className="rounded-full bg-[#0b66c3] px-3 py-1 text-xs font-black text-white">ミッション</p>
          <p className="mt-2 text-sm font-black text-[#0b2551]">あぶない場所を<br />みつけて通報しよう!</p>
        </div>
        <div className="absolute bottom-[24%] left-0 h-24 w-full bg-[#deb887]" />
        <div className="absolute bottom-[24%] left-0 h-5 w-full bg-[#f7e4b3]" />
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="absolute bottom-[32%] h-28 w-20 rounded-t-full bg-[#3fb36e]" style={{ left: `${index * 13}%` }}>
            <span className="absolute bottom-0 left-1/2 h-20 w-4 -translate-x-1/2 bg-[#8b5a2b]" />
          </div>
        ))}
        <Mascot size="lg" pose="jump" className="absolute bottom-[25%] left-[18%]" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="absolute bottom-[39%] grid h-14 w-14 place-items-center rounded-[16px] border-4 border-[#ffd23f] bg-[#fff7cc] text-[#f59e0b] shadow-lg"
            style={{ left: `${42 + index * 10}%` }}
          >
            <Shield className="h-7 w-7 fill-[#facc15]" />
          </div>
        ))}
        <div className="absolute bottom-[34%] right-[15%] grid h-20 w-20 place-items-center rounded-full bg-[#111827] shadow-lg">
          <span className="h-10 w-10 rounded-full bg-[#0f172a]" />
          <span className="absolute -top-8 rounded-[14px] bg-white px-3 py-1 text-sm font-black text-[#ef4444] shadow">あぶない!</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 bg-[#064d91] p-4">
        <div className="flex gap-3">
          <button
            className="grid h-16 w-16 place-items-center rounded-[18px] border-4 border-white/70 bg-[#16b8a6] text-white shadow"
            type="button"
            aria-label="左へ"
            onClick={() => movePatrol(-1)}
          >
            <ArrowLeft className="h-9 w-9" />
          </button>
          <button
            className="grid h-16 w-16 place-items-center rounded-[18px] border-4 border-white/70 bg-[#16b8a6] text-white shadow"
            type="button"
            aria-label="右へ"
            onClick={() => movePatrol(1)}
          >
            <ChevronRight className="h-9 w-9" />
          </button>
        </div>
        <div className="min-w-[190px] rounded-[18px] bg-[#063b75] px-5 py-3 text-center text-white">
          <p className="text-xs font-black">安全パワー</p>
          <ProgressBar value={safePower * 20} color="#ffd23f" />
          <p className="mt-1 text-xl font-black">{safePower}/5</p>
        </div>
        <button type="button" onClick={onReward} className="rounded-[18px] bg-[#1e88e5] px-8 py-4 text-xl font-black text-white shadow-lg">
          ジャンプ
        </button>
      </div>
    </div>
  )
}
