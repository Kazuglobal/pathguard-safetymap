"use client"

/**
 * きけんハンター 共通テーマ
 *
 * 統合UIデザイン仕様（確定版）にもとづく Foundation ファイル。
 * 画面実装はここから tokens / Mascot / HunterShell / StatPill / PrimaryCTA / Celebrate を import する。
 *
 * 設計原則:
 *  - 明るく・やさしく・あんしん感（ライトな空グラデ＋クリーム面＋ポップな達成演出）
 *  - 否定しない / 断定しない（「安全判定」ではなく「気をつける練習」）
 *  - アクセシブル（十分なコントラスト・タップ領域大きめ・aria・reduced-motion 尊重）
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ *
 * tokens
 * ------------------------------------------------------------------ */

export const tokens = {
  color: {
    primary: "#1E88E5",
    primaryStrong: "#0D66C4",
    accent: "#FF8A3D",
    accentStrong: "#F2701F",
    success: "#2FBF71",
    warning: "#FFC23C",
    combo: "#FF7FB0",
    surface: "#FFFFFF",
    surfaceWarm: "#FFF8EF",
    headerNavy: "#0B2551",
    ink: "#2B3A4A",
    inkSoft: "#51677D",
    bgFrom: "#EAF4FF",
    bgTo: "#DCEBFF",
    danger: "#D14343",
  },
  // 任意要素ですぐ使える Tailwind クラス文字列
  cls: {
    pageBg: "bg-gradient-to-b from-[#EAF4FF] to-[#DCEBFF]",
    card:
      "bg-white rounded-[24px] shadow-[0_2px_6px_rgba(30,60,90,.10),0_8px_20px_rgba(30,60,90,.12)]",
    cardWarm:
      "bg-[#FFF8EF] rounded-[24px] shadow-[0_2px_6px_rgba(30,60,90,.10),0_8px_20px_rgba(30,60,90,.12)]",
    ctaTreasure: "bg-gradient-to-br from-[#FFC23C] to-[#FF8A3D] text-[#2B3A4A]",
    ctaBlue: "bg-[#1E88E5] text-white",
    focus:
      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1E88E5]/35",
  },
  radius: { card: 24, button: 9999, chip: 16, thumb: 20, marker: 9999 },
  shadow: {
    soft: "0 2px 6px rgba(30,60,90,.10)",
    card: "0 8px 20px rgba(30,60,90,.12)",
    pop: "0 6px 18px rgba(255,138,61,.35)",
    focus: "0 0 0 4px rgba(30,136,229,.35)",
  },
  gradient: {
    bg: "linear-gradient(180deg,#EAF4FF,#DCEBFF)",
    sky: "linear-gradient(160deg,#5BB8FF,#1E88E5)",
    treasure: "linear-gradient(45deg,#FFC23C,#FF8A3D)",
    combo: "linear-gradient(45deg,#FF9F5A,#FF7FB0)",
  },
  spring: { type: "spring", stiffness: 260, damping: 18 },
} as const

// framer-motion 用にゆるめに型付けした spring トランジション
const SPRING: Transition = { type: "spring", stiffness: 260, damping: 18 }
const C = tokens.color

/* ------------------------------------------------------------------ *
 * Mascot — ハンタくん（丸い盾のヒーロー探検家・2.2頭身）
 * ------------------------------------------------------------------ */

type MascotSize = "sm" | "md" | "lg"
type MascotMood = "happy" | "cheer" | "think" | "wow"

const MASCOT_PX: Record<MascotSize, number> = { sm: 48, md: 88, lg: 128 }

const MOOD_LABEL: Record<MascotMood, string> = {
  happy: "わくわくしているハンタくん",
  cheer: "おうえんしているハンタくん",
  think: "かんがえているハンタくん",
  wow: "びっくり して よろこんでいるハンタくん",
}

