"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight, AlertTriangle, AlertCircle, Construction, FileText, Users, MapPin, Clock, Zap } from "lucide-react"
import { getLatestNews, formatNewsDate, NEWS_CATEGORIES, type NewsCategory } from "@/lib/school-route-news"

const CATEGORY_ICONS = {
  "AlertTriangle": AlertTriangle,
  "AlertCircle": AlertCircle,
  "Construction": Construction,
  "FileText": FileText,
  "Users": Users,
}

export function SchoolRouteNewsSection() {
  const newsItems = getLatestNews(5)

  return (
    <section className="py-6 md:py-10 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* セクションヘッダー */}
        <div className="flex items-center justify-between px-4 mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-500" />
            <h2 className="text-lg md:text-xl font-bold text-gray-900">通学路の安全ニュース</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded-full">
              リアルタイム
            </span>
          </div>
          <Link
            href="/school-route-news"
            className="flex items-center gap-0.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            すべて見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ニュースリスト */}
        <div className="px-4">
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {newsItems.map((item) => {
              const category = NEWS_CATEGORIES[item.category as NewsCategory]
              const IconComponent = category ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] : AlertTriangle

              return (
                <Link
                  key={item.id}
                  href={`/school-route-news/${item.slug}`}
                  className="flex gap-3 p-3 md:p-4 hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  {/* サムネイル */}
                  <div
                    className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden"
                    style={{ backgroundColor: `${item.categoryColor}15` }}
                  >
                    {item.thumbnailUrl ? (
                      <Image
                        src={item.thumbnailUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {IconComponent && (
                          <IconComponent
                            className="w-8 h-8 opacity-40"
                            style={{ color: item.categoryColor }}
                          />
                        )}
                      </div>
                    )}
                    {item.isBreaking && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded">
                        速報
                      </span>
                    )}
                  </div>

                  {/* コンテンツ */}
                  <div className="flex-1 min-w-0">
                    {/* カテゴリーと時間 */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-white rounded"
                        style={{ backgroundColor: item.categoryColor }}
                      >
                        {IconComponent && <IconComponent className="w-2.5 h-2.5" />}
                        {item.categoryLabel}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                        <Clock className="w-2.5 h-2.5" />
                        {formatNewsDate(item.publishedDate)}
                      </span>
                    </div>

                    {/* タイトル */}
                    <h3 className="text-sm md:text-base font-medium text-gray-900 line-clamp-2 leading-tight mb-1">
                      {item.title}
                    </h3>

                    {/* 場所 */}
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      <span>{item.location.prefecture}{item.location.city && ` ${item.location.city}`}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* 都道府県フィルター（オプション） */}
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
            <span className="text-xs text-gray-500 flex-shrink-0">地域:</span>
            {["全国", "東京都", "大阪府", "愛知県", "福岡県", "北海道"].map((pref) => (
              <button
                key={pref}
                className="flex-shrink-0 px-3 py-1 text-xs bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
              >
                {pref}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
