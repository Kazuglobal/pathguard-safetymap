"use client"

/**
 * PathGuardian はじめての絵本オンボーディング
 *
 * アプリ初回起動時に、4ページの絵本で「なにをするアプリか」
 * 「親子でどう使うか」を ことばすくなに伝える。
 * スワイプ/タップ/矢印キー対応・スキップ可能・「使い方」からいつでも再生できる。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Map as MapIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { markTutorialCompleted } from "@/lib/tutorial-storage"
import { tankenTokens, ENDPAPER, PAPER_NOISE } from "@/lib/design/tanken"
import { PRODUCT_FACTS } from "@/lib/product-facts"

const C = tankenTokens.color

interface Slide {
  image: string
  alt: string
  sticker: string
  title: string
  body: string
  /** おうちの人向けの小さな添え書き(任意) */
  parentNote?: string
  /** 絵のまわりのクリーム色の余白を落として場面を大きく見せる倍率(任意。場面の端が切れない値だけ) */
  zoom?: number
}

/** 絵を入れる白い枠の幅(枠線1px+内側の余白8pxを左右に足した18px)。高さの計算に使う */
const CARD_FRAME_PX = 18
const CARD_MAX_WIDTH_PX = 420

const SLIDES: readonly Slide[] = [
  {
    image: "/images/onboarding/app-onboarding-1.png",
    alt: "親子がテーブルで通学路のあんぜんノートを広げ、ルペが照らしている絵",
    sticker: "その1",
    title: "かぞくでつかう つうがくろの あんぜんノート",
    body: "PathGuardian(パスガーディアン)は、通学路の「気をつけて」を家族で見つけて、地図にのこせるアプリ。あいぼうの ルペと いっしょに つかってね。",
    parentNote: "おうちの人へ: 準備は1分。お子さんと同じ画面で一緒に使えます。",
    zoom: 1.12,
  },
  {
    image: "/images/onboarding/app-onboarding-2.png",
    alt: "地図の上に注意ピンが並び、親子とルペがのぞきこんでいる絵",
    sticker: "その2",
    title: "ちずを ひらくと「きをつけて」が みえる",
    body: "近所の不審者情報・くるまの危険・みんなの報告が、ちずのピンで ひと目でわかるよ。",
    parentNote: "警察・自治体の公開情報を3時間ごとに自動収集しています。",
  },
  {
    image: "/images/onboarding/app-onboarding-3.png",
    alt: "気になる場所をスマホで撮ると、地図にピンが立つ絵",
    sticker: "その3",
    title: "きになる ばしょは、しゃしんで パチリ",
    body: "「ここ あぶないかも？」と おもったら、その場で ほうこく。ちずに スタンプが ついて、ご近所の かぞくにも つたわるよ。",
    parentNote: `${PRODUCT_FACTS.moderation.adult}${PRODUCT_FACTS.photo.parent}`,
  },
  {
    image: "/images/onboarding/app-onboarding-4.png",
    alt: "親子が学校までのルートを地図にえがき、ルペが旗をふって応援する絵",
    sticker: "その4",
    title: "まずは つうがくろを 1本 とうろく！",
    body: "とうろくすると、毎朝の「通学3分チェック」で わが子のルートの注意点が わかるよ。さっそく やってみよう！",
    parentNote: "学校名と自宅周辺を選ぶだけ。あとから何本でも追加できます。",
    zoom: 1.1,
  },
]

/**
 * 1ページ分の見出し・本文・おうちの人への一言。
 * ghost のときは見えない・読み上げない状態で場所だけ取る(ページ間で文章の場所の高さをそろえるため)。
 */
