"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Eye, Search, ShieldCheck, Sparkles, Star as StarIcon, Zap } from "lucide-react"

import type { HunterHazard } from "@/lib/hunter/types"
import { Celebrate, Mascot, PrimaryCTA, StatPill, tokens } from "./theme"

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

const C = tokens.color

/** お祝いメッセージ: 発見率で言葉を変える（どの結果でも前向き）。 */
function celebrationMessage(matches: number, total: number): string {
  if (total <= 0) return "プレイしてくれて ありがとう！"
  if (matches >= total) return "ぜんぶ 見つけたよ！ きけんハンター めいじん！"
  if (matches >= Math.ceil(total / 2)) return "すごい！ たくさん 見つけられたね！"
  if (matches > 0) return "やったね！ きけんを 見つけられたよ！"
  return "チャレンジ できたね！ つぎは いっしょに さがそう！"
}

/** 達成段階（0〜3）。点数ではなく「成長」を星であらわす。 */
function starCount(matches: number, total: number): number {
  if (total <= 0) return 0
  const rate = matches / total
  if (matches >= total) return 3
  if (rate >= 0.5) return 2
  if (matches > 0) return 1
  return 0
}

interface Badge {
  label: string
  caption: string
  gradient: string
}

/** 達成段階に応じた、否定しないごほうびバッジ。 */
function badgeFor(stars: number): Badge {
  if (stars >= 3) {
    return {
      label: "めいじんバッジ",
      caption: "ぜんぶ 見つけた すごい目！",
      gradient: tokens.gradient.treasure,
    }
  }
  if (stars === 2) {
    return {
      label: "たんていバッジ",
      caption: "よく 気づけたね！",
      gradient: tokens.gradient.combo,
    }
  }
  if (stars === 1) {
    return {
      label: "みならいバッジ",
      caption: "1つ 見つけられたよ！",
      gradient: tokens.gradient.sky,
    }
  }
  return {
    label: "チャレンジバッジ",
    caption: "やってみた キミは えらい！",
    gradient: tokens.gradient.sky,
  }
}

