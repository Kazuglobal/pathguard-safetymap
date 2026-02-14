"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, AlertTriangle, BarChart2, Users, Shield, FileText, Clock, Tag } from "lucide-react"
import { getAllArticles, CATEGORIES, formatDate, type CategoryKey } from "@/lib/safe-magazine"

const CATEGORY_ICONS = {
  "AlertTriangle": AlertTriangle,
  "BarChart2": BarChart2,
  "Users": Users,
  "Shield": Shield,
  "FileText": FileText,
}

export default function SafeMagazinePage() {
  const articles = getAllArticles()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/landing"
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">PathGuard Press</h1>
              <p className="text-sm text-gray-500">通学路の安全に関する最新情報</p>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* カテゴリーフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          <button className="flex-shrink-0 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full">
            すべて
          </button>
          {Object.entries(CATEGORIES).map(([key, category]) => {
            const IconComponent = CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS]
            return (
              <button
                key={key}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-full border border-gray-200 hover:border-gray-300 transition-colors"
              >
                {IconComponent && <IconComponent className="w-4 h-4" style={{ color: category.color }} />}
                {category.label}
              </button>
            )
          })}
        </div>

        {/* 記事リスト */}
        <div className="space-y-4">
          {articles.map((article) => {
            const category = CATEGORIES[article.category as CategoryKey]
            const IconComponent = category ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] : null

            return (
              <Link
                key={article.id}
                href={`/safe-magazine/${article.slug}`}
                className="block bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row">
                  {/* サムネイル画像 */}
                  {article.thumbnailUrl && (
                    <div className="relative w-full md:w-48 h-32 md:h-auto flex-shrink-0">
                      <Image
                        src={article.thumbnailUrl}
                        alt={article.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 192px"
                      />
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="p-5">
                      {/* カテゴリーバッジと日付 */}
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: article.categoryColor }}
                        >
                          {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                          {article.categoryLabel}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(article.publishedDate)}
                        </div>
                      </div>

                      {/* タイトル */}
                      <h2 className="text-lg font-bold text-gray-900 leading-tight mb-2">
                        {article.title}
                      </h2>

                      {/* 概要 */}
                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-3">
                        {article.excerpt}
                      </p>

                      {/* タグ */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {article.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                          >
                            <Tag className="w-3 h-3" />
                            {tag}
                          </span>
                        ))}
                        {article.tags.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{article.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ポイントまとめ */}
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-1.5">ポイント</p>
                      <ul className="text-xs text-gray-700 space-y-0.5">
                        {article.keyPoints.slice(0, 2).map((point, index) => (
                          <li key={index} className="line-clamp-1">• {point}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* 空の状態 */}
        {articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">記事がありません</p>
          </div>
        )}
      </main>
    </div>
  )
}
