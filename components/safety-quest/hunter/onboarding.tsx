"use client"

/**
 * きけんハンター オンボーディング(絵本モード)
 *
 * 初回起動時に4ページの絵本で「なにをするアプリか」「親子でどう使うか」を
 * ことばすくなに伝える。スワイプ/タップ両対応・スキップ可能・再生可能。
 * 完了は localStorage("hunter:onboarded:v1") に記録する。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowRight, X } from "lucide-react"

import { PrimaryCTA, Sticker, tokens } from "./theme"

const C = tokens.color

export const ONBOARDING_KEY = "hunter:onboarded:v1"

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "1"
  } catch {
    return true
  }
}

export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1")
  } catch {
    // localStorage が使えなくても進行は妨げない
  }
}

interface Slide {
  image: string
  alt: string
  sticker: string
  title: string
  body: string
  /** おうちの人向けの小さな添え書き(任意) */
  parentNote?: string
}

const SLIDES: readonly Slide[] = [
  {
    image: "/images/hunter/onboarding-1.png",
    alt: "親子が家から出発し、虫めがねのルペが横で光っている絵",
    sticker: "その1",
    title: "まちは ちいさな ぼうけんの ばしょ",
    body: "いつもの みちにも「きをつけるポイント」が かくれているよ。あいぼうの ルペと いっしょに さがしに いこう！",
  },
  {
    image: "/images/hunter/onboarding-2.png",
    alt: "おうちの人がスマホで通学路の写真をとっている絵",
    sticker: "その2",
    title: "おうちの人と しゃしんを とろう",
    body: "気になる みちを 1まい パチリ。かおや くるまの ナンバーは、あとで かんたんに ぼかせるから あんしんだよ。",
    parentNote: "おうちの人へ: 写真はぼかし加工をしてからAIが解析します。保存は任意です。",
  },
  {
    image: "/images/hunter/onboarding-3.png",
    alt: "写真の上を虫めがねでさがして、危ないところが光っている絵",
    sticker: "その3",
    title: "虫めがねで きけんを はっけん！",
    body: "しゃしんの なかの「あぶないかも？」を タッチ！ みつけると スタンプが たまっていくよ。",
  },
  {
    image: "/images/hunter/onboarding-4.png",
    alt: "親子がハイタッチしてスタンプのついたノートがある絵",
    sticker: "その4",
    title: "きょうから きみも きけんハンター",
    body: "みつけた あとは「どう 気をつける？」を おうちの人と はなしてみよう。きづく目が どんどん そだつよ！",
    parentNote: "答え合わせより「一緒に気づく」体験を大切にしています。",
  },
]

