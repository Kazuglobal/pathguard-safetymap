"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Lupe } from "@/components/brand/lupe"
import { BRAND } from "@/lib/brand"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/**
 * ホームの、子ども向けの遊びの入口(UIUX改装 項目8)。
 * ゲームの入口は、この「きけんハンターで あそぶ」の1つにまとめる(ミッション・バッジ・ランキングはマイページの「あそぶ」)。
 */
export function HunterPlayBlock() {
  return (
    <section className="px-4 py-6 md:py-10" aria-labelledby="hunter-play-title">
      <div className="mx-auto max-w-6xl">
        <div
          className="flex flex-col gap-4 rounded-[22px] border p-5 md:flex-row md:items-center md:justify-between md:p-8"
          style={{ background: C.primarySoft, borderColor: "rgba(21,158,114,.3)", boxShadow: tankenTokens.shadow.soft }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <Lupe size="md" mood="cheer" decorative />
            <div className="min-w-0">
              <h2 id="hunter-play-title" className="text-lg font-black leading-snug md:text-xl" style={{ color: C.ink }}>
                {BRAND.kidsUmbrella}で あそぶ
              </h2>
              <p className="mt-1 text-sm font-bold leading-relaxed" style={{ color: C.inkSoft }}>
                つうがくろの しゃしんで、きけんを さがそう。みつけると ポイントと ミッションが すすむよ。
              </p>
            </div>
          </div>
          <Link
            href="/safety-quest/hunter"
            className={`chunky-press inline-flex min-h-12 flex-shrink-0 items-center justify-center gap-1.5 self-stretch rounded-full px-6 text-base font-black text-white md:self-center ${tankenTokens.cls.focus}`}
            style={{ background: C.primary, boxShadow: tankenTokens.shadow.pressGreen }}
          >
            あそんでみる
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
