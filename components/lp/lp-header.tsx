"use client"

import Link from "next/link"
import { motion } from "framer-motion"

import { BrandLogo } from "@/components/brand/brand-logo"
import { useLpAuthStatus } from "@/components/lp/use-lp-auth-status"
import { LP_LOGIN, LP_OPEN_APP, LP_SIGNUP, LP_SIGNUP_SHORT_LABEL } from "@/lib/lp-content"

const NAV_LINKS = [
  { label: "課題", href: "#problem" },
  { label: "機能", href: "#features" },
  { label: "動画", href: "#video" },
  { label: "はじめかた", href: "#how" },
  { label: "よくある質問", href: "#faq" },
]

/**
 * 右上のボタン(UIUX改装 項目54): ログイン済みなら「アプリを開く」、まだなら「ログイン」「無料ではじめる」。
 * ログイン状態が分かるまでは、どちらも出さずに同じ大きさの枠だけを出す(あとから入れ替わるチラつきを防ぐ)。
 */
function HeaderActions() {
  const status = useLpAuthStatus()

  if (status === "loading") {
    return <span aria-hidden="true" className="h-10 w-32 rounded-full bg-[#2B2723]/10" data-testid="lp-header-actions-loading" />
  }

  if (status === "authenticated") {
    return (
      <Link
        href={LP_OPEN_APP.href}
        className="font-lp-display rounded-full bg-[#E8A33D] px-5 py-2.5 text-sm font-black text-[#2B2723] transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        {LP_OPEN_APP.label}
      </Link>
    )
  }

  // スマホの幅ではロゴと2つのボタンが入りきらず「ログ/イン」「無料ではじめ/る」と折れていた。
  // 折り返しを禁止し、狭い幅では余白と文字を詰める。360px 未満では登録の表示だけ短くする。
  // 使わない方の表示は display:none なので、読み上げの名前もその幅で見えている文字にそろう(音声操作で見えている名前が通じる)。
  return (
    <>
      <Link
        href={LP_LOGIN.href}
        className="shrink-0 whitespace-nowrap rounded-full bg-[#2B2723] px-3 py-2.5 text-xs font-bold text-white transition-transform hover:scale-[1.03] active:scale-[0.98] sm:px-5 sm:text-sm"
      >
        {LP_LOGIN.label}
      </Link>
      <Link
        href={LP_SIGNUP.href}
        className="font-lp-display shrink-0 whitespace-nowrap rounded-full bg-[#E8A33D] px-3.5 py-2.5 text-[13px] font-black text-[#2B2723] transition-transform hover:scale-[1.03] active:scale-[0.98] sm:px-5 sm:text-sm"
      >
        <span className="min-[360px]:hidden">{LP_SIGNUP_SHORT_LABEL}</span>
        <span className="hidden min-[360px]:inline">
          {LP_SIGNUP.label}
        </span>
      </Link>
    </>
  )
}

export function LpHeader() {
  return (
    <motion.header
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-3 z-50 px-3 md:top-5"
    >
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-2 rounded-full border-2 border-[#2B2723]/10 bg-[#F3EFE4]/95 py-2 pl-4 pr-2 shadow-[0_12px_32px_-12px_rgba(43,39,35,0.35)] backdrop-blur-md md:h-16 md:pl-7">
        <Link href="/lp" aria-label="PathGuardian 紹介ページの先頭へ" className="flex items-center">
          <BrandLogo size="compact" />
        </Link>

        <nav aria-label="紹介ページの中の移動" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-bold text-[#2B2723]/75 transition-colors hover:text-[#C77E1B]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <HeaderActions />
        </div>
      </div>
    </motion.header>
  )
}
