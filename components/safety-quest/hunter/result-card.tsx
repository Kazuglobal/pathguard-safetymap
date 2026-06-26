"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import type { HunterHazard } from "@/lib/hunter/types"

export interface ResultCardProps {
  score: number
  matches: number
  total: number
  comboMax: number
  hazards: readonly HunterHazard[]
  foundIds: readonly string[]
  onRetry: () => void
  onNewPhoto: () => void
}

/** お祝いメッセージ: 発見率で言葉を変える（どの結果でも前向き）。 */
function celebrationMessage(matches: number, total: number): string {
  if (total <= 0) return "プレイしてくれて ありがとう！"
  if (matches >= total) return "ぜんぶ 見つけたよ！ きけんハンター めいじん！"
  if (matches >= Math.ceil(total / 2)) return "すごい！ たくさん 見つけられたね！"
  if (matches > 0) return "やったね！ きけんを 見つけられたよ！"
  return "チャレンジ できたね！ つぎは いっしょに さがそう！"
}

/** 危険の重さに合わせた絵文字。 */
function severityEmoji(severity: HunterHazard["severity"]): string {
  switch (severity) {
    case "high":
      return "🚨"
    case "medium":
      return "⚠️"
    case "low":
    default:
      return "👀"
  }
}

export function ResultCard(props: ResultCardProps) {
  const { score, matches, total, comboMax, hazards, foundIds, onRetry, onNewPhoto } = props

  const foundSet = React.useMemo(() => new Set(foundIds), [foundIds])

  const foundHazards = React.useMemo(
    () => hazards.filter((h) => foundSet.has(h.id)),
    [hazards, foundSet],
  )
  const missedHazards = React.useMemo(
    () => hazards.filter((h) => !foundSet.has(h.id)),
    [hazards, foundSet],
  )

  return (
    <section
      aria-label="ゲームのけっか"
      className="mx-auto w-full max-w-md rounded-[20px] bg-white p-5 shadow-xl ring-1 ring-black/5 sm:p-6"
    >
      {/* お祝いヘッダー */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#0d66c4] to-[#1a8fff] px-5 py-6 text-center text-white shadow-lg">
        <div className="text-4xl" aria-hidden="true">
          🎉✨
        </div>
        <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">
          {celebrationMessage(matches, total)}
        </h2>

        <div className="mt-4 flex items-end justify-center gap-2">
          <span
            className="text-6xl font-black tabular-nums leading-none text-[#ffcf35] drop-shadow sm:text-7xl"
            aria-hidden="true"
          >
            {score}
          </span>
          <span className="pb-1 text-2xl font-black text-white/90">pt</span>
        </div>
        <p className="sr-only">スコアは {score} ポイントです</p>
      </div>

      {/* サマリーバッジ */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[20px] bg-[#0d66c4]/10 px-4 py-3 text-center">
          <div className="text-2xl font-black tabular-nums text-[#0d66c4]">
            {matches}
            <span className="text-base font-bold text-[#0d66c4]/70"> / {total}</span>
          </div>
          <div className="mt-0.5 text-xs font-bold text-[#0d66c4]/80">こ 見つけた</div>
        </div>
        <div className="rounded-[20px] bg-[#f97316]/10 px-4 py-3 text-center">
          <div className="text-2xl font-black tabular-nums text-[#f97316]">
            {comboMax}
            <span className="text-base font-bold text-[#f97316]/70"> れんぞく</span>
          </div>
          <div className="mt-0.5 text-xs font-bold text-[#f97316]/80">さいこうコンボ</div>
        </div>
      </div>

      {/* 見つけた危険と安全の学び */}
      {foundHazards.length > 0 && (
        <div className="mt-5">
          <h3 className="text-base font-black text-[#0d66c4]">
            👏 見つけた きけんと、あんぜんの まなび
          </h3>
          <ul className="mt-2 space-y-2">
            {foundHazards.map((h) => (
              <li
                key={h.id}
                className="rounded-[20px] border-2 border-[#ffcf35] bg-[#ffcf35]/10 p-3"
              >
                <p className="flex items-center gap-1.5 font-black text-[#7a4a00]">
                  <span aria-hidden="true">{severityEmoji(h.severity)}</span>
                  <span>{h.type}</span>
                </p>
                <p className="mt-1 text-sm font-bold leading-snug text-[#444]">
                  <span aria-hidden="true">🛡️ </span>
                  {h.safeAction}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 見つけられなかった危険（責めずに前向きに） */}
      {missedHazards.length > 0 && (
        <div className="mt-5">
          <h3 className="text-base font-black text-[#f97316]">
            つぎは こんなところも 見てみよう！
          </h3>
          <ul className="mt-2 space-y-2">
            {missedHazards.map((h) => (
              <li
                key={h.id}
                className="rounded-[20px] border-2 border-dashed border-[#f97316]/50 bg-[#f97316]/5 p-3"
              >
                <p className="flex items-center gap-1.5 font-black text-[#c2410c]">
                  <span aria-hidden="true">🔍</span>
                  <span>{h.type}</span>
                </p>
                <p className="mt-1 text-sm font-medium leading-snug text-[#666]">
                  {h.kidExplanation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* アクションボタン */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          size="lg"
          variant="warning"
          className="w-full rounded-[20px] text-base font-black"
          onClick={onRetry}
        >
          🔁 もういちど
        </Button>
        <Button
          type="button"
          size="lg"
          variant="info"
          className="w-full rounded-[20px] text-base font-black"
          onClick={onNewPhoto}
        >
          📷 べつの写真で
        </Button>
      </div>
    </section>
  )
}
