"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Database, Filter, Clock, MapPin, Users, Shield } from "lucide-react"

const stats = [
  {
    icon: Database,
    value: 1530000,
    suffix: "件",
    label: "交通事故データ",
    description: "2019〜2023年の警察庁データ",
    format: (n: number) => {
      if (n >= 10000) return `${Math.floor(n / 10000)}万`
      return n.toLocaleString()
    },
    color: "from-red-500 to-orange-500",
    bgColor: "bg-red-50",
    iconColor: "text-red-500",
  },
  {
    icon: Filter,
    value: 6,
    suffix: "種類",
    label: "分析フィルター",
    description: "時間帯・天候・事故種別など",
    format: (n: number) => n.toString(),
    color: "from-blue-500 to-indigo-500",
    bgColor: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    icon: Clock,
    value: 100,
    suffix: "ms以下",
    label: "クエリ応答速度",
    description: "PostGIS空間インデックス最適化",
    format: (n: number) => n.toString(),
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-50",
    iconColor: "text-emerald-500",
  },
  {
    icon: MapPin,
    value: 300,
    suffix: "m",
    label: "分析半径",
    description: "通学路周辺の危険度を評価",
    format: (n: number) => n.toString(),
    color: "from-amber-500 to-yellow-500",
    bgColor: "bg-amber-50",
    iconColor: "text-amber-500",
  },
  {
    icon: Users,
    value: 47,
    suffix: "都道府県",
    label: "対応エリア",
    description: "全国の通学路をカバー",
    format: (n: number) => n.toString(),
    color: "from-violet-500 to-purple-500",
    bgColor: "bg-violet-50",
    iconColor: "text-violet-500",
  },
  {
    icon: Shield,
    value: 96.8,
    suffix: "%",
    label: "AI分析精度",
    description: "GPT-4o Visionによる高精度検出",
    format: (n: number) => n.toFixed(1),
    color: "from-sky-500 to-cyan-500",
    bgColor: "bg-sky-50",
    iconColor: "text-sky-500",
  },
]

function useCountUp(end: number, duration: number, start: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setCount(eased * end)
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration, start])

  return count
}

function StatCard({
  stat,
  index,
  isVisible,
}: {
  stat: (typeof stats)[0]
  index: number
  isVisible: boolean
}) {
  const count = useCountUp(stat.value, 2000, isVisible)

  return (
    <div
      className={`group relative bg-white rounded-3xl p-6 border border-gray-100 hover:shadow-xl transition-all duration-500 hover:-translate-y-1 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${300 + index * 100}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-2xl ${stat.bgColor} flex-shrink-0`}>
          <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${stat.color}`}
            >
              {stat.format(count)}
            </span>
            <span className="text-sm font-bold text-gray-400">
              {stat.suffix}
            </span>
          </div>
          <div className="font-bold text-gray-900 mt-1">{stat.label}</div>
          <div className="text-sm text-gray-400 mt-0.5">{stat.description}</div>
        </div>
      </div>

      {/* Hover gradient line */}
      <div
        className={`absolute bottom-0 left-6 right-6 h-0.5 bg-gradient-to-r ${stat.color} rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`}
      />
    </div>
  )
}

export function LPStats() {
  const ref = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-24 px-4 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium transition-all duration-700 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <Database className="w-4 h-4" />
            数字で見る実力
          </div>
          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight transition-all duration-700 delay-200 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            圧倒的な
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              データ基盤
            </span>
          </h2>
          <p
            className={`text-lg text-gray-500 max-w-2xl mx-auto transition-all duration-700 delay-300 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            国内最大級の交通事故データベースと最先端のAI技術で、
            <br className="hidden sm:block" />
            科学的根拠に基づいた安全分析を実現しています。
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <StatCard
              key={stat.label}
              stat={stat}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
