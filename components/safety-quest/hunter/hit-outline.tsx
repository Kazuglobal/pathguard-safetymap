"use client"

// =============================================
// きけんハンター たんけん: 当たった危険を写真の上で見せる
// 当たった直後〜理由を答えるまで、その危険の範囲(表示枠)をふちどり、
// focus(いちばん見るべき 1 点)を脈打たせる。写真そのものは動かさない(タップの邪魔をしない)。
// =============================================

import { motion, useReducedMotion } from "framer-motion"

import { anchorOf } from "@/lib/hunter/hit-zone"
import { regionToContainerPct, toContainerPct, type ContainRect, type Size } from "@/lib/hunter/image-geometry"
import type { HunterHazard } from "@/lib/hunter/types"

import { tokens } from "./theme"

const C = tokens.color

export function HitOutline({
  hazard,
  contain,
  box,
  tone = "accent",
}: {
  hazard: HunterHazard | null
  contain: ContainRect | null
  box: Size | null
  /** accent=答え待ち / green=わかった */
  tone?: "accent" | "green"
}) {
  const reduce = useReducedMotion()
  if (!hazard || !contain || !box) return null
  const color = tone === "green" ? C.primary : C.accent
  const anchor = toContainerPct(anchorOf(hazard), contain, box)

  return (
    <>
      <motion.div
        key={`outline-${hazard.id}-${tone}`}
        aria-hidden="true"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 320, damping: 24 }}
        style={{
          position: "absolute",
          ...regionToContainerPct(hazard.region, contain, box),
          border: `3px solid ${color}`,
          borderRadius: 14,
          boxShadow: `0 0 0 2px #fff, 0 0 18px ${color}66`,
          background: `${color}14`,
          zIndex: 3,
          pointerEvents: "none",
        }}
      />
      <motion.span
        aria-hidden="true"
        animate={reduce ? { opacity: 1 } : { scale: [1, 1.5, 1], opacity: [1, 0.55, 1] }}
        transition={reduce ? { duration: 0 } : { duration: 1.3, repeat: Infinity }}
        style={{
          position: "absolute",
          left: `${anchor.leftPct}%`,
          top: `${anchor.topPct}%`,
          width: 18,
          height: 18,
          marginLeft: -9,
          marginTop: -9,
          borderRadius: "50%",
          background: color,
          border: "3px solid #fff",
          boxShadow: tokens.shadow.soft,
          zIndex: 4,
          pointerEvents: "none",
        }}
      />
    </>
  )
}