function MascotEyes({ mood }: { mood: MascotMood }) {
  const stroke = C.ink
  if (mood === "think") {
    // 目を細め上向き
    return (
      <g stroke={stroke} strokeWidth={3.5} strokeLinecap="round" fill="none">
        <path d="M44 58 q6 -4 12 0" />
        <path d="M64 58 q6 -4 12 0" />
      </g>
    )
  }
  if (mood === "cheer") {
    // 片目ウインク（∩）＋まる目
    return (
      <g>
        <path
          d="M44 60 q6 -6 12 0"
          stroke={stroke}
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={70} cy={59} r={5.5} fill={stroke} />
        <circle cx={68.2} cy={57.2} r={1.7} fill="#FFFFFF" />
      </g>
    )
  }
  if (mood === "wow") {
    // 目が★
    return (
      <g fill={stroke}>
        <Star cx={50} cy={59} r={6.5} />
        <Star cx={70} cy={59} r={6.5} />
      </g>
    )
  }
  // happy: まる目＋キラ
  return (
    <g fill={stroke}>
      <circle cx={50} cy={59} r={5.5} />
      <circle cx={70} cy={59} r={5.5} />
      <circle cx={48.2} cy={57.2} r={1.7} fill="#FFFFFF" />
      <circle cx={68.2} cy={57.2} r={1.7} fill="#FFFFFF" />
    </g>
  )
}

function MascotMouth({ mood }: { mood: MascotMood }) {
  if (mood === "wow") {
    return <ellipse cx={60} cy={73} rx={6} ry={7} fill={C.accentStrong} />
  }
  if (mood === "think") {
    return (
      <path
        d="M55 73 q5 3 10 0"
        stroke={C.ink}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    )
  }
  // happy / cheer: にっこり
  return (
    <path
      d="M50 71 q10 10 20 0"
      stroke={C.ink}
      strokeWidth={3.5}
      strokeLinecap="round"
      fill="none"
    />
  )
}

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts: string[] = []
  for (let i = 0; i < 10; i += 1) {
    const rad = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.45
    pts.push(`${cx + rr * Math.cos(rad)},${cy + rr * Math.sin(rad)}`)
  }
  return <polygon points={pts.join(" ")} />
}

export function Mascot({
  size = "md",
  mood = "happy",
}: {
  size?: MascotSize
  mood?: MascotMood
}) {
  const reduce = useReducedMotion()
  const px = MASCOT_PX[size]

  // 呼吸/まばたきの軽いループ（reduced 時は静止）
  const animate = reduce ? undefined : { y: [0, -3, 0] }
  const transition: Transition | undefined = reduce
    ? undefined
    : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }

  return (
    <motion.svg
      width={px}
      height={px}
      viewBox="0 0 120 120"
      role="img"
      aria-label={MOOD_LABEL[mood]}
      animate={animate}
      transition={transition}
    >
      {/* 接地影 */}
      <ellipse cx={60} cy={113} rx={26} ry={5} fill="rgba(30,60,90,.12)" />

      {/* おうかん（小さな王冠・ヒーローの印） */}
      <g strokeLinejoin="round">
        <path
          d="M45 33 L48 18 L54 26 L60 15 L66 26 L72 18 L75 33 Z"
          fill={C.warning}
          stroke={C.accentStrong}
          strokeWidth={2}
        />
        <circle cx={60} cy={16} r={2.6} fill={C.accent} />
      </g>

      {/* 盾（バッジ）本体 */}
      <path
        d="M32 39 Q32 33 38 33 H82 Q88 33 88 39 V66 Q88 86 60 99 Q32 86 32 66 Z"
        fill={C.primary}
        stroke={C.primaryStrong}
        strokeWidth={4}
        strokeLinejoin="round"
      />

      {/* 上部ハイライト（立体感） */}
      <path
        d="M37 41 Q37 38 40 38 H80 Q83 38 83 41 V49 Q60 55 37 49 Z"
        fill="#FFFFFF"
        opacity={0.12}
      />

      {/* 顔パネル（白） */}
      <ellipse cx={60} cy={62} rx={23} ry={20} fill="#FFFFFF" opacity={0.95} />

      {/* ほっぺ */}
      <circle cx={45} cy={67} r={5} fill={C.combo} opacity={0.45} />
      <circle cx={75} cy={67} r={5} fill={C.combo} opacity={0.45} />

      {/* 目・口（表情） */}
      <MascotEyes mood={mood} />
      <MascotMouth mood={mood} />

      {/* バッジの星（下部） */}
      <g fill={C.warning} stroke={C.accentStrong} strokeWidth={1}>
        <Star cx={60} cy={88} r={6} />
      </g>

      {/* キラキラ（cheer / wow で強調） */}
      <g fill={C.warning}>
        <Star cx={22} cy={44} r={mood === "wow" ? 5 : 3.4} />
        <Star cx={98} cy={40} r={mood === "wow" ? 5 : 3.4} />
        {(mood === "wow" || mood === "cheer") && <Star cx={101} cy={74} r={4} />}
        {(mood === "wow" || mood === "cheer") && <Star cx={19} cy={72} r={4} />}
      </g>

      {/* think のときの「？」 */}
      {mood === "think" && (
        <text
          x={97}
          y={30}
          fontSize={20}
          fontWeight={800}
          fill={C.primaryStrong}
          aria-hidden="true"
        >
          ?
        </text>
      )}
    </motion.svg>
  )
}

