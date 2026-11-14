"use client"

/**
 * 画面の上で、実際のボタンを1つずつ照らして説明する案内(地図とARで共通)。
 * 絵本のはじめての案内(components/onboarding/app-onboarding.tsx)は「なにをするアプリか」を伝える。
 * こちらは「その機能が画面のどこにあるか」を、本物の画面の上で指す。
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight, Check } from "lucide-react"

import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

export interface SpotGuideStep {
  /** 照らす要素の CSS セレクタ。画面に無い(または見えない)手順は飛ばす */
  target: string
  title: string
  body: string
  /** 小さな添え書き(安全の注意など) */
  note?: string
  /**
   * 横にスクロールする列の中の部品など、画面の外にあるかもしれないもの。照らす前に見える位置まで送る。
   * 地図のピンのように「送ると画面がずれる」ものには付けない
   */
  scrollIntoView?: boolean
  /**
   * 同じ部品がたくさんあるもの(地図のピン)。画面のまんなかの帯に見えているものだけを照らし、無ければ飛ばす
   * (上下のボタンの下に隠れたものを照らさない)
   */
  visibleInMiddleOnly?: boolean
}

/** done: 最後まで見た / skipped: 途中でやめた / empty: 照らせる要素が1つも無かった(見た記録は付けない) */
export type SpotGuideCloseReason = "done" | "skipped" | "empty"

interface SpotGuideProps {
  open: boolean
  steps: readonly SpotGuideStep[]
  /** スクリーンリーダー向けの名前(例: 「地図の画面の案内」) */
  label: string
  onClose: (reason: SpotGuideCloseReason) => void
}

interface SpotRect {
  top: number
  left: number
  width: number
  height: number
}

/** 照らす枠を、要素より少し大きくする */
const SPOT_PADDING = 6
const SCREEN_MARGIN = 12
const BUBBLE_MAX_WIDTH = 352
const BUBBLE_GAP = 14
/** 画面の並びが変わっても枠がずれないよう、測り直す間隔 */
const MEASURE_INTERVAL_MS = 250

/** 画面のまんなかの帯(上下のボタンにかからない高さ)。visibleInMiddleOnly の手順で使う */
const MIDDLE_BAND = { top: 0.28, bottom: 0.78 }

function findTarget(step: SpotGuideStep): Element | null {
  for (const element of Array.from(document.querySelectorAll(step.target))) {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    if (!step.visibleInMiddleOnly) return element
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const isInMiddle =
      centerX >= 0 &&
      centerX <= window.innerWidth &&
      centerY >= window.innerHeight * MIDDLE_BAND.top &&
      centerY <= window.innerHeight * MIDDLE_BAND.bottom
    if (isInMiddle) return element
  }
  return null
}

