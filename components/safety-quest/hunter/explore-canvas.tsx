"use client"

// =============================================
// きけんハンター 探索モード 中心UI
// アップ写真の上をタップして危険を見つける。
//
// 方針B(段階的ヒント＋やさしい当たり判定):
//  - object-contain のレターボックスを考慮してタップ/オーバーレイを補正
//    (lib/hunter/image-geometry)。縦長写真でもズレない。
//  - 外し回数/時間で段階ヒント: Lv1 あったかい・つめたい+方向 → Lv2 ゾーン発光
//    → Lv3 薄枠開示。自動発見はしない(最後は必ず子のタップ)。
//  - フィードバックは「実際にタップした場所」にアンカーしつつ、
//    写真のふちで見切れないよう位置をクランプする。
// =============================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Search,
  Sparkles,
} from "lucide-react"

import type {
  HunterDirection,
  HunterHazard,
  HunterTapOutcome,
  HunterTemperature,
} from "@/lib/hunter/types"
import {
  containRect,
  toContainerPct,
  toImageCoords,
  type Size,
} from "@/lib/hunter/image-geometry"
import { computeHintLevel, selectHintTarget } from "@/lib/hunter/hint"

import { Celebrate, Mascot, PhotoFrame, StampSeal, StatPill, tokens } from "./theme"

export interface ExploreCanvasProps {
  imageUrl: string
  hazards: readonly HunterHazard[]
  foundIds: readonly string[]
  onTap: (tap: { x: number; y: number }) => void
  /** 直近のタップ位置(画像内相対 0..1)。フィードバック/ヒントのアンカー。 */
  lastTap?: { x: number; y: number } | null
  lastOutcome?: HunterTapOutcome | null
}

const C = tokens.color

type Outcome = "hit" | "near" | "miss"

/** 結果ごとの前向きメッセージ(否定しない・断定しないトーン) */
const OUTCOME_MESSAGES: Record<Outcome, string> = {
  hit: "よく きづいたね！",
  near: "おしい！もう ちょっと！",
  miss: "つぎは どこかな？",
}

/** 読み上げ用のくわしい文(表示チップは短く、SRにはあたたかく)。 */
const OUTCOME_ANNOUNCE: Record<Outcome, string> = {
  hit: "これ あぶないかも！よく きづいたね！",
  near: "おしい！もう ちょっと！",
  miss: "つぎは どこかな？さがそう！",
}

const OUTCOME_CHIP: Record<Outcome, { bg: string; fg: string }> = {
  hit: { bg: C.primary, fg: "#FFFFFF" },
  near: { bg: C.sun, fg: C.ink },
  miss: { bg: "#FFFFFF", fg: C.ink },
}

