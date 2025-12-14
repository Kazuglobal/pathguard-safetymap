"use client"

import * as React from "react"
import Image from "next/image"
import { Search, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface Product {
  id: string
  imageUrl: string
  name: string
  price: number
  originalPrice?: number
  badge?: "NEW" | "OUTLET" | "人気"
  rating: number
  reviewCount: number
}

const products: Product[] = [
  {
    id: "1",
    imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=300&fit=crop",
    name: "GPS見守りキーホルダー",
    price: 3980,
    badge: "NEW",
    rating: 4.5,
    reviewCount: 128,
  },
  {
    id: "2",
    imageUrl: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=300&h=300&fit=crop",
    name: "反射リフレクター付きランドセルカバー",
    price: 1980,
    originalPrice: 2480,
    badge: "OUTLET",
    rating: 4.8,
    reviewCount: 256,
  },
  {
    id: "3",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop",
    name: "防犯ブザー（大音量110dB）",
    price: 1280,
    badge: "人気",
    rating: 4.7,
    reviewCount: 512,
  },
  {
    id: "4",
    imageUrl: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=300&h=300&fit=crop",
    name: "キッズスマートウォッチ",
    price: 8980,
    rating: 4.3,
    reviewCount: 89,
  },
  {
    id: "5",
    imageUrl: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=300&h=300&fit=crop",
    name: "LED搭載通学シューズ",
    price: 4980,
    badge: "NEW",
    rating: 4.6,
    reviewCount: 67,
  },
  {
    id: "6",
    imageUrl: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=300&h=300&fit=crop",
    name: "見守りアプリ連携ケース",
    price: 2480,
    originalPrice: 3280,
    badge: "OUTLET",
    rating: 4.4,
    reviewCount: 143,
  },
]

const categories = ["すべて", "GPS", "防犯", "反射材", "アクセサリー"]

export function StoreSection() {
  const [activeCategory, setActiveCategory] = React.useState("すべて")
  const [searchQuery, setSearchQuery] = React.useState("")

  const getBadgeStyle = (badge: Product["badge"]) => {
    switch (badge) {
      case "NEW":
        return "bg-red-600 text-white"
      case "OUTLET":
        return "bg-orange-500 text-white"
      case "人気":
        return "bg-yellow-500 text-gray-900"
      default:
        return ""
    }
  }

  return (
    <section className="py-6 md:py-10 bg-gray-50">
      <div className="max-w-6xl mx-auto">
      {/* セクションヘッダー */}
      <div className="px-4 mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">通学・見守りストア</h2>

        {/* 検索バー */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="商品を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="フィルター"
          >
            <SlidersHorizontal className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* カテゴリフィルター */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-2 min-w-max">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors",
                  activeCategory === category
                    ? "bg-red-600 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-red-300"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2カラムグリッド（デスクトップは3-4カラム） */}
      <div className="px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {products.map((product) => (
            <article
              key={product.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              {/* 商品画像 */}
              <div className="relative aspect-square">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 200px"
                />
                {product.badge && (
                  <span
                    className={cn(
                      "absolute top-2 left-2 px-2 py-0.5 text-xs font-bold rounded",
                      getBadgeStyle(product.badge)
                    )}
                  >
                    {product.badge}
                  </span>
                )}
              </div>

              {/* 商品情報 */}
              <div className="p-3">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight mb-2">
                  {product.name}
                </h3>

                {/* 評価 */}
                <div className="flex items-center gap-1 mb-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={cn(
                          "w-3 h-3",
                          i < Math.floor(product.rating)
                            ? "text-yellow-400"
                            : "text-gray-200"
                        )}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    ({product.reviewCount})
                  </span>
                </div>

                {/* 価格 */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-bold text-red-600">
                    ¥{product.price.toLocaleString()}
                  </span>
                  {product.originalPrice && (
                    <span className="text-xs text-gray-400 line-through">
                      ¥{product.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      </div>
    </section>
  )
}
