"use client"

import { ShieldCheck, EyeOff, HeartHandshake } from "lucide-react"
import { LP_TRUST } from "@/lib/lp-content"

const TRUST_ICONS = [ShieldCheck, EyeOff, HeartHandshake]

export function LpTrust() {
  return (
    <section className="bg-[#26221E] py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p data-reveal className="mb-4 text-sm font-semibold tracking-[0.2em] text-[#E8A33D]">
          {LP_TRUST.eyebrow}
        </p>
        <h2
          data-reveal
          className="font-lp-display max-w-2xl whitespace-pre-line text-3xl font-black leading-snug text-white md:text-[2.6rem] md:leading-[1.35]"
        >
          {LP_TRUST.headline}
        </h2>

        <div data-reveal-group className="mt-14 grid gap-6 md:grid-cols-3">
          {LP_TRUST.items.map((item, index) => {
            const Icon = TRUST_ICONS[index] ?? ShieldCheck
            return (
              <div
                key={item.title}
                className={`${index % 2 === 0 ? "-rotate-1" : "rotate-1"} rounded-[1.6rem] border-2 border-white/20 bg-white/[0.05] p-8 shadow-[7px_7px_0_rgba(0,0,0,0.35)] backdrop-blur`}
              >
                <div className="flex h-12 w-12 -rotate-3 items-center justify-center rounded-2xl border-2 border-[#2FA36B] bg-[#2FA36B]/20">
                  <Icon className="h-6 w-6 text-[#4ADE80]" />
                </div>
                <h3 className="font-lp-display mt-5 text-lg font-black text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
