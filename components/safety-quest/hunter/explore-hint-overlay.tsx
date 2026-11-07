"use client"

// =============================================
// きけんハンター たんけん: 段階ヒントの重ね表示
//  Lv2 = いちばん近い危険の focus がそっと光る
//  Lv3 = 当たり枠(本当にタップすべき範囲)を点線で開示。自動発見はしない(最後は子がタップ)。
// =============================================

import { motion, useReducedMotion } from "framer-motion"

import { anchorOf, hitZoneOf } from "@/lib/hunter/hit-zone"
import { regionToContainerPct, toContainerPct, type ContainRect, type Size } from "@/lib/hunter/image-geometry"
import type { HunterHazard, HunterHintLevel } from "@/lib/hunter/types"

import { tokens } from "./theme"

const C = tokens.color

export function ExploreHintOverlay({
  level,
  target,
  contain,
  box,
}: {
  level: HunterHintLevel
  target: HunterHazard | null
  contain: ContainRect | null
  box: Size | null
}) {
  const reduce = useReducedMotion()
  if (!target || !contain || !box || level < 2) return null

  if (level >= 3) {
    return (
      <motion.div
        aria-hidden="true"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          position: "absolute",
          ...regionToContainerPct(hitZoneOf(target), contain, box),
          border: `3px dashed ${C.sun}`,
          borderRadius: 14,
          background: "rgba(255,201,62,.12)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
    )
  }

  const anchor = toContainerPct(anchorOf(target), contain, box)
  // 位置合わせは外側の div、脈打ちは内側(framer の scale が中央寄せの transform を上書きしないように)
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: `${anchor.leftPct}%`,
        top: `${anchor.topPct}%`,
        width: 88,
        height: 88,
        transform: "translate(-50%, -50%)",
        zIndex: 2,
        pointerEvents: "none",
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={reduce ? { opacity: 0.5 } : { opacity: [0.15, 0.55, 0.15], scale: [0.9, 1.12, 0.9] }}
        transition={reduce ? { duration: 0.3 } : { duration: 1.8, repeat: Infinity }}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.sun}72 0%, transparent 70%)`,
        }}
      />
    </div>
  )
}
