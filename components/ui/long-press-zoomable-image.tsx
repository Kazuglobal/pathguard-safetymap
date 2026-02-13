"use client"

import { useState, useCallback } from "react"
import { useLongPress } from "@/hooks/use-long-press"
import { ImageZoomOverlay } from "@/components/ui/image-zoom-overlay"

interface LongPressZoomableImageProps {
  /** Image source URL */
  src: string
  /** Alt text for accessibility */
  alt: string
  /** Additional class names for the image */
  className?: string
  /** Additional class names for the wrapper div */
  wrapperClassName?: string
  /** Called on normal click/tap (not long press) */
  onClick?: () => void
  /** Long press delay in ms (default: 400) */
  delay?: number
  /** Whether to use <img> or Next.js Image component style */
  children?: React.ReactNode
}

/**
 * Wraps an image (or children) with long-press-to-zoom functionality.
 * On long press, opens a fullscreen overlay displaying the image.
 * Normal clicks still pass through to the onClick handler.
 */
export function LongPressZoomableImage({
  src,
  alt,
  className,
  wrapperClassName,
  onClick,
  delay = 400,
  children,
}: LongPressZoomableImageProps) {
  const [isZoomOpen, setIsZoomOpen] = useState(false)

  const handleLongPress = useCallback(() => {
    setIsZoomOpen(true)
  }, [])

  const longPressHandlers = useLongPress({
    delay,
    onLongPress: handleLongPress,
    onClick,
  })

  return (
    <>
      <div
        className={wrapperClassName}
        {...longPressHandlers}
        style={{
          cursor: "pointer",
          WebkitTouchCallout: "none",
          userSelect: "none",
          touchAction: "manipulation",
        }}
      >
        {children || (
          <img
            src={src}
            alt={alt}
            className={className}
            draggable={false}
          />
        )}
      </div>
      <ImageZoomOverlay
        src={src}
        alt={alt}
        isOpen={isZoomOpen}
        onClose={() => setIsZoomOpen(false)}
      />
    </>
  )
}
