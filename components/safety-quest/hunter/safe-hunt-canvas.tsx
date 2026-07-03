"use client"

// =============================================
// きけんハンター 逆モード「安全さがし」UI
// 危険が見つからなかった(ガイド)とき、写真の中の「安全の工夫」
// (ガードレール・歩道・ミラー等)を肯定形で探す。否定しない・点を競わない。
// safePoints が無ければ呼ばれない(hunter-game 側で出し分け)。
// =============================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ShieldCheck, Sparkles } from "lucide-react"

import type { HunterSafePoint } from "@/lib/hunter/types"
import {
  containRect,
  toContainerPct,
  toImageCoords,
  type Size,
} from "@/lib/hunter/image-geometry"

import { RubyText } from "./ruby-text"
import {
  BottomBar,
  Celebrate,
  PhotoFrame,
  PrimaryCTA,
  SpeechBubble,
  StatPill,
  tokens,
} from "./theme"

const C = tokens.color

export interface SafeHuntCanvasProps {
  imageUrl: string
  safePoints: readonly HunterSafePoint[]
  onDone: () => void
}

/** タップが safe point の領域(少し広め)に入っているか。 */
function hitSafePoint(
  rel: { x: number; y: number },
  point: HunterSafePoint,
  margin = 0.12,
): boolean {
  const r = point.region
  return (
    rel.x >= r.x - margin &&
    rel.x <= r.x + r.w + margin &&
    rel.y >= r.y - margin &&
    rel.y <= r.y + r.h + margin
  )
}

export function SafeHuntCanvas({ imageUrl, safePoints, onDone }: SafeHuntCanvasProps) {
  const reduce = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<Size | null>(null)
  const [box, setBox] = useState<Size | null>(null)
  const [foundIds, setFoundIds] = useState<string[]>([])
  const [active, setActive] = useState<HunterSafePoint | null>(null)

  const foundSet = useMemo(() => new Set(foundIds), [foundIds])
  const allFound = foundIds.length >= safePoints.length

  const contain = useMemo(() => {
    if (!natural || !box) return null
    return containRect(natural, box)
  }, [natural, box])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setBox({ w: rect.width, h: rect.height })
    }
    update()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const place = useCallback(
    (rel: { x: number; y: number }) => {
      if (!contain || !box) return { left: `${rel.x * 100}%`, top: `${rel.y * 100}%` }
      const pct = toContainerPct(rel, contain, box)
      return { left: `${pct.leftPct}%`, top: `${pct.topPct}%` }
    },
    [contain, box],
  )

  const activateSafePoint = useCallback((point: HunterSafePoint) => {
    setActive(point)
    setFoundIds((prev) => (prev.includes(point.id) ? prev : [...prev, point.id]))
  }, [])

  const emitTapAt = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current
      if (!el || !contain) return
      const rect = el.getBoundingClientRect()
      const rel = toImageCoords(clientX, clientY, rect, contain)
      if (!rel) return
      const hit = safePoints.find((p) => hitSafePoint(rel, p))
      if (hit) activateSafePoint(hit)
    },
    [contain, safePoints, activateSafePoint],
  )

  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => emitTapAt(e.clientX, e.clientY),
    [emitTapAt],
  )

  /**
   * キーボード操作用のカーソル。コンテナ中央固定だと、その座標に重ならない
   * safePoint には永久に到達できないため、Enter/Space を押すたびに
   * 「まだ見つけていない」safePoint を1つずつ順番に見つけたことにする。
   */
  const keyboardCursorRef = useRef(0)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        const remaining = safePoints.filter((p) => !foundSet.has(p.id))
        if (remaining.length === 0) return
        const index = keyboardCursorRef.current % remaining.length
        keyboardCursorRef.current += 1
        activateSafePoint(remaining[index])
      }
    },
    [safePoints, foundSet, activateSafePoint],
  )

  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-full flex-1 flex-col px-4 pt-1">
      {/* スクリーンリーダー向け: 見つけた安全の工夫を読み上げる(視覚カードとは独立に常設) */}
      <span className="sr-only" role="status" aria-live="polite">
        {active ? `${active.type}：${active.whyGood}` : ""}
      </span>

      <Celebrate show={allFound} />

      <div className="flex flex-1 flex-col gap-3">
        <SpeechBubble mood="happy">
          この みちの「<RubyText text="安全" />の くふう」を さがそう！ ガードレールや{" "}
          <RubyText text="歩道" />は あんしんの しるしだよ。
        </SpeechBubble>

        <div className="flex items-center justify-center">
          <StatPill
            icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}
            label="みつけた"
            value={`${foundIds.length}/${safePoints.length}`}
            tone="green"
          />
        </div>

        <PhotoFrame tape={false}>
          <div
            ref={containerRef}
            role="button"
            tabIndex={0}
            aria-label="しゃしんの上を タップして、安全の くふうを さがそう"
            onClick={handleTap}
            onKeyDown={handleKeyDown}
            className={tokens.cls.focus}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4 / 3",
              cursor: "pointer",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="つうがくろの しゃしん"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setNatural({ w: img.naturalWidth, h: img.naturalHeight })
                }
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />

            {safePoints.map((point) => {
              const found = foundSet.has(point.id)
              const center = {
                x: point.region.x + point.region.w / 2,
                y: point.region.y + point.region.h / 2,
              }
              return (
                <motion.div
                  key={point.id}
                  initial={reduce ? { opacity: 0.7 } : { scale: 0.9, opacity: 0.7 }}
                  animate={
                    reduce
                      ? { opacity: found ? 1 : 0.7 }
                      : found
                        ? { scale: 1, opacity: 1 }
                        : { scale: [0.9, 1.06, 0.9], opacity: [0.6, 0.95, 0.6] }
                  }
                  transition={reduce ? { duration: 0.2 } : { duration: 1.8, repeat: found ? 0 : Infinity }}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    ...place(center),
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: found ? C.primary : "rgba(21,158,114,.55)",
                      boxShadow: `0 0 0 3px #fff, ${tokens.shadow.card}`,
                      color: "#fff",
                    }}
                  >
                    <ShieldCheck className="h-5 w-5" strokeWidth={2.6} />
                  </span>
                </motion.div>
              )
            })}
          </div>
        </PhotoFrame>

        <AnimatePresence>
          {active && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2.5 rounded-[18px] px-4 py-3"
              style={{ background: C.primarySoft, boxShadow: tokens.shadow.soft }}
            >
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.primaryStrong }} aria-hidden="true" />
              <p className="text-[14px] font-bold leading-relaxed" style={{ color: C.ink }}>
                <span className="font-black" style={{ color: C.primaryStrong }}>
                  <RubyText text={active.type} />：
                </span>
                <RubyText text={active.whyGood} />
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomBar className="-mx-4 px-4">
        <PrimaryCTA onClick={onDone} variant={allFound ? "sun" : "paper"}>
          {allFound ? "ぜんぶ みつけた！おわる" : "おわる"}
        </PrimaryCTA>
      </BottomBar>
    </div>
  )
}
