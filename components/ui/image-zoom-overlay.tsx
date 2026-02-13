"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageZoomOverlayProps {
  src: string
  alt: string
  isOpen: boolean
  onClose: () => void
}

/**
 * Fullscreen overlay for zoomed image display.
 * Creates its own portal container and uses MutationObserver to prevent
 * Radix Dialog/Sheet from marking it as inert.
 */
export function ImageZoomOverlay({ src, alt, isOpen, onClose }: ImageZoomOverlayProps) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const portalRef = useRef<HTMLDivElement | null>(null)
  const lastPinchDistRef = useRef<number | null>(null)
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null)

  // Create a dedicated portal container on mount
  useEffect(() => {
    const el = document.createElement("div")
    el.setAttribute("data-image-zoom-portal", "")
    document.body.appendChild(el)
    portalRef.current = el
    return () => {
      document.body.removeChild(el)
      portalRef.current = null
    }
  }, [])

  // Prevent Radix from making our portal inert
  useEffect(() => {
    const el = portalRef.current
    if (!isOpen || !el) return

    const keepAlive = () => {
      el.removeAttribute("inert")
      el.removeAttribute("aria-hidden")
      // Also remove as a property (some frameworks set it as a property)
      ;(el as any).inert = false
    }

    // Initial cleanup
    keepAlive()

    // Watch for Radix re-applying inert/aria-hidden
    const observer = new MutationObserver(keepAlive)
    observer.observe(el, {
      attributes: true,
      attributeFilter: ["inert", "aria-hidden"],
    })

    return () => observer.disconnect()
  }, [isOpen])

  // Reset zoom state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
  }, [isOpen])

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  const getPinchDist = (touches: React.TouchList) => {
    const [t1, t2] = [touches[0], touches[1]]
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastPinchDistRef.current = getPinchDist(e.touches)
      lastTouchRef.current = null
    } else if (e.touches.length === 1 && scale > 1) {
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }
  }, [scale])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
        const dist = getPinchDist(e.touches)
        const delta = dist / lastPinchDistRef.current
        setScale((prev) => Math.min(Math.max(prev * delta, 1), 5))
        lastPinchDistRef.current = dist
      } else if (e.touches.length === 1 && lastTouchRef.current && scale > 1) {
        const dx = e.touches[0].clientX - lastTouchRef.current.x
        const dy = e.touches[0].clientY - lastTouchRef.current.y
        setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
        lastTouchRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
      }
    },
    [scale]
  )

  const handleTouchEnd = useCallback(() => {
    lastPinchDistRef.current = null
    lastTouchRef.current = null
    if (scale <= 1) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
  }, [scale])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale((prev) => {
      const next = prev - e.deltaY * 0.002
      return Math.min(Math.max(next, 1), 5)
    })
  }, [])

  // Double-tap to toggle zoom
  const lastTapRef = useRef(0)
  const handleTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      if (scale > 1) {
        setScale(1)
        setTranslate({ x: 0, y: 0 })
      } else {
        setScale(2.5)
      }
    }
    lastTapRef.current = now
  }, [scale])

  // Close handler for backdrop tap
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only close when tapping the backdrop (not the image)
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!isOpen || !portalRef.current) return null

  const overlay = (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ zIndex: 2147483647, touchAction: "none" }}
      onContextMenu={(e) => e.preventDefault()}
      role="dialog"
      aria-modal="true"
      aria-label="画像拡大表示"
    >
      {/* Backdrop - tapping closes */}
      <div
        className="absolute inset-0 bg-black/90"
        onClick={onClose}
        onTouchEnd={(e) => {
          // Only close if touch ended on the backdrop itself
          if (e.target === e.currentTarget) {
            onClose()
          }
        }}
      />

      {/* Close button - rendered above everything with pointer-events */}
      <button
        type="button"
        onClick={onClose}
        onTouchEnd={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
        className="absolute top-4 right-4 rounded-full bg-white/20 backdrop-blur-sm p-3 text-white active:bg-white/40 transition-colors"
        style={{ zIndex: 2147483647, pointerEvents: "auto" }}
        aria-label="閉じる"
      >
        <X className="h-7 w-7" />
      </button>

      {/* Zoom hint */}
      {scale === 1 && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/60 px-4 py-2 text-white text-sm pointer-events-none"
          style={{ zIndex: 2147483647 }}
        >
          <ZoomIn className="h-4 w-4" />
          ピンチ・ダブルタップで拡大
        </div>
      )}

      {/* Image area - handles zoom gestures */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden select-none"
        style={{ touchAction: "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onClick={(e) => {
          // Double-tap zoom or close on single tap on non-image area
          handleTap()
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn(
            "max-w-[95vw] max-h-[85vh] object-contain transition-transform",
            scale === 1 ? "duration-200" : "duration-0"
          )}
          style={{
            transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
            touchAction: "none",
            pointerEvents: "auto",
          }}
        />
      </div>
    </div>
  )

  return createPortal(overlay, portalRef.current)
}
