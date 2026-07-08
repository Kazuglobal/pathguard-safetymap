"use client"

import { useState } from "react"
import { Check, Crown, Flag, Lock, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProgressBar } from "@/components/safety-quest/quest-primitives"
import { PlayerFace } from "@/components/safety-quest/quest-characters"

const teamMembers = [
  ["そうた", "1,250 pt"],
  ["ゆい", "1,120 pt"],
  ["たくみ", "950 pt"],
  ["あおい", "780 pt"],
  ["はると", "750 pt"],
]

const familyMembers = [
  ["おとうさん", "1,020 pt"],
  ["おかあさん", "940 pt"],
  ["そうた", "850 pt"],
  ["いもうと", "450 pt"],
]

export function TeamMissionScreen() {
  const [teamTab, setTeamTab] = useState<"class" | "family">("class")
  const activeMembers = teamTab === "class" ? teamMembers : familyMembers
  const teamPoint = teamTab === "class" ? "4,850 pt" : "3,260 pt"

  return (
    <div className="h-full bg-gradient-to-b from-[#0757aa] to-[#052e78] p-5 text-[#0b2551]">
      <div className="mb-4 flex items-center justify-between text-white">
        <div>
          <h2 className="text-2xl font-black">きょうりょくミッション</h2>
          <p className="text-sm font-bold text-blue-100">みんなで力を合わせて、まちをもっと安全にしよう!</p>
        </div>
        <div className="rounded-[18px] bg-white px-5 py-3 text-[#0b2551] shadow-lg">
          <p className="text-xs font-black text-[#52708f]">チームポイント</p>
          <p className="text-3xl font-black">{teamPoint}</p>
        </div>
      </div>
      <div className="grid h-[calc(100%-92px)] gap-4 lg:grid-cols-[0.58fr_1.42fr]">
        <section className="rounded-[24px] bg-white/95 p-4 shadow-xl">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              className={cn("rounded-[14px] py-2 text-sm font-black", teamTab === "class" ? "bg-[#0d66c4] text-white" : "border-2 border-[#d8e8f7] bg-white")}
              type="button"
              onClick={() => setTeamTab("class")}
            >
              クラスチーム
            </button>
            <button
              className={cn("rounded-[14px] py-2 text-sm font-black", teamTab === "family" ? "bg-[#0d66c4] text-white" : "border-2 border-[#d8e8f7] bg-white")}
              type="button"
              onClick={() => setTeamTab("family")}
            >
              かぞくチーム
            </button>
          </div>
          <p className="mb-3 rounded-[14px] bg-[#e0f2fe] px-3 py-2 text-sm font-black text-[#0d66c4]">
            {teamTab === "class" ? "クラスチームで安全チャレンジ中" : "かぞくチームで安全週間に参加中"}
          </p>
          <div className="space-y-2">
            {activeMembers.map(([name, point], index) => (
              <div key={name} className="flex items-center gap-3 rounded-[14px] border border-[#e0ecf8] bg-[#f8fbff] p-2">
                <PlayerFace size="sm" />
                <span className="font-black">{name}</span>
                <span className="ml-auto text-sm font-black text-[#31516f]">{point}</span>
                {index === 0 && <Crown className="h-5 w-5 fill-[#facc15] text-[#eab308]" />}
              </div>
            ))}
          </div>
        </section>
        <section className="grid gap-4 rounded-[24px] bg-white p-5 shadow-xl lg:grid-cols-[1.2fr_.8fr]">
          <div className="relative overflow-hidden rounded-[22px] bg-[#fff7dd] p-4">
            <p className="text-sm font-black text-[#52708f]">みんなの進み具合</p>
            <div className="mt-4 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid h-12 flex-1 place-items-center rounded-[10px] border-2 border-[#e8c06d] bg-[#ffe2a1]">
                  {index < 4 ? <Check className="h-7 w-7 rounded-full bg-[#18b56c] p-1 text-white" /> : <Flag className="h-7 w-7 fill-[#ef4444] text-[#ef4444]" />}
                </div>
              ))}
            </div>
            <div className="relative mt-7 grid place-items-center">
              <div className="h-36 w-48 rounded-[28px] border-[7px] border-[#a85f21] bg-gradient-to-b from-[#f7b94d] to-[#c96d23] shadow-2xl" />
              <div className="absolute top-9 h-14 w-56 rounded-t-[80px] border-[7px] border-[#a85f21] bg-[#facc15]" />
              <Lock className="absolute top-[76px] h-16 w-16 rounded-full bg-[#7c3f12] p-3 text-[#ffd23f]" />
              <Sparkles className="absolute left-[20%] top-8 h-8 w-8 fill-[#22c55e] text-[#22c55e]" />
            </div>
            <div className="mt-3 rounded-[16px] bg-white px-4 py-3 text-center text-lg font-black text-[#e57200]">
              次のチーム報酬まで あと 1,150 pt
            </div>
          </div>
          <div className="rounded-[22px] border-2 border-[#d8e8f7] p-4">
            <h3 className="mb-3 text-center text-lg font-black">ミッション</h3>
            {[
              ["危険さがしにちょうせん", 100],
              ["あぶない場所を通報する", 60],
              ["パトロールでコインをあつめる", 80],
            ].map(([label, value]) => (
              <div key={label as string} className="mb-4 rounded-[14px] bg-[#f8fbff] p-3">
                <p className="mb-2 text-sm font-black">{label}</p>
                <ProgressBar value={value as number} color="#f59e0b" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
