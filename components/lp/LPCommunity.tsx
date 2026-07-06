"use client"

import { useEffect, useRef, useState } from "react"
import {
  Users,
  Target,
  Award,
  Trophy,
  Star,
  Flame,
  Heart,
  CheckCircle2,
} from "lucide-react"

export function LPCommunity() {
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
    <section ref={ref} className="py-24 px-4 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-emerald-50 text-emerald-600 text-sm font-medium transition-all duration-700 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <Users className="w-4 h-4" />
            コミュニティ
          </div>
          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight transition-all duration-700 delay-200 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            楽しみながら、
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
              安全を学ぶ
            </span>
          </h2>
          <p
            className={`text-lg text-gray-500 max-w-2xl mx-auto transition-all duration-700 delay-300 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            ゲーミフィケーションで子どもも大人も夢中に。
            <br className="hidden sm:block" />
            家族みんなで参加できる安全コミュニティです。
          </p>
        </div>

        {/* Three columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Missions */}
          <div
            className={`transition-all duration-700 delay-400 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-12"
            }`}
          >
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl p-6 border border-orange-100 h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                  <Target className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">デイリーミッション</h3>
              </div>

              {/* Mission list */}
              <div className="space-y-3">
                {[
                  { text: "通学路の写真を1枚投稿", pts: "+50pt", done: true },
                  { text: "ヒヤリハット報告にコメント", pts: "+30pt", done: true },
                  { text: "AI分析ゲームに挑戦", pts: "+100pt", done: false },
                  { text: "安全マガジンを1記事読む", pts: "+20pt", done: false },
                ].map((mission, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      mission.done ? "bg-white/80" : "bg-white/40"
                    }`}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 flex-shrink-0 ${
                        mission.done ? "text-emerald-500" : "text-gray-300"
                      }`}
                    />
                    <span
                      className={`text-sm flex-1 ${
                        mission.done
                          ? "text-gray-400 line-through"
                          : "text-gray-700"
                      }`}
                    >
                      {mission.text}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        mission.done ? "text-gray-400" : "text-orange-500"
                      }`}
                    >
                      {mission.pts}
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div className="mt-4 pt-4 border-t border-orange-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500">本日の達成率</span>
                  <span className="text-xs font-bold text-orange-500">2/4</span>
                </div>
                <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                  <div className="w-1/2 h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div
            className={`transition-all duration-700 delay-[550ms] ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-12"
            }`}
          >
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl p-6 border border-violet-100 h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                  <Award className="w-6 h-6 text-violet-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">バッジコレクション</h3>
              </div>

              {/* Badge grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { emoji: "🛡️", name: "初回ログイン", unlocked: true },
                  { emoji: "📸", name: "初めての報告", unlocked: true },
                  { emoji: "🎮", name: "ゲームマスター", unlocked: true },
                  { emoji: "🔥", name: "7日連続", unlocked: true },
                  { emoji: "⭐", name: "100ポイント", unlocked: false },
                  { emoji: "👑", name: "トップ10入り", unlocked: false },
                ].map((badge, i) => (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${
                      badge.unlocked
                        ? "bg-white shadow-sm"
                        : "bg-white/40 opacity-50"
                    }`}
                  >
                    <span className="text-2xl">{badge.emoji}</span>
                    <span className="text-[10px] text-gray-500 text-center leading-tight">
                      {badge.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-4 pt-4 border-t border-violet-100 flex items-center justify-center gap-4">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-gray-700">4/6</span>
                </div>
                <span className="text-xs text-gray-400">獲得済み</span>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div
            className={`transition-all duration-700 delay-700 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-12"
            }`}
          >
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-3xl p-6 border border-sky-100 h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                  <Trophy className="w-6 h-6 text-sky-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">リーダーボード</h3>
              </div>

              {/* Rankings */}
              <div className="space-y-2">
                {[
                  { rank: 1, name: "安全パトロール隊", pts: "12,450", medal: "🥇" },
                  { rank: 2, name: "みまもりママ", pts: "10,280", medal: "🥈" },
                  { rank: 3, name: "パパガード", pts: "9,750", medal: "🥉" },
                  { rank: 4, name: "通学路マスター", pts: "8,920", medal: "" },
                  { rank: 5, name: "セーフティキッズ", pts: "7,100", medal: "" },
                ].map((user, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      i === 0
                        ? "bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200"
                        : "bg-white/80"
                    }`}
                  >
                    <span className="text-lg w-8 text-center">
                      {user.medal || (
                        <span className="text-sm font-bold text-gray-400">
                          {user.rank}
                        </span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-700 truncate">
                        {user.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-sm font-bold text-gray-600">
                        {user.pts}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Your position */}
              <div className="mt-4 pt-4 border-t border-sky-100">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-sky-100/50">
                  <span className="text-sm font-bold text-sky-600 w-8 text-center">
                    15
                  </span>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-sky-700">
                      あなた
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />
                    <span className="text-sm font-bold text-sky-600">3,200</span>
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