function measureTarget(step: SpotGuideStep): SpotRect | null {
  const element = findTarget(step)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

function findStepFrom(steps: readonly SpotGuideStep[], start: number): number {
  for (let index = start; index < steps.length; index += 1) {
    if (measureTarget(steps[index])) return index
  }
  return -1
}

function isSameRect(a: SpotRect | null, b: SpotRect | null): boolean {
  if (a === null || b === null) return a === b
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

export function SpotGuide({ open, steps, label, onClose }: SpotGuideProps) {
  const [index, setIndex] = useState(-1)
  const [rect, setRect] = useState<SpotRect | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const bubbleRef = useRef<HTMLDivElement>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // onClose と steps は毎回の描画で作り直されてもよいように、最新のものを ref で読む
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const stepsRef = useRef(steps)
  stepsRef.current = steps

  // ひらいたら、照らせる最初の手順から始める
  useEffect(() => {
    if (!open) {
      setIndex(-1)
      setRect(null)
      return
    }
    const first = findStepFrom(stepsRef.current, 0)
    if (first === -1) {
      onCloseRef.current("empty")
      return
    }
    setIndex(first)
  }, [open])

  const goNext = useCallback(() => {
    const next = findStepFrom(stepsRef.current, index + 1)
    if (next === -1) {
      onCloseRef.current("done")
      return
    }
    setIndex(next)
  }, [index])

  // 照らす要素の位置を測りつづける(画面の回転・列の開け閉め・シートの伸び縮みに追いつく)
  useEffect(() => {
    if (!open || index < 0) return

    // 横にスクロールする列の中の部品は、照らす前に見える位置まで送る
    const enteredStep = stepsRef.current[index]
    if (enteredStep?.scrollIntoView) {
      findTarget(enteredStep)?.scrollIntoView?.({ block: "nearest", inline: "center" })
    }

    const measure = () => {
      const step = stepsRef.current[index]
      const nextRect = step ? measureTarget(step) : null
      if (!nextRect) {
        // 案内の途中で要素が消えたら、つぎの手順へ進む(無ければ終わる)
        const next = findStepFrom(stepsRef.current, index + 1)
        if (next === -1) onCloseRef.current("done")
        else setIndex(next)
        return
      }
      setRect((current) => (isSameRect(current, nextRect) ? current : nextRect))
      setViewport((current) =>
        current.width === window.innerWidth && current.height === window.innerHeight
          ? current
          : { width: window.innerWidth, height: window.innerHeight },
      )
    }

    measure()
    const timer = window.setInterval(measure, MEASURE_INTERVAL_MS)
    window.addEventListener("resize", measure)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("resize", measure)
    }
  }, [open, index])

  // キーボード: Esc でやめる。Tab は吹き出しの中だけを回す。
  // AR の画面は自分でも Esc(とじる)と Tab を見ているので、先に受け取って止める(capture)
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current("skipped")
        return
      }
      if (event.key !== "Tab") return
      const bubble = bubbleRef.current
      if (!bubble) return
      const focusable = Array.from(bubble.querySelectorAll<HTMLElement>("button:not([disabled])"))
      if (focusable.length === 0) return
      event.preventDefault()
      event.stopPropagation()
      const current = focusable.indexOf(document.activeElement as HTMLElement)
      const step = event.shiftKey ? -1 : 1
      const nextIndex = current === -1 ? 0 : (current + step + focusable.length) % focusable.length
      focusable[nextIndex].focus()
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [open])

  // フォーカスを案内に移し、とじたら元の場所へ戻す
  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      const previous = previousFocusRef.current
      if (previous?.isConnected) previous.focus()
    }
  }, [open])
  const hasRect = rect !== null
  useEffect(() => {
    if (open && index >= 0 && hasRect) nextButtonRef.current?.focus()
  }, [open, index, hasRect])

  if (!open || index < 0 || !rect) return null

  const step = steps[index]
  if (!step) return null

  // 何番目かは、いま照らせる手順だけで数える(無い手順を飛ばしても「2 / 5」が飛ばないように)
  const visibleIndexes = steps.map((item, itemIndex) => (itemIndex === index || measureTarget(item) ? itemIndex : -1)).filter((itemIndex) => itemIndex >= 0)
  const position = visibleIndexes.indexOf(index) + 1
  const total = visibleIndexes.length
  const isLast = position === total

  const spot = {
    top: rect.top - SPOT_PADDING,
    left: rect.left - SPOT_PADDING,
    width: rect.width + SPOT_PADDING * 2,
    height: rect.height + SPOT_PADDING * 2,
  }
  const bubbleWidth = Math.min(BUBBLE_MAX_WIDTH, Math.max(viewport.width - SCREEN_MARGIN * 2, 0))
  const bubbleLeft = Math.min(
    Math.max(rect.left + rect.width / 2 - bubbleWidth / 2, SCREEN_MARGIN),
    Math.max(viewport.width - bubbleWidth - SCREEN_MARGIN, SCREEN_MARGIN),
  )
  // 要素が画面の上半分にあれば下に、下半分にあれば上に吹き出しを出す
  const isTargetInUpperHalf = rect.top + rect.height / 2 < viewport.height / 2
  const bubblePosition = isTargetInUpperHalf
    ? { top: Math.min(spot.top + spot.height + BUBBLE_GAP, Math.max(viewport.height - 180, SCREEN_MARGIN)) }
    : { bottom: Math.min(viewport.height - spot.top + BUBBLE_GAP, Math.max(viewport.height - 180, SCREEN_MARGIN)) }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-testid="spot-guide"
      className="fixed inset-0 z-[90]"
      style={{ fontFamily: tankenTokens.font.family }}
    >
      {/* 案内のあいだは、下の画面を押せないようにする */}
      <div className="absolute inset-0" aria-hidden="true" />

      {/* まわりを暗くして、この要素だけ明るく抜く */}
      <div
        data-testid="spot-guide-spot"
        aria-hidden="true"
        className="pointer-events-none fixed rounded-[18px] transition-all duration-200 motion-reduce:transition-none"
        style={{
          ...spot,
          boxShadow: "0 0 0 3px rgba(255,201,62,.95), 0 0 0 9999px rgba(28,22,14,.66)",
        }}
      />

      <div
        ref={bubbleRef}
        className="fixed rounded-[22px] border-2 p-4"
        style={{
          left: bubbleLeft,
          width: bubbleWidth,
          ...bubblePosition,
          background: C.card,
          borderColor: "rgba(67,57,43,.16)",
          boxShadow: tankenTokens.shadow.card,
          wordBreak: "keep-all",
          overflowWrap: "anywhere",
        }}
      >
        <p className="text-xs font-black" style={{ color: C.primaryStrong }} aria-live="polite">
          {position} / {total}
        </p>
        <h2 className="mt-1 text-[17px] font-black leading-snug" style={{ color: C.ink }}>
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm font-bold leading-relaxed" style={{ color: C.inkSoft }}>
          {step.body}
        </p>
        {step.note && (
          <p
            className="mt-2 rounded-xl px-3 py-2 text-xs font-bold leading-relaxed"
            style={{ color: C.ink, background: C.sunSoft }}
          >
            {step.note}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            className={`min-h-11 rounded-full px-3 text-sm font-black underline underline-offset-4 ${tankenTokens.cls.focus}`}
            style={{ color: C.inkSoft }}
            onClick={() => onClose("skipped")}
          >
            スキップ
          </button>
          <button
            ref={nextButtonRef}
            type="button"
            className={`chunky-press flex min-h-11 items-center gap-1.5 rounded-full border-2 px-5 text-[15px] font-black text-white ${tankenTokens.cls.focus}`}
            style={{
              background: C.primary,
              borderColor: "rgba(67,57,43,.18)",
              boxShadow: tankenTokens.shadow.pressGreen,
            }}
            onClick={goNext}
          >
            {isLast ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
                わかった
              </>
            ) : (
              <>
                つぎへ
                <ArrowRight className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SpotGuide
