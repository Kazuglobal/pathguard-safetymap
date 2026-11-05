/**
 * 検索エンジン向けの決まり(robots・サイトマップ・構造化データ・ねらう言葉)を1か所にまとめる。
 * 構造化データに書くことは、画面に見えている内容と同じにする(見えない文を検索向けに足さない)。
 */

import { PROTECTED_PREFIXES } from "./auth/protected-paths"
import { BRAND } from "./brand"

/** 公開URLの基点。本番は NEXT_PUBLIC_SITE_URL(CI で https://path-guardian.com を渡す) */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || BRAND.siteUrl).replace(/\/+$/, "")

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

/** 紹介ページでねらう言葉(タイトル・説明・FAQ の見えている文に入れる) */
export const SEO_KEYWORDS = [
  "通学路",
  "通学路 危険",
  "通学路 キケン",
  "通学路 危険箇所",
  "通学路 安全マップ",
  "通学路 見守り",
  "通学路 事故",
  "ヒヤリハット",
  "不審者情報",
  "ハザードマップ",
  "交通事故 多い場所",
  "見守りアプリ 無料",
] as const

/** ログインが要る画面(lib/auth/protected-paths.ts と同じ一覧)・管理・API・認証の途中の画面は検索に出さない */
export const ROBOTS_DISALLOW = [
  ...PROTECTED_PREFIXES,
  "/api/",
  "/auth",
  "/monitoring",
  "/access-denied",
  "/forgot-password",
  "/reset-password",
] as const

export interface StaticSitemapPage {
  path: string
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly"
  priority: number
}

/** ログインなしで見られる、検索に出したいページ */
export const STATIC_SITEMAP_PAGES: readonly StaticSitemapPage[] = [
  { path: "/lp", changeFrequency: "weekly", priority: 1 },
  { path: "/school-route-news", changeFrequency: "daily", priority: 0.9 },
  { path: "/safe-magazine", changeFrequency: "weekly", priority: 0.8 },
  { path: "/accidents", changeFrequency: "monthly", priority: 0.7 },
  { path: "/safety-quest", changeFrequency: "monthly", priority: 0.6 },
  { path: "/register", changeFrequency: "yearly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
]

export interface FaqEntry {
  q: string
  a: string
}

/** 紹介ページの構造化データ(WebSite・運営・ウェブアプリ・よくある質問) */
export function buildLpJsonLd(input: { description: string; faq: readonly FaqEntry[]; features: readonly string[] }) {
  const site = { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: absoluteUrl("/lp"), name: BRAND.name, alternateName: BRAND.descriptor, inLanguage: "ja-JP" }
  const organization = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND.name,
    url: SITE_URL,
    logo: absoluteUrl("/icon-512.png"),
    sameAs: [BRAND.instagram.url],
  }
  const application = {
    "@type": "WebApplication",
    name: BRAND.name,
    alternateName: BRAND.descriptor,
    url: absoluteUrl("/lp"),
    description: input.description,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web(スマートフォン・タブレット・パソコンのブラウザ)",
    inLanguage: "ja-JP",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
    featureList: input.features,
    publisher: { "@id": `${SITE_URL}/#organization` },
  }
  const faq = {
    "@type": "FAQPage",
    mainEntity: input.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
  return { "@context": "https://schema.org", "@graph": [site, organization, application, faq] }
}

/** JSON-LD を <script> に安全に埋める(</script> で閉じられないよう < を逃がす) */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}
