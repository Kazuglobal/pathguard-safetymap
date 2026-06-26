"use client"

// =============================================
// きけんハンター 探索モード 中心UI
// アップ写真の上をタップして危険を見つける。
// 発見済みマーカー表示 + タップ結果の前向きフィードバック。
//
// 見た目は共通テーマ(theme.tsx)に統一:
//   - tokens   : 配色・角丸・影
//   - StatPill : 上部HUD（のこり / みつけた）
//   - Celebrate: 発見時の紙吹雪＋「+pt」演出
//   - Mascot   : 発見時に「わぁ！」と よろこぶハンタくん
// =============================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Search, Sparkles } from "lucide-react"

import type { HunterHazard } from "@/lib/hunter/types"

import { Celebrate, Mascot, StatPill, tokens } from "./theme"

export interface ExploreCanvasProps {
  imageUrl: string
  hazards: readonly HunterHazard[]
  foundIds: readonly string[]
  onTap: (tap: { x: number; y: number }) => void
  lastOutcome?: {
    result: "hit" | "near" | "miss"
    hazardId: string | null
    points: number
  } | null
}

const C = tokens.color

/** 0..1 にクランプ */
function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

type Outcome = "hit" | "near" | "miss"

/** 結果ごとの前向きメッセージ（否定しない・断定しないトーン） */
const OUTCOME_MESSAGES: Record<Outcome, string> = {
  hit: "やったね！みつけた！",
  near: "おしい！もう ちょっと！",
  miss: "つぎは どこかな？さがそう！",
}

/** メッセージチップの配色（warning の上は ink 文字、それ以外は白文字） */
const OUTCOME_CHIP: Record<Outcome, { bg: string; fg: string }> = {
  hit: { bg: C.success, fg: "#FFFFFF" },
  near: { bg: C.warning, fg: C.ink },
  miss: { bg: C.primary, fg: "#FFFFFF" },
}

interface FeedbackState {
  /** 再描画トリガー用の一意キー */
  key: number
  result: Outcome
  points: number
  /** 表示位置（相対 0..1）。なければ中央。 */
  x: number
  y: number
}

