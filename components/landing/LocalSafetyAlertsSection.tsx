"use client"

import * as React from "react"
import { AlertCircle, MapPin, Clock, ExternalLink, Leaf } from "lucide-react"
import {
  useLocalSafetyAlerts,
  formatRelativeTime,
  isBreakingAlert,
  type LocalAlertCategory,
} from "@/hooks/use-local-safety-alerts"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

// --- 定数 ---

const CATEGORY_CONFIG: Record<LocalAlertCategory, { label: string; color: string }> = {
  suspicious: { label: "不審者情報", color: "#D8660A" },
  voice_call: { label: "声かけ事案", color: "#D95555" },
  following:  { label: "つきまとい",  color: "#C03A3A" },
  other:      { label: "その他",     color: "#847661" },
}

const PREFECTURE_OPTIONS = [
  "全国", "北海道", "宮城県", "東京都", "神奈川県",
  "埼玉県", "千葉県", "愛知県", "大阪府", "兵庫県", "福岡県",
]

const PREFECTURE_STORAGE_KEY = "pathguardian:selected_prefecture"

// --- コンポーネント ---

export function LocalSafetyAlertsSection() {
  const [selectedPrefecture, setSelectedPrefecture] = React.useState<string>("全国")
  const [mounted, setMounted] = React.useState(false)

  // localStorage から都道府県を復元（SSR 対策で useEffect 内で実施）
  React.useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(PREFECTURE_STORAGE_KEY)
    if (stored && PREFECTURE_OPTIONS.includes(stored)) {
      setSelectedPrefecture(stored)
    }
  }, [])

  const handlePrefectureChange = React.useCallback((pref: string) => {
    setSelectedPrefecture(pref)
    localStorage.setItem(PREFECTURE_STORAGE_KEY, pref)
  }, [])

  const { alerts, isLoading, error } = useLocalSafetyAlerts({
    prefecture: selectedPrefecture,
    limitHours: 24,
  })

  const areaLabel = selectedPrefecture === "全国" ? "全国" : selectedPrefecture

  return (
    <section className="py-6 md:py-10" style={{ background: C.accentSoft }}>
      <div className="mx-auto max-w-6xl">
        {/* セクションヘッダー */}
        <div className="mb-4 flex flex-col items-start gap-2 px-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 animate-pulse rounded-full"
              style={{ background: C.accent }}
            />
            <h2 className="text-lg font-black md:text-xl" style={{ color: C.ink }}>
              今日の地域アラート
            </h2>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: "rgba(244,128,31,.15)", color: C.accentStrong }}
            >
              リアルタイム
            </span>
          </div>
          <p className="px-0.5 text-xs" style={{ color: C.inkFaint }}>
            3時間毎に収集・5分毎に自動更新
          </p>
        </div>

        {/* 都道府県フィルター */}
        {mounted && (
          <div className="mb-4 px-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
              <span className="flex-shrink-0 text-xs font-bold" style={{ color: C.inkSoft }}>
                地域:
              </span>
              {PREFECTURE_OPTIONS.map((pref) => {
                const active = selectedPrefecture === pref
                return (
                  <button
                    key={pref}
                    onClick={() => handlePrefectureChange(pref)}
                    aria-pressed={active}
                    className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${tankenTokens.cls.focus}`}
                    style={
                      active
                        ? { background: C.accent, color: "#fff", borderColor: C.accent }
                        : { background: C.card, color: C.inkSoft, borderColor: tankenTokens.border.soft }
                    }
                  >
                    {pref}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* アラートリスト */}
        <div className="px-4">
          {isLoading && (
            <div
              className="flex min-h-[88px] animate-pulse items-center justify-center rounded-[18px] border p-6 text-sm"
              style={{ background: C.card, borderColor: tankenTokens.border.faint, color: C.inkFaint }}
            >
              確認しています…
            </div>
          )}

          {error && (
            <div
              className="rounded-[18px] border p-4 text-sm"
              style={{ background: C.card, borderColor: "rgba(217,85,85,.4)", color: C.danger }}
            >
              アラートの取得に失敗しました。時間をおいて再読み込みしてください。
            </div>
          )}

          {!isLoading && !error && alerts.length === 0 && (
            <div
              className="flex min-h-[88px] items-center justify-center gap-3 rounded-[18px] border p-6"
              style={{ background: C.card, borderColor: tankenTokens.border.faint }}
            >
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: C.primarySoft }}
              >
                <Leaf className="h-5 w-5" style={{ color: C.primaryStrong }} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: C.ink }}>
                  {areaLabel}では、この24時間 新しいアラートはありません
                </p>
                <p className="mt-0.5 text-xs" style={{ color: C.inkSoft }}>
                  いつもどおりです。このまま見守りを続けましょう。
                </p>
              </div>
            </div>
          )}

          {alerts.length > 0 && (
            <div
              className="divide-y overflow-hidden rounded-[18px] border"
              style={{
                background: C.card,
                borderColor: tankenTokens.border.faint,
                boxShadow: tankenTokens.shadow.soft,
              }}
            >
              {alerts.map((alert) => {
                const config = CATEGORY_CONFIG[alert.category] ?? CATEGORY_CONFIG['other']
                const breaking = isBreakingAlert(alert.occurred_at)

                return (
                  <div
                    key={alert.id}
                    className="flex gap-3 p-3 md:p-4"
                    style={breaking ? { background: C.accentSoft } : undefined}
                  >
                    {/* カテゴリアイコン */}
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <AlertCircle
                        className="h-5 w-5"
                        style={{ color: config.color }}
                        aria-hidden="true"
                      />
                    </div>

                    {/* コンテンツ */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: config.color }}
                        >
                          {config.label}
                        </span>
                        {breaking && (
                          <span
                            className="inline-flex animate-pulse items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ background: C.danger }}
                          >
                            <span className="h-1 w-1 rounded-full bg-white" />
                            新着
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: C.inkFaint }}>
                          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                          {formatRelativeTime(alert.occurred_at)}
                        </span>
                      </div>

                      <p className="line-clamp-3 text-sm leading-snug" style={{ color: C.ink }}>
                        {alert.description}
                      </p>

                      <div className="mt-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs" style={{ color: C.inkSoft }}>
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {alert.prefecture}
                          {alert.city && ` ${alert.city}`}
                        </span>
                        {alert.source_url?.startsWith('https://') && (
                          <a
                            href={alert.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-0.5 rounded text-[10px] font-bold hover:underline ${tankenTokens.cls.focus}`}
                            style={{ color: C.sky }}
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            ソース
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
