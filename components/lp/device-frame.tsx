"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface PhoneFrameProps {
  src: string
  alt: string
  className?: string
  priority?: boolean
}

/** スマートフォン風フレームに実アプリのスクリーンショットを収める */
export function PhoneFrame({ src, alt, className, priority = false }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative aspect-[390/844] w-full overflow-hidden rounded-[2.6rem] border-[10px] border-slate-900 bg-slate-900 shadow-[0_40px_80px_-24px_rgba(15,26,43,0.45)]",
        className,
      )}
    >
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 60vw, 320px"
        className="rounded-[2rem] object-cover object-top"
      />
    </div>
  )
}

interface BrowserFrameProps {
  src: string
  alt: string
  className?: string
}

/** デスクトップブラウザ風フレーム */
export function BrowserFrame({ src, alt, className }: BrowserFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_48px_96px_-32px_rgba(15,26,43,0.4)]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="ml-3 hidden flex-1 rounded-md bg-white px-3 py-1 text-[11px] text-slate-400 sm:block">
          pathguardian.app
        </div>
      </div>
      <div className="relative aspect-[1600/1000]">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 90vw, 960px"
          className="object-cover object-top"
        />
      </div>
    </div>
  )
}
