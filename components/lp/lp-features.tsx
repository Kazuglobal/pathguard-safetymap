"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { MapPinned, MessageSquareWarning, BellRing, Camera, Newspaper, FileText } from "lucide-react"
import { LP_FEATURES } from "@/lib/lp-content"

const FEATURE_ICONS = {
  "danger-map": MapPinned,
  report: MessageSquareWarning,
  alerts: BellRing,
  hunter: Camera,
  news: Newspaper,
  "pdf-report": FileText,
} as const

export function LpFeatures() {
  const [showcase, ...rest] = LP_FEATURES

  return (
    <section id="features" className="bg-[#F3EFE4] py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p data-reveal className="font-lp-display mb-4 text-sm font-black tracking-[0.2em] text-[#C77E1B]">
          FEATURES
        </p>
        <h2
          data-reveal
          className="font-lp-display max-w-2xl text-3xl font-black leading-snug text-[#2B2723] md:text-[2.8rem] md:leading-[1.3]"
        >
          家族の見守りに必要なものを、
          <br />
          ぜんぶひとつに。
        </h2>

        {/* 主役機能: 危険マップ(大きく見せる) */}
        <div className="mt-16 grid items-center gap-10 md:grid-cols-2">
          <div
            data-reveal
            className="-rotate-1 overflow-hidden rounded-[1.8rem] border-[3px] border-[#2B2723] shadow-[10px_10px_0_rgba(43,39,35,0.85)]"
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={showcase.image ?? "/images/lp/feature-map-watch.png"}
                alt="通学路の危険をデータで見える化するイメージ"
                fill
                sizes="(max-width: 768px) 90vw, 560px"
                className="object-cover"
              />
            </div>
          </div>
          <div>
            <p data-reveal className="text-sm font-semibold text-[#2FA36B]">
              {showcase.kicker}
            </p>
            <h3 data-reveal className="font-lp-display mt-3 text-2xl font-black text-[#2B2723] md:text-3xl">
              {showcase.title}
            </h3>
            <p data-reveal className="mt-5 text-base leading-loose text-[#2B2723]/70">
              {showcase.description}
            </p>
          </div>
        </div>

        {/* 残り5機能のカードグリッド */}
        <div data-reveal-group className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((feature) => {
            const Icon = FEATURE_ICONS[feature.key as keyof typeof FEATURE_ICONS] ?? MapPinned
            return (
              <motion.article
                key={feature.key}
                whileHover={{ y: -8, rotate: -1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-[1.6rem] border-2 border-[#2B2723] bg-[#FFFDF8] p-7 shadow-[7px_7px_0_rgba(43,39,35,0.85)]"
              >
                <div className="flex h-12 w-12 -rotate-3 items-center justify-center rounded-2xl border-2 border-[#2B2723] bg-[#E8A33D]">
                  <Icon className="h-6 w-6 text-[#2B2723]" />
                </div>
                <p className="mt-5 text-xs font-bold tracking-wide text-[#2FA36B]">{feature.kicker}</p>
                <h3 className="font-lp-display mt-2 text-lg font-black text-[#2B2723]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#2B2723]/65">{feature.description}</p>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
