"use client"

import Image from "next/image"
import { PhoneFrame, BrowserFrame } from "@/components/lp/device-frame"

export function LpShowcase() {
  return (
    <section className="overflow-hidden bg-[#FBF9F5] py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p data-reveal className="mb-4 text-sm font-semibold tracking-[0.2em] text-[#C77E1B]">
          PRODUCT
        </p>
        <h2
          data-reveal
          className="font-lp-display max-w-2xl text-3xl font-semibold leading-snug text-[#16233A] md:text-[2.6rem] md:leading-[1.35]"
        >
          スマホでも、パソコンでも。<br />家族みんなの手のなかに。
        </h2>
        <p data-reveal className="mt-5 max-w-xl text-base leading-loose text-[#16233A]/70">
          外出先ではスマートフォンで通知とマップを。おうちでは大きな画面で、家族そろって通学路の作戦会議を。すべて実際の画面です。
        </p>

        <div className="relative mt-16">
          <div data-reveal>
            <BrowserFrame
              src="/images/lp/mocks/desktop-map.png"
              alt="PathGuardian のデスクトップ版危険マップ画面(実際のアプリのスクリーンショット)"
              className="md:mr-24"
            />
          </div>
          <div data-reveal className="mx-auto -mt-10 w-40 sm:w-48 md:absolute md:-bottom-12 md:right-0 md:mt-0 md:w-56">
            <PhoneFrame
              src="/images/lp/mocks/mobile-news.png"
              alt="PathGuardian の通学路安全ニュース画面(実際のアプリのスクリーンショット)"
            />
          </div>
        </div>

        {/* 家族の時間へつなげるブリッジ画像 */}
        <div className="mt-28 grid items-center gap-10 md:mt-36 md:grid-cols-2">
          <div data-reveal className="order-2 md:order-1">
            <p className="text-sm font-semibold text-[#2FA36B]">アプリの先にあるもの</p>
            <h3 className="font-lp-display mt-3 text-2xl font-semibold leading-snug text-[#16233A] md:text-3xl">
              今夜は、家族で
              <br />
              「つうがくろ作戦会議」。
            </h3>
            <p className="mt-5 text-base leading-loose text-[#16233A]/70">
              PathGuardian が目指すのは、画面の中の安心ではなく、家族の会話が増えること。今日のニュースをきっかけに、明日の通学路をいっしょに歩く計画を立てる — そんな毎日をつくります。
            </p>
          </div>
          <div data-reveal className="order-1 overflow-hidden rounded-3xl shadow-[0_40px_80px_-32px_rgba(22,35,58,0.35)] md:order-2">
            <div className="relative aspect-[4/3]">
              <Image
                src="/images/lp/feature-family-night.png"
                alt="夜のリビングでタブレットの地図を囲む親子"
                fill
                sizes="(max-width: 768px) 90vw, 560px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
