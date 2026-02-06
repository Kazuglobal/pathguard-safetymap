"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight, AlertTriangle, BarChart2, Users, Shield, FileText } from "lucide-react"
import { getAllArticles, formatDate, CATEGORIES, type CategoryKey } from "@/lib/safe-magazine"

const CATEGORY_ICONS = {
  "AlertTriangle": AlertTriangle,
  "BarChart2": BarChart2,
  "Users": Users,
  "Shield": Shield,
  "FileText": FileText,
}

export function SafetyNewsSection() {
  const articles = getAllArticles()

  return (
    <section className="py-6 md:py-10">
      <div className="max-w-6xl mx-auto">
        {/* セクションヘッダー */}
        <div className="flex items-center justify-between px-4 mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">通学路の安全NEWS</h2>
          <Link
            href="/safe-magazine"
            className="flex items-center gap-0.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            すべて見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* モバイル: 横スクロール / デスクトップ: グリッド */}
        <div className="overflow-x-auto scrollbar-hide md:overflow-visible">
          <div className="flex gap-3 px-4 pb-2 md:grid md:grid-cols-3 md:gap-4">
            {articles.map((article) => {
              const category = CATEGORIES[article.category as CategoryKey]
              const IconComponent = category ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] : null

              return (
                <Link
                  key={article.id}
                  href={`/safe-magazine/${article.slug}`}
                  className="flex-shrink-0 w-72 md:w-auto bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div
                    className="relative h-36 md:h-40"
                    style={{ backgroundColor: `${article.categoryColor}15` }}
                  >
                    {article.thumbnailUrl ? (
                      <Image
                        src={article.thumbnailUrl}
                        alt={article.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 288px, 33vw"
                      />
                    ) : (
                      IconComponent && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <IconComponent
                            className="w-12 h-12 opacity-30"
                            style={{ color: article.categoryColor }}
                          />
                        </div>
                      )
                    )}
                    <span
                      className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium text-white rounded flex items-center gap-1 z-10"
                      style={{ backgroundColor: article.categoryColor }}
                    >
                      {IconComponent && <IconComponent className="w-3 h-3" />}
                      {article.categoryLabel}
                    </span>
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="text-sm md:text-base font-medium text-gray-900 line-clamp-2 leading-tight mb-2">
                      {article.title}
                    </h3>
                    <p className="text-xs text-gray-400">{formatDate(article.publishedDate)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
