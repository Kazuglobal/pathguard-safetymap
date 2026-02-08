"use client"

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react"
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ImageOff,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * AR画像ギャラリーコンポーネント
 * 登録された複数の画像をカルーセル形式で表示する
 */

type ImageLoadState = "loading" | "loaded" | "error"

const MAX_RETRIES = 3

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
  const [imageStates, setImageStates] = useState<Record<number, ImageLoadState>>(
    {}
  )
  const [retryCountMap, setRetryCountMap] = useState<Record<number, number>>({})
  const previousImagesRef = useRef<string[] | null>(null)

  const hasImages = images.length > 0
  const hasMultipleImages = images.length > 1
  const currentImage = hasImages ? images[currentIndex] : null
  const currentState: ImageLoadState = imageStates[currentIndex] ?? "loading"

  useEffect(() => {
    const previousImages = previousImagesRef.current
    const hasImageListChanged =
      previousImages === null ||
      previousImages.length !== images.length ||
      previousImages.some((image, index) => image !== images[index])

    if (hasImageListChanged) {
      setImageStates({})
      setRetryCountMap({})
      setCurrentIndex(0)
    }

    previousImagesRef.current = images
  }, [images])

  const updateImageState = useCallback(
    (index: number, state: ImageLoadState) => {
      setImageStates((prev) => ({ ...prev, [index]: state }))
    },
    []
  )

  const getImageSrc = useCallback(
    (url: string, index: number): string => {
      const retries = retryCountMap[index] ?? 0
      if (retries === 0) return url
      const separator = url.includes("?") ? "&" : "?"
      return `${url}${separator}_retry=${retries}`
    },
    [retryCountMap]
  )

  const handleRetry = useCallback(() => {
    const currentRetries = retryCountMap[currentIndex] ?? 0
    if (currentRetries >= MAX_RETRIES) return
    setRetryCountMap((prev) => ({
      ...prev,
      [currentIndex]: currentRetries + 1,
    }))
    updateImageState(currentIndex, "loading")
  }, [currentIndex, retryCountMap, updateImageState])

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

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!hasMultipleImages) return

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goToPrev()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        goToNext()
      }
    },
    [hasMultipleImages, goToPrev, goToNext]
  )

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
      role="region"
      aria-roledescription="画像カルーセル"
      aria-label={alt}
      tabIndex={hasMultipleImages ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {/* 画像 */}
      <img
        src={getImageSrc(currentImage!, currentIndex)}
        alt={alt}
        className={cn(
          "w-full h-full object-cover cursor-pointer",
          currentState === "loading" && "opacity-0"
        )}
        onLoad={() => updateImageState(currentIndex, "loaded")}
        onError={() => updateImageState(currentIndex, "error")}
        onClick={handleImageClick}
      />

      {/* ローディングスケルトン */}
      {currentState === "loading" && (
        <div data-testid="ar-image-skeleton" className="absolute inset-0" role="status" aria-label="画像を読み込み中">
          <Skeleton className="w-full h-full rounded-none" />
        </div>
      )}

      {/* エラーフォールバック */}
      {currentState === "error" && (
        <div
          data-testid="ar-image-error"
          className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex flex-col items-center justify-center gap-2"
          role="alert"
        >
          <ImageOff className="h-10 w-10 text-gray-400" aria-hidden="true" />
          <p className="text-xs text-gray-500">画像を読み込めませんでした</p>
          {(retryCountMap[currentIndex] ?? 0) < MAX_RETRIES && (
            <button
              data-testid="ar-image-retry-button"
              onClick={(e) => {
                e.stopPropagation()
                handleRetry()
              }}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              再読み込み
            </button>
          )}
        </div>
      )}

      {/* 画像カウンター */}
      {hasMultipleImages && (
        <div
          data-testid="ar-image-counter"
          className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full"
          role="status"
          aria-live="polite"
          aria-atomic="true"
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
              aria-label={`画像${index + 1}を表示`}
              aria-current={index === currentIndex ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
