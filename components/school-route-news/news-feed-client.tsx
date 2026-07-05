"use client"

/**
 * news-feed-client.tsx
 *
 * 通学路の安全ニュースのフィード本体（デイリーハビット設計 v3）。
 * 構成: ダイジェストヘッダー → あなたの地域 → 今週の傾向 → 全国のトピック → 終端カード。
 * 「有限のフィード＋完了感」「地域による自分ごと化」「恐怖で終わらせない」を実装する。
 */

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  Leaf,
  MapPin,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react"
import {
  computeDailyDigest,
  findLatestWeeklyTrend,
  NEWS_CATEGORIES,
  type DailyDigestSummary,
  type NewsCategory,
  type SchoolRouteNewsFeedItem,
} from "@/lib/school-route-news-feed"
import {
  useLocalSafetyAlerts,
  formatRelativeTime,
  type LocalAlertCategory,
} from "@/hooks/use-local-safety-alerts"
import { useNewsReadState } from "@/hooks/use-news-read-state"
import { getActionPhraseForAlert } from "@/lib/local-alert-action-phrases"
import {
  NATIONWIDE,
  getRegionChipOptions,
  getStoredRegion,
  setStoredRegion,
} from "@/lib/user-region"
import { syncPushSubscriptionRegion } from "@/hooks/use-push-subscription"
import { NewsItemCard, CATEGORY_ICONS } from "./news-item-card"

const ALERT_CATEGORY_LABELS: Record<LocalAlertCategory, string> = {
  suspicious: "不審者情報",
  voice_call: "声かけ事案",
  following: "つきまとい",
  other: "その他",
}

interface NewsFeedClientProps {
  items: SchoolRouteNewsFeedItem[]
}

function formatDigestDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  if (!year || !month || !day) return dateKey
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
  const weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${month}月${day}日(${weekday})`
}

export function NewsFeedClient({ items }: NewsFeedClientProps) {
  const [mounted, setMounted] = React.useState(false)
  const [selectedPrefecture, setSelectedPrefecture] = React.useState<string>(NATIONWIDE)
  const [activeCategory, setActiveCategory] = React.useState<NewsCategory | "all">("all")
  // 「今日」の判定はクライアントの時計に依存するため、SSR/静的HTMLとの
  // hydration mismatchを避けてマウント後にのみ計算する
  const [digest, setDigest] = React.useState<DailyDigestSummary | null>(null)
  const { hydrated, isRead, markRead, streakDays } = useNewsReadState()

  React.useEffect(() => {
    setMounted(true)
    setSelectedPrefecture(getStoredRegion())
  }, [])

  React.useEffect(() => {
    if (!mounted) return
    setDigest(computeDailyDigest(items, selectedPrefecture))
  }, [mounted, items, selectedPrefecture])

  const handlePrefectureChange = React.useCallback((pref: string) => {
    setSelectedPrefecture(pref)
    setStoredRegion(pref)
    void syncPushSubscriptionRegion(pref)
  }, [])

  const { alerts } = useLocalSafetyAlerts({
    prefecture: selectedPrefecture,
    limitHours: 24,
  })

  const weeklyTrend = findLatestWeeklyTrend(items)
  const feedItems = items.filter((item) => item.newsType !== "weekly_trend")

  const regionSelected = selectedPrefecture !== NATIONWIDE
  const regionItems = regionSelected
    ? feedItems.filter((item) => item.location.prefecture === selectedPrefecture)
    : []
  const nationalItems = regionSelected
    ? feedItems.filter((item) => item.location.prefecture !== selectedPrefecture)
    : feedItems
  const filteredNationalItems =
    activeCategory === "all"
      ? nationalItems
      : nationalItems.filter((item) => item.category === activeCategory)

  const unreadCount = hydrated
    ? items.filter((item) => !isRead(item.slug)).length
    : items.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/landing"
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-red-500" />
                <h1 className="text-xl font-bold text-gray-900">通学路の安全ニュース</h1>
              </div>
              <p className="text-sm text-gray-500">編集部が選んだ通学路の安全トピック</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* 今日のダイジェストヘッダー */}
        <section className="mb-5 rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              {digest ? (
                <>
                  <p className="text-xs font-medium text-gray-500">
                    {formatDigestDate(digest.date)} のダイジェスト
                  </p>
                  <p className="mt-0.5 text-base font-bold text-gray-900">
                    今日のニュース{digest.nationalCount}件
                    {regionSelected && `・${selectedPrefecture}のアラート${alerts.length}件（24時間）`}
                    {digest.nationalCount === 0 &&
                      (!regionSelected || alerts.length === 0) &&
                      " — 新しい情報はありません"}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-gray-400">
                  きょうのダイジェストを確認しています…
                </p>
              )}
            </div>
            {mounted && hydrated && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  <Leaf className="h-3.5 w-3.5" />
                  見守り継続{streakDays}日目
                </span>
                {unreadCount > 0 ? (
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600">
                    未読 {unreadCount}件
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    すべて確認済み
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 地域フィルター */}
        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
          <span className="flex-shrink-0 text-xs font-bold text-gray-500">地域:</span>
          {getRegionChipOptions(selectedPrefecture).map((pref) => {
            const active = selectedPrefecture === pref
            return (
              <button
                key={pref}
                onClick={() => handlePrefectureChange(pref)}
                aria-pressed={active}
                className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {pref}
              </button>
            )
          })}
        </div>

        {/* あなたの地域 */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-gray-900">
              あなたの地域{regionSelected ? `（${selectedPrefecture}）` : ""}
            </h2>
          </div>

          {!regionSelected ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
              お住まいの都道府県を選ぶと、あなたの地域のアラートとニュースをここにまとめて表示します。
            </div>
          ) : (
            <div className="space-y-3">
              {/* Layer 2: 24時間以内の地域アラート */}
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-orange-100 bg-white p-4"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <AlertCircle className="h-3 w-3" />
                      {ALERT_CATEGORY_LABELS[alert.category] ?? "その他"}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                      <Clock className="h-2.5 w-2.5" />
                      {formatRelativeTime(alert.occurred_at)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                      <MapPin className="h-2.5 w-2.5" />
                      {alert.prefecture}
                      {alert.city && ` ${alert.city}`}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm leading-snug text-gray-800">
                    {alert.description}
                  </p>
                  <p className="mt-2 flex items-start gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs leading-snug text-emerald-800">
                    <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span>
                      <span className="font-bold">そなえ: </span>
                      {getActionPhraseForAlert(alert.id, alert.category)}
                    </span>
                  </p>
                </div>
              ))}

              {/* Layer 1: 地域一致の記事 */}
              {regionItems.map((item) => (
                <NewsItemCard
                  key={item.id}
                  item={item}
                  isRead={hydrated && isRead(item.slug)}
                  onRead={markRead}
                />
              ))}

              {/* 0件の安心カード */}
              {alerts.length === 0 && regionItems.length === 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-5">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50">
                    <Leaf className="h-5 w-5 text-emerald-600" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedPrefecture}では、この24時間 新しい事案はありません
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      いつもどおりです。このまま見守りを続けましょう。
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 今週の傾向（週次ロールアップのピン留め） */}
        {weeklyTrend && (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <h2 className="text-base font-bold text-gray-900">今週の傾向</h2>
            </div>
            <NewsItemCard
              item={weeklyTrend}
              isRead={hydrated && isRead(weeklyTrend.slug)}
              onRead={markRead}
            />
          </section>
        )}

        {/* 全国のトピック */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-bold text-gray-900">全国のトピック</h2>
          </div>

          {/* カテゴリーフィルター */}
          <div className="flex gap-2 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setActiveCategory("all")}
              aria-pressed={activeCategory === "all"}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === "all"
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              すべて
            </button>
            {(Object.entries(NEWS_CATEGORIES) as [NewsCategory, (typeof NEWS_CATEGORIES)[NewsCategory]][]).map(
              ([key, category]) => {
                const IconComponent = CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS]
                const active = activeCategory === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    aria-pressed={active}
                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-gray-900 text-white"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {IconComponent && (
                      <IconComponent
                        className="h-4 w-4"
                        style={active ? undefined : { color: category.color }}
                      />
                    )}
                    {category.label}
                  </button>
                )
              }
            )}
          </div>

          <div className="space-y-4">
            {filteredNationalItems.map((item) => (
              <NewsItemCard
                key={item.id}
                item={item}
                isRead={hydrated && isRead(item.slug)}
                onRead={markRead}
              />
            ))}
          </div>

          {filteredNationalItems.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-gray-500">このカテゴリーのニュースはありません</p>
            </div>
          )}
        </section>

        {/* 終端カード（完了感） */}
        <section className="mt-8 mb-4">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-emerald-100 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <p className="text-sm font-bold text-emerald-800">今日のチェックは以上です</p>
            <p className="text-xs text-emerald-700">
              次の更新は明日の朝7:30です。いつもの見守り、おつかれさまです。
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
