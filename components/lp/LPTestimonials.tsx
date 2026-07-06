"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircle, Star, Quote } from "lucide-react"

const testimonials = [
  {
    name: "田中 美咲",
    role: "小学2年生の母",
    location: "東京都世田谷区",
    avatar: "TM",
    avatarGradient: "from-pink-400 to-rose-500",
    rating: 5,
    text: "通学路の危険箇所が地図上で一目でわかるので、子どもと一緒に「ここは気をつけようね」と話し合えます。AI分析ゲームは娘も大好きで、楽しみながら安全意識が育っているのを実感しています。",
    highlight: "子どもと一緒に安全を学べる",
  },
  {
    name: "佐藤 健太",
    role: "小学4年生の父",
    location: "大阪府豊中市",
    avatar: "SK",
    avatarGradient: "from-sky-400 to-blue-500",
    rating: 5,
    text: "転勤で引っ越してきたばかりで土地勘がなく不安でしたが、PathGuardianのヒートマップで通学路の事故多発地点がすぐわかりました。3Dビューで子どもの目線の死角もチェックでき、安心感が全然違います。",
    highlight: "引っ越し先でも安心",
  },
  {
    name: "鈴木 和子",
    role: "PTA安全委員長",
    location: "愛知県名古屋市",
    avatar: "SK",
    avatarGradient: "from-emerald-400 to-teal-500",
    rating: 5,
    text: "PTAの見守り活動にPathGuardianを導入しました。保護者からのヒヤリハット報告が集まり、データに基づいた安全マップを作成できました。学校と自治体への要望書にも説得力が出て、ガードレールの設置が実現しました。",
    highlight: "データで自治体を動かせた",
  },
]

export function LPTestimonials() {
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
    <section ref={ref} className="py-24 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-pink-50 text-pink-600 text-sm font-medium transition-all duration-700 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            利用者の声
          </div>
          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight transition-all duration-700 delay-200 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            選ばれる理由が
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500">
              あります
            </span>
          </h2>
          <p
            className={`text-lg text-gray-500 max-w-2xl mx-auto transition-all duration-700 delay-300 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            全国の保護者・教育関係者から
            <br className="hidden sm:block" />
            たくさんの感謝の声をいただいています。
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((t, index) => (
            <div
              key={t.name}
              className={`relative bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 border border-gray-100 hover:shadow-xl transition-all duration-500 hover:-translate-y-1 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${400 + index * 150}ms` }}
            >
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-gray-200 mb-4" />

              {/* Highlight badge */}
              <div className="inline-flex px-3 py-1 rounded-full bg-sky-50 text-sky-600 text-xs font-medium mb-4">
                {t.highlight}
              </div>

              {/* Text */}
              <p className="text-gray-600 leading-relaxed text-[15px] mb-6">
                {t.text}
              </p>

              {/* Rating */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(t.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 text-amber-400 fill-amber-400"
                  />
                ))}
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.avatarGradient} flex items-center justify-center text-white text-sm font-bold`}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">
                    {t.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {t.role} · {t.location}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
