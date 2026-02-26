"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, EyeOff, Unplug, ShieldAlert } from "lucide-react"

const problems = [
  {
    icon: EyeOff,
    title: "見えない危険",
    description:
      "通学路の危険箇所は、実際に事故が起きるまで気づかれないことがほとんど。データに基づく可視化が必要です。",
    color: "from-red-500 to-orange-500",
    bgColor: "bg-red-50",
    iconColor: "text-red-500",
  },
  {
    icon: Unplug,
    title: "分断された情報",
    description:
      "保護者、学校、自治体、それぞれが持つ安全情報がバラバラ。共有する仕組みがなく、対策が後手に回っています。",
    color: "from-amber-500 to-yellow-500",
    bgColor: "bg-amber-50",
    iconColor: "text-amber-500",
  },
  {
    icon: ShieldAlert,
    title: "子どもの安全意識",
    description:
      "子ども自身が危険を察知し回避する力を育てることが大切。しかし従来の安全教育は座学中心で実践的ではありません。",
    color: "from-blue-500 to-indigo-500",
    bgColor: "bg-blue-50",
    iconColor: "text-blue-500",
  },
]

export function LPProblem() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.15 }
    )
    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-red-50 text-red-600 text-sm font-medium transition-all duration-700 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            知っていますか？
          </div>
          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight transition-all duration-700 delay-200 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            通学路に潜む
            <span className="text-red-500">見えない危険</span>
          </h2>
          <p
            className={`text-lg text-gray-500 max-w-2xl mx-auto transition-all duration-700 delay-300 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            日本では毎年、登下校中の子どもが交通事故に巻き込まれています。
            <br className="hidden sm:block" />
            その多くは、事前のデータ分析と地域の連携で防げるはずです。
          </p>
        </div>

        {/* Stat highlight */}
        <div
          className={`text-center mb-16 transition-all duration-700 delay-500 ${
            isVisible
              ? "opacity-100 scale-100"
              : "opacity-0 scale-90"
          }`}
        >
          <div className="inline-flex flex-col items-center p-8 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
            <span className="text-6xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
              153万件
            </span>
            <span className="text-gray-500 mt-2 text-sm">
              2019〜2023年の交通事故データを分析
            </span>
          </div>
        </div>

        {/* Problem cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {problems.map((problem, index) => (
            <div
              key={problem.title}
              className={`group relative p-8 rounded-3xl border border-gray-100 bg-white hover:shadow-xl transition-all duration-500 hover:-translate-y-1 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${600 + index * 150}ms` }}
            >
              {/* Icon */}
              <div
                className={`inline-flex p-3 rounded-2xl ${problem.bgColor} mb-5`}
              >
                <problem.icon className={`w-6 h-6 ${problem.iconColor}`} />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {problem.title}
              </h3>

              {/* Description */}
              <p className="text-gray-500 leading-relaxed text-[15px]">
                {problem.description}
              </p>

              {/* Hover gradient line */}
              <div
                className={`absolute bottom-0 left-8 right-8 h-0.5 bg-gradient-to-r ${problem.color} rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
