"use client"

import { useEffect, useRef } from "react"

interface LpLottieProps {
  /** public/ 配下の Lottie JSON(tools/feature-video/scripts/make-lottie.mjs が作る) */
  src: string
  className?: string
}

/**
 * Lottie のステッカーを、画面に入ったときに1回だけ再生して最後のフレームで止める。
 * 動きを減らす設定では再生せず、最後のフレーム(完成形)を出す。読み込みに失敗しても何も出さない(飾りのため)。
 */
export function LpLottie({ src, className }: LpLottieProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    let disposed = false
    let animation: { play: () => void; goToAndStop: (v: number, f: boolean) => void; destroy: () => void; totalFrames: number } | null = null
    let observer: IntersectionObserver | null = null

    const start = async () => {
      try {
        const [{ default: lottie }, response] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch(src),
        ])
        if (!response.ok) return
        const animationData: unknown = await response.json()
        if (disposed) return
        animation = lottie.loadAnimation({ container, renderer: "svg", loop: false, autoplay: false, animationData })
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (reduced) {
          animation.goToAndStop(animation.totalFrames - 1, true)
          return
        }
        observer = new IntersectionObserver(
          ([entry]) => {
            if (!entry?.isIntersecting) return
            animation?.play()
            observer?.disconnect()
          },
          { threshold: 0.5 },
        )
        observer.observe(container)
      } catch {
        // 飾りなので、読めなければ出さない
      }
    }
    void start()

    return () => {
      disposed = true
      observer?.disconnect()
      animation?.destroy()
    }
  }, [src])

  return <div ref={ref} className={className} aria-hidden="true" />
}
