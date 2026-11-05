"use client"

import Image from "next/image"
import { BrowserFrame, PhoneFrame } from "@/components/lp/device-frame"
import { LpLottie } from "@/components/lp/lp-lottie"
import { LP_SPOTLIGHT } from "@/lib/lp-content"

type SpotlightItem = (typeof LP_SPOTLIGHT.items)[number]

function SpotlightMedia({ item }: { item: SpotlightItem }) {
  if (item.frame === "browser") return <BrowserFrame src={item.images[0]} alt={item.alt} />
  if (item.frame === "phone") {
    return (
      <div className="mx-auto w-[220px]">
        <PhoneFrame src={item.images[0]} alt={item.alt} />
      </div>
    )
  }
  // いつも / もしも を並べる
  return (
    <figure className="grid grid-cols-2 gap-3" aria-label={item.alt}>
      {item.images.map((src, index) => (
        <div key={src}>
          <p className={`font-lp-display mb-2 inline-block rounded-full border-2 border-[#2B2723] px-3 py-0.5 text-xs font-black text-[#2B2723] ${index === 1 ? "bg-[#E8A33D]" : "bg-[#FFFDF8]"}`}>
            {"labels" in item ? item.labels[index] : null}
          </p>
          <div className="relative aspect-[704/1522] overflow-hidden rounded-2xl border-2 border-[#2B2723]">
            <Image src={src} alt="" fill sizes="(max-width: 768px) 45vw, 200px" className="object-cover" />
          </div>
        </div>
      ))}
    </figure>
  )
}

/** 新しく加わった機能(事故多発地点・AR・もしもの画像)を実際の画面で見せる */
export function LpSpotlight() {
  return (
    <section id="spotlight" className="bg-[#FFFDF8] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p data-reveal className="font-lp-display mb-4 text-sm font-black tracking-[0.2em] text-[#E96D4F]">
          {LP_SPOTLIGHT.eyebrow}
        </p>
        <h2 data-reveal className="font-lp-display max-w-2xl text-3xl font-black leading-snug text-[#2B2723] md:text-[2.6rem]">
          {LP_SPOTLIGHT.headline}
        </h2>

        <div className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-8">
          {LP_SPOTLIGHT.items.map((item) => (
            <article key={item.feature.key} data-reveal className="flex flex-col">
              <div className="relative">
                <SpotlightMedia item={item} />
                <LpLottie src={item.sticker} className="pointer-events-none absolute -bottom-8 -right-3 h-16 w-16 md:h-20 md:w-20" />
              </div>
              <p className="mt-6 text-xs font-bold tracking-wide text-[#2FA36B]">{item.feature.kicker}</p>
              <h3 className="font-lp-display mt-2 text-xl font-black text-[#2B2723]">{item.feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#2B2723]/70">{item.feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
