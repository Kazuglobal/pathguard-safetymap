"use client"

/**
 * きけんハンター デザインファウンデーション「たんけんノート」
 *
 * 世界観: 紙のフィールドノート × スタンプラリー。
 *  - クリーム紙の面に、森のみどり(primary)・安全オレンジ(accent)・帽子の黄(sun)。
 *  - マスコットは虫めがねの相棒「ルペ」。見つける=このアプリの動詞そのもの。
 *  - ボタンは押し込める「チャンキー」物理感。グラデ乱用はしない。
 *  - モーションは短く・方向性があり・reduced-motion を必ず尊重。
 *
 * ここから tokens / Mascot / HunterShell / StatPill / PrimaryCTA / Celebrate /
 * Sticker / PaperPanel / SpeechBubble / BottomBar / screenMotion を import する。
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { CSSProperties, ReactNode } from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion"
import { ArrowLeft, Flag } from "lucide-react"

import { cn } from "@/lib/utils"
import { Lupe, type LupeMood } from "@/components/brand/lupe"

/* ------------------------------------------------------------------ *
 * tokens
 * ------------------------------------------------------------------ */

export const tokens = {
  color: {
    /** 紙面 */
    paper: "#FBF5E9",
    paperDeep: "#F3EAD6",
    card: "#FFFDF7",
    /** インク(文字) */
    ink: "#43392B",
    inkSoft: "#746855",
    inkFaint: "#B7AB93",
    /** 森のみどり(主行動・発見) */
    primary: "#159E72",
    primaryStrong: "#0C7A55",
    primarySoft: "#DFF3E9",
    /** 安全オレンジ(注意・励まし) */
    accent: "#F4801F",
    accentStrong: "#D8660A",
    accentSoft: "#FDEBD7",
    /** 帽子の黄(スタート・ごほうび) */
    sun: "#FFC93E",
    sunDeep: "#E2A812",
    sunSoft: "#FFF3CE",
    /** 写真フレーム・夜インク */
    night: "#26413B",
    /** ベリー(コンボ・ほっぺ) */
    berry: "#F2699C",
    danger: "#D95555",
    dangerSoft: "#FBE9E9",
    /** success は primary の別名(発見・完了) */
    success: "#159E72",
  },
  font: {
    family:
      'var(--font-hunter, "Zen Maru Gothic"), "Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", system-ui, sans-serif',
  },
  radius: { card: 22, panel: 18, chip: 12, button: 9999, photo: 18 },
  shadow: {
    /** カードの浮き(紙の上の紙) */
    card: "0 1.5px 0 rgba(67,57,43,.07), 0 14px 30px -18px rgba(67,57,43,.38)",
    soft: "0 1px 0 rgba(67,57,43,.06), 0 6px 16px -10px rgba(67,57,43,.28)",
    /** チャンキーボタンの土台 */
    pressSun: "0 4px 0 #E2A812",
    pressGreen: "0 4px 0 #0C7A55",
    pressPaper: "0 3px 0 rgba(67,57,43,.16)",
  },
  cls: {
    // ring 色は slash 記法(/40)だと生成されないことがあるため rgba 直書きで確実に
    focus:
      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(21,158,114,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF5E9]",
  },
  spring: { type: "spring", stiffness: 420, damping: 32 } as Transition,
} as const

const C = tokens.color

/* ------------------------------------------------------------------ *
 * 画面遷移モーション(方向つき)
 *  forward: 右から入る / back: 左から入る。出る側は浅く動かしてパララックス感。
 * ------------------------------------------------------------------ */

export type NavDirection = 1 | -1

export const SCREEN_EASE: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] }

