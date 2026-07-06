"use client"

import { useEffect, useRef, useState } from "react"
import {
  Map,
  Box,
  Camera,
  Gamepad2,
  BookOpen,
  Sparkles,
} from "lucide-react"

const features = [
  {
    icon: Map,
    title: "AIハザードマップ",
    description:
      "153万件の交通事故データをヒートマップで可視化。時間帯・天候・事故種別など6つのフィルターで、通学路の危険を多角的に分析できます。",
    gradient: "from-red-500 to-orange-500",
    bgGradient: "from-red-50 to-orange-50",
    mockup: (
      <div className="relative w-full h-48 rounded-2xl bg-gradient-to-br from-emerald-100 to-sky-100 overflow-hidden">
        {/* Simulated map */}
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(circle at 30% 40%, rgba(239,68,68,0.6) 0%, transparent 30%), radial-gradient(circle at 60% 60%, rgba(249,115,22,0.5) 0%, transparent 25%), radial-gradient(circle at 70% 30%, rgba(234,179,8,0.4) 0%, transparent 20%)",
          }}
        />
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg text-xs font-medium text-gray-700 shadow-sm">
          リアルタイムヒートマップ
        </div>
        {/* Dots */}
        {[
          { top: "35%", left: "28%", color: "bg-red-500" },
          { top: "50%", left: "55%", color: "bg-orange-500" },
          { top: "30%", left: "65%", color: "bg-yellow-500" },
          { top: "60%", left: "35%", color: "bg-red-400" },
          { top: "45%", left: "75%", color: "bg-orange-400" },
        ].map((dot, i) => (
          <div
            key={i}
            className={`absolute w-3 h-3 ${dot.color} rounded-full animate-pulse shadow-lg`}
            style={{ top: dot.top, left: dot.left, animationDelay: `${i * 0.3}s` }}
          >
            <div className={`absolute inset-0 ${dot.color} rounded-full animate-ping opacity-40`} />
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Box,
    title: "3Dルート可視化",
    description:
      "Google Photorealistic 3D TilesとCesiumJSを活用し、子どもの目線で通学路を3D体験。事前に危険箇所を把握できます。",
    gradient: "from-violet-500 to-purple-500",
    bgGradient: "from-violet-50 to-purple-50",
    mockup: (
      <div className="relative w-full h-48 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 overflow-hidden">
        {/* 3D perspective grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(139,92,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          transform: "perspective(500px) rotateX(30deg)",
          transformOrigin: "bottom",
        }} />
        {/* Buildings */}
        <div className="absolute bottom-8 left-[20%] w-12 h-20 bg-gradient-to-t from-violet-300 to-violet-200 rounded-t-lg opacity-60" />
        <div className="absolute bottom-8 left-[40%] w-16 h-28 bg-gradient-to-t from-purple-300 to-purple-200 rounded-t-lg opacity-60" />
        <div className="absolute bottom-8 right-[25%] w-10 h-16 bg-gradient-to-t from-violet-300 to-violet-200 rounded-t-lg opacity-60" />
        <div className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg text-xs font-medium text-gray-700 shadow-sm">
          子どもの目線で体験
        </div>
      </div>
    ),
  },
  {
    icon: Camera,
    title: "ヒヤリハット共有",
    description:
      "危険を感じた場所をスマホで撮影して共有。位置情報付きで、地域の安全マップをみんなで作り上げます。顔やナンバーは自動モザイク処理。",
    gradient: "from-sky-500 to-cyan-500",
    bgGradient: "from-sky-50 to-cyan-50",
    mockup: (
      <div className="relative w-full h-48 rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 overflow-hidden flex items-center justify-center">
        {/* Phone mockup */}
        <div className="relative w-28 h-40 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="w-full h-3 bg-gray-100 flex items-center justify-center">
            <div className="w-8 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="p-2 space-y-1.5">
            <div className="w-full h-16 bg-gradient-to-br from-sky-200 to-cyan-200 rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-sky-500/60" />
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full" />
            <div className="w-3/4 h-1.5 bg-gray-100 rounded-full" />
            <div className="flex gap-1">
              <div className="px-1.5 py-0.5 bg-orange-100 rounded text-[6px] text-orange-600">交通</div>
              <div className="px-1.5 py-0.5 bg-sky-100 rounded text-[6px] text-sky-600">通学路</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Gamepad2,
    title: "AI画像分析ゲーム",
    description:
      "街の写真をAI（GPT-4o）が分析し、危険箇所を検出。ゲーム感覚で安全意識を高め、レベルアップやランキングで楽しく学べます。",
    gradient: "from-emerald-500 to-teal-500",
    bgGradient: "from-emerald-50 to-teal-50",
    mockup: (
      <div className="relative w-full h-48 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 overflow-hidden flex flex-col items-center justify-center gap-3">
        {/* Score display */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-white/80 backdrop-blur rounded-full text-xs font-bold text-emerald-600 shadow-sm">
            Lv.12
          </div>
          <div className="px-3 py-1 bg-white/80 backdrop-blur rounded-full text-xs font-bold text-amber-600 shadow-sm">
            ★ 850pt
          </div>
        </div>
        {/* Detection visualization */}
        <div className="relative w-32 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg">
          <div className="absolute top-2 left-2 w-8 h-6 border-2 border-red-500 rounded animate-pulse" />
          <div className="absolute bottom-3 right-3 w-10 h-5 border-2 border-yellow-500 rounded animate-pulse" style={{ animationDelay: "0.5s" }} />
          <div className="absolute top-1 right-2 px-1 bg-red-500 rounded text-[5px] text-white font-bold">危険</div>
        </div>
        <div className="text-xs text-emerald-600 font-medium">AIが危険を自動検出！</div>
      </div>
    ),
  },
  {
    icon: BookOpen,
    title: "SAFE MAGAZINE",
    description:
      "交通安全、防犯、防災、地域の取り組みなど、子どもの安全に関する記事を毎日配信。専門家監修の信頼できる情報をお届けします。",
    gradient: "from-pink-500 to-rose-500",
    bgGradient: "from-pink-50 to-rose-50",
    mockup: (
      <div className="relative w-full h-48 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 overflow-hidden p-4">
        {/* Article cards */}
        <div className="space-y-2">
          {[
            { cat: "交通安全", color: "bg-red-100 text-red-600" },
            { cat: "防犯", color: "bg-indigo-100 text-indigo-600" },
            { cat: "防災", color: "bg-amber-100 text-amber-600" },
          ].map((article, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-white/80 backdrop-blur rounded-lg">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-[6px] font-medium ${article.color}`}>{article.cat}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full" />
                <div className="w-2/3 h-1.5 bg-gray-200 rounded-full mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

export function LPFeatures() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )
    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="features" className="py-24 px-4 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-sky-50 text-sky-600 text-sm font-medium transition-all duration-700 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            主な機能
          </div>
          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight transition-all duration-700 delay-200 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-blue-600">
              5つの力
            </span>
            で、安全を守る
          </h2>
          <p
            className={`text-lg text-gray-500 max-w-2xl mx-auto transition-all duration-700 delay-300 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            データ × AI × コミュニティ。PathGuardianは
            <br className="hidden sm:block" />
            テクノロジーの力で通学路の安全を多面的にサポートします。
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group relative bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 ${
                index === 0 ? "md:col-span-2 lg:col-span-1" : ""
              } ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${400 + index * 100}ms` }}
            >
              {/* Mockup visual */}
              <div className="p-4 pb-0">
                {feature.mockup}
              </div>

              {/* Content */}
              <div className="p-6 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`p-2 rounded-xl bg-gradient-to-br ${feature.bgGradient}`}
                  >
                    <feature.icon
                      className={`w-5 h-5 text-transparent bg-clip-text`}
                      style={{
                        color: feature.gradient.includes("red")
                          ? "#ef4444"
                          : feature.gradient.includes("violet")
                          ? "#8b5cf6"
                          : feature.gradient.includes("sky")
                          ? "#0ea5e9"
                          : feature.gradient.includes("emerald")
                          ? "#10b981"
                          : "#ec4899",
                      }}
                    />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-gray-500 text-[14px] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
