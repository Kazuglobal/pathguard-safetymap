"use client"

import { useState, useCallback } from "react"
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * AR画像ギャラリーコンポーネント
 * 登録された複数の画像をカルーセル形式で表示する
 */

interface ARImageGalleryProps {
  images: string[]
  alt: string
  className?: string
  onChange?: (index: number, imageUrl: string) => void
  onClick?: (index: number, imageUrl: string) => void
}

export function ARImageGallery({
  images,
  alt,
  className,
  onChange,
  onClick,
}: ARImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const hasImages = images.length > 0
  const hasMultipleImages = images.length > 1
  const currentImage = hasImages ? images[currentIndex] : null

  const goToNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % images.length
    setCurrentIndex(nextIndex)
    onChange?.(nextIndex, images[nextIndex])
  }, [currentIndex, images, onChange])

  const goToPrev = useCallback(() => {
    const prevIndex = (currentIndex - 1 + images.length) % images.length
    setCurrentIndex(prevIndex)
    onChange?.(prevIndex, images[prevIndex])
  }, [currentIndex, images, onChange])

  const goToIndex = useCallback(
    (index: number) => {
      setCurrentIndex(index)
      onChange?.(index, images[index])
    },
    [images, onChange]
  )

  const handleImageClick = useCallback(() => {
    if (currentImage) {
      onClick?.(currentIndex, currentImage)
    }
  }, [currentIndex, currentImage, onClick])

  // 画像がない場合はプレースホルダーを表示
  if (!hasImages) {
    return (
      <div
        data-testid="ar-image-gallery"
        className={cn(
          "relative h-48 w-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center",
          className
        )}
      >
        <div data-testid="ar-image-placeholder">
          <AlertTriangle className="h-16 w-16 text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="ar-image-gallery"
      className={cn("relative h-48 w-full overflow-hidden", className)}
    >
      {/* 画像 */}
      <img
        src={currentImage!}
        alt={alt}
        className="w-full h-full object-cover cursor-pointer"
        onClick={handleImageClick}
      />

      {/* 画像カウンター */}
      {hasMultipleImages && (
        <div
          data-testid="ar-image-counter"
          className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full"
        >
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* ナビゲーションボタン */}
      {hasMultipleImages && (
        <>
          <button
            data-testid="ar-image-prev-button"
            aria-label="前の画像"
            onClick={(e) => {
              e.stopPropagation()
              goToPrev()
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            data-testid="ar-image-next-button"
            aria-label="次の画像"
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* インジケーター */}
      {hasMultipleImages && (
        <div
          data-testid="ar-image-indicators"
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5"
        >
          {images.map((_, index) => (
            <button
              key={index}
              data-testid="ar-image-indicator"
              data-active={index === currentIndex ? "true" : "false"}
              onClick={(e) => {
                e.stopPropagation()
                goToIndex(index)
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index === currentIndex
                  ? "bg-white"
                  : "bg-white/50 hover:bg-white/75"
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
