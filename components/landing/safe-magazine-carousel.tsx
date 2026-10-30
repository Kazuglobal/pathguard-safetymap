"use client"

import { useCallback, useEffect, useState } from "react"
import type React from "react"
import Autoplay from "embla-carousel-autoplay"
import { Pause, Play } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { LandingSafeMagazinePreviewItem } from "@/lib/landing-safe-magazine-preview"
import { tankenTokens } from "@/lib/design/tanken"
import { SafeMagazineCard } from "./safe-magazine-card"

const C = tankenTokens.color

/** 次の記事へ送るまでの時間 */
const AUTOPLAY_DELAY_MS = 5000
/** SafeMagazine の md:hidden と同じ境界。PCでは非表示なので動かさない */
const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)"
const ALLOWS_MOTION_QUERY = "(prefers-reduced-motion: no-preference)"

/** auto = 端末設定に従う / paused = 利用者が止めた / playing = 利用者が再生を選んだ */
type AutoplayChoice = "auto" | "paused" | "playing"

interface SafeMagazineCarouselProps {
  articles: LandingSafeMagazinePreviewItem[]
}

/**
 * スマホ向けの SAFE MAGAZINE 自動スライド。
 * 動くコンテンツには止める手段が要る(WCAG 2.2.2)ため、
 * 一時停止ボタンを常に出し、スワイプ・丸ボタン・矢印キー・記事へのフォーカスで止める。
 * 視差効果を減らす設定の端末では、利用者が再生を選ぶまで自動では動かさない。
 */
export function SafeMagazineCarousel({ articles }: SafeMagazineCarouselProps) {
  // 再生の可否は下の effect で決めるので playOnInit は切る
  const [plugins] = useState(() => [
    Autoplay({ delay: AUTOPLAY_DELAY_MS, playOnInit: false, stopOnInteraction: true }),
  ])
  const [api, setApi] = useState<CarouselApi>()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [choice, setChoice] = useState<AutoplayChoice>("auto")
  const isMobileViewport = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const allowsMotion = useMediaQuery(ALLOWS_MOTION_QUERY)
  const hasMultiple = articles.length > 1

  const shouldAutoplay =
    isMobileViewport &&
    hasMultiple &&
    (choice === "playing" || (choice === "auto" && allowsMotion))

  const pauseByUser = useCallback(() => setChoice("paused"), [])

  useEffect(() => {
    if (!api) return

    const syncSelected = () => setSelectedIndex(api.selectedScrollSnap())
    // autoplay:play / autoplay:stop は内部状態の更新前に発火するため、
    // isPlaying() を読まずにイベントの種類で状態を決める
    const markPlaying = () => setIsPlaying(true)
    const markStopped = () => setIsPlaying(false)

    syncSelected()
    api
      .on("select", syncSelected)
      .on("reInit", syncSelected)
      .on("pointerDown", pauseByUser)
      .on("autoplay:play", markPlaying)
      .on("autoplay:stop", markStopped)

    return () => {
      api
        .off("select", syncSelected)
        .off("reInit", syncSelected)
        .off("pointerDown", pauseByUser)
        .off("autoplay:play", markPlaying)
        .off("autoplay:stop", markStopped)
    }
  }, [api, pauseByUser])

  useEffect(() => {
    if (!api) return

    // 回転・リサイズの reInit でプラグインが作り直されると再生が止まるため、
    // reInit のたびに「再生すべきか」へ合わせ直す
    const syncAutoplay = () => {
      const autoplay = api.plugins().autoplay
      if (!autoplay) return

      // スナップが1つ以下だとプラグインが未初期化のままで play() が例外になる
      if (shouldAutoplay && api.scrollSnapList().length > 1) {
        autoplay.play()
      } else {
        autoplay.stop()
      }
    }

    syncAutoplay()
    api.on("reInit", syncAutoplay)
    return () => {
      api.off("reInit", syncAutoplay)
    }
  }, [api, shouldAutoplay])

  const toggleAutoplay = useCallback(() => {
    setChoice(isPlaying ? "paused" : "playing")
  }, [isPlaying])

  const showArticle = useCallback(
    (index: number) => {
      pauseByUser()
      api?.scrollTo(index)
    },
    [api, pauseByUser],
  )

  // Carousel 側の矢印キー送りより先に止める(伝播は止めない)
  const handleKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") pauseByUser()
    },
    [pauseByUser],
  )

  return (
    <div onKeyDownCapture={handleKeyDownCapture}>
      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: true }}
        plugins={plugins}
        aria-label="SAFE MAGAZINE の新着記事"
        className="px-4"
      >
        {/* 記事にフォーカスが入ったら(Tab・読み上げ操作)読んでいる途中で動かさない */}
        <CarouselContent className="-ml-3" onFocusCapture={pauseByUser}>
          {articles.map((article, index) => (
            <CarouselItem
              key={article.id}
              className="basis-[85%] pl-3"
              aria-label={`${articles.length}件中 ${index + 1}件目`}
            >
              <SafeMagazineCard article={article} />
            </CarouselItem>
          ))}
        </CarouselContent>

        {hasMultiple && (
          <>
            <p className="sr-only" aria-live={isPlaying ? "off" : "polite"} aria-atomic="true">
              {`${articles.length}件中 ${selectedIndex + 1}件目`}
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center">
                {articles.map((article, index) => {
                  const isCurrent = index === selectedIndex
                  return (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => showArticle(index)}
                      aria-label={`${index + 1}件目の記事を表示`}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${tankenTokens.cls.focus}`}
                    >
                      <span
                        aria-hidden="true"
                        className="block h-2 rounded-full transition-all duration-200 motion-reduce:transition-none"
                        style={{
                          width: isCurrent ? 18 : 8,
                          background: isCurrent ? C.primary : C.inkFaint,
                        }}
                      />
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={toggleAutoplay}
                aria-label={isPlaying ? "自動スライドを止める" : "自動スライドを再生"}
                className={`flex h-9 w-9 items-center justify-center rounded-full border ${tankenTokens.cls.focus}`}
                style={{
                  background: C.card,
                  borderColor: tankenTokens.border.soft,
                  color: C.inkSoft,
                }}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </>
        )}
      </Carousel>
    </div>
  )
}
