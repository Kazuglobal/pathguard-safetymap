"use client"

import { ShieldCheck, EyeOff, HeartHandshake } from "lucide-react"
import { LP_TRUST } from "@/lib/lp-content"

const TRUST_ICONS = [ShieldCheck, EyeOff, HeartHandshake]

export function LpTrust() {
  return (
    <section className="bg-[#101B2E] py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p data-reveal className="mb-4 text-sm font-semibold tracking-[0.2em] text-[#E8A33D]">
          {LP_TRUST.eyebrow}
        </p>
        <h2
          data-reveal
          className="font-lp-display max-w-2xl whitespace-pre-line text-3xl font-semibold leading-snug text-white md:text-[2.6rem] md:leading-[1.35]"
        >
          {LP_TRUST.headline}
        </h2>

        <div data-reveal-group className="mt-14 grid gap-6 md:grid-cols-3">
          {LP_TRUST.items.map((item, index) => {
            const Icon = TRUST_ICONS[index] ?? ShieldCheck
            return (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2FA36B]/15">
                  <Icon className="h-6 w-6 text-[#4ADE80]" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
