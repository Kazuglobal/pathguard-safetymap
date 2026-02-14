/**
 * SEO Generator for PathGuard Press
 * 記事のSEOメタデータ、構造化データを生成
 */

import type { SafeMagazineArticle } from "./safe-magazine"

export interface SEOMetadata {
  title: string
  description: string
  canonical: string
  keywords: string[]
  ogTags: {
    title: string
    description: string
    image: string
    url: string
    type: string
    siteName: string
    locale: string
  }
  twitterCard: {
    card: string
    title: string
    description: string
    image: string
  }
  structuredData: {
    article: ArticleSchema
    faq?: FAQSchema
    howTo?: HowToSchema
  }
}

interface ArticleSchema {
  "@context": string
  "@type": string
  headline: string
  description: string
  image: string
  datePublished: string
  dateModified: string
  author: {
    "@type": string
    name: string
  }
  publisher: {
    "@type": string
    name: string
    logo: {
      "@type": string
      url: string
    }
  }
  mainEntityOfPage: {
    "@type": string
    "@id": string
  }
}

interface FAQSchema {
  "@context": string
  "@type": string
  mainEntity: Array<{
    "@type": string
    name: string
    acceptedAnswer: {
      "@type": string
      text: string
    }
  }>
}

interface HowToSchema {
  "@context": string
  "@type": string
  name: string
  description: string
  step: Array<{
    "@type": string
    name: string
    text: string
  }>
}

const SITE_NAME = "通学路安全マップ"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com"
const LOGO_URL = `${SITE_URL}/logo.png`

/**
 * SEO最適化されたタイトルを生成
 */
export function generateSEOTitle(article: SafeMagazineArticle): string {
  const maxLength = 60
  const suffix = " | PathGuard Press"
  const availableLength = maxLength - suffix.length

  let title = article.title
  if (title.length > availableLength) {
    title = title.substring(0, availableLength - 3) + "..."
  }

  return title + suffix
}

/**
 * SEO最適化されたメタディスクリプションを生成
 */
export function generateMetaDescription(article: SafeMagazineArticle): string {
  const maxLength = 160
  let description = article.excerpt

  if (description.length > maxLength) {
    description = description.substring(0, maxLength - 3) + "..."
  }

  return description
}

/**
 * 記事からキーワードを抽出
 */
export function extractKeywords(article: SafeMagazineArticle): string[] {
  const baseKeywords = ["通学路", "安全", "子ども", "PathGuard Press"]
  const categoryKeywords: Record<string, string[]> = {
    "accident-news": ["事故", "交通事故", "通学路事故", "小学生"],
    "danger-ranking": ["危険", "統計", "リスク", "危険箇所"],
    "volunteer-activity": ["見守り", "ボランティア", "地域安全", "防犯"],
    "safety-tips": ["安全対策", "防犯", "安全教育"],
    "policy-update": ["施策", "制度", "行政"]
  }

  return [
    ...baseKeywords,
    ...(categoryKeywords[article.category] || []),
    ...article.tags.slice(0, 5)
  ]
}

/**
 * Article構造化データを生成
 */
export function generateArticleSchema(article: SafeMagazineArticle): ArticleSchema {
  const articleUrl = `${SITE_URL}/safe-magazine/${article.slug}`
  const imageUrl = article.thumbnailUrl
    ? `${SITE_URL}${article.thumbnailUrl}`
    : `${SITE_URL}/images/safe-magazine/default-thumbnail.png`

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    image: imageUrl,
    datePublished: article.publishedDate,
    dateModified: article.publishedDate,
    author: {
      "@type": "Organization",
      name: "PathGuard Press編集部"
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: LOGO_URL
      }
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl
    }
  }
}

/**
 * FAQスキーマを生成（キーポイントから）
 */
export function generateFAQSchema(article: SafeMagazineArticle): FAQSchema | undefined {
  if (article.keyPoints.length < 2) {
    return undefined
  }

  // キーポイントをQ&A形式に変換
  const faqs = article.keyPoints.map((point, index) => ({
    "@type": "Question" as const,
    name: `${article.categoryLabel}について: ポイント${index + 1}`,
    acceptedAnswer: {
      "@type": "Answer" as const,
      text: point
    }
  }))

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs
  }
}

/**
 * HowToスキーマを生成（ガイド記事用）
 */
export function generateHowToSchema(article: SafeMagazineArticle): HowToSchema | undefined {
  // 記事内容からステップを抽出（簡易版）
  if (article.category !== "volunteer-activity" && article.category !== "safety-tips") {
    return undefined
  }

  const steps = article.keyPoints.map((point, index) => ({
    "@type": "HowToStep" as const,
    name: `ステップ ${index + 1}`,
    text: point
  }))

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: article.title,
    description: article.excerpt,
    step: steps
  }
}

/**
 * OGPタグを生成
 */
export function generateOGTags(article: SafeMagazineArticle): SEOMetadata["ogTags"] {
  const articleUrl = `${SITE_URL}/safe-magazine/${article.slug}`
  const imageUrl = article.thumbnailUrl
    ? `${SITE_URL}${article.thumbnailUrl}`
    : `${SITE_URL}/images/safe-magazine/default-thumbnail.png`

  return {
    title: generateSEOTitle(article),
    description: generateMetaDescription(article),
    image: imageUrl,
    url: articleUrl,
    type: "article",
    siteName: SITE_NAME,
    locale: "ja_JP"
  }
}

/**
 * Twitterカードを生成
 */
export function generateTwitterCard(article: SafeMagazineArticle): SEOMetadata["twitterCard"] {
  const imageUrl = article.thumbnailUrl
    ? `${SITE_URL}${article.thumbnailUrl}`
    : `${SITE_URL}/images/safe-magazine/default-thumbnail.png`

  return {
    card: "summary_large_image",
    title: generateSEOTitle(article),
    description: generateMetaDescription(article),
    image: imageUrl
  }
}

/**
 * 完全なSEOメタデータを生成
 */
export function generateSEOMetadata(article: SafeMagazineArticle): SEOMetadata {
  return {
    title: generateSEOTitle(article),
    description: generateMetaDescription(article),
    canonical: `/safe-magazine/${article.slug}`,
    keywords: extractKeywords(article),
    ogTags: generateOGTags(article),
    twitterCard: generateTwitterCard(article),
    structuredData: {
      article: generateArticleSchema(article),
      faq: generateFAQSchema(article),
      howTo: generateHowToSchema(article)
    }
  }
}

/**
 * 構造化データをJSON文字列に変換
 */
export function stringifyStructuredData(schema: object): string {
  return JSON.stringify(schema, null, 0)
}