export function ResultCard(props: ResultCardProps) {
  const { score, matches, total, comboMax, hazards, foundIds, onRetry, onNewPhoto } = props

  const reduce = useReducedMotion()

  const foundSet = React.useMemo(() => new Set(foundIds), [foundIds])
  const foundHazards = React.useMemo(
    () => hazards.filter((h) => foundSet.has(h.id)),
    [hazards, foundSet],
  )
  const missedHazards = React.useMemo(
    () => hazards.filter((h) => !foundSet.has(h.id)),
    [hazards, foundSet],
  )

  const stars = starCount(matches, total)
  const badge = badgeFor(stars)
  const mascotMood = stars >= 2 ? "wow" : "cheer"

  // 結果画面に入ったら 1 回だけお祝い演出を出す（reduced は theme 側でフェードのみ）。
  const [celebrate, setCelebrate] = React.useState(false)
  React.useEffect(() => {
    setCelebrate(true)
    const timer = window.setTimeout(() => setCelebrate(false), 1100)
    return () => window.clearTimeout(timer)
  }, [])

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { ...tokens.spring, delay },
        }

  return (
    <section aria-label="ゲームのけっか" className="mx-auto w-full max-w-md space-y-4">
      <Celebrate show={celebrate} />

      {/* お祝いヒーロー */}
      <motion.div
        {...rise(0.04)}
        className="relative overflow-hidden rounded-[24px] px-5 pb-6 pt-5 text-center text-white"
        style={{ background: tokens.gradient.sky, boxShadow: tokens.shadow.card }}
      >
        {/* やわらかい光のあしらい（装飾） */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full"
          style={{ background: "rgba(255,255,255,.18)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full"
          style={{ background: "rgba(255,255,255,.12)" }}
        />

        <div className="relative flex flex-col items-center">
          <Mascot size="lg" mood={mascotMood} />

          <h2 className="mt-1 text-[22px] font-extrabold leading-tight sm:text-2xl">
            {celebrationMessage(matches, total)}
          </h2>

          {/* 達成の星（1〜3） */}
          <StarRow stars={stars} />

          {/* スコア（ヒーロー数値） */}
          <div className="mt-3 flex items-end justify-center gap-2">
            <span
              className="text-6xl font-extrabold leading-none tabular-nums sm:text-7xl"
              style={{ color: C.warning, textShadow: "0 3px 10px rgba(11,37,81,.35)" }}
              aria-hidden="true"
            >
              {score}
            </span>
            <span className="pb-1 text-2xl font-extrabold text-white/90">pt</span>
          </div>
          <p className="sr-only">スコアは {score} ポイントです</p>

          {/* ごほうびバッジ */}
          <BadgeChip badge={badge} reduce={reduce ?? false} />
        </div>
      </motion.div>

      {/* HUD まとめ（はっけん数・コンボ） */}
      <motion.div {...rise(0.1)} className="flex flex-wrap justify-center gap-3">
        <StatPill
          tone="green"
          icon={<Eye className="h-4 w-4" aria-hidden="true" />}
          label={`はっけん（ぜんぶで ${total}）`}
          value={matches}
        />
        <StatPill
          tone="orange"
          icon={<Zap className="h-4 w-4" aria-hidden="true" />}
          label="さいこうコンボ"
          value={comboMax}
        />
      </motion.div>

      {/* 見つけた危険と「気をつける練習」 */}
      {foundHazards.length > 0 && (
        <motion.div
          {...rise(0.16)}
          className="rounded-[24px] bg-white p-4"
          style={{ boxShadow: tokens.shadow.card }}
        >
          <h3
            className="flex items-center gap-1.5 text-base font-extrabold"
            style={{ color: C.primaryStrong }}
          >
            <Sparkles className="h-5 w-5" style={{ color: C.warning }} aria-hidden="true" />
            見つけた きけんと、気をつける れんしゅう
          </h3>
          <ul className="mt-3 space-y-2.5">
            {foundHazards.map((h) => (
              <li
                key={h.id}
                className="rounded-[20px] bg-[#FFF8EF] p-3.5"
                style={{ boxShadow: tokens.shadow.soft, borderLeft: `5px solid ${C.warning}` }}
              >
                <p className="flex items-center gap-2">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                    style={{ background: C.success }}
                    aria-hidden="true"
                  >
                    <ShieldCheck className="h-4 w-4 text-white" />
                  </span>
                  <span className="font-extrabold" style={{ color: C.ink }}>
                    {h.type}
                  </span>
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white"
                    style={{ background: C.success }}
                  >
                    みつけた！
                  </span>
                </p>
                <p
                  className="mt-2 text-sm font-bold leading-relaxed"
                  style={{ color: C.ink }}
                >
                  <span aria-hidden="true">🛡 </span>
                  {h.safeAction}
                </p>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* 見つけられなかった危険（責めずに前向きに） */}
      {missedHazards.length > 0 && (
        <motion.div
          {...rise(0.22)}
          className="rounded-[24px] bg-white p-4"
          style={{ boxShadow: tokens.shadow.card }}
        >
          <h3
            className="flex items-center gap-1.5 text-base font-extrabold"
            style={{ color: C.accentStrong }}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
            つぎは こんなところも 見てみよう！
          </h3>
          <ul className="mt-3 space-y-2.5">
            {missedHazards.map((h) => (
              <li
                key={h.id}
                className="rounded-[20px] p-3.5"
                style={{
                  background: "#FFFFFF",
                  boxShadow: tokens.shadow.soft,
                  border: `2px dashed ${C.accent}`,
                }}
              >
                <p className="flex items-center gap-2 font-extrabold" style={{ color: C.accentStrong }}>
                  <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{h.type}</span>
                </p>
                <p
                  className="mt-1.5 text-sm font-medium leading-relaxed"
                  style={{ color: C.inkSoft }}
                >
                  {h.kidExplanation}
                </p>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* アクションボタン */}
      <motion.div {...rise(0.28)} className="flex flex-col gap-3 pt-1">
        <PrimaryCTA onClick={onRetry}>
          <span aria-hidden="true">🔁</span>
          もういちど さがす
        </PrimaryCTA>
        <PrimaryCTA onClick={onNewPhoto} className={tokens.cls.ctaBlue}>
          <span aria-hidden="true">📷</span>
          べつの写真で あそぶ
        </PrimaryCTA>
      </motion.div>
    </section>
  )
}

/** 達成の星（1〜3）。点数ではなく「成長」を肯定的に見せる。 */
function StarRow({ stars }: { stars: number }) {
  const reduce = useReducedMotion()
  const label =
    stars >= 3
      ? "ほし 3つ ぜんぶ あつまったよ"
      : stars === 2
        ? "ほし 2つ あつまったよ"
        : stars === 1
          ? "ほし 1つ あつまったよ"
          : "つぎは ほしを あつめよう"

  return (
    <div className="mt-2 flex items-center justify-center gap-1.5" role="img" aria-label={label}>
      {[0, 1, 2].map((i) => {
        const filled = i < stars
        return (
          <motion.span
            key={i}
            initial={reduce ? undefined : { scale: 0.4, opacity: 0 }}
            animate={reduce ? undefined : { scale: 1, opacity: 1 }}
            transition={reduce ? undefined : { ...tokens.spring, delay: 0.18 + i * 0.12 }}
          >
            <StarIcon
              className="h-8 w-8"
              aria-hidden="true"
              style={{
                color: filled ? C.warning : "rgba(255,255,255,.4)",
                fill: filled ? C.warning : "transparent",
                filter: filled ? "drop-shadow(0 2px 4px rgba(11,37,81,.3))" : undefined,
              }}
            />
          </motion.span>
        )
      })}
    </div>
  )
}

/** ごほうびバッジ（どの結果でも前向き）。 */
function BadgeChip({ badge, reduce }: { badge: Badge; reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? undefined : { scale: 0.6, opacity: 0 }}
      animate={reduce ? undefined : { scale: 1, opacity: 1 }}
      transition={reduce ? undefined : { ...tokens.spring, delay: 0.55 }}
      className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2"
      style={{ background: badge.gradient, boxShadow: tokens.shadow.soft }}
    >
      <span
        className="grid h-6 w-6 place-items-center rounded-full bg-white/30"
        aria-hidden="true"
      >
        <StarIcon className="h-3.5 w-3.5 text-white" fill="currentColor" />
      </span>
      <span className="text-left leading-tight">
        <span className="block text-sm font-extrabold" style={{ color: C.ink }}>
          {badge.label}
        </span>
        <span className="block text-[11px] font-bold" style={{ color: C.ink, opacity: 0.75 }}>
          {badge.caption}
        </span>
      </span>
    </motion.div>
  )
}
