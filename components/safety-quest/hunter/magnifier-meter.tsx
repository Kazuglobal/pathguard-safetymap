"use client"

// =============================================
// きけんハンター たんけん: 虫めがねメーター
// はずれ(おしい含む)で 1 つ減る。当たり・見つけ済みの再タップでは減らない。
// 「よく見てからタップする」を、数字ではなく ならんだ虫めがねで伝える。
// =============================================

import { motion, useReducedMotion } from "framer-motion"
import { Search } from "lucide-react"

import { tokens } from "./theme"

const C = tokens.color

export function MagnifierMeter({ left, budget }: { left: number; budget: number }) {
  const reduce = useReducedMotion()
  if (budget <= 0) return null
  const safeLeft = Math.max(0, Math.min(left, budget))
  const low = safeLeft <= 1

  return (
    <div
      role="img"
      aria-label={`むしめがね のこり ${safeLeft}こ`}
      className="inline-flex items-center gap-1.5 rounded-2xl border bg-white px-3 py-1.5"
      style={{ borderColor: low ? `${C.accent}88` : "rgba(67,57,43,.10)", boxShadow: `0 0 0 2px #fff, ${tokens.shadow.soft}` }}
    >
      <span aria-hidden="true" className="mr-0.5 text-[12px] font-bold" style={{ color: C.inkSoft }}>
        むしめがね
      </span>
      {Array.from({ length: budget }, (_, i) => {
        const filled = i < safeLeft
        return (
          <motion.span
            key={i}
            aria-hidden="true"
            initial={false}
            animate={reduce ? { opacity: filled ? 1 : 0.35 } : { opacity: filled ? 1 : 0.35, scale: filled ? 1 : 0.82, y: filled ? 0 : 2 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 22 }}
            className="grid h-6 w-6 place-items-center rounded-full"
            style={{ background: filled ? (low ? C.accent : C.primary) : C.paperDeep, color: "#fff" }}
          >
            <Search className="h-3.5 w-3.5" strokeWidth={3} />
          </motion.span>
        )
      })}
    </div>
  )
}
