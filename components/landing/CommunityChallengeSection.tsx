"use client"

import * as React from "react"
import Link from "next/link"
import {
  Users,
  Camera,
  Target,
  ChevronRight,
  MapPin,
  TrendingUp,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserClient } from "@supabase/ssr"

interface ChallengeStats {
  totalReports: number
  totalRoutes: number
  thisWeekReports: number
  weeklyGoal: number
  topPrefectures: { name: string; count: number }[]
}

const WEEKLY_GOAL = 50 // Weekly community goal for reports

export function CommunityChallengeSection() {
  const [stats, setStats] = React.useState<ChallengeStats>({
    totalReports: 0,
    totalRoutes: 0,
    thisWeekReports: 0,
    weeklyGoal: WEEKLY_GOAL,
    topPrefectures: [],
  })
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function fetchCommunityStats() {
      try {
        // Total reports (approved/published)
        const { count: totalReports } = await supabase
          .from("danger_reports")
          .select("id", { count: "exact", head: true })
          .in("status", ["approved", "published", "resolved"])

        // Total routes
        const { count: totalRoutes } = await supabase
          .from("routes")
          .select("id", { count: "exact", head: true })

        // This week's reports
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        weekStart.setHours(0, 0, 0, 0)

        const { count: thisWeekReports } = await supabase
          .from("danger_reports")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekStart.toISOString())

        // Top prefectures by report count
        const { data: prefectureData } = await supabase
          .from("danger_reports")
          .select("prefecture")
          .in("status", ["approved", "published", "resolved"])
          .not("prefecture", "is", null)

        const prefectureCounts: Record<string, number> = {}
        ;(prefectureData ?? []).forEach((row) => {
          if (row.prefecture) {
            prefectureCounts[row.prefecture] =
              (prefectureCounts[row.prefecture] ?? 0) + 1
          }
        })

        const topPrefectures = Object.entries(prefectureCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }))

        setStats({
          totalReports: totalReports ?? 0,
          totalRoutes: totalRoutes ?? 0,
          thisWeekReports: thisWeekReports ?? 0,
          weeklyGoal: WEEKLY_GOAL,
          topPrefectures,
        })
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false)
      }
    }

    fetchCommunityStats()
  }, [])

  const weeklyProgress = Math.min(
    (stats.thisWeekReports / stats.weeklyGoal) * 100,
    100
  )
  const isGoalMet = stats.thisWeekReports >= stats.weeklyGoal

  if (isLoading) {
    return (
      <section className="px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-gray-100 animate-pulse h-64" />
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 py-6 md:py-10">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-4 md:mb-6">
          <Users className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            みんなで達成！安全チャレンジ
          </h2>
        </div>

        {/* Main challenge card */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-5 md:p-8 shadow-lg mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-white mb-2">
                <Target className="w-3.5 h-3.5" />
                今週のチャレンジ
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white">
                みんなで{stats.weeklyGoal}件の危険報告を集めよう！
              </h3>
            </div>
            {isGoalMet && (
              <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-full text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                達成！
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-white/80 mb-2">
              <span>
                {stats.thisWeekReports} / {stats.weeklyGoal} 件
              </span>
              <span>{Math.round(weeklyProgress)}%</span>
            </div>
            <div className="h-4 bg-white/20 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-out",
                  isGoalMet
                    ? "bg-gradient-to-r from-yellow-300 to-yellow-400"
                    : "bg-gradient-to-r from-white/80 to-white"
                )}
                style={{ width: `${weeklyProgress}%` }}
              />
            </div>
          </div>

          {/* Motivational message */}
          <p className="text-white/90 text-sm mb-4">
            {isGoalMet
              ? "今週の目標を達成しました！さらに報告を増やして安全度をアップさせましょう"
              : stats.thisWeekReports > 0
              ? `あと${stats.weeklyGoal - stats.thisWeekReports}件で今週の目標達成！あなたの1枚が街を守ります`
              : "今週はまだ始まったばかり。最初の報告者になりましょう！"}
          </p>

          <Link
            href="/map"
            className="inline-flex items-center gap-2 bg-white text-indigo-600 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-50 transition-colors"
          >
            <Camera className="w-4 h-4" />
            危険箇所を報告する
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-gray-500 font-medium">
                累計写真報告
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalReports.toLocaleString()}
              <span className="text-sm font-normal text-gray-400 ml-1">件</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-pink-500" />
              <span className="text-xs text-gray-500 font-medium">
                登録通学路
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalRoutes.toLocaleString()}
              <span className="text-sm font-normal text-gray-400 ml-1">
                ルート
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500 font-medium">
                今週の報告
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.thisWeekReports}
              <span className="text-sm font-normal text-gray-400 ml-1">件</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-gray-500 font-medium">
                報告エリア数
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.topPrefectures.length}
              <span className="text-sm font-normal text-gray-400 ml-1">
                地域
              </span>
            </div>
          </div>
        </div>

        {/* Area ranking */}
        {stats.topPrefectures.length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-500" />
              報告が多いエリア TOP5
            </h4>
            <div className="space-y-2">
              {stats.topPrefectures.map((pref, index) => (
                <div key={pref.name} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      index === 0
                        ? "bg-yellow-100 text-yellow-700"
                        : index === 1
                        ? "bg-gray-100 text-gray-600"
                        : index === 2
                        ? "bg-orange-50 text-orange-600"
                        : "bg-gray-50 text-gray-500"
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-700 flex-1">
                    {pref.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {pref.count}件
                  </span>
                  <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{
                        width: `${
                          (pref.count / (stats.topPrefectures[0]?.count || 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
