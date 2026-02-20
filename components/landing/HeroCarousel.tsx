"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"

interface CarouselSlide {
  id: string
  imageUrl: string
  title: string
  subtitle?: string
  badge?: string
}

const slides: CarouselSlide[] = [
  {
    id: "1",
    imageUrl: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&h=450&fit=crop",
    title: "全国一斉！通学路点検キャンペーン",
    subtitle: "みんなの報告で安全な街づくり",
    badge: "開催中",
  },
  {
    id: "2",
    imageUrl: "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=800&h=450&fit=crop",
    title: "新機能：不審者情報のリアルタイム通知",
    subtitle: "地域の安全を即座にお届け",
    badge: "NEW",
  },
  {
    id: "3",
    imageUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&h=450&fit=crop",
    title: "見守りポイント2倍キャンペーン",
    subtitle: "12月31日まで",
    badge: "キャンペーン",
  },
]

export function HeroCarousel() {
  const autoplay = React.useMemo(
    () => Autoplay({ delay: 5000, stopOnInteraction: false }) as any,
    []
  )
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
    [autoplay]
  )
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  React.useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap())
    }

    emblaApi.on("select", onSelect)
    onSelect()

    return () => {
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi])

  const scrollTo = React.useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index)
    },
    [emblaApi]
  )

  return (
    <div className="relative max-w-5xl mx-auto">
      {/* カルーセル */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="flex-[0_0_100%] min-w-0 px-4 md:flex-[0_0_80%] lg:flex-[0_0_70%]"
            >
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden shadow-lg md:rounded-2xl">
                <Image
                  src={slide.imageUrl}
                  alt={slide.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority={slide.id === "1"}
                />
                {/* オーバーレイ */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                
                {/* バッジ */}
                {slide.badge && (
                  <span className="absolute top-3 left-3 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                    {slide.badge}
                  </span>
                )}

                {/* テキスト */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                  <h3 className="text-white text-lg md:text-2xl font-bold leading-tight mb-1">
                    {slide.title}
                  </h3>
                  {slide.subtitle && (
                    <p className="text-white/80 text-sm md:text-base">
                      {slide.subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* インジケーター */}
      <div className="flex justify-center gap-1.5 mt-4">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => scrollTo(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              selectedIndex === index
                ? "w-6 bg-red-600"
                : "bg-gray-300 hover:bg-gray-400"
            )}
            aria-label={`スライド ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
