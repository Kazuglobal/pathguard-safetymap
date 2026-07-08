"use client"

import Link from "next/link"
import { motion } from "framer-motion"

const NAV_LINKS = [
  { label: "課題", href: "#problem" },
  { label: "機能", href: "#features" },
  { label: "動画", href: "#video" },
  { label: "はじめかた", href: "#how" },
  { label: "FAQ", href: "#faq" },
]

export function LpHeader() {
  return (
    <motion.header
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-3 z-50 px-3 md:top-5"
    >
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between rounded-full border-2 border-[#2B2723]/10 bg-[#F3EFE4]/95 py-2 pl-5 pr-2 shadow-[0_12px_32px_-12px_rgba(43,39,35,0.35)] backdrop-blur-md md:h-16 md:pl-7">
        <Link href="/lp" className="font-lp-display flex items-baseline gap-0.5 text-lg font-black tracking-tight">
          <span className="text-[#2B2723]">Path</span>
          <span className="text-[#E8A33D]">Guardian</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-bold text-[#2B2723]/70 transition-colors hover:text-[#C77E1B]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full bg-[#2B2723] px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.03] active:scale-[0.98] sm:block"
          >
            ログイン
          </Link>
          <Link
            href="/register"
            className="font-lp-display rounded-full bg-[#E8A33D] px-5 py-2.5 text-sm font-black text-[#2B2723] transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            無料ではじめる
          </Link>
        </div>
      </div>
    </motion.header>
  )
}