const TEMPERATURE_LABEL: Record<HunterTemperature, string> = {
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

interface FeedbackState {
  key: number
  result: Outcome
  points: number
  /** 実タップ位置(画像内相対 0..1) */
  x: number
  y: number
  temperature?: HunterTemperature
  direction?: HunterDirection | null
}

/** 方向(矢印)を読み上げ用のやさしい日本語へ。 */
const DIRECTION_JP: Record<HunterDirection, string> = {
  up: "うえ",
  down: "した",
  left: "ひだり",
  right: "みぎ",
}

const clampPct = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

export function ExploreCanvas(props: ExploreCanvasProps) {
  const { imageUrl, hazards, foundIds, onTap, lastTap, lastOutcome } = props

  const reduce = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const feedbackSeqRef = useRef(0)

  const [natural, setNatural] = useState<Size | null>(null)
  const [box, setBox] = useState<Size | null>(null)
  const [missStreak, setMissStreak] = useState(0)
  const [idleMs, setIdleMs] = useState(0)

  const foundSet = useMemo(() => new Set(foundIds), [foundIds])
  const total = hazards.length
  const foundCount = foundSet.size
  const remaining = Math.max(0, total - foundCount)

  const foundHazards = useMemo(
    () => hazards.filter((hazard) => foundSet.has(hazard.id)),
    [hazards, foundSet],
  )

  const activeHitHazard = useMemo(() => {
    if (lastOutcome?.result !== "hit" || !lastOutcome.hazardId) return null
    return hazards.find((hazard) => hazard.id === lastOutcome.hazardId) ?? null
  }, [hazards, lastOutcome])

  const contain = useMemo(() => {
    if (!natural || !box) return null
    return containRect(natural, box)
  }, [natural, box])

  // 枠サイズを監視(レターボックス補正のため)
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

  // 発見が進んだら idle タイマーをリセット(ヒント抑止)
  useEffect(() => {
    setIdleMs(0)
  }, [foundCount])

  // idle 時間を 1 秒ごとに加算(全発見後は止める)
  useEffect(() => {
    if (remaining <= 0) return
    const timer = setInterval(() => setIdleMs((ms) => ms + 1000), 1000)
    return () => clearInterval(timer)
  }, [remaining, foundCount])

  // タップ結果フィードバック + missStreak 更新
  useEffect(() => {
    if (!lastOutcome) return
    if (lastOutcome.result === "hit") {
      setMissStreak(0)
    } else {
      setMissStreak((n) => n + 1)
    }

    const anchor = lastTap ?? { x: 0.5, y: 0.5 }
    feedbackSeqRef.current += 1
    setFeedback({
      key: feedbackSeqRef.current,
      result: lastOutcome.result,
      points: lastOutcome.points,
      x: anchor.x,
      y: anchor.y,
      temperature: lastOutcome.temperature,
      direction: lastOutcome.direction ?? null,
    })

    const timer = setTimeout(() => {
      setFeedback((current) =>
        current && current.key === feedbackSeqRef.current ? null : current,
      )
    }, 1600)
    return () => clearTimeout(timer)
    // lastTap は lastOutcome と同時更新されるため依存は lastOutcome のみで十分
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastOutcome])

  const hintLevel = computeHintLevel(missStreak, idleMs, remaining)

  // ヒント対象(最近傍の未発見 hazard)。Lv2以上で表示。
  const hintTarget = useMemo(() => {
    if (hintLevel < 2 || remaining <= 0) return null
    return selectHintTarget(lastTap ?? null, hazards, foundSet)
  }, [hintLevel, remaining, lastTap, hazards, foundSet])

  // スクリーンリーダー向けの読み上げ要約(温度+方向、または発見)。
  const announcement = useMemo(() => {
    if (!feedback) return ""
    if (feedback.result === "hit") return "みつけたね！"
    if (hintLevel >= 1 && feedback.temperature) {
      const dir = feedback.direction ? `、${DIRECTION_JP[feedback.direction]}のほう` : ""
      return `${TEMPERATURE_LABEL[feedback.temperature]}${dir}`
    }
    return OUTCOME_ANNOUNCE[feedback.result]
  }, [feedback, hintLevel])

  const emitTap = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current
      if (!el || !contain) return
      const rect = el.getBoundingClientRect()
      const rel = toImageCoords(clientX, clientY, rect, contain)
      if (!rel) return // レターボックス(余白)上は無視
      onTap(rel)
    },
    [onTap, contain],
  )

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => emitTap(event.clientX, event.clientY),
    [emitTap],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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

  /** 画像内相対座標 → 枠に対する % 位置。 */
  const place = useCallback(
    (rel: { x: number; y: number }) => {
      if (!contain || !box) return { left: `${rel.x * 100}%`, top: `${rel.y * 100}%` }
      const pct = toContainerPct(rel, contain, box)
      return { left: `${pct.leftPct}%`, top: `${pct.topPct}%` }
    },
    [contain, box],
  )

  /** フィードバック吹き出し用: ふちで見切れないようクランプした % 位置。 */
  const placeClamped = useCallback(
    (rel: { x: number; y: number }) => {
      const raw = place(rel)
      const left = clampPct(parseFloat(raw.left), 28, 72)
      const top = clampPct(parseFloat(raw.top), 18, 82)
      return { left: `${left}%`, top: `${top}%` }
    },
    [place],
  )

  const isHit = feedback?.result === "hit"

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* スクリーンリーダー向け: タップ結果と方向ヒントを読み上げる */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <Celebrate
        show={Boolean(isHit)}
        points={isHit && feedback && feedback.points > 0 ? feedback.points : undefined}
      />

      {/* 上部 HUD(やわらかい表現)。全部見つけたら完了表示に切りかえる */}
      <div className="mb-2.5 flex items-center justify-center gap-2.5">
        {remaining > 0 ? (
          <>
            <StatPill
              icon={<Search className="h-3.5 w-3.5" aria-hidden="true" />}
              label="あと"
              value={`${remaining}こ`}
              tone="orange"
            />
            <StatPill
              icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
              label="みつけた"
              value={foundCount}
              tone="green"
            />
          </>
        ) : (
          <StatPill
            icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            label="みつけた"
            value={`ぜんぶ みつけた！`}
            tone="green"
          />
        )}
      </div>

      <PhotoFrame tape={false}>
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
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
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
                color: "#BFD2C9",
                textAlign: "center",
                padding: 16,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 40 }}>
                🖼️
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>
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
          )}

          {/* Lv3: ゾーン薄枠開示(自動発見はしない=最後は子がタップ) */}
          {hintLevel >= 3 && hintTarget && contain && box ? (
            <motion.div
              aria-hidden="true"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                position: "absolute",
                ...placeRect(hintTarget, contain, box),
                border: `3px dashed ${C.sun}`,
                borderRadius: 14,
                background: "rgba(255,201,62,.12)",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
          ) : null}

          {/* Lv2: 最近傍ゾーンのパルス発光(そっと) */}
          {hintLevel === 2 && hintTarget ? (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={
                reduce
                  ? { opacity: 0.5 }
                  : { opacity: [0.15, 0.55, 0.15], scale: [0.9, 1.12, 0.9] }
              }
              transition={reduce ? { duration: 0.3 } : { duration: 1.8, repeat: Infinity }}
              style={{
                position: "absolute",
                ...place({
                  x: hintTarget.region.x + hintTarget.region.w / 2,
                  y: hintTarget.region.y + hintTarget.region.h / 2,
                }),
                width: 88,
                height: 88,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${C.sun}72 0%, transparent 70%)`,
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
          ) : null}

          {/* 発見済みマーカー(スタンプ) */}
          {foundHazards.map((hazard) => (
            <motion.div
              key={hazard.id}
              initial={reduce ? { opacity: 0 } : { scale: 2.1, opacity: 0, rotate: 14 }}
              animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1, rotate: -6 }}
              transition={
                reduce ? { duration: 0.2 } : { type: "spring", stiffness: 380, damping: 20 }
              }
              aria-label={`みつけた きをつけるところ: ${hazard.type}`}
              role="img"
              style={{
                position: "absolute",
                ...place({
                  x: hazard.region.x + hazard.region.w / 2,
                  y: hazard.region.y + hazard.region.h / 2,
                }),
                transform: "translate(-50%, -50%)",
                zIndex: 3,
                pointerEvents: "none",
                filter: "drop-shadow(0 3px 6px rgba(38,65,59,.4))",
              }}
            >
              <StampSeal size={50} label="はっけん" tone="accent" />
            </motion.div>
          ))}

          {/* タップ結果フィードバック(タップ位置にアンカー・ふちでクランプ) */}
          <AnimatePresence>
            {feedback ? (
              <motion.div
                key={feedback.key}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.8 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: -12, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -30, scale: 0.9 }}
                transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 340, damping: 20 }}
                style={{
                  position: "absolute",
                  ...placeClamped({ x: feedback.x, y: feedback.y }),
                  transform: "translate(-50%, -50%)",
                  zIndex: 5,
                  pointerEvents: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  maxWidth: "86%",
                }}
              >
                {/* Lv1: 温度感 + 方向ヒント(near/miss のとき) */}
                {hintLevel >= 1 && feedback.result !== "hit" && feedback.temperature ? (
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
                    {feedback.direction ? <DirectionArrow direction={feedback.direction} /> : null}
                    {TEMPERATURE_LABEL[feedback.temperature]}
                  </span>
                ) : null}

                <span
                  style={{
                    padding: "7px 14px",
                    borderRadius: 9999,
                    background: OUTCOME_CHIP[feedback.result].bg,
                    color: OUTCOME_CHIP[feedback.result].fg,
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
                  {remaining <= 0 && feedback.result !== "hit"
                    ? "もう ぜんぶ みつけたよ！"
                    : OUTCOME_MESSAGES[feedback.result]}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* 発見時に よろこぶルペ */}
          <AnimatePresence>
            {isHit ? (
              <motion.div
                key="lupe-wow"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, y: 10 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 8 }}
                transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 320, damping: 18 }}
                style={{ position: "absolute", right: 6, bottom: 6, zIndex: 6, pointerEvents: "none" }}
              >
                <Mascot size="sm" mood="wow" />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* 操作ヒント */}
          {!feedback ? (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                bottom: 10,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 2,
                padding: "6px 14px",
                borderRadius: 9999,
                background: "rgba(38,65,59,.66)",
                backdropFilter: "blur(4px)",
                color: "#FFFFFF",
                fontSize: 12.5,
                fontWeight: 800,
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              タップして きをつけるところを さがそう
            </div>
          ) : null}
        </div>
      </PhotoFrame>

      <AnimatePresence mode="wait">
        {activeHitHazard ? (
          <motion.div
            key={activeHitHazard.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 rounded-[18px] px-4 py-3"
            style={{ background: C.primarySoft, boxShadow: tokens.shadow.soft }}
          >
            <p className="text-[14px] font-black leading-relaxed" style={{ color: C.primaryStrong }}>
              {activeHitHazard.type}
            </p>
            <p className="mt-0.5 text-[13.5px] font-bold leading-relaxed" style={{ color: C.ink }}>
              {activeHitHazard.kidExplanation}
            </p>
            <p className="mt-1 text-[13px] font-black leading-relaxed" style={{ color: C.inkSoft }}>
              つぎに すること：{activeHitHazard.safeAction}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function DirectionArrow({ direction }: { direction: HunterDirection }) {
  const Icon = DIRECTION_ICON[direction]
  return <Icon className="h-3.5 w-3.5" aria-hidden="true" />
}

/** hazard の region を枠に対する絶対配置スタイルへ。 */
function placeRect(
  hazard: HunterHazard,
  contain: ReturnType<typeof containRect>,
  box: Size,
): { left: string; top: string; width: string; height: string } {
  const tl = toContainerPct({ x: hazard.region.x, y: hazard.region.y }, contain, box)
  const br = toContainerPct(
    { x: hazard.region.x + hazard.region.w, y: hazard.region.y + hazard.region.h },
    contain,
    box,
  )
  return {
    left: `${tl.leftPct}%`,
    top: `${tl.topPct}%`,
    width: `${Math.max(0, br.leftPct - tl.leftPct)}%`,
    height: `${Math.max(0, br.topPct - tl.topPct)}%`,
  }
}
