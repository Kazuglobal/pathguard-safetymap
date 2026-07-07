"use client"

import { Flag, Gift, Lock, Sparkles, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SafetyQuestChallenge } from "@/lib/safety-quest"
import type { Screen } from "@/components/safety-quest/screen-types"
import { GameHeader, StatusPill } from "@/components/safety-quest/quest-primitives"
import { Mascot } from "@/components/safety-quest/quest-characters"

const mapNodes = [
  { id: 1, x: 26, y: 69, stars: 3, label: "スタート", locked: false },
  { id: 2, x: 40, y: 47, stars: 3, label: "みまもり坂", locked: false },
  { id: 3, x: 61, y: 25, stars: 2, label: "交差点", locked: false },
  { id: 4, x: 71, y: 55, stars: 1, label: "公園前", locked: false },
  { id: 5, x: 86, y: 36, stars: 0, label: "商店街", locked: true },
]

export function AdventureMapScreen({
  challenges,
  selectedChallenge,
  onStart,
  onJump,
}: {
  challenges: readonly SafetyQuestChallenge[]
  selectedChallenge: SafetyQuestChallenge
  onStart: (challenge: SafetyQuestChallenge) => void
  onJump: (screen: Screen) => void
}) {
  return (
    <div className="h-full bg-gradient-to-b from-[#b9e8ff] via-[#e8f8ff] to-[#d7f4d8]">
      <GameHeader
        title="ぼうけんマップ"
        subtitle="まちの安全をまもる ぼうけんに出発しよう!"
        right={
          <>
            <StatusPill icon={<Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />} value="128/150" />
            <StatusPill icon={<Sparkles className="h-4 w-4 text-[#0ea5e9]" />} value="1,250" />
          </>
        }
      />
      <div className="grid h-[calc(100%-70px)] gap-4 p-4 lg:grid-cols-[0.78fr_1.22fr] lg:p-5">
        <section className="relative overflow-hidden rounded-[26px] border-4 border-white/80 bg-white/78 p-4 shadow-xl">
          <div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-[#9be7ff]/70" />
          <div className="relative z-10 flex items-start gap-4">
            <Mascot size="lg" pose="point" />
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-[#0b66c3] px-3 py-1 text-xs font-black text-white">レベル 12</span>
              <h3 className="mt-3 text-3xl font-black leading-tight text-[#0b2b62]">安全たんけんへ<br />出発!</h3>
              <button
                type="button"
                onClick={() => onStart(selectedChallenge)}
                className="mt-3 whitespace-nowrap rounded-full bg-[#ff8b18] px-6 py-3 text-sm font-black text-white shadow-lg shadow-orange-900/15 transition hover:scale-[1.02]"
              >
                出発する
              </button>
              <p className="mt-3 rounded-[18px] border-2 border-[#cbe5f8] bg-white px-4 py-3 text-sm font-bold leading-relaxed text-[#31516f] shadow-sm">
                今日のミッションをクリアして、次のステージをひらこう。
              </p>
              <div className="mt-3 rounded-[18px] border-2 border-[#9bd8d3] bg-[#f0fffd] px-4 py-3 shadow-sm">
                <p className="text-[11px] font-black text-[#087c78]">今日の投稿チャレンジ</p>
                <p className="mt-1 text-sm font-black leading-tight text-[#0b2b62]">{selectedChallenge.title}</p>
                <p className="mt-1 text-xs font-bold text-[#52708f]">{selectedChallenge.areaLabel}</p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] border-2 border-[#c8e5fb] bg-white p-3 shadow-sm">
              <p className="text-xs font-black text-[#41718f]">エリア1</p>
              <p className="text-sm font-black text-[#0b2b62]">学校のまわり</p>
              <div className="mt-2 flex items-center gap-2 text-xs font-black">
                <Star className="h-4 w-4 fill-[#facc15] text-[#eab308]" />12/15
              </div>
            </div>
            <div className="rounded-[18px] border-2 border-[#ffd49a] bg-[#fff6df] p-3 shadow-sm">
              <p className="text-xs font-black text-[#995b00]">今日のミッション</p>
              <p className="mt-2 text-2xl font-black text-[#0f8f73]">3/3</p>
            </div>
          </div>
        </section>

        <section className="relative min-h-[430px] overflow-hidden rounded-[26px] border-4 border-white/90 bg-[#bdecb6] shadow-xl">
          <MapIllustration />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M26 69 C34 62 35 53 40 47 C48 36 55 33 61 25 C66 34 65 46 71 55 C76 47 80 40 86 36"
              fill="none"
              stroke="#1677c6"
              strokeDasharray="3 2"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
          {mapNodes.map((node) => {
            const challenge = challenges[(node.id - 1) % challenges.length] ?? selectedChallenge

            return (
              <StageNode
                key={node.id}
                node={node}
                onClick={node.locked ? undefined : () => onStart(challenge)}
              />
            )
          })}
          <button
            type="button"
            onClick={() => onJump("defend")}
            className="absolute right-4 top-4 grid h-16 w-16 place-items-center rounded-[20px] border-4 border-white bg-[#ffb020] text-[#8a4a00] shadow-lg"
            aria-label="たからばこ"
          >
            <Gift className="h-8 w-8" />
          </button>
        </section>
      </div>
    </div>
  )
}

function MapIllustration() {
  const houses = [
    ["12%", "18%", "#f9b44d"],
    ["28%", "30%", "#72c6ef"],
    ["70%", "20%", "#ff8c66"],
    ["82%", "63%", "#facc15"],
    ["18%", "74%", "#f7a3b5"],
  ]
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,.75),transparent_16%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,.75),transparent_12%),linear-gradient(135deg,#c8f2b8,#eaf8b4_45%,#a9e5c9)]" />
      <div className="absolute -left-12 top-[54%] h-16 w-[120%] rotate-[-18deg] rounded-full bg-[#f4e7a5]" />
      <div className="absolute left-[48%] top-[-8%] h-[120%] w-20 rotate-[22deg] rounded-full bg-[#f4e7a5]" />
      <div className="absolute left-[4%] top-[42%] h-14 w-[92%] rotate-[9deg] rounded-full bg-[#89d0f0]/80" />
      {houses.map(([left, top, color], index) => (
        <div key={`${left}-${top}`} className="absolute h-14 w-16" style={{ left, top }}>
          <div className="absolute bottom-0 h-10 w-16 rounded-[6px] border-2 border-white shadow" style={{ background: color }} />
          <div className="absolute left-1 top-0 h-9 w-14 rotate-45 rounded-[4px] border-l-2 border-t-2 border-white bg-[#cf6f3d]" />
          <span className="absolute bottom-3 left-3 h-3 w-3 rounded-sm bg-white/80" />
          <span className="absolute bottom-3 right-3 h-3 w-3 rounded-sm bg-white/80" />
          {index === 2 && <Flag className="absolute -right-1 -top-3 h-5 w-5 fill-[#ef4444] text-[#ef4444]" />}
        </div>
      ))}
      {Array.from({ length: 22 }).map((_, index) => (
        <span
          key={index}
          className="absolute h-5 w-4 rounded-full bg-[#54b96d] shadow-sm"
          style={{
            left: `${8 + ((index * 17) % 84)}%`,
            top: `${12 + ((index * 23) % 76)}%`,
            transform: `scale(${0.75 + (index % 4) * 0.08})`,
          }}
        />
      ))}
    </div>
  )
}

function StageNode({
  node,
  onClick,
}: {
  node: { id: number; x: number; y: number; stars: number; label: string; locked: boolean }
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={node.locked}
      className={cn(
        "absolute grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] border-white text-xl font-black text-white shadow-xl transition",
        node.locked ? "bg-[#9aa8b5]" : "bg-gradient-to-b from-[#23c58b] to-[#0c91b7] hover:scale-105",
      )}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      aria-label={node.label}
    >
      {node.locked ? <Lock className="h-8 w-8" /> : node.id}
      <span className="absolute -bottom-5 flex gap-0.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Star key={index} className={cn("h-4 w-4", index < node.stars ? "fill-[#facc15] text-[#eab308]" : "fill-white text-white")} />
        ))}
      </span>
      {node.id === 1 && (
        <span className="absolute -bottom-11 rounded-full bg-[#1bb46f] px-3 py-1 text-xs font-black text-white shadow">スタート</span>
      )}
    </button>
  )
}
