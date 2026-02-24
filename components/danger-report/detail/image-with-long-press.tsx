"use client"

import Image from "next/image"
import { useLongPress } from "@/hooks/use-long-press"

interface ImageWithLongPressProps {
  src: string
  alt: string
  onZoom: () => void
  onError: () => void
  /** Use Next.js Image fill mode (for fixed-height containers) */
  fill?: boolean
  /** Width for non-fill mode */
  width?: number
  /** Height for non-fill mode */
  height?: number
  className?: string
}

/**
 * Unified long-press-to-zoom image component.
 * Replaces the duplicate OriginalImageWithLongPress + ProcessedImageWithLongPress.
 */
export function ImageWithLongPress({
  src,
  alt,
  onZoom,
  onError,
  fill = false,
  width = 800,
  height = 600,
  className,
}: ImageWithLongPressProps) {
  const handlers = useLongPress({ delay: 400, onLongPress: onZoom })

  return (
    <div
      className={className ?? (fill ? "relative w-full h-full" : "relative w-full")}
      {...handlers}
      style={{ WebkitTouchCallout: "none", userSelect: "none", touchAction: "manipulation" }}
    >
      {fill ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          draggable={false}
          onError={onError}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="w-full h-auto max-h-80 object-contain rounded"
          draggable={false}
          onError={onError}
        />
      )}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-white text-[10px] pointer-events-none">
        長押しで拡大
      </div>
    </div>
  )
}
