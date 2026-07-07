"use client"

import { LP_HOW } from "@/lib/lp-content"

export function LpHow() {
  return (
    <section id="how" className="bg-white py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p data-reveal className="mb-4 text-sm font-semibold tracking-[0.2em] text-[#C77E1B]">
          {LP_HOW.eyebrow}
        </p>
        <h2 data-reveal className="font-lp-display text-3xl font-semibold text-[#16233A] md:text-[2.6rem]">
          {LP_HOW.headline}
        </h2>

        <ol data-reveal-group className="mt-14 grid gap-8 md:grid-cols-3">
          {LP_HOW.steps.map((step, index) => (
            <li key={step.title} className="relative rounded-3xl border border-[#16233A]/8 bg-[#FBF9F5] p-8">
              <span className="font-lp-display block text-5xl font-semibold text-[#E8A33D]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-lg font-bold text-[#16233A]">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#16233A]/65">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
