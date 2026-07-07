"use client"

import { useEffect, useRef } from "react"
import { LP_VIDEO } from "@/lib/lp-content"

export function LpVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  // ビューポートに入ったらミュート自動再生、離れたら停止
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
    <section id="video" ref={sectionRef} className="bg-[#26221E] py-28 md:py-36">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <p data-reveal className="mb-4 text-center text-sm font-semibold tracking-[0.2em] text-[#E8A33D]">
          MOVIE
        </p>
        <h2
          data-reveal
          className="font-lp-display text-center text-3xl font-black text-white md:text-[2.6rem]"
        >
          {LP_VIDEO.headline}
        </h2>
        <p data-reveal className="mt-4 text-center text-base text-white/65">
          {LP_VIDEO.caption}
        </p>

        <div
          data-reveal
          className="mt-12 rotate-1 overflow-hidden rounded-[1.8rem] border-[3px] border-[#E8A33D] shadow-[12px_12px_0_rgba(0,0,0,0.5)]"
        >
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black"
            src={LP_VIDEO.src}
            poster={LP_VIDEO.poster}
            muted
            loop
            playsInline
            controls
            preload="metadata"
            aria-label="PathGuardianの30秒紹介動画"
          >
            <track kind="captions" srcLang="ja" label="日本語字幕" src="/videos/lp/pathguardian-intro.ja.vtt" />
          </video>
        </div>
      </div>
    </section>
  )
}
