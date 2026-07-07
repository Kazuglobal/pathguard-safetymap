"use client"

import { Bell, Check, Shield, Sparkles, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { getDailyMissions } from "@/lib/safety-quest-daily-missions"
import { StatusPill } from "@/components/safety-quest/quest-primitives"
import { Mascot, PlayerFace } from "@/components/safety-quest/quest-characters"

export function DailyScreen({
  missions,
  points,
  coins,
  onMission,
}: {
  missions: ReturnType<typeof getDailyMissions>
  points: number
  coins: number
  onMission: () => void
}) {
  return (
    <div className="h-full bg-gradient-to-b from-[#9ddcff] via-[#eaffff] to-[#fff1cf] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlayerFace />
          <span className="text-sm font-black">そうた</span>
          <StatusPill icon={<Shield className="h-4 w-4 text-[#0d66c4]" />} value="レベル 12" />
        </div>
        <div className="flex gap-2">
          <StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value={`${points.toLocaleString()} pt`} />
          <StatusPill icon={<Sparkles className="h-4 w-4 text-[#0ea5e9]" />} value={coins.toLocaleString()} />
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#cde5f9] bg-white">
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="grid h-[calc(100%-56px)] gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative overflow-hidden rounded-[30px] border-4 border-white bg-white/80 p-5 shadow-xl">
          <div className="absolute bottom-0 right-0 h-56 w-56 rounded-tl-full bg-[#b4ebaa]" />
          <div className="relative z-10 flex gap-4">
            <Mascot size="lg" pose="point" />
            <div className="rounded-[26px] border-2 border-[#cde5f9] bg-white p-4 shadow">
              <p className="font-black leading-relaxed">おはよう!<br />今日もいっしょに<br />安全たんけんに出発しよう!</p>
            </div>
          </div>
          <div className="relative z-10 mt-6 rounded-[24px] bg-[#0d66c4] p-4 text-white shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-black">デイリーたんけん</h3>
              <span className="rounded-full bg-[#ff8b18] px-3 py-1 text-xs font-black">7日れんぞく中!</span>
            </div>
            <div className="flex items-center justify-between rounded-[18px] bg-white p-3 text-[#0b2551]">
              {[14, 11, 12, 13, 10, 11, 12, 13, 16].map((day, index) => (
                <div key={`${day}-${index}`} className="text-center text-xs font-black">
                  <div className={cn("mb-1 grid h-8 w-8 place-items-center rounded-full", index < 4 ? "bg-[#10b981] text-white" : index === 8 ? "bg-[#ff8b18] text-white" : "bg-[#fff1cc] text-[#0b2551]")}>
                    {index < 4 ? <Check className="h-5 w-5" /> : day}
                  </div>
                  {index === 8 ? "今日" : day}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="flex flex-col rounded-[30px] border-4 border-white bg-[#0d66c4] p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between text-white">
            <h3 className="text-xl font-black">今日のミッション</h3>
            <span className="font-mono text-sm font-black">のこり 14:30:25</span>
          </div>
          <div className="grid flex-1 gap-3 md:grid-cols-3">
            {missions.map((mission) => {
              const Icon = mission.icon
              return (
                <button
                  key={mission.title}
                  type="button"
                  onClick={onMission}
                  className="rounded-[20px] border-2 border-[#d8e8f7] bg-white p-4 text-left shadow-sm transition hover:scale-[1.02]"
                >
                  <p className="min-h-[44px] text-sm font-black leading-snug">{mission.title}</p>
                  <div className="my-3 grid h-16 w-full place-items-center rounded-[18px] bg-[#eaf5ff]">
                    <Icon className={cn("h-9 w-9", mission.tint === "green" ? "text-[#22c55e]" : mission.tint === "orange" ? "text-[#f97316]" : "text-[#0d66c4]")} />
                  </div>
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>{mission.progress}</span>
                    <span className="text-[#f97316]">{mission.reward}</span>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="mt-4 rounded-[18px] bg-[#0a4d99] p-4 text-center text-2xl font-black text-[#ffd23f] shadow-inner">
            ぜんぶクリアでボーナス! +150pt
          </div>
        </section>
      </div>
    </div>
  )
}
