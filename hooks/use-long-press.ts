"use client"

import { useCallback, useRef } from "react"

interface UseLongPressOptions {
  /** Long press duration in ms (default: 500) */
  delay?: number
  /** Called when long press is triggered */
  onLongPress: () => void
  /** Called on normal click/tap (optional) */
  onClick?: () => void
}

/**
 * Hook to detect long press (touch hold / mouse hold) on an element.
 * Returns event handlers to spread onto the target element.
 */
export function useLongPress({
  delay = 500,
  onLongPress,
  onClick,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(
    (x: number, y: number) => {
      isLongPressRef.current = false
      startPosRef.current = { x, y }
      clear()
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true
        onLongPress()
      }, delay)
    },
    [delay, onLongPress, clear]
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
      // Cancel if finger/mouse moved more than 10px (it's a scroll/drag, not a hold)
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
        // Prevent click after long press
        e.preventDefault()
      }
      cancel(!isLongPressRef.current)
    },
    [cancel]
  )

  // Mouse events (for desktop)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left click
      start(e.clientX, e.clientY)
    },
    [start]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY)
    },
    [handleMove]
  )

  const onMouseUp = useCallback(() => {
    cancel(!isLongPressRef.current)
  }, [cancel])

  const onMouseLeave = useCallback(() => {
    cancel(false)
  }, [cancel])

  // Prevent context menu on long press (mobile)
  const onContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault()
    }
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
