"use client"

import { useCallback, useRef } from "react"

interface UseLongPressOptions {
  /** Long press duration in ms (default: 400) */
  delay?: number
  /** Called when long press is triggered */
  onLongPress: () => void
  /** Called on normal click/tap (optional) */
  onClick?: () => void
}

/**
 * Hook to detect long press (touch hold / mouse hold) on an element.
 * Returns event handlers to spread onto the target element.
 *
 * Key behaviors:
 * - Always prevents context menu to avoid interfering with long press
 * - Cancels if finger moves more than 10px (scroll detection)
 * - Uses touch-action: manipulation via style to avoid browser delays
 * - Vibrates on long press trigger (if supported)
 */
export function useLongPress({
  delay = 400,
  onLongPress,
  onClick,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const isTouchRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const triggerLongPress = useCallback(() => {
    isLongPressRef.current = true
    // Haptic feedback on supported devices
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(30)
    }
    onLongPress()
  }, [onLongPress])

  const start = useCallback(
    (x: number, y: number) => {
      isLongPressRef.current = false
      startPosRef.current = { x, y }
      clear()
      timerRef.current = setTimeout(triggerLongPress, delay)
    },
    [delay, triggerLongPress, clear]
  )

  const cancel = useCallback(
    (shouldClick?: boolean) => {
      clear()
      if (shouldClick && !isLongPressRef.current && onClick) {
        onClick()
      }
      isLongPressRef.current = false
      startPosRef.current = null
    },
    [clear, onClick]
  )

  const handleMove = useCallback(
    (x: number, y: number) => {
      if (!startPosRef.current) return
      const dx = Math.abs(x - startPosRef.current.x)
      const dy = Math.abs(y - startPosRef.current.y)
      // Cancel if finger/mouse moved more than 10px (it's a scroll/drag)
      if (dx > 10 || dy > 10) {
        clear()
        startPosRef.current = null
      }
    },
    [clear]
  )

  // Touch events
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isTouchRef.current = true
      const touch = e.touches[0]
      start(touch.clientX, touch.clientY)
    },
    [start]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      handleMove(touch.clientX, touch.clientY)
    },
    [handleMove]
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (isLongPressRef.current) {
        // Prevent subsequent click event after long press
        e.preventDefault()
      }
      cancel(!isLongPressRef.current)
    },
    [cancel]
  )

  // Mouse events (for desktop) — skipped on touch devices
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Skip mouse events if this interaction started with touch
      if (isTouchRef.current) return
      if (e.button !== 0) return
      start(e.clientX, e.clientY)
    },
    [start]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isTouchRef.current) return
      handleMove(e.clientX, e.clientY)
    },
    [handleMove]
  )

  const onMouseUp = useCallback(() => {
    if (isTouchRef.current) {
      isTouchRef.current = false
      return
    }
    cancel(!isLongPressRef.current)
  }, [cancel])

  const onMouseLeave = useCallback(() => {
    if (isTouchRef.current) return
    cancel(false)
  }, [cancel])

  // Always prevent context menu on long-press targets
  const onContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
  }, [])

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onContextMenu,
  }
}