export function screenVariants(reduce: boolean) {
  if (reduce) {
    return {
      enter: () => ({ opacity: 0 }),
      center: { opacity: 1 },
      exit: () => ({ opacity: 0 }),
    }
  }
  return {
    enter: (dir: NavDirection) => ({ opacity: 0, x: 40 * dir, scale: 0.99 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: NavDirection) => ({ opacity: 0, x: -28 * dir, scale: 0.995 }),
  }
}

/** コンテンツの順次せり上がり。 */
export function riseIn(reduce: boolean | null, delay = 0) {
  if (reduce) return {}
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { ...SCREEN_EASE, delay },
  }
}

/* ------------------------------------------------------------------ *
 * 紙テクスチャ & ノート柄 (data-uri / 追加アセット不要)
 * ------------------------------------------------------------------ */

/** ざらっとした紙の粒子(ごく薄く重ねる)。 */
const PAPER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E\")"

/** 探検ノートの見返し柄: 点線ルート・ピン・星をまばらに。 */
const ENDPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='340' height='340' viewBox='0 0 340 340'%3E%3Cg fill='none' stroke='%2343392B' stroke-opacity='.055' stroke-width='3' stroke-linecap='round'%3E%3Cpath stroke-dasharray='1 14' d='M20 60 Q120 20 170 90 T320 120'/%3E%3Cpath stroke-dasharray='1 14' d='M40 300 Q140 240 220 280 T330 230'/%3E%3C/g%3E%3Cg fill='%2343392B' fill-opacity='.06'%3E%3Cpath d='M84 148c0-9 7-16 16-16s16 7 16 16c0 12-16 26-16 26s-16-14-16-26zm16 5a5 5 0 100-10 5 5 0 000 10z'/%3E%3Ccircle cx='262' cy='58' r='9' fill='none' stroke='%2343392B' stroke-opacity='.07' stroke-width='4'/%3E%3Cpath d='M268 65l10 10' stroke='%2343392B' stroke-opacity='.07' stroke-width='4' stroke-linecap='round'/%3E%3Cpath d='M50 215l3.5 7 7.7 1-5.6 5.4 1.4 7.6-7-3.6-7 3.6 1.4-7.6-5.6-5.4 7.7-1z'/%3E%3Cpath d='M300 320l2.6 5.2 5.8.8-4.2 4 1 5.7-5.2-2.7-5.2 2.7 1-5.7-4.2-4 5.8-.8z'/%3E%3C/g%3E%3C/svg%3E\")"

/* ------------------------------------------------------------------ *
 * Mascot — ルペ。本体は components/brand/lupe.tsx(紹介HP・ログインの画面と同じもの)
 * ------------------------------------------------------------------ */

export const Mascot = Lupe
type MascotMood = LupeMood

/* ------------------------------------------------------------------ *
 * HunterShell — 紙のノート面 + ヘッダー + トレイル進捗
 * ------------------------------------------------------------------ */

/** 進捗(みつけた数など)をトレイル(点線みち)で見せる。 */
function TrailProgress({ current, total }: { current: number; total: number }) {
  const safeTotal = Math.max(total, 1)
  const clamped = Math.min(Math.max(current, 0), safeTotal)
  const pct = (clamped / safeTotal) * 100
  const reduce = useReducedMotion()

  return (
    <div className="mt-2 flex items-center gap-2" aria-hidden="false">
      <div
        role="progressbar"
        aria-label="みつけた かず"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        className="relative h-3 flex-1 overflow-visible rounded-full"
        style={{ background: "rgba(67,57,43,.10)" }}
      >
        {/* 点線みち */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-2 right-2"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(67,57,43,.28) 0 4px, transparent 4px 12px)",
            backgroundSize: "12px 2px",
            backgroundPosition: "0 center",
            backgroundRepeat: "repeat-x",
            height: 2,
            top: "50%",
            transform: "translateY(-1px)",
          }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: C.primary }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : tokens.spring}
        />
      </div>
      <Flag className="h-4 w-4 shrink-0" style={{ color: pct >= 100 ? C.accent : C.inkSoft }} aria-hidden="true" />
    </div>
  )
}