function SlideText({ slide, ghost }: { slide: Slide; ghost: boolean }) {
  const Title = ghost ? "div" : "h2"
  return (
    <div
      className="[grid-area:1/1]"
      aria-hidden={ghost || undefined}
      style={ghost ? { visibility: "hidden" } : undefined}
      data-testid={ghost ? undefined : "onboarding-slide-text"}
    >
      <Title className="text-[21px] font-black leading-snug" style={{ color: C.ink, textWrap: "balance" }}>
        {slide.title}
      </Title>
      <p
        className="mx-auto mt-2 max-w-[340px] text-[14.5px] font-bold leading-relaxed"
        style={{ color: C.inkSoft, textWrap: "balance" }}
      >
        {slide.body}
      </p>
      {/* 補足の有無でカード位置が跳ねないよう、常に高さを確保する */}
      <div className="mt-2.5 flex min-h-[44px] items-start justify-center">
        {slide.parentNote ? (
          <p
            className="inline-block rounded-full px-3.5 py-1.5 text-[12px] font-bold leading-snug"
            style={{ color: C.inkSoft, background: "rgba(67,57,43,.06)" }}
          >
            {slide.parentNote}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function AppOnboarding({
  open,
  onClose,
  summaryOnly = false,
}: {
  open: boolean
  onClose: () => void
  summaryOnly?: boolean
}) {
  const reduce = useReducedMotion()
  const router = useRouter()
  const pathname = usePathname()
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const slides = useMemo(() => (summaryOnly ? [SLIDES[0]] : SLIDES), [summaryOnly])
  const isLast = index === slides.length - 1
  const slide = slides[index]

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= slides.length) return
      setDir(next > index ? 1 : -1)
      setIndex(next)
    },
    [index, slides.length],
  )

  const finish = useCallback(
    (destination: "/routes" | "/map" | null) => {
      markTutorialCompleted()
      onClose()
      if (destination && pathname !== destination) {
        router.push(destination)
      }
    },
    [onClose, pathname, router],
  )

  // 矢印キー(親のPC利用も想定) + Esc でスキップ
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1)
      if (e.key === "ArrowLeft") go(index - 1)
      if (e.key === "Escape") finish(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, go, index, finish])

  // 背面スクロールを止める
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // モーダル表示中はキーボードフォーカスを内部に閉じ込め、終了時に呼び出し元へ戻す。
  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const dialog = dialogRef.current
    dialog?.focus()

    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"))
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onTab)
    return () => {
      document.removeEventListener("keydown", onTab)
      const previous = previousFocusRef.current
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

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
    const next = slides[index + 1]
    if (!next || preloadRef.current.has(next.image)) return
    preloadRef.current.add(next.image)
    const img = new window.Image()
    img.src = next.image
  }, [index, slides])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex justify-center overflow-hidden"
          style={{
            fontFamily: tankenTokens.font.family,
            background: `${ENDPAPER}, linear-gradient(175deg, ${C.paperDeep} 0%, #EBDFC6 100%)`,
            wordBreak: "keep-all",
            overflowWrap: "break-word",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="PathGuardianのはじめてガイド"
          data-testid="app-onboarding"
        >
          <motion.div
            initial={reduce ? undefined : { y: 24, scale: 0.99 }}
            animate={reduce ? undefined : { y: 0, scale: 1 }}
            exit={reduce ? undefined : { y: 16, opacity: 0 }}
            transition={tankenTokens.springSoft}
            className="relative flex h-[100dvh] w-full max-w-md flex-col sm:h-[min(880px,100dvh)] sm:self-center md:max-w-lg"
          >
            {/* ノート本体 */}
            <div
              className={cn(
                "relative flex min-h-0 flex-1 flex-col overflow-hidden",
                "sm:rounded-[30px] sm:border sm:border-[#43392B]/10",
                "sm:shadow-[0_2px_0_rgba(67,57,43,.08),0_40px_80px_-40px_rgba(67,57,43,.5)]",
              )}
              style={{ background: `${PAPER_NOISE}, linear-gradient(180deg, ${C.paper} 0%, #F7EFDD 100%)` }}
            >
              {/* ヘッダー: はじめてガイド / スキップ */}
              <div className="flex shrink-0 items-center justify-between px-4 pt-[max(env(safe-area-inset-top),14px)]">
                <span
                  className="text-[13px] font-black tracking-wide"
                  style={{ color: C.inkSoft }}
                  aria-hidden="true"
                >
                  はじめてガイド
                </span>
                <button
                  type="button"
                  onClick={() => finish(null)}
                  className={`inline-flex min-h-[40px] items-center gap-1 rounded-full px-3.5 text-[13px] font-black ${tankenTokens.cls.focus}`}
                  style={{ color: C.inkSoft }}
                  data-testid="onboarding-skip"
                >
                  {summaryOnly ? "あとで見る" : "スキップ"}
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/*
                ページ本体(スワイプ可)。幅を絵の大きさの計算(cqw)に使う。
                絵を最小まで縮めても入りきらないとても低い画面では、縦にスクロールして読めるようにする(切らない)。
              */}
              <div
                className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5"
                style={{ containerType: "inline-size" }}
              >
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
                    className="flex h-full cursor-grab flex-col active:cursor-grabbing"
                  >
                    {/*
                      上下の空き。余る高さを半分ずつ受け持って中身を真ん中に置く。
                      justify-center と違い、入りきらないときは最小の余白(上12px・下16px)だけになり、上端が切れない。
                    */}
                    <div aria-hidden="true" className="min-h-3 flex-1" />
                    {/*
                      絵(ノートに貼った1枚)。高さが足りないときは、文章ではなくこの枠が縮む。
                      枠の中の絵は4:3を保ったまま幅ごと小さくし、切り取らない(低い画面で下半分が切れていた)。
                    */}
                    <div
                      className="min-h-[96px] w-full shrink"
                      style={{
                        height: `calc((min(100cqw, ${CARD_MAX_WIDTH_PX}px) - ${CARD_FRAME_PX}px) * 0.75 + ${CARD_FRAME_PX}px)`,
                        containerType: "size",
                      }}
                      data-testid="onboarding-picture-area"
                    >
                      <div
                        className="relative mx-auto overflow-hidden rounded-[20px] border bg-white p-2"
                        style={{
                          width: `min(100%, ${CARD_MAX_WIDTH_PX}px, calc((100cqh - ${CARD_FRAME_PX}px) * 4 / 3 + ${CARD_FRAME_PX}px))`,
                          borderColor: "rgba(67,57,43,.09)",
                          boxShadow: tankenTokens.shadow.card,
                        }}
                      >
                        {/* 「その1」の札。絵が小さくなる低い画面では札も小さくして、絵を覆わないようにする(cqh=絵の場所の高さ) */}
                        <div
                          className="absolute z-10"
                          style={{ left: "clamp(8px, 6cqh, 16px)", top: "clamp(8px, 6cqh, 16px)" }}
                        >
                          <span
                            className="inline-block rounded-[10px] border-2 font-black"
                            style={{
                              fontSize: "clamp(9px, 4.8cqh, 12px)",
                              padding: "0.33em 0.83em",
                              background: C.sun,
                              borderColor: "rgba(67,57,43,.25)",
                              color: C.ink,
                              transform: "rotate(-4deg)",
                              boxShadow: "0 2px 0 rgba(67,57,43,.18)",
                            }}
                          >
                            {slide.sticker}
                          </span>
                        </div>
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[13px]">
                          <Image
                            src={slide.image}
                            alt={slide.alt}
                            fill
                            sizes="(max-width: 480px) 92vw, 420px"
                            priority={index === 0}
                            className="object-cover"
                            style={slide.zoom ? { transform: `scale(${slide.zoom})` } : undefined}
                            draggable={false}
                          />
                        </div>
                      </div>
                    </div>

                    {/*
                      ことば(縮めない。足りない高さは上の絵が受け持つ)。
                      ほかのページの文章も見えない状態で同じ場所に重ね、いちばん長いページの高さにそろえる。
                      こうしないと、文章の長さでページごとに絵の大きさが変わってしまう。
                    */}
                    <div className="mx-auto mt-4 grid w-full max-w-[420px] shrink-0 grid-cols-[minmax(0,1fr)] text-center">
                      {slides.map((s, i) => (
                        <SlideText key={s.image} slide={s} ghost={i !== index} />
                      ))}
                    </div>
                    <div aria-hidden="true" className="min-h-4 flex-1" />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ページドット + すすむ */}
              <div
                className="shrink-0 px-5 pt-2"
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 18px)" }}
              >
                {/* 1ページだけの要約では点が1つになるだけなので出さず、その高さを絵に回す */}
                {slides.length > 1 ? (
                  <div className="mb-4 flex items-center justify-center gap-2" role="group" aria-label="ガイドのページ">
                    {slides.map((s, i) => {
                      const active = i === index
                      return (
                        <button
                          key={s.image}
                          type="button"
                          aria-current={active ? "step" : undefined}
                          aria-label={`${i + 1}ページ目`}
                          onClick={() => go(i)}
                          className={`grid h-11 w-11 place-items-center rounded-full ${tankenTokens.cls.focus}`}
                          style={{
                            touchAction: "manipulation",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="block rounded-full transition-all duration-300"
                            style={{
                              width: active ? 26 : 9,
                              height: 9,
                              background: active ? C.primary : "rgba(67,57,43,.18)",
                            }}
                          />
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                <div className="mx-auto w-full max-w-[420px]">
                  <motion.button
                    type="button"
                    onClick={() => (isLast ? finish(summaryOnly ? "/map" : "/routes") : go(index + 1))}
                    whileTap={reduce ? undefined : { scale: 0.97, y: 3 }}
                    transition={tankenTokens.spring}
                    data-testid="onboarding-next"
                    className={cn(
                      "chunky-press flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full border-2 text-[17px] font-black",
                      tankenTokens.cls.focus,
                    )}
                    style={
                      isLast
                        ? {
                            background: C.sun,
                            borderColor: "rgba(67,57,43,.22)",
                            color: C.ink,
                            boxShadow: tankenTokens.shadow.pressSun,
                          }
                        : {
                            background: C.primary,
                            borderColor: "rgba(67,57,43,.18)",
                            color: "#fff",
                            boxShadow: tankenTokens.shadow.pressGreen,
                          }
                    }
                  >
                    {isLast ? (
                      <>
                        <MapIcon className="h-5 w-5" aria-hidden="true" strokeWidth={2.8} />
                        {summaryOnly ? "ちずを みてみる" : "つうがくろを とうろくする"}
                      </>
                    ) : (
                      <>
                        つぎへ
                        <ArrowRight className="h-5 w-5" aria-hidden="true" strokeWidth={2.8} />
                      </>
                    )}
                  </motion.button>

                  {/*
                    最終ページの代替導線。4ページ版では高さを常に確保してボタン位置が跳ねないようにする。
                    要約(1ページ)では中身が入らないので枠ごと出さない。
                  */}
                  {summaryOnly ? null : (
                    <div className="mt-2 flex min-h-[36px] items-center justify-center">
                      {isLast ? (
                        <button
                          type="button"
                          onClick={() => finish("/map")}
                          className={`rounded-full px-4 py-1.5 text-[13px] font-black underline underline-offset-4 ${tankenTokens.cls.focus}`}
                          style={{ color: C.inkSoft }}
                          data-testid="onboarding-open-map"
                        >
                          あとで。まずは ちずを みてみる
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AppOnboarding
