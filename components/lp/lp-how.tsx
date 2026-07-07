"use client"

import { LP_HOW } from "@/lib/lp-content"

export function LpHow() {
  return (
    <section id="how" className="bg-white py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p data-reveal className="font-lp-display mb-4 text-sm font-black tracking-[0.2em] text-[#C77E1B]">
          {LP_HOW.eyebrow}
        </p>
        <h2 data-reveal className="font-lp-display text-3xl font-black text-[#2B2723] md:text-[2.6rem]">
          {LP_HOW.headline}
        </h2>

        <ol data-reveal-group className="mt-14 grid gap-8 md:grid-cols-3">
          {LP_HOW.steps.map((step, index) => (
            <li
              key={step.title}
              className={`${index % 2 === 0 ? "-rotate-1" : "rotate-1"} relative rounded-[1.6rem] border-2 border-[#2B2723] bg-[#F3EFE4] p-8 shadow-[7px_7px_0_rgba(43,39,35,0.85)]`}
            >
              <span className="font-lp-display inline-block -rotate-3 rounded-full border-2 border-[#2B2723] bg-[#E8A33D] px-4 py-1 text-2xl font-black text-[#2B2723] shadow-[4px_4px_0_rgba(43,39,35,0.85)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-lg font-bold text-[#2B2723]">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#2B2723]/65">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
