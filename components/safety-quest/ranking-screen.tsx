"use client"

import { useState } from "react"
import { Crown, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { GameHeader, ProgressBar, StatusPill } from "@/components/safety-quest/quest-primitives"
import { Mascot, PlayerFace } from "@/components/safety-quest/quest-characters"

export function RankingScreen({ onBack }: { onBack: () => void }) {
  const [rankingTab, setRankingTab] = useState<"national" | "friends">("national")
  const [eventJoined, setEventJoined] = useState(false)
  const nationalRows = [
    ["4", "ゆうき", "3,120 pt"],
    ["5", "あかり", "2,950 pt"],
    ["23", "あなた", "2,840 pt"],
  ]
  const friendRows = [
    ["1", "そうた", "2,840 pt"],
    ["2", "ゆい", "2,310 pt"],
    ["3", "あなた", "2,120 pt"],
  ]
  const rows = rankingTab === "national" ? nationalRows : friendRows

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-[#ecf9ff] to-[#fff7e6] p-5">
      <GameHeader
        title="ランキング＆イベント"
        compact
        onBack={onBack}
        right={<StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="2,840 pt" />}
      />
      <div className="grid h-[calc(100%-56px)] gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border-4 border-white bg-white p-4 shadow-xl">
          <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-r from-[#12a777] to-[#6ee7b7] p-5 text-white">
            <div className="absolute bottom-0 right-0 h-32 w-56 rounded-tl-full bg-white/25" />
            <h3 className="text-2xl font-black">春のあんぜんたんけんフェス</h3>
            <p className="text-sm font-bold">イベント期間: 4/20(土) - 5/20(月)</p>
            <div className="relative z-10 mt-4 flex items-center gap-4">
              <Mascot size="md" pose="point" />
              <p className="rounded-[18px] bg-white/88 px-4 py-3 text-sm font-black text-[#0b2551] shadow">ミッションをクリアして<br />限定バッジをゲットしよう!</p>
            </div>
          </div>
          <div className="mt-4 rounded-[22px] border-2 border-[#d8e8f7] bg-[#f8fbff] p-4">
            <h4 className="mb-3 font-black text-[#0b2551]">イベントミッション</h4>
            {[
              ["あぶない場所を10こ見つけよう!", 60, "6/10", "+200 pt"],
              ["クイズで5問正解しよう", 60, "3/5", "+150 pt"],
              ["お友だちに安全をおしえよう!", 33, "1/3", "+100 pt"],
            ].map(([label, value, progress, reward]) => (
              <div key={label as string} className="mb-3 grid grid-cols-[1fr_auto] gap-3 rounded-[16px] bg-white p-3 shadow-sm">
                <div>
                  <p className="text-sm font-black">{label as string}</p>
                  <ProgressBar value={value as number} color="#12a777" />
                </div>
                <p className="text-right text-sm font-black">
                  {progress as string}
                  <br />
                  <span className="text-[#f97316]">{reward as string}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[28px] border-4 border-white bg-white p-4 shadow-xl">
          <div className="grid grid-cols-2 gap-2">
            <button
              className={cn("rounded-[14px] py-2 font-black", rankingTab === "national" ? "bg-[#0d66c4] text-white" : "bg-[#f1f5f9] text-[#31516f]")}
              type="button"
              onClick={() => setRankingTab("national")}
            >
              全国ランキング
            </button>
            <button
              className={cn("rounded-[14px] py-2 font-black", rankingTab === "friends" ? "bg-[#0d66c4] text-white" : "bg-[#f1f5f9] text-[#31516f]")}
              type="button"
              onClick={() => setRankingTab("friends")}
            >
              おともだちランキング
            </button>
          </div>
          {rankingTab === "friends" && <p className="mt-3 rounded-[14px] bg-[#e0f2fe] px-3 py-2 text-sm font-black text-[#0d66c4]">クラスの友だちと安全チャレンジ中</p>}
          <div className="mt-6 grid grid-cols-3 items-end gap-3">
            {[
              ["2", "はると", "4,320 pt", "bg-[#e5e7eb]", "h-28"],
              ["1", "みお", "5,680 pt", "bg-[#ffd76a]", "h-36"],
              ["3", "りく", "3,890 pt", "bg-[#f8c29d]", "h-24"],
            ].map(([rank, name, point, color, height]) => (
              <div key={rank as string} className="text-center">
                <Crown className={cn("mx-auto mb-1 h-8 w-8", rank === "1" ? "fill-[#facc15] text-[#eab308]" : "fill-[#cbd5e1] text-[#94a3b8]")} />
                <div className={cn("rounded-t-[22px] p-3 shadow", color as string, height as string)}>
                  <PlayerFace className="mx-auto" />
                  <p className="font-black">{name as string}</p>
                  <p className="text-sm font-black">{point as string}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-hidden rounded-[18px] border-2 border-[#d8e8f7]">
            {rows.map(([rank, name, point]) => (
              <div key={rank} className={cn("grid grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3 text-sm font-black", name === "あなた" ? "bg-[#dff6ff] text-[#0d66c4]" : "bg-white")}>
                <span>{rank}</span>
                <span>{name}</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEventJoined(true)}
            className="mt-5 w-full rounded-[20px] bg-[#ff8b18] py-4 text-xl font-black text-white shadow-lg"
          >
            {eventJoined ? "参加中!" : "イベントに参加する!"}
          </button>
          {eventJoined && <p className="mt-3 rounded-[14px] bg-[#fff7dd] px-3 py-2 text-sm font-black text-[#e57200]">イベント参加中! 今日の安全チャレンジを続けよう</p>}
        </section>
      </div>
    </div>
  )
}
