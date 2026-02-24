"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, AlertTriangle, BarChart2, Users, Shield, FileText, Clock, Tag, ExternalLink, CheckCircle } from "lucide-react"
import { CATEGORIES, formatDate, type CategoryKey, type SafeMagazineArticle } from "@/lib/safe-magazine"
import ReactMarkdown from "react-markdown"

const CATEGORY_ICONS = {
  "AlertTriangle": AlertTriangle,
  "BarChart2": BarChart2,
  "Users": Users,
  "Shield": Shield,
  "FileText": FileText,
}

interface ArticleContentProps {
  article: SafeMagazineArticle
}

export function ArticleContent({ article }: ArticleContentProps) {
  const category = CATEGORIES[article.category as CategoryKey]
  const IconComponent = category ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] : null

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/safe-magazine"
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <span className="text-sm font-medium text-gray-500">SAFE MAGAZINE</span>
          </div>
        </div>
      </header>

      {/* サムネイル画像 */}
      {article.thumbnailUrl && (
        <div className="relative w-full aspect-[16/9] bg-gray-100">
          <Image
            src={article.thumbnailUrl}
            alt={article.title}
            fill
            className="object-contain"
            priority
          />
        </div>
      )}

      {/* 記事ヘッダー */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* カテゴリーと日付 */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: article.categoryColor }}
          >
            {IconComponent && <IconComponent className="w-4 h-4" />}
            {article.categoryLabel}
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            {formatDate(article.publishedDate)}
          </div>
        </div>

        {/* タイトル */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-4">
          {article.title}
        </h1>

        {/* 概要 */}
        <p className="text-base text-gray-600 leading-relaxed mb-6">
          {article.excerpt}
        </p>

        {/* タグ */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
            >
              <Tag className="w-3.5 h-3.5" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ポイントまとめカード */}
      <div className="max-w-3xl mx-auto px-4 mb-8">
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-100">
          <h2 className="flex items-center gap-2 text-base font-bold text-emerald-800 mb-3">
            <CheckCircle className="w-5 h-5" />
            この記事のポイント
          </h2>
          <ul className="space-y-2">
            {article.keyPoints.map((point, index) => (
              <li key={index} className="flex gap-2 text-sm text-emerald-700">
                <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 bg-emerald-200 text-emerald-800 text-xs font-bold rounded-full">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 本文 */}
      <article className="max-w-3xl mx-auto px-4 pb-8">
        <div className="prose prose-gray prose-lg max-w-none">
          <ReactMarkdown
            components={{
              h3: ({ children }) => (
                <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200">
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-lg font-bold text-gray-800 mt-6 mb-3">
                  {children}
                </h4>
              ),
              p: ({ children }) => (
                <p className="text-base text-gray-700 leading-relaxed mb-4">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-5 mb-4 space-y-1">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 mb-4 space-y-1">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-base text-gray-700 leading-relaxed">
                  {children}
                </li>
              ),
              strong: ({ children }) => (
                <strong className="font-bold text-gray-900">{children}</strong>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full border-collapse border border-gray-200 text-sm">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left font-medium text-gray-700">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-gray-200 px-4 py-2 text-gray-600">
                  {children}
                </td>
              ),
            }}
          >
            {article.content}
          </ReactMarkdown>
        </div>
      </article>

      {/* 記事内画像 */}
      {article.contentImages && article.contentImages.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 pb-8">
          <div className="grid gap-6">
            {article.contentImages.map((image) => (
              <figure key={image.id} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <div className="relative w-full aspect-[4/3]">
                  <Image
                    src={image.url}
                    alt={image.description}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 768px"
                  />
                </div>
                <figcaption className="px-4 py-3 bg-gray-50 text-sm text-gray-600 text-center border-t border-gray-200">
                  {image.description}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {/* 出典 */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-700 mb-3">
            <ExternalLink className="w-5 h-5" />
            出典・参考資料
          </h2>
          <ul className="space-y-2">
            {article.sources.map((source, index) => (
              <li key={index} className="text-sm text-gray-600 leading-relaxed">
                • {source}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* フッターナビゲーション */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        <Link
          href="/safe-magazine"
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          記事一覧に戻る
        </Link>
      </div>
    </div>
  )
}
