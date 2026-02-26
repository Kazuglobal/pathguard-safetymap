"use client"

import * as React from "react"
import Link from "next/link"
import { Flame, Camera, Route, Trophy, ChevronRight, Gift } from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserClient } from "@supabase/ssr"

interface StreakData {
  currentStreak: number
  todayCheckedIn: boolean
  totalReports: number
  totalRoutes: number
}

export function DailyStreakBanner() {
  const [streak, setStreak] = React.useState<StreakData>({
    currentStreak: 0,
    todayCheckedIn: false,
    totalReports: 0,
    totalRoutes: 0,
  })
  const [isLoggedIn, setIsLoggedIn] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function fetchStreakData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setIsLoggedIn(false)
          setIsLoading(false)
          return
        }

        setIsLoggedIn(true)

        // Fetch user's report count
        const { count: reportCount } = await supabase
          .from("danger_reports")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)

        // Fetch user's route count
        const { count: routeCount } = await supabase
          .from("routes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)

        // Calculate streak from recent reports (approximate based on report dates)
        const { data: recentReports } = await supabase
          .from("danger_reports")
          .select("created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30)

        let currentStreak = 0
        let todayCheckedIn = false

        if (recentReports && recentReports.length > 0) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          const reportDates = new Set(
            recentReports.map((r) => {
              const d = new Date(r.created_at)
              d.setHours(0, 0, 0, 0)
              return d.getTime()
            })
          )

          // Check if today has activity
          if (reportDates.has(today.getTime())) {
            todayCheckedIn = true
          }

          // Count consecutive days backwards from today (or yesterday if not checked in today)
          const startDate = todayCheckedIn ? today : new Date(today.getTime() - 86400000)
          const checkDate = new Date(startDate)

          for (let i = 0; i < 30; i++) {
            if (reportDates.has(checkDate.getTime())) {
              currentStreak++
              checkDate.setDate(checkDate.getDate() - 1)
            } else {
              break
            }
          }
        }

        setStreak({
          currentStreak,
          todayCheckedIn,
          totalReports: reportCount ?? 0,
          totalRoutes: routeCount ?? 0,
        })
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false)
      }
    }

    fetchStreakData()
  }, [])

  // For non-logged-in users: Show a compelling CTA
  if (!isLoading && !isLoggedIn) {
    return (
      <section className="px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 p-6 shadow-lg">
            <div className="absolute -right-8 -top-8 opacity-10">
              <Camera className="w-40 h-40 text-white" />
            </div>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-white mb-3">
                <Gift className="w-3.5 h-3.5" />
                今すぐ始めよう
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                通学路の写真を撮って、街を安全にしよう
              </h3>
              <p className="text-white/90 text-sm mb-4">
                写真1枚の投稿でポイントGET。毎日続けるとボーナスポイントも！
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 bg-white text-orange-600 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-orange-50 transition-colors"
                >
                  無料で登録する
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 bg-white/20 text-white font-medium px-5 py-2.5 rounded-xl text-sm hover:bg-white/30 transition-colors"
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

  if (isLoading) {
    return (
      <section className="px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-gray-100 animate-pulse h-40" />
        </div>
      </section>
    )
  }

  // Streak milestones for bonus messaging
  const nextMilestone = [3, 7, 14, 30, 60, 100].find(
    (m) => m > streak.currentStreak
  ) ?? 100
  const daysToMilestone = nextMilestone - streak.currentStreak

  return (
    <section className="px-4 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 p-5 md:p-6 shadow-lg">
          {/* Background decoration */}
          <div className="absolute -right-6 -bottom-6 opacity-10">
            <Flame className="w-48 h-48 text-white" />
          </div>

          <div className="relative z-10">
            {/* Streak counter */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Flame
                  className={cn(
                    "w-8 h-8",
                    streak.currentStreak > 0
                      ? "text-yellow-200 drop-shadow-lg"
                      : "text-white/60"
                  )}
                />
                <div>
                  <div className="text-3xl font-black text-white leading-none">
                    {streak.currentStreak}
                    <span className="text-lg ml-1">日連続</span>
                  </div>
                  <p className="text-white/80 text-xs mt-0.5">
                    {streak.todayCheckedIn
                      ? "今日もアクティブ！"
                      : "今日はまだ報告していません"}
                  </p>
                </div>
              </div>

              {/* Streak dots (last 7 days visual) */}
              <div className="ml-auto flex gap-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-3 h-3 rounded-full",
                      i < streak.currentStreak
                        ? "bg-yellow-300 shadow-sm"
                        : "bg-white/20"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Milestone message */}
            {streak.currentStreak > 0 && (
              <div className="bg-white/15 rounded-xl px-4 py-2.5 mb-4">
                <p className="text-white text-sm font-medium">
                  {daysToMilestone === 1
                    ? `あと1日で${nextMilestone}日連続達成！ボーナスポイントがもらえます`
                    : `${nextMilestone}日連続まであと${daysToMilestone}日！続けてボーナスを獲得しよう`}
                </p>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
                <Camera className="w-4 h-4 text-yellow-200 mx-auto mb-1" />
                <div className="text-lg font-bold text-white leading-none">
                  {streak.totalReports}
                </div>
                <div className="text-[10px] text-white/70 mt-0.5">写真投稿</div>
              </div>
              <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
                <Route className="w-4 h-4 text-yellow-200 mx-auto mb-1" />
                <div className="text-lg font-bold text-white leading-none">
                  {streak.totalRoutes}
                </div>
                <div className="text-[10px] text-white/70 mt-0.5">通学路登録</div>
              </div>
              <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
                <Trophy className="w-4 h-4 text-yellow-200 mx-auto mb-1" />
                <div className="text-lg font-bold text-white leading-none">
                  {streak.currentStreak >= 7
                    ? "S"
                    : streak.currentStreak >= 3
                    ? "A"
                    : streak.currentStreak >= 1
                    ? "B"
                    : "C"}
                </div>
                <div className="text-[10px] text-white/70 mt-0.5">ランク</div>
              </div>
            </div>

            {/* CTA */}
            {!streak.todayCheckedIn && (
              <Link
                href="/map"
                className="flex items-center justify-center gap-2 w-full py-3 bg-white text-orange-600 font-bold rounded-xl text-sm hover:bg-orange-50 transition-colors"
              >
                <Camera className="w-4 h-4" />
                今日の写真を投稿してストリーク継続！
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
