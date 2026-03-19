"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useGamification } from "@/hooks/use-gamification"
import { useMissions } from "@/hooks/use-missions"
import { motion } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Shield,
  Camera,
  Trophy,
  Target,
  TrendingUp,
  MapPin,
  ArrowRight,
  Sparkles,
  Users,
  CheckCircle2,
} from "lucide-react"

interface SafetyScoreDashboardProps {
  isLoggedIn: boolean
}

export default function SafetyScoreDashboard({ isLoggedIn }: SafetyScoreDashboardProps) {
  const { supabase } = useSupabase()
  const { points, level, isLoading: isGamificationLoading } = useGamification()
  const { missions, progress } = useMissions()
  const [totalReports, setTotalReports] = useState(0)
  const [userReportCount, setUserReportCount] = useState(0)
  const [resolvedCount, setResolvedCount] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let isMounted = true

    const loadStats = async () => {
      try {
        // Total community reports
        const { count: totalCount } = await supabase
          .from("danger_reports")
          .select("id", { count: "exact", head: true })

        // Resolved reports
        const { count: resolved } = await supabase
          .from("danger_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "resolved")

        // User's own reports
        const {
          data: { user },
        } = await supabase.auth.getUser()
        let myCount = 0
        if (user) {
          const { count } = await supabase
            .from("danger_reports")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
          myCount = count ?? 0
        }

        if (isMounted) {
          setTotalReports(totalCount ?? 0)
          setResolvedCount(resolved ?? 0)
          setUserReportCount(myCount)
          setIsLoaded(true)
        }
      } catch {
        if (isMounted) setIsLoaded(true)
      }
    }

    loadStats()
    return () => {
      isMounted = false
    }
  }, [supabase])

  const safetyScore = useMemo(() => {
    if (totalReports === 0) return 85
    const resolvedRatio = resolvedCount / totalReports
    return Math.round(60 + resolvedRatio * 40)
  }, [totalReports, resolvedCount])

  const completedMissionCount = useMemo(
    () => Object.values(progress).filter((item) => item?.completed).length,
    [progress],
  )

  const nextMission = useMemo(() => {
    return missions.find((m: any) => {
      const record = progress[Number(m.id)]
      return !record?.completed
    })
  }, [missions, progress])

  // Non-logged-in CTA
  if (!isLoggedIn) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 text-white shadow-xl"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Camera className="h-7 w-7" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-bold">
                写真1枚で、通学路が変わる
              </h2>
              <p className="text-sm leading-relaxed text-white/80">
                危険箇所を撮影すると、AIが即座に分析。
                あなたの報告が地域の安全を改善します。
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-white text-blue-700 hover:bg-white/90"
                >
                  <Link href="/register">
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    無料で始める
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  <Link href="/login">ログイン</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Community stats */}
          {isLoaded && totalReports > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-xl font-bold">{totalReports}</p>
                <p className="text-xs text-white/70">報告数</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{resolvedCount}</p>
                <p className="text-xs text-white/70">改善済み</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{safetyScore}</p>
                <p className="text-xs text-white/70">安全スコア</p>
              </div>
            </div>
          )}
        </motion.div>
      </section>
    )
  }

  // Logged-in personalized dashboard
  return (
    <section className="mx-auto max-w-5xl px-4 py-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        {/* Safety Score Card */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/80">
                通学路の安全スコア
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black">{safetyScore}</span>
                <span className="text-lg font-medium text-white/70">/100</span>
              </div>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Shield className="h-8 w-8" />
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-3 space-y-1.5">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${safetyScore}%` }}
                transition={{ delay: 0.5, duration: 1 }}
                className="h-full rounded-full bg-gradient-to-r from-green-300 to-emerald-300"
              />
            </div>
            <p className="text-xs text-white/60">
              コミュニティ全体の報告・改善状況から算出
            </p>
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/10 p-2.5 text-center backdrop-blur-sm">
              <p className="text-lg font-bold">{userReportCount}</p>
              <p className="text-[10px] text-white/70">あなたの報告</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5 text-center backdrop-blur-sm">
              <p className="text-lg font-bold">{resolvedCount}</p>
              <p className="text-[10px] text-white/70">改善済み</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5 text-center backdrop-blur-sm">
              <p className="text-lg font-bold">Lv.{level}</p>
              <p className="text-[10px] text-white/70">あなたのレベル</p>
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Today's mission */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Target className="h-4 w-4 text-orange-500" />
              今日のミッション
            </div>
            {nextMission ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-600 line-clamp-2">
                  {(nextMission as any).title}
                </p>
                <div className="space-y-1">
                  <Progress
                    value={Math.round(
                      ((progress[Number((nextMission as any).id)]?.progress ?? 0) /
                        ((nextMission as any).target_value ?? 1)) *
                        100,
                    )}
                    className="h-1.5"
                  />
                  <p className="text-[10px] text-slate-400">
                    {progress[Number((nextMission as any).id)]?.progress ?? 0} /{" "}
                    {(nextMission as any).target_value ?? 1}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                全ミッション達成!
              </div>
            )}
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="mt-2 h-7 w-full text-xs"
            >
              <Link href="/missions">
                ミッション一覧
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>

          {/* Quick capture CTA */}
          <Link
            href="/map?report=open"
            className="group flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 p-4 text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Camera className="h-8 w-8 transition-transform group-hover:scale-110" />
            <span className="mt-2 text-sm font-bold">撮影して報告</span>
            <span className="mt-0.5 text-[10px] text-white/70">
              +30pt獲得
            </span>
          </Link>
        </div>

        {/* Points & Level bar */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
            <Trophy className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-900">
                {points} pt
              </span>
              <span className="text-xs text-slate-400">
                次のレベルまで{" "}
                {Math.max((level * 500) - points, 0)} pt
              </span>
            </div>
            <Progress
              value={Math.min(
                100,
                (((points % 500) || (points > 0 ? 500 : 0)) / 500) * 100,
              )}
              className="h-1.5"
            />
          </div>
          <Button asChild size="sm" variant="ghost" className="h-8 px-2">
            <Link href="/mypage">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </section>
  )
}
