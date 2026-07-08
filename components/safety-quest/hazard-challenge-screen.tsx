"use client"

import { Check, CircleHelp, Pause, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SafetyQuestChallenge } from "@/lib/safety-quest"
import { getChallengeHazardPoints } from "@/lib/safety-quest-hazard-points"
import { StatusPill } from "@/components/safety-quest/quest-primitives"
import { Mascot } from "@/components/safety-quest/quest-characters"
import { StreetPhotoScene } from "@/components/safety-quest/street-photo-scene"

export function HazardChallengeScreen({
  challenge,
  foundHazards,
  onMark,
  onNext,
}: {
  challenge: SafetyQuestChallenge
  foundHazards: string[]
  onMark: (id: string) => void
  onNext: () => void
}) {
  const hazardPoints = getChallengeHazardPoints(challenge)
  const complete = foundHazards.length >= Math.max(1, hazardPoints.length)

  return (
    <div className="flex h-full flex-col bg-[#eaf7ff]">
      <div className="flex h-14 items-center gap-3 bg-gradient-to-b from-[#0c75d4] to-[#0757aa] px-4 text-white">
        <StatusPill className="h-9 border-white/30 bg-white/16 text-white" icon={<CircleHelp className="h-4 w-4" />} value="00:45" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="rounded-full bg-[#10b981] px-3 py-1 text-xs font-black">コンボ</span>
          <span className="text-4xl font-black text-[#ffcf35] drop-shadow">3</span>
          <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-white bg-[#0b3a74]">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#10b981] to-[#ffd23f]" />
          </div>
        </div>
        <span className="text-lg font-black">スコア 350 pt</span>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white/20" aria-label="一時停止">
          <Pause className="h-5 w-5 fill-white" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden bg-[#a7d7ff]">
        <StreetPhotoScene imageUrl={challenge.imageUrl} />
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-[18px] border-2 border-[#d7e5f2] bg-white/95 px-6 py-2 text-center text-lg font-black shadow">
          危険なところをタップしよう!
        </div>
        <div className="absolute left-5 top-4 max-w-[310px] rounded-[18px] border-2 border-[#9bd8d3] bg-white/95 px-4 py-3 shadow-lg">
          <p className="text-xs font-black text-[#087c78]">投稿チャレンジ</p>
          <h3 className="mt-1 text-base font-black leading-tight text-[#0b2b62]">{challenge.title}</h3>
          <p className="mt-1 text-xs font-bold text-[#52708f]">{challenge.areaLabel}</p>
        </div>

        {hazardPoints.map((point) => (
          <HazardMarker
            key={point.id}
            id={point.id}
            x={point.x}
            y={point.y}
            found={foundHazards.includes(point.id)}
            onMark={onMark}
          />
        ))}

        {complete && (
          <button
            type="button"
            onClick={onNext}
            className="absolute right-5 top-24 rounded-full bg-[#ff8b18] px-6 py-3 text-base font-black text-white shadow-xl shadow-orange-900/20 transition hover:scale-[1.02]"
          >
            クイズへ
          </button>
        )}

        {foundHazards.length > 0 && (
          <div className="absolute bottom-24 right-[18%] rotate-[-8deg] text-center">
            <p className="text-5xl font-black text-[#ff6b22] drop-shadow-[0_4px_0_white]">GOOD!</p>
            <p className="text-3xl font-black text-[#ff6b22] drop-shadow-[0_3px_0_white]">+50pt</p>
            <Sparkles className="absolute -left-8 top-1 h-8 w-8 fill-[#facc15] text-[#eab308]" />
            <Sparkles className="absolute -right-7 bottom-2 h-7 w-7 fill-[#facc15] text-[#eab308]" />
          </div>
        )}

        <div className="absolute bottom-5 left-5 flex items-end gap-3">
          <Mascot pose="point" />
          <div className="rounded-[18px] border-2 border-[#cde5f9] bg-white px-4 py-3 text-sm font-bold text-[#0b2551] shadow-lg">
            よく見つけたね!<br />
            そのちょうし!
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t-4 border-[#063b75] bg-[#064d91] p-4 text-white md:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-3 gap-3">
          {hazardPoints.map((point) => (
            <div key={point.id} className="rounded-[16px] border-2 border-white/35 bg-white/12 px-3 py-2 text-center text-sm font-black">
              <span className="text-[#ffd23f]">{foundHazards.includes(point.id) ? "発見!" : "未発見"}</span>
              <br />
              {point.label}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={!complete}
          className={cn(
            "rounded-[18px] px-8 py-3 text-lg font-black shadow-lg",
            complete ? "bg-[#ff8b18] text-white hover:scale-[1.02]" : "bg-white/20 text-white/60",
          )}
        >
          クイズへすすむ
        </button>
      </div>
    </div>
  )
}

function HazardMarker({
  id,
  x,
  y,
  found,
  onMark,
}: {
  id: string
  x: number
  y: number
  found: boolean
  onMark: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onMark(id)}
      className={cn(
        "absolute grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] shadow-[0_0_0_5px_rgba(239,68,68,.18)] transition hover:scale-110",
        found ? "border-[#22c55e] bg-[#dcfce7]/75" : "border-[#ef4444] bg-transparent",
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-label="危険ポイント"
    >
      {found ? <Check className="h-8 w-8 rounded-full bg-[#22c55e] p-1 text-white" /> : <span className="h-5 w-5 rounded-full border-2 border-white bg-[#ef4444]" />}
    </button>
  )
}
