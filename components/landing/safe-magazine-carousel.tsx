"use client"

import { useCallback, useEffect, useState } from "react"
import Autoplay from "embla-carousel-autoplay"
import { useReducedMotion } from "framer-motion"
import { Pause, Play } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import type { LandingSafeMagazinePreviewItem } from "@/lib/landing-safe-magazine-preview"
import { tankenTokens } from "@/lib/design/tanken"
import { SafeMagazineCard } from "./safe-magazine-card"

const C = tankenTokens.color

/** 次の記事へ送るまでの時間 */
const AUTOPLAY_DELAY_MS = 5000

interface SafeMagazineCarouselProps {
  articles: LandingSafeMagazinePreviewItem[]
}

/**
 * スマホ向けの PathGuard Press 自動スライド。
 * 動くコンテンツには止める手段が要る(WCAG 2.2.2)ため、
 * 一時停止ボタンを常に出し、スワイプ・丸ボタン・キーボードで触れたら止める。
 * 視差効果を減らす設定の端末では最初から自動では動かさない。
 */
export function SafeMagazineCarousel({ articles }: SafeMagazineCarouselProps) {
  // 再生開始は reduced-motion の判定後に行うので playOnInit は切る
  const [plugins] = useState(() => [
    Autoplay({ delay: AUTOPLAY_DELAY_MS, playOnInit: false, stopOnInteraction: true }),
  ])
  const [api, setApi] = useState<CarouselApi>()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const prefersReducedMotion = useReducedMotion()

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
      .on("autoplay:play", markPlaying)
      .on("autoplay:stop", markStopped)

    return () => {
      api
        .off("select", syncSelected)
        .off("reInit", syncSelected)
        .off("autoplay:play", markPlaying)
        .off("autoplay:stop", markStopped)
    }
  }, [api])

  useEffect(() => {
    const autoplay = api?.plugins().autoplay
    if (!autoplay) return

    if (prefersReducedMotion === false) {
      autoplay.play()
    } else {
      autoplay.stop()
    }
  }, [api, prefersReducedMotion])

  const toggleAutoplay = useCallback(() => {
    const autoplay = api?.plugins().autoplay
    if (!autoplay) return

    if (autoplay.isPlaying()) {
      autoplay.stop()
    } else {
      autoplay.play()
    }
  }, [api])

  const showArticle = useCallback(
    (index: number) => {
      api?.plugins().autoplay?.stop()
      api?.scrollTo(index)
    },
    [api],
  )

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: "start", loop: true }}
      plugins={plugins}
      aria-label="PathGuard Press の新着記事"
      className="px-4"
    >
      <CarouselContent className="-ml-3" aria-live={isPlaying ? "off" : "polite"}>
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
    </Carousel>
  )
}
