"use client"

import { useState } from "react"
import { Image as ImageIcon } from "lucide-react"
import { GameHeader } from "@/components/safety-quest/quest-primitives"
import { KidDetective } from "@/components/safety-quest/quest-characters"
import { StreetPhotoScene } from "@/components/safety-quest/street-photo-scene"

export function MysteryScreen({ onBack }: { onBack: () => void }) {
  const [solved, setSolved] = useState(false)

  return (
    <div className="flex h-full flex-col bg-[#f6f0e5]">
      <GameHeader title="なぞときミッション" compact onBack={onBack} />
      <div className="relative flex-1 overflow-hidden bg-[#efe6d5]">
        <StreetPhotoScene />
        <div className="absolute inset-y-0 left-0 w-10 bg-[repeating-linear-gradient(to_bottom,#c9a67c_0_10px,transparent_10px_30px)] opacity-70" />
        <div className="absolute left-12 right-8 top-8 rounded-[24px] bg-white/92 p-5 shadow-xl">
          <div className="flex justify-between gap-5">
            <div>
              <span className="rounded-full bg-[#0d66c4] px-3 py-1 text-xs font-black text-white">ケース 03</span>
              <h3 className="mt-3 text-2xl font-black">「かげから ひょっこりはん!」</h3>
              <p className="mt-3 max-w-[470px] text-sm font-bold leading-relaxed text-[#31516f]">
                公園のまわりの道で、とてもあぶないことが起きているみたい...ヒントを集めて、なぞを解こう!
              </p>
            </div>
            <KidDetective />
          </div>
        </div>
        <div className="absolute bottom-28 left-8 right-8 rounded-[22px] border-4 border-[#d7edf8] bg-[#e8f8ff]/95 p-4 shadow-xl">
          <p className="mb-3 rounded-full bg-[#4cb5e8] px-3 py-1 text-xs font-black text-white">ヒントを集めよう!</p>
          <div className="grid grid-cols-4 gap-3">
            {["ポスター", "足あと", "かげの写真", "?"].map((hint, index) => (
              <div key={hint} className="grid h-24 place-items-center rounded-[16px] border-2 border-[#d8e8f7] bg-white p-2 text-center text-xs font-black">
                {index < 3 ? <ImageIcon className="h-10 w-10 text-[#0d66c4]" /> : <span className="text-4xl text-[#cbd5e1]">?</span>}
                {hint}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-4 left-8 right-8 rounded-[22px] border-4 border-[#a7f3d0] bg-white p-4 shadow-xl">
          <p className="mb-2 rounded-full bg-[#36bca5] px-3 py-1 text-xs font-black text-white">なぞを解こう!</p>
          <div className="grid items-center gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <p className="mb-2 text-sm font-black">車のかげからとび出すとどうなる?</p>
              {solved && (
                <p className="mb-2 rounded-[12px] bg-[#dcfce7] px-3 py-2 text-sm font-black text-[#087b55]">
                  <span>正解!</span> 見えない場所から出ると車に気づかれにくいよ。
                </p>
              )}
              <div className="flex gap-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <span key={index} className="grid h-9 w-9 place-items-center rounded-[8px] border-2 border-[#b7c9d8] bg-[#f8fbff] text-sm font-black">
                    {solved ? ["危", "険", "", "", "", "", ""][index] : index === 6 ? "険" : ""}
                  </span>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setSolved(true)} className="rounded-[16px] bg-[#0d66c4] px-10 py-3 text-lg font-black text-white shadow">
              {solved ? "もう一度見る" : "こたえを決定する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
