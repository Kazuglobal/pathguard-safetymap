"use client"

import { useEffect, useRef } from "react"
import { LP_FEATURE_TOUR } from "@/lib/lp-content"

/** Remotionで制作した機能ツアー動画のセクション */
export function LpFeatureTour() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const video = videoRef.current
    if (!section || !video) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // 自動再生がブロックされた場合はユーザー操作に委ねる
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="bg-[#F3EFE4] py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <p data-reveal className="font-lp-display mb-4 text-center text-sm font-black tracking-[0.2em] text-[#C77E1B]">
          FEATURE TOUR
        </p>
        <h2 data-reveal className="font-lp-display text-center text-3xl font-black text-[#2B2723] md:text-[2.8rem]">
          {LP_FEATURE_TOUR.headline}
        </h2>
        <p data-reveal className="mt-4 text-center text-base text-[#2B2723]/65">
          {LP_FEATURE_TOUR.caption}
        </p>

        <div
          data-reveal
          className="mt-12 -rotate-1 overflow-hidden rounded-[1.8rem] border-[3px] border-[#2B2723] shadow-[12px_12px_0_rgba(43,39,35,0.85)]"
        >
          <video
            ref={videoRef}
            className="aspect-video w-full bg-[#26221E]"
            src={LP_FEATURE_TOUR.src}
            muted
            loop
            playsInline
            controls
            preload="metadata"
            aria-label="PathGuardianの機能ツアー動画(60秒)"
          />
        </div>
      </div>
    </section>
  )
}