/* ------------------------------------------------------------------ *
 * HunterShell — モバイル枠＋グラデ背景＋任意の固定ヘッダー
 * ------------------------------------------------------------------ */

export function HunterShell({
  title,
  onBack,
  headerRight,
  progress,
  children,
}: {
  title?: string
  onBack?: () => void
  headerRight?: ReactNode
  progress?: { current: number; total: number }
  children: ReactNode
}) {
  return (
    // 外側: 画面いっぱいの背景。デスクトップ/タブレットでは中央寄せの「アプリカード」にする。
    <div className="flex min-h-[100dvh] w-full justify-center bg-[#DCEBFF] sm:items-center sm:p-4 md:p-6">
      {/* 内側フレーム: スマホ=全画面 / sm+=角丸カード。横はみ出しは overflow-hidden で根絶。 */}
      <div
        className={cn(
          "relative flex w-full max-w-md flex-col overflow-hidden",
          "h-[100dvh] sm:h-auto sm:min-h-[600px] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[32px] sm:shadow-[0_24px_60px_rgba(11,37,81,.28)] sm:ring-1 sm:ring-black/5",
          tokens.cls.pageBg,
        )}
      >
        {title && (
          <header className="bg-[#0B2551] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="もどる"
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25",
                    tokens.cls.focus,
                  )}
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
              <h1 className="min-w-0 flex-1 truncate text-[16px] font-extrabold leading-tight">
                {title}
              </h1>
              {headerRight && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {headerRight}
                </div>
              )}
            </div>

            {progress && progress.total > 0 && <RouteProgress {...progress} />}
          </header>
        )}

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}

/** 宝の地図ルート風プログレス（角丸トラック＋success 塗り＋ピン） */
function RouteProgress({ current, total }: { current: number; total: number }) {
  const safeTotal = Math.max(total, 1)
  const clamped = Math.min(Math.max(current, 0), safeTotal)
  const pct = (clamped / safeTotal) * 100

  return (
    <div className="mt-2.5">
      <div
        role="progressbar"
        aria-label="ステージの すすみぐあい"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        className="relative h-2.5 w-full rounded-full bg-white/20"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: C.success }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        {Array.from({ length: safeTotal }).map((_, i) => {
          const done = i < clamped
          return (
            <span
              key={i}
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: done ? C.success : "rgba(255,255,255,.3)",
                boxShadow: done ? `0 0 0 2px ${C.headerNavy}` : "none",
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * StatPill — HUD チップ（表示専用）
 * ------------------------------------------------------------------ */

type PillTone = "blue" | "orange" | "yellow" | "green"

const TONE_COLOR: Record<PillTone, string> = {
  blue: C.primary,
  orange: C.accent,
  yellow: C.warning,
  green: C.success,
}

export function StatPill({
  icon,
  label,
  value,
  tone = "blue",
}: {
  icon?: ReactNode
  label?: string
  value: ReactNode
  tone?: PillTone
}) {
  const accent = TONE_COLOR[tone]
  const ariaLabel = label ? `${label} ${stringifyValue(value)}` : undefined

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-[16px] bg-white px-3 py-1.5"
      style={{ boxShadow: tokens.shadow.soft }}
      aria-label={ariaLabel}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="grid h-4 w-4 place-items-center"
          style={{ color: accent }}
        >
          {icon}
        </span>
      )}
      <span className="flex flex-col leading-none">
        {label && (
          <span
            className="text-[13px] font-bold"
            style={{ color: C.inkSoft }}
            aria-hidden={ariaLabel ? "true" : undefined}
          >
            {label}
          </span>
        )}
        <span
          className="text-[24px] font-extrabold tabular-nums"
          style={{ color: C.ink }}
          aria-hidden={ariaLabel ? "true" : undefined}
        >
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </span>
      </span>
    </div>
  )
}

function stringifyValue(value: ReactNode): string {
  if (typeof value === "number" || typeof value === "string") return String(value)
  return ""
}

/** 数値のカウントアップ（reduced 時は即時表示） */
function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    fromRef.current = value
    if (reduce || from === value) {
      setDisplay(value)
      return
    }
    const duration = 500
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - t) * (1 - t)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce])

  return <>{display}</>
}

