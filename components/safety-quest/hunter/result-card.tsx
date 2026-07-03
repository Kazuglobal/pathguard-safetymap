"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  Camera,
  Eye,
  MessageCircleHeart,
  RotateCcw,
  Search,
  ShieldCheck,
  Star as StarIcon,
  Zap,
} from "lucide-react"

import type { HunterHazard } from "@/lib/hunter/types"
import { splitFurigana } from "@/lib/hunter/furigana"
import { RubyText } from "./ruby-text"
import {
  Celebrate,
  Mascot,
  PaperPanel,
  PrimaryCTA,
  StampSeal,
  StatPill,
  tokens,
} from "./theme"

export interface ResultCardProps {
  score: number
  matches: number
  total: number
  comboMax: number
  /** コンボ表示(クイズなど概念がないモードでは false) */
  showCombo?: boolean
  hazards: readonly HunterHazard[]
  foundIds: readonly string[]
  onRetry: () => void
  onNewPhoto: () => void
}

const C = tokens.color

/** お祝いメッセージ: 「気づく目」を育てる前向きさ。断定・競争表現は使わない。 */
function celebrationMessage(matches: number, total: number): string {
  if (total <= 0) return "プレイしてくれて ありがとう！"
  if (matches >= total) return "ぜんぶ きづけたね！ すごい目だね！"
  if (matches >= Math.ceil(total / 2)) return "たくさん きづけたね！ いい目だね！"
  if (matches > 0) return "あぶないところに きづけたね！"
  return "チャレンジ できたね！ つぎも いっしょに さがそう！"
}

/** 達成段階(0〜3)。点数ではなく「成長」を星であらわす。 */
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
  tone: "sun" | "green" | "accent"
}

/** 達成段階に応じた、否定しないごほうびバッジ。 */
function badgeFor(stars: number): Badge {
  if (stars >= 3) return { label: "きづきバッジ", caption: "たくさん きづけた すごい目！", tone: "sun" }
  if (stars === 2) return { label: "たんていバッジ", caption: "よく 気づけたね！", tone: "accent" }
  if (stars === 1) return { label: "みならいバッジ", caption: "1つ 見つけられたよ！", tone: "green" }
  return { label: "チャレンジバッジ", caption: "やってみた キミは えらい！", tone: "green" }
}

/**
 * 小さなタグ用: 漢字をかなに開く(6px相当の極小ルビは読めないため)。
 * 辞書に無い漢字はそのまま。
 */
function toKana(text: string): string {
  return splitFurigana(text)
    .map((tk) => tk.r ?? tk.t)
    .join("")
}

/** 親子の会話をうながす問いかけ(みつけた/みのがした危険から1つ)。 */
function conversationPrompt(hazards: readonly HunterHazard[], foundIds: ReadonlySet<string>): string {
  const found = hazards.find((h) => foundIds.has(h.id))
  const target = found ?? hazards[0]
  if (!target) return "きょう あるいた みちで、気になった ところは あった？"
  return `「${target.type}」は どうして あぶないのかな？ こんど その ばしょを いっしょに 見てみよう。`
}

