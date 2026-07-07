"use client"

import { Award, Heart, Home, Lock, Shield, Star, Target } from "lucide-react"
import { GameHeader, StatusPill } from "@/components/safety-quest/quest-primitives"
import { DangerCloud, KidAvatar, Mascot } from "@/components/safety-quest/quest-characters"

export function DefendTownScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-full bg-gradient-to-b from-[#d9f6ff] to-[#f5fbff]">
      <GameHeader
        title="まちをまもろう"
        compact
        onBack={onBack}
        right={
          <>
            <StatusPill icon={<Heart className="h-4 w-4 fill-[#ef4444] text-[#ef4444]" />} value="5/5" />
            <StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="1,850" />
            <StatusPill icon={<Shield className="h-4 w-4 text-[#0d66c4]" />} value="レベル 8" />
          </>
        }
      />
      <div className="relative h-[calc(100%-56px)] overflow-hidden">
        <div className="absolute left-1/2 top-5 z-10 w-[72%] -translate-x-1/2 rounded-[24px] bg-white/90 p-4 text-center shadow-lg">
          <h3 className="text-xl font-black">ステージ 3-2　こうさてんのあんぜん</h3>
          <p className="text-sm font-bold text-[#31516f]">あぶないスポットをなおして、安全なまちにしよう!</p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#bfe8ff] to-[#9ed7a6]" />
        <IsometricTown />
        <div className="absolute bottom-6 left-8 rounded-[20px] border-2 border-[#b7ead1] bg-white/92 p-4 shadow-xl">
          <p className="mb-2 rounded-full bg-[#16b8a6] px-3 py-1 text-xs font-black text-white">クリア条件</p>
          <p className="text-sm font-black">あぶないスポットをすべてなおす</p>
          <div className="mt-2 flex items-center gap-2 text-sm font-black">
            <Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />を20こ集める
            <span className="ml-auto">15/20</span>
          </div>
        </div>
        <div className="absolute bottom-5 left-1/2 grid h-24 w-24 -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-[#55a7ff] shadow-2xl">
          <span className="text-4xl font-black text-white">3</span>
        </div>
        <div className="absolute bottom-8 right-10">
          <Mascot size="md" />
          <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-[#ef4444] text-sm font-black text-white">2</span>
        </div>
      </div>
    </div>
  )
}

function IsometricTown() {
  const blocks = [
    [26, 44, "#a7f3d0", Shield],
    [38, 35, "#bae6fd", Home],
    [51, 47, "#fde68a", Target],
    [63, 35, "#fdba74", Award],
    [72, 55, "#fca5a5", Lock],
    [42, 58, "#bbf7d0", Star],
    [57, 64, "#93c5fd", Home],
  ] as const
  return (
    <div className="absolute inset-0 top-20">
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className="absolute h-[44%] w-[9%] rotate-[55deg] rounded-full bg-white/45"
          style={{ left: `${14 + index * 9}%`, top: `${9 + (index % 2) * 17}%` }}
        />
      ))}
      {blocks.map(([left, top, color, Icon], index) => (
        <div key={`${left}-${top}`} className="absolute h-24 w-28 -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
          <div className="absolute inset-x-0 bottom-0 h-16 skew-y-[-12deg] rounded-[14px] border-2 border-white shadow-lg" style={{ background: color }} />
          <Icon className="absolute left-1/2 top-4 h-9 w-9 -translate-x-1/2 text-[#0d66c4]" />
          {index === 4 && <DangerCloud />}
          {index === 2 && <span className="absolute -right-1 -top-2 grid h-8 w-8 place-items-center rounded-full bg-[#f97316] text-white">!</span>}
        </div>
      ))}
      <KidAvatar className="absolute left-[27%] top-[56%] scale-[0.32]" />
    </div>
  )
}
