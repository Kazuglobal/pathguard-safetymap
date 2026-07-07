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
    <section id="features" className="bg-[#FBF9F5] py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p data-reveal className="mb-4 text-sm font-semibold tracking-[0.2em] text-[#C77E1B]">
          FEATURES
        </p>
        <h2
          data-reveal
          className="font-lp-display max-w-2xl text-3xl font-semibold leading-snug text-[#16233A] md:text-[2.6rem] md:leading-[1.35]"
        >
          家族の見守りに必要なものを、
          <br />
          ぜんぶひとつに。
        </h2>

        {/* 主役機能: 危険マップ(大きく見せる) */}
        <div className="mt-16 grid items-center gap-10 md:grid-cols-2">
          <div data-reveal className="overflow-hidden rounded-3xl shadow-[0_40px_80px_-32px_rgba(22,35,58,0.35)]">
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
            <h3 data-reveal className="font-lp-display mt-3 text-2xl font-semibold text-[#16233A] md:text-3xl">
              {showcase.title}
            </h3>
            <p data-reveal className="mt-5 text-base leading-loose text-[#16233A]/70">
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
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="rounded-3xl border border-[#16233A]/8 bg-white p-7 shadow-[0_16px_48px_-24px_rgba(22,35,58,0.25)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8A33D]/12">
                  <Icon className="h-6 w-6 text-[#C77E1B]" />
                </div>
                <p className="mt-5 text-xs font-semibold tracking-wide text-[#2FA36B]">{feature.kicker}</p>
                <h3 className="mt-2 text-lg font-bold text-[#16233A]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#16233A]/65">{feature.description}</p>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
