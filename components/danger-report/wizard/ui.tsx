"use client"

/**
 * 危険報告ウィザードのUI部品(たんけんノート言語)。
 * ロジックは持たない純プレゼンテーション層。
 */

import type { CSSProperties, ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Car, Shield, CloudRainWind, HelpCircle, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/* ------------------------------------------------------------------ *
 * チャンキーボタン
 * ------------------------------------------------------------------ */

export function TankenButton({
  children,
  onClick,
  type = "button",
  variant = "green",
  disabled = false,
  className,
  testId,
}: {
  children: ReactNode
  onClick?: () => void
  type?: "button" | "submit"
  variant?: "green" | "sun" | "paper" | "accent" | "ghost"
  disabled?: boolean
  className?: string
  testId?: string
}) {
  const reduce = useReducedMotion()
  const styles: Record<string, CSSProperties> = {
    green: {
      background: C.primary,
      color: "#fff",
      borderColor: "rgba(67,57,43,.18)",
      boxShadow: tankenTokens.shadow.pressGreen,
    },
    sun: {
      background: C.sun,
      color: C.ink,
      borderColor: "rgba(67,57,43,.22)",
      boxShadow: tankenTokens.shadow.pressSun,
    },
    accent: {
      background: C.accent,
      color: "#fff",
      borderColor: "rgba(67,57,43,.18)",
      boxShadow: tankenTokens.shadow.pressAccent,
    },
    paper: {
      background: "#fff",
      color: C.ink,
      borderColor: "rgba(67,57,43,.14)",
      boxShadow: tankenTokens.shadow.pressPaper,
    },
    ghost: {
      background: "transparent",
      color: C.inkSoft,
      borderColor: "transparent",
      boxShadow: "none",
    },
  }
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      whileTap={reduce || disabled ? undefined : { scale: 0.97, y: 3 }}
      transition={tankenTokens.spring}
      className={cn(
        "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 px-5 text-[15px] font-black transition-opacity",
        disabled && "cursor-not-allowed opacity-45",
        tankenTokens.cls.focus,
        className,
      )}
      style={styles[variant]}
    >
      {children}
    </motion.button>
  )
}

/* ------------------------------------------------------------------ *
 * 紙のカード
 * ------------------------------------------------------------------ */

