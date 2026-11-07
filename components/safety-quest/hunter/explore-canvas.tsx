"use client"

// =============================================
// きけんハンター 探索モード 中心UI
// アップ写真の上をタップして危険を見つける。
//
//  - object-contain のレターボックスを考慮してタップ/オーバーレイを補正
//    (lib/hunter/image-geometry)。縦長写真でもズレない。
//  - 段階ヒント: Lv1 あったかい・つめたい+方向 → Lv2 focus が光る → Lv3 当たり枠を点線で開示。
//    ヒントに数えるのは「間をあけた はずれ」だけ。答えの枠(Lv3)は時間だけで出す(連打で引き出せない)。
//    自動発見はしない(最後は必ず子のタップ)。
//  - 当たったら、その危険の範囲をふちどる(理由の3択はこの下の画面が出す。説明はそのあと)。
//  - 写真は動かさない。ズームは こたえあわせ でだけ使う。
// =============================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Search, Sparkles } from "lucide-react"

import type { HunterDirection, HunterHazard, HunterTapOutcome, HunterTemperature } from "@/lib/hunter/types"
import { anchorOf } from "@/lib/hunter/hit-zone"
import { containRect, toContainerPct, toImageCoords, type Size } from "@/lib/hunter/image-geometry"
import { computeHintLevel, selectHintTarget } from "@/lib/hunter/hint"
import { photoAspectRatio } from "@/lib/hunter/photo-aspect"

import { ExploreHintOverlay } from "./explore-hint-overlay"
import { ExploreTapFeedback, TEMPERATURE_LABEL, type FeedbackKind, type TapFeedback } from "./explore-tap-feedback"
import { HitOutline } from "./hit-outline"
import { Celebrate, Mascot, PhotoFrame, StampSeal, StatPill, tokens } from "./theme"
import { useContainerBox } from "./use-container-box"

export interface ExploreCanvasProps {
  imageUrl: string
  hazards: readonly HunterHazard[]
  foundIds: readonly string[]
  onTap: (tap: { x: number; y: number }) => void
  /** 直近のタップ位置(画像内相対 0..1)。フィードバック/ヒントのアンカー。 */
  lastTap?: { x: number; y: number } | null
  lastOutcome?: HunterTapOutcome | null
  /** 理由まで分かった危険(スタンプが「わかった」になる)。 */
  understoodIds?: readonly string[]
  /** ふちどる危険(理由の答え待ち・答えた直後)。 */
  activeHazardId?: string | null
  activeTone?: "accent" | "green"
  /** 理由の3択を開いている間などは、何もしていない時間を数えない。 */
  paused?: boolean
  /** 虫めがねを使い切った(タップを受け付けない)。 */
  locked?: boolean
  /** HUD の右に出すもの(虫めがねメーター)。 */
  hudExtra?: ReactNode
  /** 写真の上に重ねるもの(おしまいの案内など)。 */
  overlay?: ReactNode
}

/** 読み上げ用のくわしい文(表示チップは短く、SRにはあたたかく)。 */
const ANNOUNCE: Record<FeedbackKind, string> = {
  hit: "みつけたね！",
  near: "おしい！もう ちょっと！",
  miss: "つぎは どこかな？さがそう！",
  again: "そこは もう みつけたよ！",
}

const LOCKED_ANNOUNCE = "むしめがねを ぜんぶ つかったよ！こたえあわせを しよう。"

const DIRECTION_JP: Record<HunterDirection, string> = {
  up: "うえ",
  down: "した",
  left: "ひだり",
  right: "みぎ",
}

const clampPct = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

function feedbackKind(outcome: HunterTapOutcome): FeedbackKind {
  if (outcome.result === "hit") return "hit"
  if (outcome.alreadyFound === true) return "again"
  return outcome.result
}

/** ヒントに数える はずれか(連打・見つけ済みの再タップは数えない)。 */
function countsAsMiss(outcome: HunterTapOutcome): boolean {
  return outcome.result !== "hit" && outcome.alreadyFound !== true && outcome.deliberate !== false
}

