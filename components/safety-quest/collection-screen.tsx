"use client"

import { useState } from "react"
import { Gift, Sparkles } from "lucide-react"
import { GameHeader, StatusPill } from "@/components/safety-quest/quest-primitives"
import { Mascot } from "@/components/safety-quest/quest-characters"

const collectionItems = [
  { key: "school-guard", name: "スクールガード", rarity: "★★★", color: "#f7c948", locked: false },
  { key: "route-guide", name: "みちしるべくん", rarity: "★★", color: "#7bd88f", locked: false },
  { key: "signal-ranger", name: "シグナルレンジャー", rarity: "★★★", color: "#2f80ed", locked: false },
  { key: "lookout-master", name: "見通し名人", rarity: "★★★", color: "#14b8a6", locked: true },
  { key: "secret", name: "ひみつ", rarity: "", color: "#dbeafe", locked: true },
]

export function CollectionScreen({ unlockedRewards, onBack }: { unlockedRewards: string[]; onBack: () => void }) {
  const [localRewards, setLocalRewards] = useState<string[]>([])
  const [gachaMessage, setGachaMessage] = useState("ガードマン")
  const unlockedCollection = [...unlockedRewards, ...localRewards]
  const spinGacha = (message: string) => {
    setLocalRewards((current) => (current.includes("lookout-master") ? current : [...current, "lookout-master"]))
    setGachaMessage(message)
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-[#dff6ff] to-[#f8fcff] p-5">
      <GameHeader
        title="ガチャ・コレクション"
        compact
        onBack={onBack}
        right={
          <>
            <StatusPill icon={<Gift className="h-4 w-4 text-[#f59e0b]" />} value="5" />
            <StatusPill icon={<Sparkles className="h-4 w-4 text-[#0ea5e9]" />} value="120" />
          </>
        }
      />
      <div className="grid h-[calc(100%-56px)] gap-4 lg:grid-cols-[0.62fr_1.38fr]">
        <section className="relative overflow-hidden rounded-[28px] border-4 border-[#0d66c4] bg-[#79d4ff] p-4 shadow-xl">
          <div className="rounded-[22px] bg-[#0d66c4] p-3 text-center text-2xl font-black text-[#ffe066] shadow">
            セーフティ<br />ヒーローガチャ
          </div>
          <div className="relative mx-auto mt-3 h-[310px] max-w-[300px]">
            <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full border-[12px] border-[#e6f6ff] bg-white/60 shadow-inner" />
            {Array.from({ length: 16 }).map((_, index) => (
              <span
                key={index}
                className="absolute h-12 w-12 rounded-full border-4 border-white shadow"
                style={{
                  left: `${26 + Math.cos(index) * 34}%`,
                  top: `${30 + Math.sin(index * 1.7) * 26}%`,
                  background: ["#ef4444", "#22c55e", "#60a5fa", "#facc15", "#f472b6"][index % 5],
                }}
              />
            ))}
            <div className="absolute bottom-0 left-1/2 h-32 w-64 -translate-x-1/2 rounded-[28px] border-[8px] border-[#a33428] bg-[#f05a42]" />
            <button
              type="button"
              onClick={() => spinGacha("見通し名人をゲット!")}
              className="absolute bottom-8 left-1/2 grid h-20 w-20 -translate-x-1/2 place-items-center rounded-full border-8 border-[#0d66c4] bg-[#ffd23f] shadow-lg"
              aria-label="ガチャを回す"
            >
              <Gift className="h-10 w-10 text-[#0d66c4]" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="rounded-[18px] bg-[#14b8a6] py-3 text-lg font-black text-white shadow" type="button" aria-label="1回まわす 50" onClick={() => spinGacha("見通し名人をゲット!")}>1回まわす<br /><span className="text-sm">50</span></button>
            <button className="rounded-[18px] bg-[#ef4444] py-3 text-lg font-black text-white shadow" type="button" aria-label="10回まわす 450" onClick={() => spinGacha("見通し名人をゲット! 10回分のシール追加!")}>10回まわす<br /><span className="text-sm">450</span></button>
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <div className="grid rounded-[24px] bg-gradient-to-r from-[#f0526f] to-[#ffb067] p-4 text-white shadow-xl md:grid-cols-[0.34fr_1fr]">
            <div className="grid place-items-center rounded-[18px] bg-white/22">
              <Mascot pose="point" />
            </div>
            <div className="pl-4">
              <h3 className="text-2xl font-black">新しいヒーローをゲット!</h3>
              <div className="mt-4 rounded-[18px] bg-white p-4 text-[#0b2551] shadow">
                <span className="rounded-full bg-[#ef4444] px-2 py-1 text-xs font-black text-white">NEW!</span>
                <h4 className="mt-2 text-xl font-black">{gachaMessage}</h4>
                <p className="text-sm font-bold text-[#31516f]">みんなを守る、まちのヒーロー! 危険を見つけてお知らせしてくれるよ。</p>
              </div>
            </div>
          </div>
          <div className="flex-1 rounded-[24px] border-4 border-[#0c9c95] bg-[#dffbf4] p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between rounded-full bg-[#0c9c95] px-4 py-2 text-white">
              <h3 className="font-black">シールコレクション</h3>
              <span className="font-black">24/48</span>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {collectionItems.map((item) => {
                const locked = item.locked && !unlockedCollection.includes(item.key)

                return (
                <div key={item.name} className="rounded-[16px] border-2 border-[#c7ddf2] bg-white p-3 text-center shadow-sm">
                  <div className="relative mx-auto mb-2 grid h-24 place-items-center rounded-[14px] bg-[#f8fbff]">
                    {locked ? (
                      <span className="text-5xl font-black text-[#cbd5e1]">?</span>
                    ) : (
                      <Mascot size="sm" className="scale-90" />
                    )}
                    {!locked && <span className="absolute left-1 top-1 rounded bg-[#ef4444] px-1 text-[10px] font-black text-white">NEW!</span>}
                  </div>
                  <p className="text-xs font-black">{item.name}</p>
                  <p className="text-xs font-black text-[#eab308]">{item.rarity}</p>
                </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
