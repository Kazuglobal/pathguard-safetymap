"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Shield, Sparkles } from "lucide-react"

export function LPCTA() {
  const ref = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-24 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <div
          className={`relative rounded-[2rem] overflow-hidden transition-all duration-700 ${
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800" />

          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Glow effects */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl" />

          {/* Content */}
          <div className="relative z-10 text-center px-8 py-16 sm:px-12 sm:py-20">
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm transition-all duration-700 delay-200 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              完全無料で利用可能
            </div>

            <h2
              className={`text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight transition-all duration-700 delay-300 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              お子さまの安全を、
              <br />
              今すぐ守りましょう
            </h2>

            <p
              className={`text-lg text-white/70 max-w-xl mx-auto mb-10 transition-all duration-700 delay-400 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              アカウント登録は無料。3分で始められます。
              <br />
              あなたの地域の安全情報をいますぐチェック。
            </p>

            <div
              className={`flex flex-col sm:flex-row gap-4 justify-center items-center transition-all duration-700 delay-500 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              <Link
                href="/register"
                className="group flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold rounded-2xl text-lg shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Shield className="w-5 h-5" />
                無料で始める
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-2xl text-lg hover:bg-white/10 backdrop-blur-sm transition-all duration-300"
              >
                ログイン
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