/* ------------------------------------------------------------------ *
 * PrimaryCTA — 大きく親しみやすい主ボタン
 * ------------------------------------------------------------------ */

export function PrimaryCTA({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  // className で塗りを上書きしない場合は たから色グラデを既定にする
  const hasFill = className ? /\bbg-/.test(className) : false

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      whileTap={disabled || reduce ? undefined : { scale: 0.94 }}
      transition={SPRING}
      style={{ boxShadow: disabled ? "none" : tokens.shadow.pop }}
      className={cn(
        "inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full px-10 text-[18px] font-extrabold",
        "transition-colors",
        !hasFill && tokens.cls.ctaTreasure,
        tokens.cls.focus,
        disabled
          ? "cursor-not-allowed bg-[#D7DEE6] text-[#9AA8B6] grayscale"
          : "",
        className,
      )}
    >
      {children}
    </motion.button>
  )
}

/* ------------------------------------------------------------------ *
 * Celebrate — 発見/達成時の紙吹雪・星バースト＋「+pt」演出
 * ------------------------------------------------------------------ */

interface Particle {
  id: number
  x: number
  rise: number
  drift: number
  rotate: number
  delay: number
  size: number
  color: string
  star: boolean
}

const PARTY_COLORS = [C.warning, C.accent, C.combo, "#FF9F5A", C.success]

function buildParticles(seed: number): Particle[] {
  // seed で見た目を変えつつ、SSR/CSR の不一致を避けるため決定的に生成
  const count = 15
  let s = seed * 9301 + 49297
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: count }).map((_, id) => ({
    id,
    x: 8 + rand() * 84,
    rise: 120 + rand() * 160,
    drift: (rand() - 0.5) * 120,
    rotate: (rand() - 0.5) * 360,
    delay: rand() * 0.15,
    size: 8 + rand() * 8,
    color: PARTY_COLORS[Math.floor(rand() * PARTY_COLORS.length)],
    star: rand() > 0.5,
  }))
}

export function Celebrate({
  show,
  points,
}: {
  show: boolean
  points?: number
}) {
  const reduce = useReducedMotion()
  const particles = useMemo(() => buildParticles(points ?? 1), [points])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="celebrate"
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
          initial={{ opacity: reduce ? 0 : 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* 紙吹雪/星バースト（reduced 時は出さない） */}
          {!reduce &&
            particles.map((p) => (
              <motion.div
                key={p.id}
                className="absolute top-1/2 left-0"
                style={{ left: `${p.x}%` }}
                initial={{ y: 0, x: 0, opacity: 0, rotate: 0, scale: 0.6 }}
                animate={{
                  y: -p.rise,
                  x: p.drift,
                  opacity: [0, 1, 1, 0],
                  rotate: p.rotate,
                  scale: 1,
                }}
                transition={{ duration: 0.8, delay: p.delay, ease: "easeOut" }}
              >
                {p.star ? (
                  <svg
                    width={p.size}
                    height={p.size}
                    viewBox="0 0 24 24"
                    fill={p.color}
                  >
                    <Star cx={12} cy={12} r={11} />
                  </svg>
                ) : (
                  <span
                    className="block rounded-[3px]"
                    style={{
                      width: p.size,
                      height: p.size * 0.7,
                      background: p.color,
                    }}
                  />
                )}
              </motion.div>
            ))}

          {/* 中央の「+pt」ヒーロー数値 */}
          {typeof points === "number" && (
            <motion.div
              className="absolute inset-x-0 top-[38%] flex justify-center"
              initial={{ y: reduce ? 0 : 16, opacity: 0, scale: reduce ? 1 : 0.8 }}
              animate={{ y: reduce ? 0 : -24, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={reduce ? { duration: 0.2 } : SPRING}
            >
              <span
                className="text-[40px] font-extrabold"
                style={{
                  color: C.accent,
                  textShadow: HERO_OUTLINE,
                }}
              >
                +{points}pt
              </span>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ヒーロー数値の白縁取り
const HERO_OUTLINE: CSSProperties["textShadow"] =
  "-2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff, 0 3px 6px rgba(30,60,90,.25)"