export function ResultCard(props: ResultCardProps) {
  const {
    score,
    matches,
    total,
    comboMax,
    showCombo = true,
    hazards,
    foundIds,
    onRetry,
    onNewPhoto,
  } = props

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

  // 結果画面に入ったら 1 回だけお祝い演出を出す(reduced は theme 側でフェードのみ)。
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
          transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const, delay },
        }

  return (
    <section aria-label="ゲームのけっか" className="mx-auto w-full max-w-md space-y-4">
      <Celebrate show={celebrate} />

      {/* お祝いヒーロー: ノートに大きなスタンプが押される */}
      <motion.div {...rise(0.02)}>
        <PaperPanel className="relative overflow-hidden px-5 pb-6 pt-5 text-center">
          {/* うっすら方眼(ノートらしさ) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[.05]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(67,57,43,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(67,57,43,.7) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />

          <div className="relative flex flex-col items-center">
            <div className="flex items-end gap-2">
              <Mascot size="md" mood={mascotMood} />
              {/* スタンプがドン！と押される */}
              <motion.div
                initial={reduce ? { opacity: 0 } : { scale: 2.4, opacity: 0, rotate: 18 }}
                animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1, rotate: -8 }}
                transition={
                  reduce
                    ? { duration: 0.2 }
                    : { type: "spring", stiffness: 320, damping: 17, delay: 0.25 }
                }
                style={{ filter: "drop-shadow(0 4px 8px rgba(67,57,43,.25))" }}
              >
                <StampSeal size={88} label={stars >= 3 ? "かんぺき" : "クリア"} tone={stars >= 3 ? "accent" : "green"} />
              </motion.div>
            </div>

            <h2 className="mt-3 text-[21px] font-black leading-snug" style={{ color: C.ink }}>
              <RubyText text={celebrationMessage(matches, total)} />
            </h2>

            {/* 達成の星(1〜3) */}
            <StarRow stars={stars} />

            {/* スコアは主役にしない(点取りゲーム化を避ける) */}
            <p className="mt-2.5 text-[14px] font-black" style={{ color: C.inkSoft }}>
              <span className="text-[24px] tabular-nums" style={{ color: C.accentStrong }}>
                {score}
              </span>{" "}
              がんばりポイント
            </p>

            {/* ごほうびバッジ */}
            <motion.div
              initial={reduce ? undefined : { scale: 0.6, opacity: 0, rotate: -4 }}
              animate={reduce ? undefined : { scale: 1, opacity: 1, rotate: -1.5 }}
              transition={reduce ? undefined : { ...tokens.spring, delay: 0.5 }}
              className="mt-3.5 inline-flex items-center gap-2.5 rounded-[16px] px-4 py-2.5"
              style={{
                background: badge.tone === "sun" ? C.sun : badge.tone === "accent" ? C.accent : C.primary,
                color: badge.tone === "sun" ? C.ink : "#fff",
                boxShadow: `0 0 0 2.5px #fff, ${tokens.shadow.soft}`,
              }}
            >
              <StarIcon className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true" />
              <span className="text-left leading-tight">
                <span className="block text-[13.5px] font-black">{badge.label}</span>
                <span className="block text-[11px] font-bold opacity-85">{badge.caption}</span>
              </span>
            </motion.div>
          </div>
        </PaperPanel>
      </motion.div>

      {/* HUD まとめ */}
      <motion.div {...rise(0.1)} className="flex flex-wrap justify-center gap-2.5">
        <StatPill
          tone="green"
          icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />}
          label={`はっけん（ぜんぶで ${total}）`}
          value={matches}
        />
        {showCombo && (
          <StatPill
            tone="orange"
            icon={<Zap className="h-3.5 w-3.5" aria-hidden="true" />}
            label="さいこうコンボ"
            value={comboMax}
          />
        )}
      </motion.div>

      {/* おうちの人と はなそう(会話のタネ) */}
      <motion.div {...rise(0.14)}>
        <PaperPanel tone="green" className="px-4 py-4">
          <h3
            className="flex items-center gap-1.5 text-[14px] font-black"
            style={{ color: C.primaryStrong }}
          >
            <MessageCircleHeart className="h-5 w-5" aria-hidden="true" />
            おうちの人と はなしてみよう
          </h3>
          <p className="mt-2 text-[14px] font-bold leading-relaxed" style={{ color: C.ink }}>
            <RubyText text={conversationPrompt(hazards, foundSet)} />
          </p>
        </PaperPanel>
      </motion.div>

      {/* 見つけた危険と「気をつける練習」 */}
      {foundHazards.length > 0 && (
        <motion.div {...rise(0.18)}>
          <PaperPanel className="px-4 py-4">
            <h3
              className="flex items-center gap-1.5 text-[15px] font-black"
              style={{ color: C.primaryStrong }}
            >
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <RubyText text="見つけた危険と、気をつける練習" />
            </h3>
            <ul className="mt-3 space-y-2.5">
              {foundHazards.map((h) => (
                <li
                  key={h.id}
                  className="relative rounded-[16px] p-3.5 pl-4"
                  style={{
                    background: C.primarySoft,
                    boxShadow: tokens.shadow.soft,
                  }}
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-[14.5px]" style={{ color: C.ink }}>
                      <RubyText text={h.type} />
                    </span>
                    {h.accidentLink ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-black text-white"
                        style={{ background: C.accent }}
                      >
                        {toKana(h.accidentLink)}
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0" aria-label="みつけた">
                      <StampSeal size={38} label="OK" tone="green" />
                    </span>
                  </p>
                  <p className="mt-1.5 text-[13px] font-bold leading-relaxed" style={{ color: C.ink }}>
                    <span aria-hidden="true">👀 </span>
                    <RubyText text={h.kidExplanation} />
                  </p>
                  <p className="mt-1 text-[13px] font-bold leading-relaxed" style={{ color: C.primaryStrong }}>
                    <span aria-hidden="true">🛡 </span>
                    <RubyText text={h.safeAction} />
                  </p>
                </li>
              ))}
            </ul>
          </PaperPanel>
        </motion.div>
      )}

      {/* 見つけられなかった危険(責めずに前向きに) */}
      {missedHazards.length > 0 && (
        <motion.div {...rise(0.24)}>
          <PaperPanel className="px-4 py-4">
            <h3
              className="flex items-center gap-1.5 text-[15px] font-black"
              style={{ color: C.accentStrong }}
            >
              <Search className="h-5 w-5" aria-hidden="true" />
              <RubyText text="つぎは こんな ところも 見てみよう！" />
            </h3>
            <ul className="mt-3 space-y-2.5">
              {missedHazards.map((h) => (
                <li
                  key={h.id}
                  className="rounded-[16px] border-2 border-dashed p-3.5"
                  style={{ borderColor: `${C.accent}66`, background: "#fff" }}
                >
                  <p className="flex items-center gap-2 text-[14px] font-black" style={{ color: C.accentStrong }}>
                    <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <RubyText text={h.type} />
                  </p>
                  <p className="mt-1.5 text-[13px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
                    <RubyText text={h.kidExplanation} />
                  </p>
                </li>
              ))}
            </ul>
          </PaperPanel>
        </motion.div>
      )}

      {/* アクションボタン */}
      <motion.div {...rise(0.3)} className="flex flex-col gap-2.5 pt-1">
        <PrimaryCTA onClick={onRetry}>
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
          もういちど さがす
        </PrimaryCTA>
        <PrimaryCTA onClick={onNewPhoto} variant="paper">
          <Camera className="h-5 w-5" aria-hidden="true" />
          べつの<RubyText text="写真" />で あそぶ
        </PrimaryCTA>
      </motion.div>
    </section>
  )
}

/** 達成の星(1〜3)。点数ではなく「成長」を肯定的に見せる。 */
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
            initial={reduce ? undefined : { scale: 0.3, opacity: 0, rotate: -30 }}
            animate={reduce ? undefined : { scale: 1, opacity: 1, rotate: 0 }}
            transition={reduce ? undefined : { type: "spring", stiffness: 380, damping: 18, delay: 0.3 + i * 0.14 }}
          >
            <StarIcon
              className="h-9 w-9"
              aria-hidden="true"
              style={{
                color: filled ? C.sun : "rgba(67,57,43,.18)",
                fill: filled ? C.sun : "transparent",
                filter: filled ? "drop-shadow(0 2px 3px rgba(67,57,43,.25))" : undefined,
              }}
            />
          </motion.span>
        )
      })}
    </div>
  )
}
