// 通学路の安全ニュース: クライアント安全なフィード用ユーティリティ
//
// このモジュールは NEWS_ITEMS（記事全文データ）を一切importしない。
// クライアントコンポーネントは必ずこちらからimportすること。
// lib/school-route-news.ts をクライアントから直接importすると
// 全記事本文がJSバンドルに載る（レビューC3の回帰）ため禁止。

import type { SchoolRouteNewsItem } from "./school-route-news"

export type NewsCategory = "accident" | "suspicious" | "infrastructure" | "policy" | "community"

export type SchoolRouteNewsType = "daily" | "weekly_trend"

/** フィード表示用の記事型。本文（content）を持たない */
export type SchoolRouteNewsFeedItem = Omit<SchoolRouteNewsItem, "content">

// カテゴリーの定義
export const NEWS_CATEGORIES = {
  "accident": {
    label: "交通事故",
    color: "#EF4444",
    bgColor: "bg-red-500",
    textColor: "text-red-600",
    bgLight: "bg-red-50",
    icon: "AlertTriangle"
  },
  "suspicious": {
    label: "不審者情報",
    color: "#F97316",
    bgColor: "bg-orange-500",
    textColor: "text-orange-600",
    bgLight: "bg-orange-50",
    icon: "AlertCircle"
  },
  "infrastructure": {
    label: "インフラ整備",
    color: "#3B82F6",
    bgColor: "bg-blue-500",
    textColor: "text-blue-600",
    bgLight: "bg-blue-50",
    icon: "Construction"
  },
  "policy": {
    label: "施策・対策",
    color: "#8B5CF6",
    bgColor: "bg-purple-500",
    textColor: "text-purple-600",
    bgLight: "bg-purple-50",
    icon: "FileText"
  },
  "community": {
    label: "地域活動",
    color: "#22C55E",
    bgColor: "bg-green-500",
    textColor: "text-green-600",
    bgLight: "bg-green-50",
    icon: "Users"
  }
} as const

// 日付をフォーマット
export function formatNewsDate(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

// ---- 今日のダイジェスト（デイリーハビット設計 v3） ----

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

// ISO文字列/DateをJSTの暦日キー（YYYY-MM-DD）に丸める
export function toJstDateKey(dateInput: string | Date): string {
  const time = new Date(dateInput).getTime()
  if (Number.isNaN(time)) return ""
  return new Date(time + JST_OFFSET_MS).toISOString().slice(0, 10)
}

export interface DailyDigestSummary {
  /** JSTの暦日 YYYY-MM-DD */
  date: string
  /** 今日公開されたLayer 1記事の件数（全国） */
  nationalCount: number
  /** うち指定都道府県に一致する件数（「全国」指定時は nationalCount と同値） */
  localNewsCount: number
  prefecture: string
}

/** 「今日は全国でX件・あなたの地域でY件」の集計（渡されたitemsから計算する純関数） */
export function computeDailyDigest(
  items: readonly Pick<SchoolRouteNewsFeedItem, "publishedDate" | "location">[],
  prefecture: string,
  now: Date = new Date()
): DailyDigestSummary {
  const today = toJstDateKey(now)
  const todaysItems = items.filter(item => toJstDateKey(item.publishedDate) === today)
  const localNewsCount = prefecture === "全国"
    ? todaysItems.length
    : todaysItems.filter(item => item.location.prefecture === prefecture).length

  return {
    date: today,
    nationalCount: todaysItems.length,
    localNewsCount,
    prefecture,
  }
}

/** 最新の週次傾向記事を返す（フィードの「今週の傾向」枠にピン留めする） */
export function findLatestWeeklyTrend<
  T extends Pick<SchoolRouteNewsFeedItem, "newsType" | "publishedDate">,
>(items: readonly T[]): T | undefined {
  return [...items]
    .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
    .find(item => item.newsType === "weekly_trend")
}