export function PaperCard({
  children,
  className,
  tone = "card",
  style,
}: {
  children: ReactNode
  className?: string
  tone?: "card" | "sun" | "green" | "accent" | "danger"
  style?: CSSProperties
}) {
  const bg =
    tone === "sun"
      ? C.sunSoft
      : tone === "green"
        ? C.primarySoft
        : tone === "accent"
          ? C.accentSoft
          : tone === "danger"
            ? C.dangerSoft
            : C.card
  return (
    <div
      className={cn("rounded-[18px] border", className)}
      style={{
        background: bg,
        borderColor: tankenTokens.border.faint,
        boxShadow: tankenTokens.shadow.soft,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ステップ進捗(点線トレイル + 足あと)
 * ------------------------------------------------------------------ */

export function WizardTrail({
  steps,
  current,
}: {
  steps: readonly string[]
  current: number
}) {
  const reduce = useReducedMotion()
  return (
    <div className="flex items-center justify-center gap-0" role="list" aria-label="報告のステップ">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} role="listitem" aria-current={active ? "step" : undefined} className="flex items-center">
            {i > 0 && (
              <div
                aria-hidden="true"
                className="mx-1 h-[2px] w-6"
                style={{
                  backgroundImage: `repeating-linear-gradient(90deg, ${done ? C.primary : "rgba(67,57,43,.22)"} 0 4px, transparent 4px 9px)`,
                }}
              />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <motion.span
                initial={false}
                animate={active && !reduce ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 0.35 }}
                className="grid h-7 w-7 place-items-center rounded-full border-2 text-[12px] font-black"
                style={{
                  background: done ? C.primary : active ? C.sun : "#fff",
                  borderColor: done ? C.primaryStrong : active ? C.sunDeep : "rgba(67,57,43,.18)",
                  color: done ? "#fff" : C.ink,
                }}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3.4} /> : i + 1}
              </motion.span>
              <span
                className="text-[10px] font-black leading-none"
                style={{ color: active ? C.ink : C.inkFaint }}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ステップ切り替え(方向つきスライド)
 * ------------------------------------------------------------------ */

export function StepSlider({
  stepKey,
  direction,
  children,
}: {
  stepKey: string | number
  direction: 1 | -1
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const variants = reduce
    ? {
        enter: () => ({ opacity: 0 }),
        center: { opacity: 1 },
        exit: () => ({ opacity: 0 }),
      }
    : {
        enter: (d: 1 | -1) => ({ opacity: 0, x: 56 * d }),
        center: { opacity: 1, x: 0 },
        exit: (d: 1 | -1) => ({ opacity: 0, x: -44 * d }),
      }
  return (
    <AnimatePresence mode="popLayout" custom={direction} initial={false}>
      <motion.div
        key={stepKey}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={reduce ? { duration: 0.16 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ *
 * きけんの しゅるい カード
 * ------------------------------------------------------------------ */

export const DANGER_TYPES = [
  {
    id: "traffic",
    label: "こうつう",
    sub: "くるま・じてんしゃ",
    icon: Car,
    color: "#3E8FB8",
    soft: "#E3F1F8",
  },
  {
    id: "crime",
    label: "ふしんしゃ",
    sub: "こわい ひと・ばしょ",
    icon: Shield,
    color: "#D95555",
    soft: "#FBE9E9",
  },
  {
    id: "disaster",
    label: "さいがい",
    sub: "みず・じしん・くずれ",
    icon: CloudRainWind,
    color: "#F4801F",
    soft: "#FDEBD7",
  },
  {
    id: "other",
    label: "そのほか",
    sub: "きになる こと",
    icon: HelpCircle,
    color: "#847661",
    soft: "#F3EAD6",
  },
] as const

export function DangerTypePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const reduce = useReducedMotion()
  return (
    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="きけんの しゅるい">
      {DANGER_TYPES.map((t) => {
        const Icon = t.icon
        const active = value === t.id
        return (
          <motion.button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`danger-type-${t.id}`}
            onClick={() => onChange(t.id)}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            transition={tankenTokens.spring}
            className={cn(
              "relative flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-[18px] border-2 px-2 py-3",
              tankenTokens.cls.focus,
            )}
            style={{
              background: active ? t.soft : "#fff",
              borderColor: active ? t.color : "rgba(67,57,43,.12)",
              boxShadow: active ? `0 3px 0 ${t.color}` : tankenTokens.shadow.pressPaper,
            }}
          >
            {active && (
              <motion.span
                initial={reduce ? false : { scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={tankenTokens.spring}
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2"
                style={{ background: t.color, borderColor: "#fff" }}
              >
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.6} />
              </motion.span>
            )}
            <Icon className="h-6 w-6" style={{ color: t.color }} strokeWidth={2.4} />
            <span className="text-[14px] font-black leading-none" style={{ color: C.ink }}>
              {t.label}
            </span>
            <span className="text-[10.5px] font-bold leading-none" style={{ color: C.inkSoft }}>
              {t.sub}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * あぶなさ レベル (1-5)
 * ------------------------------------------------------------------ */

const LEVELS = [
  { v: 1, label: "きをつけて", color: "#159E72" },
  { v: 2, label: "ちゅうい", color: "#84B816" },
  { v: 3, label: "あぶない", color: "#FFC93E" },
  { v: 4, label: "かなり", color: "#F4801F" },
  { v: 5, label: "とても", color: "#D95555" },
] as const

export function DangerLevelPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const reduce = useReducedMotion()
  const current = LEVELS.find((l) => l.v === value) ?? LEVELS[2]
  return (
    <div>
      <div className="flex items-end gap-1.5" role="radiogroup" aria-label="あぶなさ">
        {LEVELS.map((l) => {
          const active = l.v === value
          const filled = l.v <= value
          return (
            <motion.button
              key={l.v}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`レベル${l.v} ${l.label}`}
              data-testid={`danger-level-${l.v}`}
              onClick={() => onChange(l.v)}
              whileTap={reduce ? undefined : { scale: 0.94 }}
              transition={tankenTokens.spring}
              className={cn(
                "flex flex-1 items-end justify-center rounded-[12px] border-2 pb-1 text-[11px] font-black",
                tankenTokens.cls.focus,
              )}
              style={{
                height: 30 + l.v * 7,
                background: filled ? l.color : "#F6EFDF",
                borderColor: filled ? "rgba(67,57,43,.2)" : "rgba(67,57,43,.14)",
                boxShadow: active ? `0 3px 0 rgba(67,57,43,.3)` : "none",
                color: filled ? (l.v === 3 ? "rgba(67,57,43,.75)" : "rgba(255,255,255,.9)") : "#B7AB93",
              }}
            >
              {l.v}
            </motion.button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] font-bold" style={{ color: C.inkFaint }}>
          レベル {value} / 5
        </span>
        <motion.span
          key={value}
          initial={reduce ? false : { y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={tankenTokens.spring}
          className="rounded-full border-2 px-3 py-1 text-[13px] font-black"
          style={{
            background: current.color,
            borderColor: "rgba(67,57,43,.2)",
            color: current.v === 3 ? C.ink : "#fff",
          }}
        >
          {current.label}
        </motion.span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 見出し(手描きアンダーライン)
 * ------------------------------------------------------------------ */

export function StepHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="inline-block text-[18px] font-black leading-snug" style={{ color: C.ink }}>
        {children}
      </h3>
      <svg aria-hidden="true" viewBox="0 0 120 6" className="mt-0.5 block h-[5px] w-24" preserveAspectRatio="none">
        <path d="M2 4 Q30 1 60 3.2 T118 2.6" fill="none" stroke={C.sun} strokeWidth={3.4} strokeLinecap="round" />
      </svg>
      {hint ? (
        <p className="mt-1 text-[12.5px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
