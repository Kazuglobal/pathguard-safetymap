"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { label: "課題", href: "#problem" },
  { label: "機能", href: "#features" },
  { label: "動画", href: "#video" },
  { label: "はじめかた", href: "#how" },
  { label: "FAQ", href: "#faq" },
]

export function LpHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-[#16233A]/8 bg-[#FBF9F5]/85 backdrop-blur-md"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <Link href="/lp" className="flex items-baseline gap-0.5 text-lg font-bold tracking-tight">
          <span className={scrolled ? "text-[#16233A]" : "text-white"}>Path</span>
          <span className="text-[#E8A33D]">Guardian</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-[#E8A33D]",
                scrolled ? "text-[#16233A]/70" : "text-white/80",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className={cn(
              "hidden text-sm font-medium transition-colors hover:text-[#E8A33D] sm:block",
              scrolled ? "text-[#16233A]/70" : "text-white/80",
            )}
          >
            ログイン
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-[#E8A33D] px-5 py-2 text-sm font-bold text-[#16233A] shadow-lg shadow-[#E8A33D]/25 transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            無料ではじめる
          </Link>
        </div>
      </div>
    </motion.header>
  )
}