interface ShellCtx {
  onExit?: () => void
}
const ShellContext = createContext<ShellCtx>({})
export const useShell = () => useContext(ShellContext)

export function HunterShell({
  title,
  onBack,
  onExit,
  headerRight,
  progress,
  children,
}: {
  title?: string
  onBack?: () => void
  /** アプリのホーム(landing)へ戻る動線 */
  onExit?: () => void
  headerRight?: ReactNode
  progress?: { current: number; total: number }
  children: ReactNode
}) {
  const ctx = useMemo(() => ({ onExit }), [onExit])
  return (
    <ShellContext.Provider value={ctx}>
      <div
        data-hunter-root=""
        className="flex min-h-[100dvh] w-full justify-center sm:items-center sm:p-4 md:p-8"
        style={{
          fontFamily: tokens.font.family,
          background: `${ENDPAPER}, linear-gradient(175deg, ${C.paperDeep} 0%, #EBDFC6 100%)`,
        }}
      >
        {/* globals.css の `*:focus`(青アウトライン)を世界観に合わせて上書き。
            マウス操作では消し、キーボード操作(:focus-visible)ではみどりのリングを保証する。 */}
        <style>{`
          [data-hunter-root] *:focus { outline: none; }
          [data-hunter-root] *:focus-visible {
            outline: 3px solid rgba(21, 158, 114, 0.55);
            outline-offset: 2px;
          }
        `}</style>
        {/* ノート本体 */}
        <div
          className={cn(
            "relative flex w-full max-w-md flex-col overflow-hidden md:max-w-lg",
            "h-[100dvh] sm:h-[min(920px,calc(100dvh-2rem))] md:h-[min(920px,calc(100dvh-4rem))]",
            "sm:rounded-[30px] sm:border sm:border-[#43392B]/10",
            "sm:shadow-[0_2px_0_rgba(67,57,43,.08),0_40px_80px_-40px_rgba(67,57,43,.5)]",
          )}
          style={{ background: `${PAPER_NOISE}, linear-gradient(180deg, ${C.paper} 0%, #F7EFDD 100%)` }}
        >
          {title ? (
            <header className="relative z-20 shrink-0 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),14px)]">
              <div className="flex min-h-[44px] items-center gap-3">
                {onBack ? (
                  <motion.button
                    type="button"
                    onClick={onBack}
                    aria-label="もどる"
                    whileTap={{ scale: 0.92 }}
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 bg-white",
                      "active:translate-y-[2px] transition-transform",
                      tokens.cls.focus,
                    )}
                    style={{ borderColor: "rgba(67,57,43,.14)", color: C.ink, boxShadow: tokens.shadow.pressPaper }}
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" strokeWidth={2.6} />
                  </motion.button>
                ) : (
                  <span className="h-11 w-11 shrink-0" aria-hidden="true" />
                )}

                {/* タイトル(画面切替でやわらかくクロスフェード) */}
                <div className="relative min-w-0 flex-1">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.h1
                      key={title}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="truncate text-center text-[17px] font-black leading-tight"
                      style={{ color: C.ink }}
                    >
                      {title}
                    </motion.h1>
                  </AnimatePresence>
                  {/* 手描き風アンダーライン */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 120 6"
                    className="mx-auto mt-1 block h-[5px] w-24"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 4 Q30 1 60 3.2 T118 2.6"
                      fill="none"
                      stroke={C.sun}
                      strokeWidth={3.4}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-end">
                  {headerRight}
                </div>
              </div>

              {progress && progress.total > 0 && <TrailProgress {...progress} />}
            </header>
          ) : null}

          {/* 分かち書き前提の改行制御: 単語(スペース区切り)の途中では折り返さない */}
          <main
            className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain [&_rt]:font-bold"
            style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
          >
            {children}
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  )
}

/* ------------------------------------------------------------------ *
 * PaperPanel — 紙の上のカード
 * ------------------------------------------------------------------ */

