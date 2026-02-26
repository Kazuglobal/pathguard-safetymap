"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Shield, ChevronDown, MapPin, Brain, Gamepad2 } from "lucide-react"

export function LPHero() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900" />

      {/* Animated grid pattern */}
      <div className="absolute inset-0 opacity-[0.07]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/10 animate-pulse"
            style={{
              width: `${20 + i * 15}px`,
              height: `${20 + i * 15}px`,
              top: `${10 + i * 15}%`,
              left: `${5 + i * 16}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${3 + i * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Floating feature icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[15%] left-[8%] p-3 bg-white/10 backdrop-blur-sm rounded-2xl animate-bounce"
          style={{ animationDuration: "4s", animationDelay: "0s" }}
        >
          <MapPin className="w-6 h-6 text-white/70" />
        </div>
        <div
          className="absolute top-[25%] right-[10%] p-3 bg-white/10 backdrop-blur-sm rounded-2xl animate-bounce"
          style={{ animationDuration: "5s", animationDelay: "1s" }}
        >
          <Brain className="w-6 h-6 text-white/70" />
        </div>
        <div
          className="absolute bottom-[30%] left-[12%] p-3 bg-white/10 backdrop-blur-sm rounded-2xl animate-bounce"
          style={{ animationDuration: "4.5s", animationDelay: "2s" }}
        >
          <Gamepad2 className="w-6 h-6 text-white/70" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        {/* Shield icon with glow */}
        <div
          className={`inline-flex items-center justify-center mb-8 transition-all duration-1000 ${
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50"
          }`}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl scale-150" />
            <div className="relative bg-white/15 backdrop-blur-md p-5 rounded-3xl border border-white/20">
              <Shield className="w-12 h-12 text-white" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Badge */}
        <div
          className={`inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm transition-all duration-700 delay-300 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          AI × コミュニティで守る、子どもの通学路
        </div>

        {/* Main headline */}
        <h1
          className={`text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-[1.1] transition-all duration-700 delay-500 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          子どもの安全を、
          <br />
          <span className="bg-gradient-to-r from-sky-200 via-cyan-200 to-teal-200 bg-clip-text text-transparent">
            テクノロジーで守る
          </span>
        </h1>

        {/* Sub copy */}
        <p
          className={`text-lg sm:text-xl text-white/75 max-w-2xl mx-auto mb-10 leading-relaxed transition-all duration-700 delay-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          153万件の交通事故データとAI分析で、
          <br className="sm:hidden" />
          お子さまの通学路の危険を可視化。
          <br />
          家族と地域で安全を見守るプラットフォーム。
        </p>

        {/* CTA Buttons */}
        <div
          className={`flex flex-col sm:flex-row gap-4 justify-center items-center transition-all duration-700 delay-1000 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          <Link
            href="/register"
            className="group relative px-8 py-4 bg-white text-blue-700 font-bold rounded-2xl text-lg shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 transition-all duration-300 hover:-translate-y-0.5"
          >
            <span className="relative z-10">無料で始める</span>
            <div className="absolute inset-0 bg-gradient-to-r from-sky-50 to-cyan-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <a
            href="#features"
            className="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-2xl text-lg hover:bg-white/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5"
          >
            機能を見る
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="w-6 h-6 text-white/50" />
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}
