"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { LP_HERO } from "@/lib/lp-content"
import { PhoneFrame } from "@/components/lp/device-frame"

const ease = [0.22, 1, 0.36, 1] as const

export function LpHero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#2B2723]">
      {/* 背景: 生成した朝の通学路 + 暗めのグラデーション */}
      <div className="absolute inset-0">
        <Image
          src="/images/lp/hero-morning-route.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[70%_center]"
        />
        <div className="absolute inset-0 bg-[#26221E]/55 md:hidden" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-[#26221E]/95 via-[#26221E]/72 to-[#26221E]/25 md:block" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#26221E]/75 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#26221E]/80 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-5 pb-24 pt-28 md:flex-row md:items-center md:justify-between md:gap-12 md:px-8">
        <div className="max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease }}
            className="font-lp-display mb-6 inline-flex -rotate-2 items-center gap-2 rounded-full bg-[#E8A33D] px-5 py-2 text-sm font-black tracking-wider text-[#2B2723] shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
          >
            <span className="h-2 w-2 rounded-full bg-[#2FA36B]" />
            {LP_HERO.eyebrow}
          </motion.p>

          <h1 className="font-lp-display text-[clamp(1.4rem,7.2vw,1.8rem)] font-black leading-[1.35] tracking-tight text-white md:text-[3.1rem] md:leading-[1.25] lg:text-[3.4rem]">
            {LP_HERO.headline.map((line, i) => (
              <motion.span
                key={line}
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.3 + i * 0.15, ease }}
                className="block whitespace-nowrap"
              >
                {line}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.7, ease }}
            className="mt-6 max-w-md text-base leading-relaxed text-white/75 md:text-lg"
          >
            {LP_HERO.sub}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.85, ease }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Link
              href={LP_HERO.ctaPrimary.href}
              className="font-lp-display rounded-full bg-[#E8A33D] px-9 py-4 text-base font-black text-[#2B2723] shadow-[5px_5px_0_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98]"
            >
              {LP_HERO.ctaPrimary.label}
            </Link>
            <a
              href={LP_HERO.ctaSecondary.href}
              className="font-lp-display rounded-full border-2 border-white/40 px-9 py-4 text-base font-bold text-white/90 backdrop-blur transition-colors hover:border-white hover:text-white"
            >
              {LP_HERO.ctaSecondary.label}
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.1 }}
            className="mt-5 text-xs text-white/70"
          >
            {LP_HERO.note}
          </motion.p>
        </div>

        {/* 実アプリのスマホモック */}
        <motion.div
          initial={{ opacity: 0, y: 48, rotate: 8 }}
          animate={{ opacity: 1, y: 0, rotate: 3 }}
          transition={{ duration: 1.1, delay: 0.6, ease }}
          className="mt-14 hidden w-[min(300px,calc(72svh*0.44))] shrink-0 md:block"
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          >
            <PhoneFrame
              src="/images/lp/mocks/mobile-map.png"
              alt="PathGuardian の危険マップ画面(実際のアプリのスクリーンショット)"
              priority
            />
          </motion.div>
        </motion.div>
      </div>

      <motion.a
        href="#problem"
        aria-label="次のセクションへ"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.4 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 transition-colors hover:text-white"
      >
        <motion.span
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="block"
        >
          <ChevronDown className="h-6 w-6" />
        </motion.span>
      </motion.a>
    </section>
  )
}