export function PaperPanel({
  children,
  className,
  tone = "card",
  style,
}: {
  children: ReactNode
  className?: string
  tone?: "card" | "sun" | "green" | "accent"
  style?: CSSProperties
}) {
  const bg =
    tone === "sun" ? C.sunSoft : tone === "green" ? C.primarySoft : tone === "accent" ? C.accentSoft : C.card
  return (
    <div
      className={cn("rounded-[22px] border", className)}
      style={{
        background: bg,
        borderColor: "rgba(67,57,43,.09)",
        boxShadow: tokens.shadow.soft,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Sticker — シール風チップ(ちょっと傾く)
 * ------------------------------------------------------------------ */

export function Sticker({
  children,
  tone = "sun",
  tilt = -2,
  className,
}: {
  children: ReactNode
  tone?: "sun" | "green" | "accent" | "berry" | "paper"
  tilt?: number
  className?: string
}) {
  const palette: Record<string, { bg: string; fg: string }> = {
    sun: { bg: C.sun, fg: C.ink },
    green: { bg: C.primary, fg: "#fff" },
    accent: { bg: C.accent, fg: "#fff" },
    berry: { bg: C.berry, fg: "#fff" },
    paper: { bg: "#fff", fg: C.ink },
  }
  const p = palette[tone]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-black leading-none",
        className,
      )}
      style={{
        background: p.bg,
        color: p.fg,
        transform: `rotate(${tilt}deg)`,
        boxShadow: `0 0 0 2.5px #fff, ${tokens.shadow.soft}`,
      }}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * StatPill — HUD チップ(シール調・表示専用)
 * ------------------------------------------------------------------ */

type PillTone = "green" | "orange" | "sun" | "berry"

const PILL_ACCENT: Record<PillTone, string> = {
  green: C.primary,
  orange: C.accent,
  sun: C.sunDeep,
  berry: C.berry,
}

export function StatPill({
  icon,
  label,
  value,
  tone = "green",
}: {
  icon?: ReactNode
  label?: string
  value: ReactNode
  tone?: PillTone
}) {
  const accent = PILL_ACCENT[tone]
  const ariaLabel = label ? `${label} ${stringifyValue(value)}` : undefined

  return (
    <div
      className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-1.5"
      style={{
        borderColor: "rgba(67,57,43,.10)",
        boxShadow: `0 0 0 2px #fff, ${tokens.shadow.soft}`,
      }}
      aria-label={ariaLabel}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
          style={{ color: "#fff", background: accent }}
        >
          {icon}
        </span>
      )}
      <span className="flex flex-col leading-none" aria-hidden={ariaLabel ? "true" : undefined}>
        {label && (
          <span className="text-[12px] font-bold" style={{ color: C.inkSoft }}>
            {label}
          </span>
        )}
        <span className="mt-0.5 text-[17px] font-black tabular-nums" style={{ color: C.ink }}>
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

/** 数値のカウントアップ(reduced 時は即時)。 */
export function CountUp({ value }: { value: number }) {
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
    const duration = 460
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
 * PrimaryCTA — チャンキー(押し込める)主ボタン
 * ------------------------------------------------------------------ */

type CTAVariant = "sun" | "green" | "paper"

const CTA_STYLE: Record<CTAVariant, { bg: string; fg: string; press: string; border?: string }> = {
  sun: { bg: C.sun, fg: C.ink, press: tokens.shadow.pressSun },
  green: { bg: C.primary, fg: "#FFFFFF", press: tokens.shadow.pressGreen },
  paper: { bg: "#FFFFFF", fg: C.ink, press: tokens.shadow.pressPaper, border: "rgba(67,57,43,.16)" },
}

export function PrimaryCTA({
  onClick,
  disabled,
  children,
  variant = "sun",
  className,
  size = "lg",
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  variant?: CTAVariant
  className?: string
  size?: "lg" | "md"
}) {
  const v = CTA_STYLE[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={cn(
        // touch-manipulation: iOS Safari のダブルタップ拡大を抑止(子どもの連打対策)
        "inline-flex w-full touch-manipulation items-center justify-center gap-2 rounded-full font-black",
        size === "lg" ? "min-h-[58px] px-8 text-[17px]" : "min-h-[48px] px-6 text-[15px]",
        "transition-[transform,box-shadow,background-color] duration-100",
        !disabled && "active:translate-y-[4px] active:!shadow-none",
        disabled && "cursor-not-allowed",
        tokens.cls.focus,
        className,
      )}
      style={{
        background: disabled ? "#EDE5D3" : v.bg,
        // 無効時も「ボタンがある」ことは判別できるコントラストを保つ
        color: disabled ? "#8F8672" : v.fg,
        boxShadow: disabled ? "none" : v.press,
        border: disabled
          ? "2px solid rgba(67,57,43,.14)"
          : v.border
            ? `2px solid ${v.border}`
            : "2px solid transparent",
      }}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * BottomBar — 画面下の固定アクション面(セーフエリア対応)
 * ------------------------------------------------------------------ */

export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("sticky bottom-0 z-20 mt-auto shrink-0 px-4 pt-3", className)}
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 14px)",
        background: "linear-gradient(180deg, rgba(251,245,233,0) 0%, #FBF5E9 32%)",
      }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SpeechBubble — ルペのひとこと
 * ------------------------------------------------------------------ */

export function SpeechBubble({
  mood = "happy",
  children,
  className,
}: {
  mood?: MascotMood
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-end gap-2.5", className)}>
      <span className="shrink-0 -mb-1">
        <Mascot size="sm" mood={mood} />
      </span>
      <div
        className="relative flex-1 rounded-[18px] rounded-bl-[6px] border bg-white px-4 py-3"
        style={{ borderColor: "rgba(67,57,43,.10)", boxShadow: tokens.shadow.soft }}
      >
        <p
          className="text-[14px] font-bold leading-relaxed"
          style={{ color: C.ink, wordBreak: "keep-all", overflowWrap: "anywhere" }}
        >
          {children}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * StampSeal — 「はっけん!」スタンプ(発見マーカー・ごほうび)
 * ------------------------------------------------------------------ */

export function StampSeal({
  size = 52,
  label = "はっけん",
  tone = "green",
}: {
  size?: number
  label?: string
  tone?: "green" | "accent" | "sun"
}) {
  const color = tone === "green" ? C.primary : tone === "accent" ? C.accent : C.sunDeep
  // ギザギザ円(スタンプの縁)
  const teeth = 24
  const pts: string[] = []
  for (let i = 0; i < teeth * 2; i += 1) {
    const a = (Math.PI / teeth) * i
    const r = i % 2 === 0 ? 30 : 27.4
    pts.push(`${32 + r * Math.cos(a)},${32 + r * Math.sin(a)}`)
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <polygon points={pts.join(" ")} fill="#fff" />
      <polygon
        points={pts.join(" ")}
        fill={color}
        opacity={0.92}
        transform="scale(.94)"
        style={{ transformOrigin: "32px 32px" }}
      />
      <circle cx={32} cy={32} r={22} fill="none" stroke="#fff" strokeWidth={2.4} strokeDasharray="3 4" />
      <text
        x={32}
        y={32}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={label.length >= 4 ? 9.5 : label.length >= 3 ? 11.5 : 15}
        fontWeight={900}
        fill="#fff"
        style={{ fontFamily: tokens.font.family }}
      >
        {label}
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * Celebrate — Canvas 紙吹雪(紙片・星・まる) + 「+pt」
 * ------------------------------------------------------------------ */

interface ConfettiPiece {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  size: number
  color: string
  shape: 0 | 1 | 2 // 0=紙片 1=星 2=まる
  born: number
}

const PARTY = [C.sun, C.accent, C.primary, C.berry, "#7EC8E3"]

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.46
    ctx.lineTo(rr * Math.cos(a), rr * Math.sin(a))
  }
  ctx.closePath()
  ctx.fill()
}

export function Celebrate({
  show,
  points,
}: {
  show: boolean
  points?: number
}) {
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!show || reduce) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const now = performance.now()
    // 中央やや下から扇状に打ち上げ
    const pieces: ConfettiPiece[] = Array.from({ length: 30 }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5
      const speed = 340 + Math.random() * 420
      return {
        x: w / 2 + (Math.random() - 0.5) * 90,
        y: h * 0.62,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 14,
        size: 7 + Math.random() * 8,
        color: PARTY[i % PARTY.length],
        shape: (i % 3) as 0 | 1 | 2,
        born: now,
      }
    })

    let raf = 0
    let last = now
    const LIFE = 1050

    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.032)
      last = t
      ctx.clearRect(0, 0, w, h)
      let alive = false
      for (const p of pieces) {
        const age = t - p.born
        if (age > LIFE) continue
        alive = true
        p.vy += 1350 * dt
        p.vx *= 0.985
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.vrot * dt
        const fade = age > LIFE - 260 ? 1 - (age - (LIFE - 260)) / 260 : 1
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = fade
        ctx.fillStyle = p.color
        if (p.shape === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66)
        } else if (p.shape === 1) {
          drawStar(ctx, p.size * 0.62)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
      if (alive) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, w, h)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ctx.clearRect(0, 0, w, h)
    }
  }, [show, reduce])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="celebrate"
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {!reduce && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}

          {typeof points === "number" && (
            <motion.div
              className="absolute inset-x-0 top-[36%] flex justify-center"
              initial={{ y: reduce ? 0 : 18, opacity: 0, scale: reduce ? 1 : 0.7 }}
              animate={{ y: reduce ? 0 : -26, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={reduce ? { duration: 0.2 } : tokens.spring}
            >
              <span
                className="text-[42px] font-black"
                style={{ color: C.accent, textShadow: HERO_OUTLINE, fontFamily: tokens.font.family }}
              >
                +{points}
                <span className="text-[24px]">pt</span>
              </span>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const HERO_OUTLINE: CSSProperties["textShadow"] =
  "-2.5px -2.5px 0 #fff, 2.5px -2.5px 0 #fff, -2.5px 2.5px 0 #fff, 2.5px 2.5px 0 #fff, 0 4px 10px rgba(67,57,43,.3)"

/* ------------------------------------------------------------------ *
 * PhotoFrame — ノートに貼った写真(ポラロイド + テープ)
 * ------------------------------------------------------------------ */

export function PhotoFrame({
  children,
  className,
  tape = true,
  tilt = 0,
}: {
  children: ReactNode
  className?: string
  tape?: boolean
  tilt?: number
}) {
  return (
    <div
      className={cn("relative rounded-[18px] bg-white p-2 pb-3", className)}
      style={{
        boxShadow: tokens.shadow.card,
        border: "1px solid rgba(67,57,43,.08)",
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
      }}
    >
      {tape && (
        <>
          <span
            aria-hidden="true"
            className="absolute -top-2.5 left-6 z-10 h-5 w-14 -rotate-6 rounded-[3px]"
            style={{ background: "rgba(255,201,62,.75)", boxShadow: "0 1px 3px rgba(67,57,43,.18)" }}
          />
          <span
            aria-hidden="true"
            className="absolute -top-2.5 right-6 z-10 h-5 w-14 rotate-6 rounded-[3px]"
            style={{ background: "rgba(126,200,227,.7)", boxShadow: "0 1px 3px rgba(67,57,43,.18)" }}
          />
        </>
      )}
      <div className="overflow-hidden rounded-[12px]" style={{ background: C.night }}>
        {children}
      </div>
    </div>
  )
}
