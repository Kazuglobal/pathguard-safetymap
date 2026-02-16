"use client"

import { useState, useCallback, useMemo } from "react"
import { ImageIcon, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel"
import type { DangerReport } from "@/lib/types"
import { addCacheBuster } from "./report-detail-utils"
import { ImageWithLongPress } from "./image-with-long-press"

interface ShowImageOptions {
  reportId?: string
  reportTitle?: string | null
  type?: "original" | "processed"
  index?: number
}

interface ReportImageCarouselProps {
  report: DangerReport
  onShowImage?: (url: string, coords?: [number, number], options?: ShowImageOptions) => void
  onZoomImage: (url: string) => void
}

interface SlideInfo {
  url: string
  type: "original" | "processed"
  label: string
  index: number
}

/**
 * Unified image carousel replacing the old Tabs-based original/processed split.
 * All images (original + processed) are shown in a single swipeable carousel.
 */
export function ReportImageCarousel({
  report,
  onShowImage,
  onZoomImage,
}: ReportImageCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  const processedUrls = report.processed_image_urls ?? []
  const cacheToken = useMemo(
    () => Date.now(),
    [report.id, report.image_url, processedUrls.join("|")],
  )

  // Build unified slide list
  const slides: SlideInfo[] = []
  if (report.image_url) {
    slides.push({
      url: report.image_url,
      type: "original",
      label: "元画像",
      index: 0,
    })
  }
  processedUrls.forEach((url, idx) => {
    slides.push({
      url,
      type: "processed",
      label: processedUrls.length > 1 ? `加工画像 ${idx + 1}/${processedUrls.length}` : "加工画像",
      index: idx,
    })
  })

  const handleApiChange = useCallback((newApi: CarouselApi) => {
    setApi(newApi)
    if (!newApi) return
    setCurrentSlide(newApi.selectedScrollSnap())
    newApi.on("select", () => {
      setCurrentSlide(newApi.selectedScrollSnap())
    })
  }, [])

  const markImageError = useCallback((slideIdx: number) => {
    setImageErrors((prev) => new Set(prev).add(slideIdx))
  }, [])

  // No images at all
  if (slides.length === 0) {
    return (
      <div className="px-4 md:px-6">
        <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <ImageIcon className="h-10 w-10 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">画像はありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Carousel */}
      <div className="px-4 md:px-6">
        <Carousel
          className="w-full"
          setApi={handleApiChange}
          opts={{ loop: slides.length > 1 }}
        >
          <CarouselContent>
            {slides.map((slide, slideIdx) => {
              const cachedUrl = addCacheBuster(slide.url, cacheToken) ?? slide.url

              return (
                <CarouselItem key={`${slide.type}-${slide.index}`}>
                  <div className="relative bg-gray-50 rounded-lg overflow-hidden">
                    {imageErrors.has(slideIdx) ? (
                      <div className="flex flex-col items-center justify-center h-64 md:h-80 lg:h-96">
                        <ImageIcon className="h-10 w-10 text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">読み込みに失敗しました</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() =>
                            setImageErrors((prev) => {
                              const next = new Set(prev)
                              next.delete(slideIdx)
                              return next
                            })
                          }
                        >
                          再試行
                        </Button>
                      </div>
                    ) : (
                      <div className="h-64 md:h-80 lg:h-96">
                        <ImageWithLongPress
                          src={cachedUrl}
                          alt={slide.label}
                          fill
                          onZoom={() => onZoomImage(cachedUrl)}
                          onError={() => markImageError(slideIdx)}
                          className="relative w-full h-full"
                        />
                      </div>
                    )}

                    {/* Slide type label overlay */}
                    <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-white text-xs font-medium pointer-events-none">
                      {slide.label}
                    </div>

                    {/* Show on map button for processed images */}
                    {slide.type === "processed" && onShowImage && !imageErrors.has(slideIdx) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-2 right-2 h-7 gap-1 bg-white/90 hover:bg-white shadow-sm"
                        onClick={() =>
                          onShowImage(slide.url, [report.longitude, report.latitude], {
                            reportId: report.id,
                            reportTitle: report.title ?? null,
                            type: "processed",
                            index: slide.index,
                          })
                        }
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="text-xs">地図で表示</span>
                      </Button>
                    )}
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>

          {/* Navigation arrows - hidden on mobile, shown on md+ */}
          {slides.length > 1 && (
            <>
              <CarouselPrevious className="hidden md:inline-flex -left-4 h-8 w-8" />
              <CarouselNext className="hidden md:inline-flex -right-4 h-8 w-8" />
            </>
          )}
        </Carousel>

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentSlide
                    ? "w-4 bg-gray-800"
                    : "w-1.5 bg-gray-300 hover:bg-gray-400"
                }`}
                onClick={() => api?.scrollTo(idx)}
                aria-label={`スライド ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* AI disclaimer for processed images */}
      {processedUrls.length > 0 && (
        <p className="px-4 md:px-6 text-xs text-gray-500">
          注: 加工画像は生成AIによって作成されており、実際の状況と異なる場合があります。
        </p>
      )}
    </div>
  )
}
