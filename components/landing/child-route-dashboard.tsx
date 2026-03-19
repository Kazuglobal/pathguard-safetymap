"use client"

import Link from "next/link"
import { ChevronRight, MapPin, MessagesSquare, ShieldAlert } from "lucide-react"

export interface ChildRouteQuickCheck {
  id: string
  title: string
  value: string
  href: string
  description?: string
}

interface ChildRouteDashboardProps {
  childName?: string
  quickChecks: ChildRouteQuickCheck[]
}

export function ChildRouteDashboard({
  childName,
  quickChecks,
}: ChildRouteDashboardProps) {
  const getQuickCheckIcon = (item: ChildRouteQuickCheck) => {
    return item.id === "share" || item.title.includes("共有") ? MessagesSquare : MapPin
  }

  return (
    <section
      data-testid="child-route-dashboard"
      className="bg-gradient-to-b from-sky-50 via-white to-white py-4 md:py-6"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="rounded-3xl border border-sky-100 bg-white/95 p-4 shadow-[0_12px_40px_rgba(14,165,233,0.12)] md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                <ShieldAlert className="h-3.5 w-3.5" />
                わが子向けチェック
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                  今日の通学3分チェック
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {childName ? `${childName}さん向け` : "登録した通学路向け"}の注意点を30秒で確認できます。
                </p>
              </div>
            </div>
            <Link
              href="/map"
              className="inline-flex items-center gap-1 self-start rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              通学路を見る
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {quickChecks.map((item) => {
              const Icon = getQuickCheckIcon(item)

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-transform hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-sky-600 shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-lg font-bold text-slate-900">
                      {item.value}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