export function Onboarding({
  onDone,
  onSkip,
}: {
  onDone: () => void
  onSkip: () => void
}) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= SLIDES.length) return
      setDir(next > index ? 1 : -1)
      setIndex(next)
    },
    [index],
  )

  // 矢印キーでも進める(親のPC利用も想定)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1)
      if (e.key === "ArrowLeft") go(index - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, index])

  // スワイプ判定(しきい値: 56px または 高速フリック)
  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      const { offset, velocity } = info
      if (offset.x < -56 || velocity.x < -520) go(index + 1)
      else if (offset.x > 56 || velocity.x > 520) go(index - 1)
    },
    [go, index],
  )

  const variants = useMemo(() => {
    if (reduce) {
      return {
        enter: () => ({ opacity: 0 }),
        center: { opacity: 1 },
        exit: () => ({ opacity: 0 }),
      }
    }
    return {
      enter: (d: 1 | -1) => ({ opacity: 0, x: 64 * d, rotate: 0.6 * d }),
      center: { opacity: 1, x: 0, rotate: 0 },
      exit: (d: 1 | -1) => ({ opacity: 0, x: -56 * d, rotate: -0.4 * d }),
    }
  }, [reduce])

  // 次ページの画像を先読みして、めくったときの白フラッシュを防ぐ
  const preloadRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const next = SLIDES[index + 1]
    if (!next || preloadRef.current.has(next.image)) return
    preloadRef.current.add(next.image)
    const img = new window.Image()
    img.src = next.image
  }, [index])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-testid="hunter-onboarding">
      {/* スキップ(いつでも) */}
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),14px)]">
        <span
          className="text-[13px] font-black tracking-wide"
          style={{ color: C.inkFaint }}
          aria-hidden="true"
        >
          はじめてガイド
        </span>
        <button
          type="button"
          onClick={onSkip}
          className={`inline-flex min-h-[40px] items-center gap-1 rounded-full px-3.5 text-[13px] font-black ${tokens.cls.focus}`}
          style={{ color: C.inkSoft }}
        >
          スキップ
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* ページ本体(スワイプ可) */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-5">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div
            key={index}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0.18 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            drag={reduce ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.16}
            onDragEnd={handleDragEnd}
            className="flex h-full cursor-grab flex-col justify-center pb-4 active:cursor-grabbing"
          >
            {/* 絵(ノートに貼った1枚) */}
            <div
              className="relative mx-auto mt-3 w-full max-w-[420px] overflow-hidden rounded-[20px] border bg-white p-2"
              style={{ borderColor: "rgba(67,57,43,.09)", boxShadow: tokens.shadow.card }}
            >
              <div className="absolute left-4 top-4 z-10">
                <Sticker tone="sun" tilt={-4}>
                  {slide.sticker}
                </Sticker>
              </div>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[13px]">
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 480px) 92vw, 420px"
                  priority={index === 0}
                  className="object-cover"
                  draggable={false}
                />
              </div>
            </div>

            {/* ことば */}
            <div className="mx-auto mt-4 w-full max-w-[420px] text-center">
              <h2
                className="text-[21px] font-black leading-snug"
                style={{ color: C.ink, textWrap: "balance", wordBreak: "keep-all", overflowWrap: "anywhere" }}
              >
                {slide.title}
              </h2>
              <p
                className="mx-auto mt-2 max-w-[340px] text-[14.5px] font-bold leading-relaxed"
                style={{ color: C.inkSoft, textWrap: "balance", wordBreak: "keep-all", overflowWrap: "anywhere" }}
              >
                {slide.body}
              </p>
              {/* 補足の有無でカード位置が跳ねないよう、常に高さを確保する */}
              <div className="mt-2.5 flex min-h-[44px] items-start justify-center">
                {slide.parentNote ? (
                  <p
                    className="inline-block rounded-full px-3.5 py-1.5 text-[11.5px] font-bold leading-snug"
                    style={{ color: C.inkSoft, background: "rgba(67,57,43,.06)" }}
                  >
                    {slide.parentNote}
                  </p>
                ) : null}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ページドット + すすむ */}
      <div
        className="shrink-0 px-5 pt-2"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 18px)" }}
      >
        <div className="mb-4 flex items-center justify-center gap-2" role="tablist" aria-label="ページ">
          {SLIDES.map((s, i) => {
            const active = i === index
            return (
              <button
                key={s.image}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${i + 1}ページ目`}
                onClick={() => go(i)}
                className={`rounded-full transition-all duration-300 ${tokens.cls.focus}`}
                style={{
                  width: active ? 26 : 9,
                  height: 9,
                  background: active ? C.primary : "rgba(67,57,43,.18)",
                }}
              />
            )
          })}
        </div>

        <div className="mx-auto w-full max-w-[420px]">
          <PrimaryCTA
            variant={isLast ? "sun" : "green"}
            onClick={() => (isLast ? onDone() : go(index + 1))}
          >
            {isLast ? (
              <>ぼうけんに でかける！</>
            ) : (
              <>
                つぎへ
                <ArrowRight className="h-5 w-5" aria-hidden="true" strokeWidth={2.8} />
              </>
            )}
          </PrimaryCTA>
        </div>
      </div>
    </div>
  )
}
