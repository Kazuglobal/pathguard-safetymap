"use client"

import { useState } from "react"
import { Palette, RotateCcw, Shield, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { GameHeader, StatusPill } from "@/components/safety-quest/quest-primitives"
import { KidAvatar } from "@/components/safety-quest/quest-characters"

export function AvatarScreen({
  avatarColor,
  equippedHat,
  onColor,
  onHat,
  onBack,
}: {
  avatarColor: string
  equippedHat: string
  onColor: (color: string) => void
  onHat: (hat: string) => void
  onBack: () => void
}) {
  const hats = ["ぼうし", "ヘルメット", "キャップ", "ねこ耳"]
  const colors = ["#22c55e", "#3b82f6", "#a855f7", "#f97316", "#ef4444", "#facc15"]
  const [activePanel, setActivePanel] = useState("ぼうし")
  const [avatarMessage, setAvatarMessage] = useState("ぼうしを表示中")
  const resetAvatar = () => {
    onColor("#22c55e")
    onHat("ぼうし")
    setAvatarMessage("アバターを初期状態に戻しました")
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-[#fff6e8] via-[#fffaf2] to-[#dff6ff]">
      <GameHeader
        title="アバターカスタム"
        compact
        onBack={onBack}
        right={<StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="1,250" />}
      />
      <div className="grid min-h-[calc(100%-56px)] gap-4 p-5 lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative overflow-hidden rounded-[28px] bg-[#ffefd8]/80 p-5 shadow-inner">
          <div className="absolute left-8 top-14 rounded-[18px] bg-white p-4 text-sm font-black shadow">ぼうしやふくを<br />えらんでね!</div>
          <div className="absolute right-10 top-14 h-36 w-24 rounded-full border-8 border-[#d6a675] bg-[#fef3c7]" />
          <div className="absolute right-7 top-28 h-40 w-32 rounded-[18px] bg-[#a7f3d0]/70" />
          <div className="absolute bottom-8 left-1/2 h-12 w-56 -translate-x-1/2 rounded-full bg-black/10 blur-sm" />
          <KidAvatar color={avatarColor} hat={equippedHat} className="absolute left-1/2 top-[14%] -translate-x-1/2 scale-125" />
        </section>
        <section className="flex flex-col gap-4">
          <div className="rounded-[24px] border-2 border-[#d8e8f7] bg-white p-4 shadow-lg">
            <div className="mb-3 flex gap-2">
              {["ぼうし", "ふく", "くつ", "アクセ", "カラー"].map((tab, index) => (
                <button
                  key={tab}
                  className={cn("flex items-center gap-2 rounded-[14px] px-4 py-2 text-sm font-black", activePanel === tab ? "bg-[#0d66c4] text-white" : "bg-[#f1f5f9]")}
                  type="button"
                  onClick={() => {
                    setActivePanel(tab)
                    setAvatarMessage(`${tab}を表示中`)
                  }}
                >
                  {index === 4 ? <Palette className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  {tab}
                </button>
              ))}
            </div>
            <p className="mb-3 rounded-[14px] bg-[#e0f2fe] px-3 py-2 text-sm font-black text-[#0d66c4]">{avatarMessage}</p>
            <div className="grid grid-cols-4 gap-3">
              {hats.map((hat) => (
                <button
                  key={hat}
                  type="button"
                  onClick={() => onHat(hat)}
                  className={cn("grid h-24 place-items-center rounded-[16px] border-2 bg-[#f8fbff] text-sm font-black shadow-sm", equippedHat === hat ? "border-[#0d66c4] ring-4 ring-[#dff6ff]" : "border-[#d8e8f7]")}
                >
                  <div className="h-10 w-16 rounded-t-full border-4 border-[#31583b]" style={{ background: hat === "ヘルメット" ? "#facc15" : hat === "キャップ" ? "#3b82f6" : hat === "ねこ耳" ? "#f5b7c8" : avatarColor }} />
                  {hat}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border-2 border-[#d8e8f7] bg-white p-4 shadow-lg">
            <h3 className="mb-3 font-black">カラー</h3>
            <div className="flex flex-wrap gap-3">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onColor(color)}
                  className={cn("h-12 w-12 rounded-full border-4 border-white shadow", avatarColor === color && "ring-4 ring-[#0d66c4]")}
                  style={{ background: color }}
                  aria-label={`${color}を選択`}
                />
              ))}
              <button className="grid h-12 w-12 place-items-center rounded-[14px] border-2 border-[#d8e8f7] bg-[#f8fbff]" type="button" onClick={resetAvatar} aria-label="リセット">
                <RotateCcw className="h-6 w-6 text-[#52708f]" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAvatarMessage(`アバターを保存しました: ${equippedHat}`)}
            className="mt-auto rounded-[18px] bg-[#0d66c4] py-4 text-xl font-black text-white shadow-lg"
          >
            このアバターで けってい!
          </button>
        </section>
      </div>
    </div>
  )
}
