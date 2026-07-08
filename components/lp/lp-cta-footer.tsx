"use client"

import Link from "next/link"
import Image from "next/image"
import { LP_CTA } from "@/lib/lp-content"

export function LpCtaFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#2B2723]">
      {/* CTA */}
      <div className="relative">
        <div className="absolute inset-0 opacity-25">
          <Image
            src="/images/lp/og-share.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#2B2723]/70" />
        </div>
        <div className="relative mx-auto max-w-4xl px-5 py-28 text-center md:px-8 md:py-36">
          <h2
            data-reveal
            className="font-lp-display text-3xl font-black leading-snug text-white md:text-[2.6rem] md:leading-[1.35]"
          >
            {LP_CTA.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p data-reveal className="mt-5 text-base text-white/70">
            {LP_CTA.sub}
          </p>
          <div data-reveal className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={LP_CTA.primary.href}
              className="font-lp-display -rotate-1 rounded-full bg-[#E8A33D] px-10 py-4 text-base font-black text-[#2B2723] shadow-[6px_6px_0_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-0.5 hover:rotate-0 hover:scale-[1.03] active:scale-[0.98]"
            >
              {LP_CTA.primary.label}
            </Link>
            <Link
              href={LP_CTA.secondary.href}
              className="font-lp-display rounded-full border-2 border-white/40 px-10 py-4 text-base font-bold text-white/90 transition-colors hover:border-white hover:text-white"
            >
              {LP_CTA.secondary.label}
            </Link>
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-10 md:flex-row md:justify-between md:px-8">
          <p className="text-sm font-bold text-white/85">
            Path<span className="text-[#E8A33D]">Guardian</span>
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/55">
            <Link href="/terms" className="transition-colors hover:text-white">
              利用規約
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              プライバシーポリシー
            </Link>
            <Link href="/contact" className="transition-colors hover:text-white">
              お問い合わせ
            </Link>
            <Link href="/landing" className="transition-colors hover:text-white">
              アプリを開く
            </Link>
          </nav>
          <p className="text-xs text-white/60">© {new Date().getFullYear()} PathGuardian</p>
        </div>
      </div>
    </footer>
  )
}
