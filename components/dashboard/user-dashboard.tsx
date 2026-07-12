"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Flag, Map, Sparkles, Trophy } from "lucide-react"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useGamification } from "@/hooks/use-gamification"
import {
  getReportStatusPresentation,
  isReportUnderReview,
} from "@/components/danger-report/detail/report-detail-utils"
import { PaperPanel } from "@/components/safety-quest/hunter/theme"
import { tankenTokens, PAPER_NOISE } from "@/lib/design/tanken"

type RecentReport = {
  id: string
  title: string | null
  status: string
  ai_moderation_status: string | null
  ai_moderation_reason: string | null
  created_at: string
}

export default function UserDashboard() {
  const { supabase } = useSupabase()
  const { points, level, isLoading: pointsLoading } = useGamification()
  const [reports, setReports] = useState<RecentReport[]>([])
  const [name, setName] = useState("ユーザー")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoadError(false)
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          // 取得失敗を「報告0件」と区別する(誤ったデフォルト値の正常表示を防ぐ)
          if (active && userError) setLoadError(true)
          return
        }

        const [profileResult, reportsResult] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
          supabase
            .from("danger_reports")
            .select("id, title, status, ai_moderation_status, ai_moderation_reason, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3),
        ])

        if (!active) return
        if (reportsResult.error) {
          setLoadError(true)
          return
        }
        setName(profileResult.data?.display_name || user.email?.split("@")[0] || "ユーザー")
        setReports(reportsResult.data ?? [])
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [supabase, reloadKey])

  const t = tankenTokens
  // 状態の判定・ラベルは getReportStatusPresentation 系に一元化(ローカル辞書を新設しない)
  const waitingCount = reports.filter((report) => isReportUnderReview(report)).length

  return (
    <main
      className="min-h-screen px-4 pb-28 pt-6 sm:px-6"
      style={{ backgroundColor: t.color.paper, backgroundImage: PAPER_NOISE, color: t.color.ink }}
      aria-busy={loading || pointsLoading}
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <p className="text-sm font-bold" style={{ color: t.color.primaryStrong }}>きょうの安全ノート</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">{name}さんのダッシュボード</h1>
          <p className="mt-2 text-sm" style={{ color: t.color.inkSoft }}>ポイント、報告のようす、次にできることをまとめました。</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="自分の状況">
          <PaperPanel tone="sun" className="p-5">
            <Trophy className="h-6 w-6" style={{ color: t.color.sunDeep }} aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">ポイント</p>
            <p className="text-3xl font-black" aria-live="polite">{pointsLoading ? "—" : `${points}pt`}</p>
            <p className="text-xs" style={{ color: t.color.inkSoft }}>レベル {level}</p>
          </PaperPanel>
          <PaperPanel tone="green" className="p-5">
            <Flag className="h-6 w-6" style={{ color: t.color.primaryStrong }} aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">最近の報告</p>
            <p className="text-3xl font-black">{loading || loadError ? "—" : `${reports.length}件`}</p>
            <p className="text-xs" style={{ color: t.color.inkSoft }}>直近3件を表示</p>
          </PaperPanel>
          <PaperPanel tone="accent" className="p-5">
            <Sparkles className="h-6 w-6" style={{ color: t.color.accentStrong }} aria-hidden="true" />
            <p className="mt-3 text-sm font-bold">確認中</p>
            <p className="text-3xl font-black">{loading || loadError ? "—" : `${waitingCount}件`}</p>
            <p className="text-xs" style={{ color: t.color.inkSoft }}>結果は履歴で確認できます</p>
          </PaperPanel>
        </section>

        <PaperPanel className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">報告の履歴</h2>
            <Link href="/mypage" className={`inline-flex min-h-11 items-center gap-1 px-2 text-sm font-bold ${t.cls.focus}`} style={{ color: t.color.primaryStrong }}>
              すべて見る <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4" aria-live="polite">
            {loading ? (
              <p className="py-6 text-center text-sm" style={{ color: t.color.inkSoft }}>履歴を読み込んでいます…</p>
            ) : loadError ? (
              <div className="rounded-[18px] border border-dashed p-5 text-center" style={{ borderColor: t.border.soft }} role="alert">
                <p className="font-black">履歴を読み込めませんでした</p>
                <p className="mt-1 text-sm" style={{ color: t.color.inkSoft }}>通信状態を確認して、もう一度お試しください。</p>
                <button
                  type="button"
                  onClick={() => { setLoading(true); setReloadKey((key) => key + 1) }}
                  className={`mt-3 inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-black ${t.cls.focus}`}
                  style={{ borderColor: t.border.soft, background: t.color.card }}
                >
                  もう一度ためす
                </button>
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-[18px] border border-dashed p-5 text-center" style={{ borderColor: t.border.soft }}>
                <p className="font-black">まだ報告はありません</p>
                <p className="mt-1 text-sm" style={{ color: t.color.inkSoft }}>気になる場所を見つけたら、みんなに知らせよう。</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {reports.map((report) => (
                  <li key={report.id} className="flex items-center gap-3 rounded-[18px] border p-3" style={{ borderColor: t.border.faint, background: t.color.paper }}>
                    <Flag className="h-5 w-5 shrink-0" style={{ color: t.color.accent }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{report.title || "タイトルなし"}</span>
                    <span className="rounded-full px-2 py-1 text-xs font-bold" style={{ background: t.color.primarySoft, color: t.color.primaryStrong }}>
                      {getReportStatusPresentation(report).label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PaperPanel>

        <section aria-labelledby="next-action-title">
          <h2 id="next-action-title" className="text-xl font-black">つぎにできること</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Link
              href="/report"
              className={`flex min-h-14 items-center justify-center gap-2 rounded-full px-6 text-lg font-black text-white ${t.cls.focus}`}
              style={{ background: t.color.accent, boxShadow: t.shadow.pressAccent }}
            >
              <Flag className="h-5 w-5" aria-hidden="true" /> 危険を報告する
            </Link>
            <Link
              href="/map"
              className={`flex min-h-14 items-center justify-center gap-2 rounded-full border px-6 text-lg font-black ${t.cls.focus}`}
              style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.pressPaper }}
            >
              <Map className="h-5 w-5" aria-hidden="true" /> 安全マップを見る
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
