import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Script from "next/script"
import { getArticleBySlug } from "@/lib/safe-magazine"
import {
  generateSEOTitle,
  generateMetaDescription,
  extractKeywords,
  generateArticleSchema,
  generateFAQSchema,
  generateHowToSchema
} from "@/lib/seo-generator"
import { ArticleContent } from "./ArticleContent"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com"

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

// SEOメタデータを生成
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    return {
      title: "記事が見つかりません | SAFE MAGAZINE",
      description: "お探しの記事は見つかりませんでした。"
    }
  }

  const title = generateSEOTitle(article)
  const description = generateMetaDescription(article)
  const keywords = extractKeywords(article)
  const articleUrl = `${SITE_URL}/safe-magazine/${slug}`
  const imageUrl = article.thumbnailUrl
    ? `${SITE_URL}${article.thumbnailUrl}`
    : `${SITE_URL}/images/safe-magazine/default-thumbnail.png`

  return {
    title,
    description,
    keywords: keywords.join(", "),
    authors: [{ name: "SAFE MAGAZINE編集部" }],
    openGraph: {
      title,
      description,
      url: articleUrl,
      siteName: "通学路安全マップ",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: article.title
        }
      ],
      locale: "ja_JP",
      type: "article",
      publishedTime: article.publishedDate,
      authors: ["SAFE MAGAZINE編集部"],
      tags: article.tags
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl]
    },
    alternates: {
      canonical: articleUrl
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1
      }
    }
  }
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  // 構造化データを生成
  const articleSchema = generateArticleSchema(article)
  const faqSchema = generateFAQSchema(article)
  const howToSchema = generateHowToSchema(article)

  const structuredData: object[] = [articleSchema]
  if (faqSchema) structuredData.push(faqSchema)
  if (howToSchema) structuredData.push(howToSchema)

  return (
    <>
      {/* 構造化データ（JSON-LD） */}
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData)
        }}
      />

      <ArticleContent article={article} />
    </>
  )
}
