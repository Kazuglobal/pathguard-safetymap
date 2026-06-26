"use client"

// =============================================
// きけんハンター 探索モード 中心UI
// アップ写真の上をタップして危険を見つける。
// 発見済みマーカー表示 + タップ結果の前向きフィードバック。
// =============================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import type { HunterHazard } from "@/lib/hunter/types"

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

/** 0..1 にクランプ */
function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** 結果ごとの前向きメッセージ（否定しないトーン） */
const OUTCOME_MESSAGES: Record<"hit" | "near" | "miss", string> = {
  hit: "やったね！みつけた！",
  near: "おしい！近いよ",
  miss: "もう一回さがそう！",
}

const OUTCOME_COLORS: Record<"hit" | "near" | "miss", string> = {
  hit: "#22c55e",
  near: "#f59e0b",
  miss: "#38bdf8",
}

interface FeedbackState {
  /** 再描画トリガー用の一意キー */
  key: number
  result: "hit" | "near" | "miss"
  points: number
  /** 表示位置（相対 0..1）。なければ中央。 */
  x: number
  y: number
}

export function ExploreCanvas(props: ExploreCanvasProps) {
  const { imageUrl, hazards, foundIds, onTap, lastOutcome } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const feedbackSeqRef = useRef(0)

  const foundSet = useMemo(() => new Set(foundIds), [foundIds])

  const remaining = Math.max(0, hazards.length - foundSet.size)

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
    }, 1400)

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

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 20,
        overflow: "hidden",
        background: "#0b2551",
        boxShadow: "0 10px 30px rgba(11, 37, 81, 0.35)",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* 残り発見数バッジ */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 999,
          background: "rgba(11, 37, 81, 0.72)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.02em",
          backdropFilter: "blur(4px)",
        }}
      >
        <span aria-hidden="true">🔍</span>
        <span>
          のこり <span style={{ color: "#ffd166" }}>{remaining}</span> こ
        </span>
      </div>

      {/* タップ領域（写真） */}
      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        aria-label="しゃしんの上をタップして、きけんをさがそう"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          cursor: "pointer",
          outline: "none",
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
              color: "#cdd9ef",
              textAlign: "center",
              padding: 16,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 36 }}>
              🖼️
            </span>
            <span style={{ fontSize: 14 }}>
              しゃしんをよみこめませんでした
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="つうがくろのしゃしん"
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

        {/* 発見済みマーカー（未発見は隠す） */}
        {foundHazards.map((hazard) => {
          const cx = clamp01(hazard.region.x + hazard.region.w / 2)
          const cy = clamp01(hazard.region.y + hazard.region.h / 2)
          return (
            <motion.div
              key={hazard.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: 18 }}
              aria-label={`みつけたきけん: ${hazard.type}`}
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
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 30% 30%, #ff6b6b, #ef4444)",
                  border: "3px solid #fff",
                  boxShadow:
                    "0 0 0 4px rgba(239, 68, 68, 0.28), 0 4px 10px rgba(0,0,0,0.3)",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 20,
                  lineHeight: 1,
                }}
              >
                !
              </span>
            </motion.div>
          )
        })}

        {/* タップ結果フィードバック */}
        <AnimatePresence>
          {feedback ? (
            <motion.div
              key={feedback.key}
              initial={{ opacity: 0, y: 8, scale: 0.8 }}
              animate={{ opacity: 1, y: -10, scale: 1 }}
              exit={{ opacity: 0, y: -28, scale: 0.9 }}
              transition={{ duration: 0.35 }}
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
                gap: 4,
              }}
            >
              {feedback.result === "hit" && feedback.points > 0 ? (
                <span
                  style={{
                    fontWeight: 900,
                    fontSize: 26,
                    color: "#ffd166",
                    textShadow: "0 2px 6px rgba(0,0,0,0.45)",
                  }}
                >
                  +{feedback.points}pt
                </span>
              ) : null}
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: OUTCOME_COLORS[feedback.result],
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                }}
              >
                {OUTCOME_MESSAGES[feedback.result]}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
