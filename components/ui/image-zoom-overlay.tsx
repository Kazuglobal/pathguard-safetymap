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
 * Uses React Portal to render at document.body level, avoiding stacking context issues.
 * Supports pinch-to-zoom on mobile and scroll-to-zoom on desktop.
 */
export function ImageZoomOverlay({ src, alt, isOpen, onClose }: ImageZoomOverlayProps) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const lastPinchDistRef = useRef<number | null>(null)
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Ensure portal only renders on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset zoom state when overlay opens/closes
  useEffect(() => {
    if (isOpen) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
  }, [isOpen])

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const getPinchDist = (touches: React.TouchList) => {
    const [t1, t2] = [touches[0], touches[1]]
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
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
      e.stopPropagation()
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

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    lastPinchDistRef.current = null
    lastTouchRef.current = null
    if (scale <= 1) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
  }, [scale])

  // Desktop: scroll to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale((prev) => {
      const next = prev - e.deltaY * 0.002
      return Math.min(Math.max(next, 1), 5)
    })
  }, [])

  // Double-tap to toggle zoom
  const lastTapRef = useRef(0)
  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
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

  if (!isOpen || !mounted) return null

  const overlay = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90"
      style={{ touchAction: "none" }}
      onClick={(e) => {
        if (e.target === containerRef.current) onClose()
      }}
      onContextMenu={(e) => e.preventDefault()}
      role="dialog"
      aria-modal="true"
      aria-label="画像拡大表示"
    >
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute top-4 right-4 z-[100000] rounded-full bg-black/60 p-2.5 text-white hover:bg-black/80 transition-colors"
        aria-label="閉じる"
      >
        <X className="h-7 w-7" />
      </button>

      {/* Zoom hint */}
      {scale === 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100000] flex items-center gap-1.5 rounded-full bg-black/60 px-4 py-2 text-white text-sm pointer-events-none">
          <ZoomIn className="h-4 w-4" />
          ピンチ・ダブルタップで拡大
        </div>
      )}

      {/* Image container */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden select-none"
        style={{ touchAction: "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onClick={handleDoubleTap}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn(
            "max-w-[95vw] max-h-[90vh] object-contain transition-transform",
            scale === 1 ? "duration-200" : "duration-0"
          )}
          style={{
            transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
            touchAction: "none",
          }}
        />
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
