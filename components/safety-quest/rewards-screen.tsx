"use client"

import { Lock, Shield, Sparkles, Star, User, Zap } from "lucide-react"
import { RewardStat } from "@/components/safety-quest/quest-primitives"
import { Mascot } from "@/components/safety-quest/quest-characters"
import { StreetPhotoScene } from "@/components/safety-quest/street-photo-scene"

export function RewardsScreen({ onMap, onNext }: { onMap: () => void; onNext: () => void }) {
  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-b from-[#0895db] via-[#50c7ff] to-[#d9f7ff] p-5 text-[#0b2551]">
      {Array.from({ length: 44 }).map((_, index) => (
        <span
          key={index}
          className="absolute h-3 w-2 rotate-12 rounded-sm"
          style={{
            left: `${(index * 23) % 100}%`,
            top: `${(index * 17) % 82}%`,
            background: ["#f97316", "#22c55e", "#facc15", "#ef4444", "#3b82f6"][index % 5],
          }}
        />
      ))}
      <div className="relative z-10 mx-auto flex h-full max-w-[970px] flex-col">
        <div className="mx-auto mb-3 rounded-[18px] bg-gradient-to-b from-[#ff9f1c] to-[#f06414] px-12 py-3 text-4xl font-black text-white shadow-xl">
          ミッション クリア!
        </div>
        <div className="grid flex-1 gap-4 lg:grid-cols-[0.55fr_1.45fr_.7fr]">
          <div className="flex flex-col items-center justify-center">
            <Mascot size="lg" pose="jump" />
            <div className="mt-3 rounded-[18px] border-2 border-[#cde5f9] bg-white p-3 text-center text-sm font-black shadow-lg">
              やったね!<br />安全ヒーローとして<br />大せいこう!
            </div>
          </div>
          <div className="rounded-[28px] border-4 border-white/80 bg-white/88 p-5 shadow-2xl">
            <p className="text-center text-sm font-black text-[#0d66c4]">ステージ 2-3「見通しの悪い交差点」</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <RewardStat label="獲得ポイント" value="+380 pt" icon={<Star className="h-9 w-9 fill-[#facc15] text-[#eab308]" />} />
              <RewardStat label="コイン" value="+120" icon={<Sparkles className="h-9 w-9 text-[#f59e0b]" />} />
            </div>
            <h3 className="mt-5 text-center text-sm font-black text-[#52708f]">ゲットしたアイテム</h3>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                ["安全バッジ", "見通し名人", Shield],
                ["アイテム", "見守りホイッスル", Zap],
                ["スキン", "まもるんキャップ", User],
              ].map(([kind, name, Icon]) => (
                <div key={name as string} className="rounded-[18px] border-2 border-[#d8e8f7] bg-[#f8fbff] p-3 text-center shadow-sm">
                  <p className="text-[11px] font-black text-[#52708f]">{kind as string}</p>
                  <div className="mx-auto my-2 grid h-16 w-16 place-items-center rounded-[16px] bg-[#e0f2fe]">
                    <Icon className="h-9 w-9 text-[#0d66c4]" />
                  </div>
                  <p className="text-xs font-black">{name as string}</p>
                  <p className="mt-1 text-xs font-black text-[#eab308]">★ x1</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-[24px] bg-[#fff4cc] p-4 text-center shadow-xl">
            <p className="text-sm font-black">つぎにすすめるルートが<br />ふえたよ!</p>
            <div className="relative mx-auto my-4 h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-[#a3d5ff] shadow">
              <StreetPhotoScene />
              <Lock className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b2551]/80 p-2 text-white" />
            </div>
            <div className="rounded-[18px] bg-[#f97316] px-3 py-2 text-lg font-black text-white">商店街ルートが解放!</div>
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-4">
          <button type="button" onClick={onMap} className="rounded-full bg-[#0d66c4] px-8 py-3 text-lg font-black text-white shadow-lg">
            マップにもどる
          </button>
          <button type="button" onClick={onNext} className="rounded-full bg-[#ff8b18] px-10 py-3 text-xl font-black text-white shadow-lg">
            つぎのステージへ!
          </button>
        </div>
      </div>
    </div>
  )
}
