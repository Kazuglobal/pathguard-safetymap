"use client"

import { useState } from "react"
import { Lock, Shield, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { GameHeader, ProgressBar } from "@/components/safety-quest/quest-primitives"
import { Mascot } from "@/components/safety-quest/quest-characters"

const heroCards = [
  { name: "ライトガード", accent: "#2f80ed", stars: 2, locked: false },
  { name: "サインレンジャー", accent: "#f59e0b", stars: 3, locked: false },
  { name: "ミチミチ", accent: "#22c55e", stars: 1, locked: false },
  { name: "マモルン", accent: "#94a3b8", stars: 0, locked: true },
]

export function HeroEncyclopediaScreen({ onBack }: { onBack: () => void }) {
  const [activeCategory, setActiveCategory] = useState("ヒーロー")
  const [showAllBadges, setShowAllBadges] = useState(false)

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-[#e8f6ff] to-[#f7fbff]">
      <GameHeader title="安全ヒーロー図鑑" compact onBack={onBack} />
      <div className="grid min-h-[calc(100%-56px)] gap-4 p-4 lg:grid-cols-[180px_1fr]">
        <aside className="rounded-[24px] border-2 border-[#d8e8f7] bg-white/95 p-3 shadow-lg">
          <div className="mb-4 rounded-[18px] bg-[#f8fbff] p-3 text-center">
            <p className="text-xs font-black text-[#52708f]">図鑑コンプ率</p>
            <p className="text-2xl font-black">68%</p>
            <ProgressBar value={68} color="#14b8a6" />
          </div>
          {["ヒーロー", "バッジ", "ルート生き物", "ストーリー"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveCategory(item)}
              className={cn("mb-2 flex w-full items-center gap-2 rounded-[14px] px-3 py-3 text-sm font-black", activeCategory === item ? "bg-[#0d66c4] text-white" : "bg-[#f8fbff]")}
            >
              <Shield className="h-5 w-5" />
              {item}
            </button>
          ))}
          <div className="mt-auto">
            <Mascot size="md" />
          </div>
        </aside>
        <section className="flex flex-col gap-4">
          <p className="rounded-[16px] bg-white px-4 py-3 text-sm font-black text-[#0d66c4] shadow-sm">{activeCategory}を表示中</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["ヒーロー", "18/28"],
              ["バッジ", "42/72"],
              ["ルート生き物", "26/40"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[18px] border-2 border-[#d8e8f7] bg-white p-3 text-center shadow-sm">
                <p className="text-xs font-black text-[#52708f]">{label}</p>
                <p className="text-xl font-black">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[22px] border-2 border-[#d8e8f7] bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black text-[#0d66c4]">バッジコレクション</h3>
              <button type="button" onClick={() => setShowAllBadges((current) => !current)} className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-black">
                {showAllBadges ? "もどす" : "すべて見る"}
              </button>
            </div>
            {showAllBadges && <p className="mb-3 rounded-[12px] bg-[#fef3c7] px-3 py-2 text-xs font-black text-[#b45309]">すべてのバッジを表示中</p>}
            <div className="flex gap-4">
              {["#f59e0b", "#0d66c4", "#ef4444", "#14b8a6", "#7c3aed"].map((color, index) => (
                <div key={color} className="grid h-16 w-16 place-items-center rounded-[18px] border-4 border-white shadow" style={{ background: color }}>
                  <Shield className="h-9 w-9 fill-white/20 text-white" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {heroCards.map((hero) => (
              <div key={hero.name} className="rounded-[20px] border-2 border-[#d8e8f7] bg-white p-4 text-center shadow-lg">
                <h3 className={cn("mb-2 font-black", hero.locked ? "text-[#94a3b8]" : "text-[#0d66c4]")}>{hero.name}</h3>
                <div className="relative mx-auto h-36 rounded-[18px] bg-[#f8fbff]">
                  {hero.locked ? (
                    <div className="grid h-full place-items-center">
                      <Lock className="h-16 w-16 text-[#cbd5e1]" />
                    </div>
                  ) : (
                    <Mascot size="lg" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-75" />
                  )}
                  {!hero.locked && <Star className="absolute right-3 top-3 h-6 w-6 fill-[#facc15] text-[#eab308]" />}
                </div>
                <p className="mt-3 text-sm font-black text-[#eab308]">{"★".repeat(hero.stars)}{"☆".repeat(3 - hero.stars)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
