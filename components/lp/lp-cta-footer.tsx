"use client"

import Link from "next/link"
import Image from "next/image"

import { InstagramLink, OPERATOR_LABEL, SITE_FOOTER_LINKS } from "@/components/layout/site-footer"
import { useLpAuthStatus } from "@/components/lp/use-lp-auth-status"
import { LP_CTA, LP_OPEN_APP } from "@/lib/lp-content"

const PRIMARY_CTA_CLASS =
  "font-lp-display -rotate-1 rounded-full bg-[#E8A33D] px-10 py-4 text-base font-black text-[#2B2723] shadow-[6px_6px_0_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-0.5 hover:rotate-0 hover:scale-[1.03] active:scale-[0.98]"

/** ログイン済みの人には「無料ではじめる」ではなく、ヘッダーと同じ「アプリを開く」を出す */
function CtaButtons() {
  const status = useLpAuthStatus()
  if (status === "loading") return <span aria-hidden="true" className="h-14 w-56 rounded-full bg-white/10" />
  if (status === "authenticated") {
    return (
      <Link href={LP_OPEN_APP.href} className={PRIMARY_CTA_CLASS}>
        {LP_OPEN_APP.label}
      </Link>
    )
  }
  return (
    <>
      <Link href={LP_CTA.primary.href} className={PRIMARY_CTA_CLASS}>
        {LP_CTA.primary.label}
      </Link>
      <Link
        href={LP_CTA.secondary.href}
        className="font-lp-display rounded-full border-2 border-white/40 px-10 py-4 text-base font-bold text-white/90 transition-colors hover:border-white hover:text-white"
      >
        {LP_CTA.secondary.label}
      </Link>
    </>
  )
}

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
          <p data-reveal className="mt-5 text-base text-white/75">
            {LP_CTA.sub}
          </p>
          <div data-reveal className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <CtaButtons />
          </div>
        </div>
      </div>

      {/* フッター(アプリの共通フッターと同じリンク・公式 Instagram・運営者の表記。UIUX改装 項目4・32・41) */}
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 md:flex-row md:flex-wrap md:justify-between md:px-8">
          <p className="text-sm font-bold text-white/85">
            Path<span className="text-[#E8A33D]">Guardian</span>
          </p>
          <nav aria-label="サイトの情報" className="flex flex-wrap items-center justify-center gap-x-6 text-sm text-white/75">
            {SITE_FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
            <Link href={LP_OPEN_APP.href} className="inline-flex min-h-11 items-center transition-colors hover:text-white">
              {LP_OPEN_APP.label}
            </Link>
            <InstagramLink className="transition-colors hover:text-white" />
          </nav>
          <div className="text-center text-xs text-white/70 md:text-right">
            <p>{OPERATOR_LABEL}</p>
            {/* 年はサーバーとブラウザで年明けにずれることがあるので、食い違いを警告しない */}
            <p className="mt-1" suppressHydrationWarning>© {new Date().getFullYear()} PathGuardian</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