export function ExploreCanvas(props: ExploreCanvasProps) {
  const { imageUrl, hazards, foundIds, onTap, lastOutcome } = props

  const reduce = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const feedbackSeqRef = useRef(0)

  const foundSet = useMemo(() => new Set(foundIds), [foundIds])

  const total = hazards.length
  const foundCount = foundSet.size
  const remaining = Math.max(0, total - foundCount)

  const foundHazards = useMemo(
    () => hazards.filter((hazard) => foundSet.has(hazard.id)),
    [hazards, foundSet],
  )

  // タップ結果が来たら一時的なフィードバックを表示
  useEffect(() => {
    if (!lastOutcome) return

    // 該当 hazard の中心を表示位置に使う（なければ中央）
    let x = 0.5
    let y = 0.5
    if (lastOutcome.hazardId) {
      const hazard = hazards.find((item) => item.id === lastOutcome.hazardId)
      if (hazard) {
        x = clamp01(hazard.region.x + hazard.region.w / 2)
        y = clamp01(hazard.region.y + hazard.region.h / 2)
      }
    }

    feedbackSeqRef.current += 1
    setFeedback({
      key: feedbackSeqRef.current,
      result: lastOutcome.result,
      points: lastOutcome.points,
      x,
      y,
    })

    const timer = setTimeout(() => {
      setFeedback((current) =>
        current && current.key === feedbackSeqRef.current ? null : current,
      )
    }, 1600)

    return () => clearTimeout(timer)
  }, [lastOutcome, hazards])

  const emitTap = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = clamp01((clientX - rect.left) / rect.width)
      const y = clamp01((clientY - rect.top) / rect.height)
      onTap({ x, y })
    },
    [onTap],
  )

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      emitTap(event.clientX, event.clientY)
    },
    [emitTap],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // キーボード操作では中央をタップ扱い（最低限のアクセシビリティ）
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        const el = containerRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        emitTap(rect.left + rect.width / 2, rect.top + rect.height / 2)
      }
    },
    [emitTap],
  )

  const isHit = feedback?.result === "hit"

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* 発見時の全画面お祝い（紙吹雪＋「+pt」） */}
      <Celebrate
        show={Boolean(isHit)}
        points={isHit && feedback && feedback.points > 0 ? feedback.points : undefined}
      />

      {/* 上部 HUD（StatPill：のこり / みつけた） */}
      <div className="mb-2.5 flex items-center justify-center gap-2">
        <StatPill
          icon={<Search className="h-4 w-4" aria-hidden="true" />}
          label="のこり"
          value={remaining}
          tone="orange"
        />
        <StatPill
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          label="みつけた"
          value={foundCount}
          tone="green"
        />
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          borderRadius: tokens.radius.thumb,
          overflow: "hidden",
          background: C.headerNavy,
          boxShadow: `${tokens.shadow.soft}, ${tokens.shadow.card}`,
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* タップ領域（写真） */}
        <div
          ref={containerRef}
          role="button"
          tabIndex={0}
          aria-label="しゃしんの上を タップして、きけんを さがそう"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={tokens.cls.focus}
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 3",
            cursor: "pointer",
          }}
        >
          {imageFailed ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "#CDD9EF",
                textAlign: "center",
                padding: 16,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 40 }}>
                🖼️
              </span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                しゃしんを よみこめませんでした
              </span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="つうがくろの しゃしん"
              draggable={false}
              onError={() => setImageFailed(true)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />
          )}

          {/* 発見済みマーカー（未発見は隠す）。きをつけるイエローの丸「！」 */}
          {foundHazards.map((hazard) => {
            const cx = clamp01(hazard.region.x + hazard.region.w / 2)
            const cy = clamp01(hazard.region.y + hazard.region.h / 2)
            return (
              <motion.div
                key={hazard.id}
                initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { scale: [0, 1.15, 1], opacity: 1 }}
                transition={
                  reduce
                    ? { duration: 0.2 }
                    : { type: "spring", stiffness: 320, damping: 16 }
                }
                aria-label={`みつけた きをつけるところ: ${hazard.type}`}
                role="img"
                style={{
                  position: "absolute",
                  left: `${cx * 100}%`,
                  top: `${cy * 100}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 3,
                  pointerEvents: "none",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: tokens.gradient.treasure,
                    border: "4px solid #FFFFFF",
                    boxShadow: `0 0 0 4px ${C.warning}55, ${tokens.shadow.card}`,
                    color: C.ink,
                    fontWeight: 900,
                    fontSize: 26,
                    lineHeight: 1,
                  }}
                >
                  !
                </span>
              </motion.div>
            )
          })}

          {/* タップ結果フィードバック（位置に紐づく前向きメッセージ） */}
          <AnimatePresence>
            {feedback ? (
              <motion.div
                key={feedback.key}
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, y: 8, scale: 0.8 }
                }
                animate={
                  reduce
                    ? { opacity: 1 }
                    : { opacity: 1, y: -12, scale: 1 }
                }
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -30, scale: 0.9 }}
                transition={
                  reduce
                    ? { duration: 0.2 }
                    : { type: "spring", stiffness: 320, damping: 18 }
                }
                style={{
                  position: "absolute",
                  left: `${feedback.x * 100}%`,
                  top: `${feedback.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 5,
                  pointerEvents: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {feedback.result === "hit" && feedback.points > 0 ? (
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: 28,
                      color: C.accent,
                      textShadow:
                        "-2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff, 0 3px 6px rgba(30,60,90,.25)",
                    }}
                  >
                    +{feedback.points}pt
                  </span>
                ) : null}
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: tokens.radius.button,
                    background: OUTCOME_CHIP[feedback.result].bg,
                    color: OUTCOME_CHIP[feedback.result].fg,
                    fontWeight: 800,
                    fontSize: 16,
                    whiteSpace: "nowrap",
                    boxShadow: tokens.shadow.card,
                  }}
                >
                  {OUTCOME_MESSAGES[feedback.result]}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* 発見時に よろこぶハンタくん（右下にポンっと登場） */}
          <AnimatePresence>
            {isHit ? (
              <motion.div
                key="hunter-wow"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, y: 10 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 8 }}
                transition={
                  reduce
                    ? { duration: 0.2 }
                    : { type: "spring", stiffness: 300, damping: 16 }
                }
                style={{
                  position: "absolute",
                  right: 8,
                  bottom: 8,
                  zIndex: 6,
                  pointerEvents: "none",
                }}
              >
                <Mascot size="sm" mood="wow" />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* 操作ヒント（フィードバック中は隠す・装飾） */}
          {!feedback ? (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                bottom: 10,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 2,
                padding: "5px 14px",
                borderRadius: tokens.radius.button,
                background: "rgba(11, 37, 81, 0.6)",
                backdropFilter: "blur(4px)",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              タップして きをつけるところを さがそう
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
