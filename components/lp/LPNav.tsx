"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Shield, Menu, X } from "lucide-react"

const navItems = [
  { label: "課題", href: "#problem" },
  { label: "機能", href: "#features" },
  { label: "技術", href: "#showcase" },
  { label: "コミュニティ", href: "#community" },
  { label: "実績", href: "#stats" },
]

export function LPNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-100"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/lp" className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                scrolled
                  ? "bg-gradient-to-br from-sky-500 to-blue-600"
                  : "bg-white/15 backdrop-blur-sm"
              }`}
            >
              <Shield
                className={`w-5 h-5 ${scrolled ? "text-white" : "text-white"}`}
                strokeWidth={1.5}
              />
            </div>
            <span
              className={`text-lg font-bold transition-colors ${
                scrolled ? "text-gray-900" : "text-white"
              }`}
            >
              PathGuardian
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  scrolled
                    ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* CTA & mobile toggle */}
          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className={`hidden sm:flex px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                scrolled
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
              }`}
            >
              無料で始める
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`md:hidden p-2 rounded-lg transition-colors ${
                scrolled
                  ? "text-gray-600 hover:bg-gray-100"
                  : "text-white hover:bg-white/10"
              }`}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-16">
          <div className="flex flex-col p-6 gap-2">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl text-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
              <Link
                href="/register"
                className="block w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl text-center text-lg hover:bg-blue-700 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                無料で始める
              </Link>
              <Link
                href="/login"
                className="block w-full px-4 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl text-center text-lg hover:bg-gray-50 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                ログイン
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
