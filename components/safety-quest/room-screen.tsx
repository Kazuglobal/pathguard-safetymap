"use client"

import { useState } from "react"
import { Award, BookOpen, Gift, Shield, Sparkles, Star, Trophy, Users } from "lucide-react"
import { GameHeader, MissionLine, StatusPill } from "@/components/safety-quest/quest-primitives"
import { Mascot, PlayerFace } from "@/components/safety-quest/quest-characters"

export function RoomScreen({ onBack, onExplore }: { onBack: () => void; onExplore: () => void }) {
  const [roomMessage, setRoomMessage] = useState("マイルームを表示中")

  return (
    <div className="h-full bg-gradient-to-b from-[#fff0cf] to-[#dff7ff]">
      <GameHeader
        title="マイルーム"
        compact
        onBack={onBack}
        right={
          <>
            <StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="2,450" />
            <StatusPill icon={<Sparkles className="h-4 w-4 text-[#0ea5e9]" />} value="280" />
          </>
        }
      />
      <div className="relative h-[calc(100%-56px)] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#fff6df] to-[#e1f7ff]" />
        <div className="absolute left-0 right-0 top-0 h-20 bg-[repeating-linear-gradient(90deg,#ff8b18_0_36px,#facc15_36px_72px,#60a5fa_72px_108px,#34d399_108px_144px)] opacity-30" />
        <div className="absolute bottom-[18%] left-0 h-[32%] w-full bg-[#d79b61]" />
        <div className="absolute bottom-[18%] left-0 h-5 w-full bg-[#b56d37]" />
        <div className="absolute left-[44%] top-20 h-56 w-48 rounded-t-[80px] bg-[#fff9e7] shadow-inner" />
        <div className="absolute left-[45%] top-28 h-40 w-20 rounded-b-[40px] bg-[#94d3a2]" />
        <div className="absolute left-[57%] top-28 h-40 w-20 rounded-b-[40px] bg-[#94d3a2]" />

        <section className="absolute left-7 top-6 w-[34%] rounded-[24px] bg-white/95 p-4 shadow-xl">
          <div className="flex items-center gap-2">
            <PlayerFace size="md" />
            <div className="min-w-0 flex-1">
              <h3 className="whitespace-nowrap text-base font-black sm:text-xl">そうた</h3>
              <p className="text-sm font-bold text-[#31516f]">安全マスター見習い</p>
            </div>
            <span className="ml-auto shrink-0 rounded-[14px] bg-[#0d66c4] px-2 py-1 text-center text-[10px] font-black text-white">レベル<br /><span className="text-lg">12</span></span>
          </div>
        </section>

        <section className="absolute left-7 top-[28%] w-[34%] rounded-[24px] bg-white/95 p-4 shadow-xl">
          <h3 className="mb-3 text-sm font-black text-[#31516f]">今月のミッション</h3>
          <MissionLine label="あんぜんな道を3回シェアしよう" value={67} progress="2/3" />
          <MissionLine label="ARたんけんを5回クリアしよう" value={80} progress="4/5" />
          <button type="button" onClick={() => setRoomMessage("今月のミッションを確認中")} className="mt-3 rounded-full bg-[#14b8a6] px-5 py-2 text-sm font-black text-white">ミッションを見る</button>
        </section>

        <div className="absolute left-1/2 top-[18%] z-10 -translate-x-1/2 rounded-[18px] bg-white/95 px-4 py-3 text-sm font-black text-[#0d66c4] shadow-xl" role="status">
          {roomMessage}
        </div>

        <div className="absolute bottom-[25%] left-[42%] grid h-32 w-32 place-items-center rounded-[24px] bg-[#2563eb] shadow-xl">
          <div className="h-24 w-24 rounded-[20px] border-4 border-[#1e40af] bg-[#3b82f6]" />
        </div>
        <div className="absolute bottom-[26%] left-[60%]">
          <Trophy className="h-20 w-20 fill-[#facc15] text-[#d97706]" />
        </div>
        <div className="absolute bottom-[34%] right-[19%] flex gap-4">
          <Shield className="h-14 w-14 fill-[#1d4ed8]/20 text-[#1d4ed8]" />
          <Shield className="h-14 w-14 fill-[#f59e0b]/20 text-[#f59e0b]" />
        </div>
        <div className="absolute right-8 top-20 grid w-[25%] grid-cols-2 gap-3">
          <div className="rounded-[18px] border-4 border-white bg-[#fffaf0] p-2 shadow-lg">
            <p className="mb-1 text-center text-xs font-black">ぼくのマップ</p>
            <div className="h-24 rounded-[14px] bg-gradient-to-br from-[#bbf7d0] to-[#93c5fd]" />
          </div>
          <div className="rounded-[18px] border-4 border-white bg-[#fffaf0] p-2 shadow-lg">
            <p className="mb-1 text-center text-xs font-black">たんけんの思い出</p>
            <div className="grid h-24 grid-cols-2 gap-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[8px] bg-[#bfdbfe]" />
              ))}
            </div>
          </div>
        </div>
        <Mascot size="md" className="absolute bottom-[15%] right-[32%]" />
        <div className="absolute bottom-4 left-8 right-8 flex items-center justify-between rounded-[24px] bg-white/95 p-3 shadow-xl">
          {["コレクション", "ずかん", "トロフィー", "ショップ", "フレンド"].map((item, index) => (
            <button
              key={item}
              type="button"
              onClick={() => setRoomMessage(`${item}を開きました`)}
              className="grid place-items-center gap-1 rounded-[16px] px-4 py-2 text-xs font-black text-[#31516f]"
            >
              {[Gift, BookOpen, Trophy, Award, Users].map((Icon, iconIndex) => (iconIndex === index ? <Icon key={iconIndex} className="h-6 w-6 text-[#0d66c4]" /> : null))}
              {item}
            </button>
          ))}
          <button type="button" onClick={onExplore} className="rounded-[20px] bg-[#14b8a6] px-8 py-4 text-xl font-black text-white shadow-lg">
            たんけんにでかける
          </button>
        </div>
      </div>
    </div>
  )
}
