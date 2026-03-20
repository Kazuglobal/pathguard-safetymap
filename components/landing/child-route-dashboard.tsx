"use client"

import Link from "next/link"
import {
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  MessagesSquare,
  Route,
} from "lucide-react"

export interface ChildRouteQuickCheck {
  id: string
  title: string
  value: string
  href: string
  description?: string
}

export interface NewsPreviewItem {
  id: string
  title: string
  categoryLabel: string
  categoryColor: string
  slug: string
}

export type ChildRouteDashboardState =
  | "loading"
  | "empty"
  | "needs_setup"
  | "error"
  | "ready"

interface ChildRouteDashboardProps {
  state: ChildRouteDashboardState
  childName?: string
  errorMessage?: string
  quickChecks?: ChildRouteQuickCheck[]
  retryHref?: string
  newsPreview?: NewsPreviewItem[]
}

export function ChildRouteDashboard({
  state,
  childName,
  errorMessage,
  quickChecks = [],
  retryHref = "/map",
  newsPreview,
}: ChildRouteDashboardProps) {
  const resolvedErrorMessage =
    errorMessage && errorMessage !== "最新の危険情報を読み込めませんでした。"
      ? errorMessage
      : "時間をおいて再試行するか、マップで通学路を確認してください。"

  const getQuickCheckIcon = (item: ChildRouteQuickCheck) => {
    if (item.id === "share" || item.title.includes("共有")) {
      return MessagesSquare
    }
    if (item.id === "route" || item.title.includes("ルート")) {
      return Route
    }
    if (item.id === "update" || item.title.includes("更新")) {
      return Clock3
    }

    return MapPin
  }

  return (
    <section
      data-testid="child-route-dashboard"
      className="bg-white py-3 md:py-4"
    >
      <div className="mx-auto max-w-xl px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-slate-900">
                今日の通学3分チェック
              </h2>
              <p className="mt-1 text-xs text-slate-600 md:hidden">
                {childName ? `${childName}さん向け` : "登録した通学路向け"}の注意点を30秒で確認できます。
              </p>
            </div>
            <p className="hidden text-sm leading-6 text-slate-600 md:block">
              {childName ? `${childName}さん向け` : "登録した通学路向け"}の注意点を30秒で確認できます。
            </p>
            <Link
              href="/map"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
            >
              地図を見る
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {state === "loading" ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50 p-2.5"
                >
                  <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    読み込み中
                  </div>
                </div>
              ))}
            </div>
          ) : state === "needs_setup" ? (
            <div className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 p-5">
              <p className="text-sm font-semibold text-slate-900">
                この通学路はまだシミュレーション準備中です
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                ルートをもう一度設定すると、危険地点や見直しポイントをここで表示できます。
              </p>
              <Link
                href="/routes"
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-50"
              >
                通学路を見直す
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : state === "empty" ? (
            <div className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 p-5">
              <p className="text-sm font-semibold text-slate-900">
                通学路を登録すると、わが子向けの注意が表示されます
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                まずはルートを1件登録すると、危険地点や見直しポイントをここで確認できます。
              </p>
              <Link
                href="/routes"
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50"
              >
                通学路を登録する
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : state === "error" ? (
            <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/70 p-5">
              <p className="text-sm font-semibold text-slate-900">
                最新の危険情報を読み込めませんでした。
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {resolvedErrorMessage}
              </p>
              <Link
                href={retryHref}
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-50"
              >
                マップで確認する
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {quickChecks.map((item) => {
                  const Icon = getQuickCheckIcon(item)

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="group flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center transition-transform hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <span className="text-base font-bold leading-tight text-slate-900">
                        {item.value}
                      </span>
                      <div className="my-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <p className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-500">
                        {item.title}
                      </p>
                    </Link>
                  )
                })}
              </div>
              {newsPreview && newsPreview.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      通学路の安全ニュース
                    </span>
                    <Link
                      href="/school-route-news"
                      className="flex items-center gap-0.5 text-xs text-sky-600 hover:text-sky-700"
                    >
                      すべて見る
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <ul className="space-y-1.5">
                    {newsPreview.map((news) => (
                      <li key={news.id}>
                        <Link
                          href={`/school-route-news/${news.slug}`}
                          className="flex items-center gap-2 text-xs leading-snug text-slate-700 hover:text-sky-700"
                        >
                          <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-[10px] font-medium text-slate-500">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: news.categoryColor }}
                            />
                            <span>{news.categoryLabel}</span>
                          </span>
                          <span className="line-clamp-1 min-w-0">{news.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
