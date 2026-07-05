// ランディング「通学路の安全ニュース」プレビュー
//
// lib/school-route-news.ts の NEWS_ITEMS からの自動導出。
// 手動配列を持つとサムネイル・タイトルの同期漏れが再発するため、
// ここに独立データを追加してはならない（公開前監査の差し戻し対象）。

import { getAllNewsItems } from "./school-route-news"

export interface LandingNewsPreviewItem {
  id: string
  slug: string
  title: string
  categoryLabel: string
  categoryColor: string
  categoryIcon: string
  publishedDate: string
  location: {
    prefecture: string
    city?: string
  }
  thumbnailUrl?: string
  isBreaking?: boolean
}

export function getLandingNewsPreview(count = 5): LandingNewsPreviewItem[] {
  return getAllNewsItems()
    .slice(0, count)
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      categoryLabel: item.categoryLabel,
      categoryColor: item.categoryColor,
      categoryIcon: item.categoryIcon,
      publishedDate: item.publishedDate,
      location: {
        prefecture: item.location.prefecture,
        city: item.location.city,
      },
      thumbnailUrl: item.thumbnailUrl,
      isBreaking: item.isBreaking,
    }))
}

export function formatLandingNewsDate(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
}
