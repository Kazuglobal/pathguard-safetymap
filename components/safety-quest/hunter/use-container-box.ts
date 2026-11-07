"use client"

// 枠(写真の入れもの)の実サイズを追う。object-contain のレターボックス補正に使う。
import { useEffect, useState, type RefObject } from "react"

import type { Size } from "@/lib/hunter/image-geometry"

export function useContainerBox(ref: RefObject<HTMLElement | null>): Size | null {
  const [box, setBox] = useState<Size | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setBox({ w: rect.width, h: rect.height })
    }
    update()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}
