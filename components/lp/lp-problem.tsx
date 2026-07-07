"use client"

import Image from "next/image"
import { LP_PROBLEM } from "@/lib/lp-content"

export function LpProblem() {
  return (
    <section id="problem" className="relative overflow-hidden bg-[#101B2E] py-28 md:py-36">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 md:grid-cols-2 md:px-8">
        <div>
          <p data-reveal className="mb-4 text-sm font-semibold tracking-[0.2em] text-[#E8A33D]">
            {LP_PROBLEM.eyebrow}
          </p>
          <h2
            data-reveal
            className="font-lp-display text-3xl font-semibold leading-snug text-white md:text-[2.6rem] md:leading-[1.35]"
          >
            {LP_PROBLEM.headline}
          </h2>
          <div data-reveal-group className="mt-8 space-y-5">
            {LP_PROBLEM.body.map((paragraph, index) => (
              <p key={index} className="text-base leading-loose text-white/70">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div data-reveal className="relative">
          <div className="overflow-hidden rounded-3xl shadow-[0_48px_96px_-32px_rgba(0,0,0,0.6)]">
            <div data-parallax="0.08" className="relative aspect-[4/3] scale-110">
              <Image
                src="/images/lp/feature-community-hands.png"
                alt="スマートフォンで通学路の安全情報を確認する保護者の手元"
                fill
                sizes="(max-width: 768px) 90vw, 560px"
                className="object-cover"
              />
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-white/10 bg-[#16233A]/90 px-6 py-4 backdrop-blur md:block">
            <p className="text-sm font-medium text-white/85">
              その不安、<span className="text-[#E8A33D]">見える化</span>できます
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