export function ExploreCanvas(props: ExploreCanvasProps) {
  const { imageUrl, hazards, foundIds, onTap, lastTap, lastOutcome } = props
  const { understoodIds = [], activeHazardId = null, activeTone = "accent", paused = false, locked = false } = props

  const reduce = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const box = useContainerBox(containerRef)
  const [imageFailed, setImageFailed] = useState(false)
  const [natural, setNatural] = useState<Size | null>(null)
  const [feedback, setFeedback] = useState<TapFeedback | null>(null)
  const [feedbackTemp, setFeedbackTemp] = useState<{ t?: HunterTemperature; d?: HunterDirection | null }>({})
  const feedbackSeqRef = useRef(0)
  const [missStreak, setMissStreak] = useState(0)
  const [idleMs, setIdleMs] = useState(0)

  const foundSet = useMemo(() => new Set(foundIds), [foundIds])
  const understoodSet = useMemo(() => new Set(understoodIds), [understoodIds])
  const remaining = Math.max(0, hazards.length - foundSet.size)
  const contain = useMemo(() => (natural && box ? containRect(natural, box) : null), [natural, box])
  const activeHazard = useMemo(
    () => (activeHazardId ? hazards.find((h) => h.id === activeHazardId) ?? null : null),
    [hazards, activeHazardId],
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

  // 発見が進んだら idle タイマーをリセット(ヒント抑止)
  useEffect(() => {
    setIdleMs(0)
  }, [foundSet.size])

  // idle 時間を 1 秒ごとに加算(全発見後・答え待ち・おしまいの後は止める)
  useEffect(() => {
    if (remaining <= 0 || paused || locked) return
    const timer = setInterval(() => setIdleMs((ms) => ms + 1000), 1000)
    return () => clearInterval(timer)
  }, [remaining, paused, locked])

  // タップ結果フィードバック + missStreak 更新
  useEffect(() => {
    if (!lastOutcome) return
    if (lastOutcome.result === "hit") setMissStreak(0)
    else if (countsAsMiss(lastOutcome)) setMissStreak((n) => n + 1)

    const anchor = lastTap ?? { x: 0.5, y: 0.5 }
    const raw = place(anchor)
    feedbackSeqRef.current += 1
    setFeedback({
      key: feedbackSeqRef.current,
      kind: feedbackKind(lastOutcome),
      left: `${clampPct(parseFloat(raw.left), 28, 72)}%`,
      top: `${clampPct(parseFloat(raw.top), 18, 82)}%`,
      temperature: lastOutcome.temperature,
      direction: lastOutcome.direction ?? null,
    })
    setFeedbackTemp({ t: lastOutcome.temperature, d: lastOutcome.direction ?? null })
    const timer = setTimeout(() => {
      setFeedback((current) => (current && current.key === feedbackSeqRef.current ? null : current))
    }, 1600)
    return () => clearTimeout(timer)
    // lastTap は lastOutcome と同時更新されるため依存は lastOutcome のみで十分
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastOutcome])

  const hintLevel = computeHintLevel(missStreak, idleMs, remaining)
  const hintTarget = useMemo(() => {
    if (hintLevel < 2 || remaining <= 0 || paused || locked) return null
    return selectHintTarget(lastTap ?? null, hazards, foundSet)
  }, [hintLevel, remaining, paused, locked, lastTap, hazards, foundSet])

  // スクリーンリーダー向けの読み上げ要約(温度+方向、または発見)。
  // この領域は写真(role=button)の外にあるので、おしまいの案内もここで読み上げる。
  const announcement = useMemo(() => {
    if (locked) return LOCKED_ANNOUNCE
    if (!feedback) return ""
    if (feedback.kind === "hit") return ANNOUNCE.hit
    if (hintLevel >= 1 && feedbackTemp.t && (feedback.kind === "near" || feedback.kind === "miss")) {
      const dir = feedbackTemp.d ? `、${DIRECTION_JP[feedbackTemp.d]}のほう` : ""
      return `${TEMPERATURE_LABEL[feedbackTemp.t]}${dir}`
    }
    return ANNOUNCE[feedback.kind]
  }, [feedback, feedbackTemp, hintLevel, locked])

  const emitTap = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current
      if (!el || !contain || locked) return
      const rel = toImageCoords(clientX, clientY, el.getBoundingClientRect(), contain)
      if (!rel) return // レターボックス(余白)上は無視
      onTap(rel)
    },
    [onTap, contain, locked],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      emitTap(rect.left + rect.width / 2, rect.top + rect.height / 2)
    },
    [emitTap],
  )

  // おしまいの後は「つぎは どこかな？」やヒントを出さない(もうタップできないため)
  const visibleFeedback = locked ? null : feedback
  const isHit = visibleFeedback?.kind === "hit"
  // 答え待ちの危険はスタンプではなく、ふちどりで見せる
  const stamped = hazards.filter((h) => foundSet.has(h.id) && h.id !== activeHazardId)

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* スクリーンリーダー向け: タップ結果と方向ヒントを読み上げる */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <Celebrate show={Boolean(isHit)} />

      {/* 上部 HUD(やわらかい表現)。全部見つけたら完了表示に切りかえる */}
      <div className="mb-2.5 flex flex-wrap items-center justify-center gap-2.5">
        {remaining > 0 ? (
          <>
            <StatPill icon={<Search className="h-3.5 w-3.5" aria-hidden="true" />} label="あと" value={`${remaining}こ`} tone="orange" />
            <StatPill icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />} label="みつけた" value={foundSet.size} tone="green" />
          </>
        ) : (
          <StatPill icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />} label="みつけた" value="ぜんぶ みつけた！" tone="green" />
        )}
        {props.hudExtra}
      </div>

      <PhotoFrame tape={false}>
        <div
          ref={containerRef}
          role="button"
          tabIndex={0}
          aria-label="しゃしんの上を タップして、きけんを さがそう"
          aria-disabled={locked || undefined}
          onClick={(event) => emitTap(event.clientX, event.clientY)}
          onKeyDown={handleKeyDown}
          className={tokens.cls.focus}
          style={{
            position: "relative",
            width: "100%",
            // 写真の比率に合わせる(縦長写真で的が小さくならないように)。座標変換は箱サイズから都度計算。
            aspectRatio: photoAspectRatio(natural),
            maxHeight: "min(62dvh, 560px)",
            marginInline: "auto",
            cursor: locked ? "default" : "pointer",
            userSelect: "none",
            // iOS Safari のダブルタップ拡大を抑止(外したとき同じ場所を連打する子が多い)
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {imageFailed ? (
            <ImageFailed />
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
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
            />
          )}

          <ExploreHintOverlay level={hintLevel} target={hintTarget} contain={contain} box={box} />
          <HitOutline hazard={activeHazard} contain={contain} box={box} tone={activeTone} />

          {/* 発見済みマーカー(スタンプ)は focus の上に押す。◎=りゆうも わかった / ○=ばしょを みつけた。
              位置合わせは外側の div、動きは内側の motion.div(framer の transform に中央寄せを上書きさせない) */}
          {stamped.map((hazard) => {
            const understood = understoodSet.has(hazard.id)
            return (
              <div
                key={hazard.id}
                aria-label={`みつけた きをつけるところ: ${hazard.type}${understood ? "（りゆうも わかった）" : ""}`}
                role="img"
                style={{
                  position: "absolute",
                  ...place(anchorOf(hazard)),
                  transform: "translate(-50%, -50%)",
                  zIndex: 3,
                  pointerEvents: "none",
                }}
              >
                <motion.div
                  initial={reduce ? { opacity: 0 } : { scale: 2.1, opacity: 0, rotate: 14 }}
                  animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1, rotate: -6 }}
                  transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 380, damping: 20 }}
                  style={{ filter: "drop-shadow(0 3px 6px rgba(38,65,59,.4))" }}
                >
                  <StampSeal size={52} label={understood ? "◎" : "○"} tone={understood ? "green" : "accent"} />
                </motion.div>
              </div>
            )
          })}

          <ExploreTapFeedback feedback={visibleFeedback} showHint={hintLevel >= 1} allFound={remaining <= 0} />

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
          {!feedback && !locked && !activeHazard ? <TapGuide /> : null}
          {props.overlay}
        </div>
      </PhotoFrame>
    </div>
  )
}

function ImageFailed() {
  return (
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
      <span style={{ fontSize: 15, fontWeight: 800 }}>しゃしんを よみこめませんでした</span>
    </div>
  )
}

function TapGuide() {
  return (
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
  )
}
