"use client"

import { useEffect, useRef, useState } from "react"
import {
  Brain,
  Scan,
  Shield,
  Zap,
  Box,
  Eye,
  Route,
  AlertTriangle,
} from "lucide-react"

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, isVisible }
}

export function LPShowcase() {
  const ai = useInView()
  const threeD = useInView()

  return (
    <section className="py-24 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-32">
        {/* AI Analysis Showcase */}
        <div ref={ai.ref} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Visual */}
          <div
            className={`relative transition-all duration-700 ${
              ai.isVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-12"
            }`}
          >
            <div className="relative bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100 rounded-3xl p-8 overflow-hidden">
              {/* Grid background */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(59,130,246,0.3) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />

              {/* AI analysis visualization */}
              <div className="relative space-y-4">
                {/* Source image */}
                <div className="relative bg-white rounded-2xl p-3 shadow-lg">
                  <div className="w-full h-36 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center relative overflow-hidden">
                    {/* Street simulation */}
                    <div className="absolute bottom-0 w-full h-8 bg-gray-300" />
                    <div className="absolute bottom-8 left-[15%] w-6 h-16 bg-gray-400 rounded-t" />
                    <div className="absolute bottom-8 right-[20%] w-8 h-12 bg-gray-350 rounded-t" style={{ backgroundColor: "#9ca3af" }} />

                    {/* Detection boxes */}
                    <div className="absolute top-4 left-4 w-16 h-10 border-2 border-red-500 rounded-lg animate-pulse">
                      <div className="absolute -top-2 -left-0.5 px-1.5 bg-red-500 rounded text-[8px] text-white font-bold">
                        危険度: 高
                      </div>
                    </div>
                    <div className="absolute bottom-12 right-8 w-12 h-8 border-2 border-yellow-500 rounded-lg animate-pulse" style={{ animationDelay: "0.5s" }}>
                      <div className="absolute -top-2 -left-0.5 px-1.5 bg-yellow-500 rounded text-[8px] text-white font-bold">
                        注意
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Scan className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-gray-500">GPT-4o Vision 分析中...</span>
                  </div>
                </div>

                {/* Analysis results */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "危険箇所", value: "3件検出", color: "text-red-600 bg-red-50" },
                    { label: "安全スコア", value: "72/100", color: "text-blue-600 bg-blue-50" },
                    { label: "推奨アクション", value: "2件", color: "text-amber-600 bg-amber-50" },
                    { label: "分析精度", value: "96.8%", color: "text-emerald-600 bg-emerald-50" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`p-3 rounded-xl ${stat.color} text-center`}
                    >
                      <div className="text-[10px] opacity-70">{stat.label}</div>
                      <div className="text-sm font-bold">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Text content */}
          <div
            className={`transition-all duration-700 delay-200 ${
              ai.isVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-12"
            }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-blue-50 text-blue-600 text-sm font-medium">
              <Brain className="w-4 h-4" />
              AI ハザード分析
            </div>
            <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
              AIが危険を
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                自動検出
              </span>
            </h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              GPT-4o Visionを搭載した画像分析エンジンが、通学路の写真から危険箇所をリアルタイムで検出。見落としがちな危険を、AIの目が見逃しません。
            </p>
            <div className="space-y-4">
              {[
                {
                  icon: Scan,
                  title: "画像認識による危険検出",
                  desc: "道路状況、交差点、死角などをAIが自動分析",
                },
                {
                  icon: Zap,
                  title: "リアルタイム分析",
                  desc: "写真をアップロードするだけで即座に結果を表示",
                },
                {
                  icon: Shield,
                  title: "安全スコアリング",
                  desc: "100点満点で通学路の安全度を定量評価",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 flex-shrink-0">
                    <item.icon className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{item.title}</div>
                    <div className="text-gray-500 text-sm">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3D Visualization Showcase */}
        <div ref={threeD.ref} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text content (left on desktop) */}
          <div
            className={`order-2 lg:order-1 transition-all duration-700 delay-200 ${
              threeD.isVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-12"
            }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-violet-50 text-violet-600 text-sm font-medium">
              <Box className="w-4 h-4" />
              3D ビジュアライゼーション
            </div>
            <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
              子どもの目線で
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">
                通学路を体験
              </span>
            </h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Google Photorealistic 3D TilesとCesiumJSによる圧倒的な3D表現。お子さまの目線の高さで通学路を仮想体験し、危険箇所を事前に把握できます。
            </p>
            <div className="space-y-4">
              {[
                {
                  icon: Eye,
                  title: "子どもの目線の高さ",
                  desc: "大人には見える景色も、子どもには見えないことがある",
                },
                {
                  icon: Route,
                  title: "ルート全体を3Dウォークスルー",
                  desc: "自宅から学校まで、実際の街並みで確認",
                },
                {
                  icon: AlertTriangle,
                  title: "危険ポイントの3D表示",
                  desc: "地図上の印だけではわからない立体的な危険を可視化",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-violet-50 flex-shrink-0">
                    <item.icon className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{item.title}</div>
                    <div className="text-gray-500 text-sm">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual (right on desktop) */}
          <div
            className={`order-1 lg:order-2 relative transition-all duration-700 ${
              threeD.isVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-12"
            }`}
          >
            <div className="relative bg-gradient-to-br from-violet-100 via-purple-100 to-fuchsia-100 rounded-3xl p-8 overflow-hidden">
              {/* 3D perspective grid */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                  transform: "perspective(600px) rotateX(25deg)",
                  transformOrigin: "bottom center",
                }}
              />

              <div className="relative">
                {/* 3D scene mockup */}
                <div className="bg-white rounded-2xl p-4 shadow-lg">
                  <div className="relative w-full h-44 rounded-xl overflow-hidden bg-gradient-to-b from-sky-300 to-sky-100">
                    {/* Sky */}
                    <div className="absolute top-2 right-4 w-12 h-4 bg-white/60 rounded-full blur-sm" />
                    <div className="absolute top-4 left-8 w-8 h-3 bg-white/40 rounded-full blur-sm" />

                    {/* Buildings in perspective */}
                    <div className="absolute bottom-0 w-full">
                      {/* Road */}
                      <div className="absolute bottom-0 w-full h-12 bg-gray-400">
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 border-t-2 border-dashed border-white/50" />
                      </div>

                      {/* Left buildings */}
                      <div className="absolute bottom-12 left-[5%] w-14 h-24 bg-gradient-to-t from-gray-300 to-gray-200 rounded-t-lg" />
                      <div className="absolute bottom-12 left-[22%] w-10 h-32 bg-gradient-to-t from-violet-200 to-violet-100 rounded-t-lg" />

                      {/* Right buildings */}
                      <div className="absolute bottom-12 right-[8%] w-16 h-20 bg-gradient-to-t from-gray-300 to-gray-200 rounded-t-lg" />
                      <div className="absolute bottom-12 right-[28%] w-12 h-28 bg-gradient-to-t from-purple-200 to-purple-100 rounded-t-lg" />

                      {/* Warning marker */}
                      <div className="absolute bottom-14 left-[45%] flex flex-col items-center animate-bounce" style={{ animationDuration: "2s" }}>
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                          <AlertTriangle className="w-3 h-3 text-white" />
                        </div>
                        <div className="w-0.5 h-3 bg-red-500" />
                      </div>
                    </div>

                    {/* Eye level indicator */}
                    <div className="absolute left-2 top-1/2 flex items-center gap-1">
                      <div className="w-8 border-t border-dashed border-violet-500/50" />
                      <span className="text-[8px] text-violet-600 font-medium bg-white/80 px-1 rounded">110cm</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                        <Eye className="w-4 h-4 text-violet-500" />
                      </div>
                      <span className="text-xs text-gray-500">子どもの視点</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-violet-500 rounded-full" />
                      <div className="w-2 h-2 bg-violet-200 rounded-full" />
                      <div className="w-2 h-2 bg-violet-200 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
