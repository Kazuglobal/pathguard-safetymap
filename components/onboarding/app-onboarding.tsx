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

const C = tankenTokens.color

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
    image: "/images/onboarding/app-onboarding-1.png",
    alt: "親子がテーブルで通学路の安全ノートを広げ、ルペが照らしている絵",
    sticker: "その1",
    title: "かぞくでつかう つうがくろの安全ノート",
    body: "PathGuardian(パスガーディアン)は、通学路の「気をつけて」を家族で見つけて、地図にのこせるアプリ。あいぼうの ルペと いっしょに つかってね。",
    parentNote: "おうちの人へ: 準備は1分。お子さんと同じ画面で一緒に使えます。",
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
    parentNote: "報告は承認制。顔やナンバーは加工してから共有されます。",
  },
  {
    image: "/images/onboarding/app-onboarding-4.png",
    alt: "親子が学校までのルートを地図にえがき、ルペが旗をふって応援する絵",
    sticker: "その4",
    title: "まずは つうがくろを 1本 とうろく！",
    body: "とうろくすると、毎朝の「通学3分チェック」で わが子のルートの注意点が わかるよ。さっそく やってみよう！",
    parentNote: "学校名と自宅周辺を選ぶだけ。あとから何本でも追加できます。",
  },
]

export function AppOnboarding({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const router = useRouter()
  const pathname = usePathname()
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= SLIDES.length) return
      setDir(next > index ? 1 : -1)
      setIndex(next)
    },
    [index],
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
    const next = SLIDES[index + 1]
    if (!next || preloadRef.current.has(next.image)) return
    preloadRef.current.add(next.image)
    const img = new window.Image()
    img.src = next.image
  }, [index])

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
                  style={{ color: C.inkFaint }}
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
                      style={{ borderColor: "rgba(67,57,43,.09)", boxShadow: tankenTokens.shadow.card }}
                    >
                      <div className="absolute left-4 top-4 z-10">
                        <span
                          className="inline-block rounded-[10px] border-2 px-2.5 py-1 text-[12px] font-black"
                          style={{
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
                          draggable={false}
                        />
                      </div>
                    </div>

                    {/* ことば */}
                    <div className="mx-auto mt-4 w-full max-w-[420px] text-center">
                      <h2
                        className="text-[21px] font-black leading-snug"
                        style={{ color: C.ink, textWrap: "balance" }}
                      >
                        {slide.title}
                      </h2>
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
                <div className="mb-4 flex items-center justify-center gap-2" role="group" aria-label="ガイドのページ">
                  {SLIDES.map((s, i) => {
                    const active = i === index
                    return (
                      <button
                        key={s.image}
                        type="button"
                        aria-current={active ? "step" : undefined}
                        aria-label={`${i + 1}ページ目`}
                        onClick={() => go(i)}
                        className={`grid h-8 w-8 place-items-center rounded-full ${tankenTokens.cls.focus}`}
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

                <div className="mx-auto w-full max-w-[420px]">
                  <motion.button
                    type="button"
                    onClick={() => (isLast ? finish("/routes") : go(index + 1))}
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
                        つうがくろを とうろくする
                      </>
                    ) : (
                      <>
                        つぎへ
                        <ArrowRight className="h-5 w-5" aria-hidden="true" strokeWidth={2.8} />
                      </>
                    )}
                  </motion.button>

                  {/* 最終ページの代替導線。高さを常に確保してボタン位置が跳ねないようにする */}
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
