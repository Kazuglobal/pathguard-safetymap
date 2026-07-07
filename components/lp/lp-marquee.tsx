"use client"

import { LP_MARQUEE_WORDS } from "@/lib/lp-content"

/** 「いってらっしゃい」マーキー(装飾)。同じ列を2回並べて無限ループさせる */
export function LpMarquee() {
  const row = [...LP_MARQUEE_WORDS, ...LP_MARQUEE_WORDS, ...LP_MARQUEE_WORDS]

  return (
    <div aria-hidden className="overflow-hidden border-y-2 border-[#2B2723]/10 bg-[#E8A33D] py-4">
      <div className="lp-marquee-track flex w-max items-center">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center">
            {row.map((word, i) => (
              <span
                key={`${half}-${i}`}
                className="font-lp-display flex items-center gap-6 whitespace-nowrap pr-6 text-xl font-black tracking-wide text-[#2B2723] md:text-2xl"
              >
                {word}
                <span className="text-[#2B2723]/40">✳</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
