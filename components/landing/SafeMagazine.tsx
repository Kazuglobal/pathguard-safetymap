"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight, BookOpen } from "lucide-react"

interface MagazineArticle {
  id: string
  imageUrl: string
  title: string
  excerpt: string
  category: string
  readTime: string
}

const articles: MagazineArticle[] = [
  {
    id: "1",
    imageUrl: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&h=400&fit=crop",
    title: "子どもに教えたい「いかのおすし」の正しい使い方",
    excerpt: "防犯標語として知られる「いかのおすし」。でも正しく理解している子どもは意外と少ない？専門家に聞く効果的な教え方。",
    category: "防犯教育",
    readTime: "5分",
  },
  {
    id: "2",
    imageUrl: "https://images.unsplash.com/photo-1588072432836-e10032774350?w=600&h=400&fit=crop",
    title: "通学路の危険スポットを見つける親子ウォークのすすめ",
    excerpt: "実際に歩いてみると見えてくる危険箇所。週末を使った「安全マップづくり」で子どもの危険察知力を高めよう。",
    category: "親子活動",
    readTime: "7分",
  },
  {
    id: "3",
    imageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&h=400&fit=crop",
    title: "地域で守る子どもの安全〜見守りボランティア入門",
    excerpt: "高齢化が進む地域でも始められる、無理のない見守り活動とは。先進事例から学ぶ持続可能な見守りのコツ。",
    category: "地域連携",
    readTime: "8分",
  },
]

export function SafeMagazine() {
  return (
    <section className="py-6 md:py-10">
      <div className="max-w-6xl mx-auto">
        {/* セクションヘッダー */}
        <div className="flex items-center justify-between px-4 mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
            <h2 className="text-lg md:text-xl font-bold text-gray-900">SAFE MAGAZINE</h2>
          </div>
          <Link
            href="#"
            className="flex items-center gap-0.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            すべて見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 記事リスト（デスクトップはグリッド） */}
        <div className="px-4 space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
          {articles.map((article) => (
            <article
              key={article.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              {/* アイキャッチ画像 */}
              <div className="relative aspect-[2/1] md:aspect-[3/2]">
                <Image
                  src={article.imageUrl}
                  alt={article.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-medium rounded">
                    {article.category}
                  </span>
                  <span className="px-2 py-0.5 bg-white/90 text-gray-600 text-xs font-medium rounded">
                    {article.readTime}で読める
                  </span>
                </div>
              </div>

              {/* 記事情報 */}
              <div className="p-4 md:p-5">
                <h3 className="text-base md:text-lg font-bold text-gray-900 leading-tight mb-2">
                  {article.title}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-2 md:line-clamp-3 leading-relaxed">
                  {article.excerpt}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
