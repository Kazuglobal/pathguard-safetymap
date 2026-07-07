"use client"

import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { LP_HERO } from "@/lib/lp-content"
import { PhoneFrame } from "@/components/lp/device-frame"

const HeroParticles = dynamic(
  () => import("@/components/lp/hero-particles").then((m) => m.HeroParticles),
  { ssr: false },
)

const ease = [0.22, 1, 0.36, 1] as const

export function LpHero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#16233A]">
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
        <div className="absolute inset-0 bg-[#101B2E]/55 md:hidden" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-[#101B2E]/95 via-[#101B2E]/72 to-[#101B2E]/25 md:block" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#101B2E]/75 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#101B2E]/80 to-transparent" />
      </div>

      {/* 朝の光の微粒子(Three.js) */}
      <HeroParticles />

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-5 pb-24 pt-28 md:flex-row md:items-center md:justify-between md:gap-12 md:px-8">
        <div className="max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wider text-white/90 backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
            {LP_HERO.eyebrow}
          </motion.p>

          <h1 className="font-lp-display text-[clamp(1.4rem,7.2vw,1.8rem)] font-semibold leading-[1.35] tracking-tight text-white md:text-[3.1rem] md:leading-[1.25] lg:text-[3.4rem]">
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
              className="rounded-full bg-[#E8A33D] px-8 py-3.5 text-base font-bold text-[#16233A] shadow-xl shadow-[#E8A33D]/30 transition-transform hover:scale-[1.04] active:scale-[0.98]"
            >
              {LP_HERO.ctaPrimary.label}
            </Link>
            <a
              href={LP_HERO.ctaSecondary.href}
              className="rounded-full border border-white/25 px-8 py-3.5 text-base font-medium text-white/90 backdrop-blur transition-colors hover:border-white/50 hover:text-white"
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
          initial={{ opacity: 0, y: 48, rotate: 4 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 1.1, delay: 0.6, ease }}
          className="mt-14 hidden w-[280px] shrink-0 md:block lg:w-[320px]"
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
