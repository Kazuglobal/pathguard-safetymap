"use client"

import * as React from "react"
import Link from "next/link"
import {
  Shield,
  Users,
  Eye,
  Heart,
  ChevronRight,
  Zap,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserClient } from "@supabase/ssr"

interface ImpactData {
  resolvedReports: number
  totalLikes: number
  activeContributors: number
  coveredAreas: number
}

export function ContributionImpactSection() {
  const [impact, setImpact] = React.useState<ImpactData>({
    resolvedReports: 0,
    totalLikes: 0,
    activeContributors: 0,
    coveredAreas: 0,
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [animatedValues, setAnimatedValues] = React.useState<ImpactData>({
    resolvedReports: 0,
    totalLikes: 0,
    activeContributors: 0,
    coveredAreas: 0,
  })

  React.useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function fetchImpactData() {
      try {
        // Resolved (fixed) danger reports
        const { count: resolvedReports } = await supabase
          .from("danger_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "resolved")

        // Total likes across all reports
        const { count: totalLikes } = await supabase
          .from("report_likes")
          .select("id", { count: "exact", head: true })

        // Active contributors (unique users who submitted reports)
        const { data: contributorData } = await supabase
          .from("danger_reports")
          .select("user_id")

        const uniqueContributors = new Set(
          (contributorData ?? []).map((r) => r.user_id)
        ).size

        // Areas covered (unique prefectures with reports)
        const { data: areaData } = await supabase
          .from("danger_reports")
          .select("prefecture")
          .not("prefecture", "is", null)

        const uniqueAreas = new Set(
          (areaData ?? []).filter((r) => r.prefecture).map((r) => r.prefecture)
        ).size

        setImpact({
          resolvedReports: resolvedReports ?? 0,
          totalLikes: totalLikes ?? 0,
          activeContributors: uniqueContributors,
          coveredAreas: uniqueAreas,
        })
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false)
      }
    }

    fetchImpactData()
  }, [])

  // Animate numbers on load
  React.useEffect(() => {
    if (isLoading) return

    const duration = 1500
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      setAnimatedValues({
        resolvedReports: Math.round(impact.resolvedReports * eased),
        totalLikes: Math.round(impact.totalLikes * eased),
        activeContributors: Math.round(impact.activeContributors * eased),
        coveredAreas: Math.round(impact.coveredAreas * eased),
      })

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [isLoading, impact])

  if (isLoading) {
    return (
      <section className="px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-gray-100 animate-pulse h-48" />
        </div>
      </section>
    )
  }

  const impactCards = [
    {
      icon: Shield,
      value: animatedValues.resolvedReports,
      label: "解決された危険箇所",
      suffix: "件",
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      icon: Heart,
      value: animatedValues.totalLikes,
      label: "「参考になった」の数",
      suffix: "件",
      color: "text-pink-500",
      bgColor: "bg-pink-50",
    },
    {
      icon: Users,
      value: animatedValues.activeContributors,
      label: "安全パトロール参加者",
      suffix: "人",
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      icon: Eye,
      value: animatedValues.coveredAreas,
      label: "カバーされたエリア",
      suffix: "地域",
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
  ]

  return (
    <section className="px-4 py-6 md:py-10 bg-gradient-to-b from-white to-sky-50/50">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center gap-1.5 bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold mb-3">
            <Zap className="w-3.5 h-3.5" />
            みんなの力が街を守る
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
            あなたの投稿が、安全を生み出す
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            みんなの写真投稿や通学路報告が、実際に危険箇所の改善につながっています
          </p>
        </div>

        {/* Impact stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {impactCards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center"
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2",
                  card.bgColor
                )}
              >
                <card.icon className={cn("w-5 h-5", card.color)} />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900">
                {card.value.toLocaleString()}
                <span className="text-sm font-normal text-gray-400 ml-0.5">
                  {card.suffix}
                </span>
              </div>
              <div className="text-[11px] md:text-xs text-gray-500 mt-1">
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Story card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 text-sm mb-1">
                あなたの報告がこんな変化を生んでいます
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                利用者からの写真報告をもとに、全国の通学路で危険箇所の改善が進んでいます。
                ガードレールの設置、信号機の追加、見通しの悪い交差点の改良など、
                みなさんの「気づき」が具体的なアクションにつながっています。
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
                >
                  危険箇所を報告する
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/routes"
                  className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
                >
                  通学路を登録する
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
