"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface NewsItem {
  id: string
  imageUrl: string
  title: string
  date: string
  category: string
}

const newsItems: NewsItem[] = [
  {
    id: "1",
    imageUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400&h=300&fit=crop",
    title: "冬の通学路、凍結箇所に注意！今日から対策を",
    date: "2024.12.14",
    category: "安全情報",
  },
  {
    id: "2",
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",
    title: "〇〇市で見守りボランティア200名達成",
    date: "2024.12.13",
    category: "地域活動",
  },
  {
    id: "3",
    imageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop",
    title: "子どもの防犯力を高める5つのポイント",
    date: "2024.12.12",
    category: "教育",
  },
  {
    id: "4",
    imageUrl: "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?w=400&h=300&fit=crop",
    title: "交差点の危険度ランキング発表",
    date: "2024.12.11",
    category: "データ分析",
  },
]

export function SafetyNewsSection() {
  return (
    <section className="py-6 md:py-10">
      <div className="max-w-6xl mx-auto">
        {/* セクションヘッダー */}
        <div className="flex items-center justify-between px-4 mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">通学路の安全NEWS</h2>
          <Link
            href="#"
            className="flex items-center gap-0.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            すべて見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* モバイル: 横スクロール / デスクトップ: グリッド */}
        <div className="overflow-x-auto scrollbar-hide md:overflow-visible">
          <div className="flex gap-3 px-4 pb-2 md:grid md:grid-cols-4 md:gap-4">
            {newsItems.map((item) => (
              <article
                key={item.id}
                className="flex-shrink-0 w-64 md:w-auto bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 256px, 300px"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 text-xs font-medium text-gray-700 rounded">
                    {item.category}
                  </span>
                </div>
                <div className="p-3 md:p-4">
                  <h3 className="text-sm md:text-base font-medium text-gray-900 line-clamp-2 leading-tight mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-400">{item.date}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
