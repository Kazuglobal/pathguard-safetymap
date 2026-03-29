"use client"

import * as React from "react"
import { AlertCircle, MapPin, Clock, Radio, ExternalLink } from "lucide-react"
import {
  useLocalSafetyAlerts,
  formatRelativeTime,
  isBreakingAlert,
  type LocalAlertCategory,
} from "@/hooks/use-local-safety-alerts"

// --- 定数 ---

const CATEGORY_CONFIG: Record<LocalAlertCategory, { label: string; color: string }> = {
  suspicious: { label: "不審者情報", color: "#F97316" },
  voice_call: { label: "声かけ事案", color: "#EF4444" },
  following:  { label: "つきまとい",  color: "#DC2626" },
  other:      { label: "その他",     color: "#6B7280" },
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

  return (
    <section className="py-6 md:py-10 bg-orange-50">
      <div className="max-w-6xl mx-auto">
        {/* セクションヘッダー */}
        <div className="flex flex-col items-start gap-2 px-4 mb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-orange-500 animate-pulse" />
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              今日の地域アラート
            </h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
              リアルタイム
            </span>
          </div>
          <p className="text-xs text-gray-400 px-0.5">
            3時間毎に収集・5分毎に自動更新
          </p>
        </div>

        {/* 都道府県フィルター */}
        {mounted && (
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
              <span className="text-xs text-gray-500 flex-shrink-0">地域:</span>
              {PREFECTURE_OPTIONS.map((pref) => (
                <button
                  key={pref}
                  onClick={() => handlePrefectureChange(pref)}
                  className={[
                    "flex-shrink-0 px-3 py-1 text-xs rounded-full border transition-colors",
                    selectedPrefecture === pref
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {pref}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* アラートリスト */}
        <div className="px-4">
          {isLoading && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
              取得中…
            </div>
          )}

          {error && (
            <div className="bg-white rounded-xl border border-red-200 p-4 text-sm text-red-500">
              アラートの取得に失敗しました
            </div>
          )}

          {!isLoading && !error && alerts.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
              {selectedPrefecture === "全国"
                ? "直近24時間のアラートはありません"
                : `${selectedPrefecture}の直近24時間のアラートはありません`}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {alerts.map((alert) => {
                const config = CATEGORY_CONFIG[alert.category] ?? CATEGORY_CONFIG['other']
                const breaking = isBreakingAlert(alert.occurred_at)

                return (
                  <div
                    key={alert.id}
                    className={[
                      "flex gap-3 p-3 md:p-4 transition-colors",
                      breaking ? "bg-orange-50" : "",
                    ].join(" ")}
                  >
                    {/* カテゴリアイコン */}
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <AlertCircle
                        className="w-5 h-5"
                        style={{ color: config.color }}
                      />
                    </div>

                    {/* コンテンツ */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-medium text-white rounded"
                          style={{ backgroundColor: config.color }}
                        >
                          {config.label}
                        </span>
                        {breaking && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-white" />
                            新着
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(alert.occurred_at)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-800 line-clamp-3 leading-snug">
                        {alert.description}
                      </p>

                      <div className="flex items-center justify-between mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {alert.prefecture}
                          {alert.city && ` ${alert.city}`}
                        </span>
                        {alert.source_url?.startsWith('https://') && (
                          <a
                            href={alert.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-[10px] text-blue-500 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
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
