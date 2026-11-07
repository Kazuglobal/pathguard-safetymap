"use client"

// =============================================
// きけんハンター たんけん: タップした場所に出る ひとこと
// 実際にタップした場所にアンカーし、写真のふちで見切れないようクランプする。
// 否定しない・断定しない(はずれでも「つぎは どこかな？」)。
// =============================================

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"

import type { HunterDirection, HunterTemperature } from "@/lib/hunter/types"

import { tokens } from "./theme"

const C = tokens.color

export type FeedbackKind = "hit" | "near" | "miss" | "again"

export interface TapFeedback {
  readonly key: number
  readonly kind: FeedbackKind
  /** 枠に対する % 位置(クランプ済み)。 */
  readonly left: string
  readonly top: string
  readonly temperature?: HunterTemperature
  readonly direction?: HunterDirection | null
}

/** 結果ごとの前向きメッセージ。 */
export const FEEDBACK_MESSAGES: Record<FeedbackKind, string> = {
  hit: "よく きづいたね！",
  near: "おしい！もう ちょっと！",
  miss: "つぎは どこかな？",
  again: "そこは もう みつけたよ！",
}

const CHIP: Record<FeedbackKind, { bg: string; fg: string }> = {
  hit: { bg: C.primary, fg: "#FFFFFF" },
  near: { bg: C.sun, fg: C.ink },
  miss: { bg: "#FFFFFF", fg: C.ink },
  again: { bg: C.primarySoft, fg: C.primaryStrong },
}

export const TEMPERATURE_LABEL: Record<HunterTemperature, string> = {
  hot: "あったかい！",
  warm: "ちょっと あったかい",
  cold: "つめたい…",
}

const DIRECTION_ICON: Record<HunterDirection, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
}

export function ExploreTapFeedback({
  feedback,
  showHint,
  allFound,
}: {
  feedback: TapFeedback | null
  /** 温度+方向のヒント(Lv1 以上)を出すか。 */
  showHint: boolean
  allFound: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {feedback ? (
        // 位置合わせは外側の div、動きは内側の motion.div(framer の y/scale が中央寄せを上書きしないように)
        <div
          key={feedback.key}
          style={{
            position: "absolute",
            left: feedback.left,
            top: feedback.top,
            transform: "translate(-50%, -50%)",
            zIndex: 5,
            pointerEvents: "none",
            maxWidth: "86%",
          }}
        >
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.8 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: -12, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -30, scale: 0.9 }}
          transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 340, damping: 20 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
        >
          {showHint && (feedback.kind === "near" || feedback.kind === "miss") && feedback.temperature ? (
            <HintChip temperature={feedback.temperature} direction={feedback.direction ?? null} />
          ) : null}
          <span
            style={{
              padding: "7px 14px",
              borderRadius: 9999,
              background: CHIP[feedback.kind].bg,
              color: CHIP[feedback.kind].fg,
              fontWeight: 900,
              fontSize: 14.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
              boxShadow: `0 0 0 2.5px #fff, ${tokens.shadow.card}`,
            }}
          >
            {/* 全部見つけたあとの余分なタップに「つぎは？」と言わない */}
            {allFound && feedback.kind !== "hit" ? "もう ぜんぶ みつけたよ！" : FEEDBACK_MESSAGES[feedback.kind]}
          </span>
        </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

function HintChip({ temperature, direction }: { temperature: HunterTemperature; direction: HunterDirection | null }) {
  const Icon = direction ? DIRECTION_ICON[direction] : null
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 11px",
        borderRadius: 9999,
        background: "rgba(38,65,59,.82)",
        color: "#fff",
        fontWeight: 800,
        fontSize: 12.5,
        whiteSpace: "nowrap",
      }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {TEMPERATURE_LABEL[temperature]}
    </span>
  )
}
