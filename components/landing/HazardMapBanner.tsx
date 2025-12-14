"use client"

import * as React from "react"
import Link from "next/link"
import { MapPin, ChevronRight, X, AlertTriangle, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"

export function HazardMapBanner() {
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  return (
    <>
      {/* バナー */}
      <section className="px-4 py-6 md:py-10">
        <div className="max-w-6xl mx-auto">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-orange-500 p-6 md:p-10 text-left shadow-lg hover:shadow-xl transition-shadow"
        >
          {/* 背景パターン */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>
          </div>

          {/* マップアイコン装飾 */}
          <div className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 opacity-20">
            <MapPin className="w-32 h-32 md:w-48 md:h-48 text-white" />
          </div>

          {/* コンテンツ */}
          <div className="relative z-10 md:max-w-xl">
            <div className="inline-flex items-center gap-1 bg-white/20 px-2 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-medium text-white mb-3">
              <Navigation className="w-3 h-3 md:w-4 md:h-4" />
              リアルタイム更新
            </div>
            <h3 className="text-xl md:text-3xl font-bold text-white mb-2">
              今、どこが危ないかわかる！
            </h3>
            <p className="text-white/90 text-sm md:text-base mb-4">
              リアルタイム危険マップ2025
            </p>
            <div className="inline-flex items-center gap-1 text-white text-sm md:text-base font-medium">
              マップを見る
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
        </button>
        </div>
      </section>

      {/* モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 背景オーバーレイ */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setIsModalOpen(false)}
            role="button"
            tabIndex={0}
            aria-label="閉じる"
          />

          {/* モーダルコンテンツ */}
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="text-lg font-bold text-gray-900">危険マップ</h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="閉じる"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* マップエリア（プレースホルダー） */}
            <div className="relative aspect-[4/3] bg-gray-100">
              {/* 仮のマップ表示 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">マップを読み込み中...</p>
                </div>
              </div>

              {/* 危険箇所マーカー（デモ用） */}
              <div className="absolute top-1/4 left-1/3 flex items-center justify-center">
                <span className="absolute w-8 h-8 bg-red-500/30 rounded-full animate-ping" />
                <span className="relative w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
              <div className="absolute top-1/2 right-1/4 flex items-center justify-center">
                <span className="absolute w-8 h-8 bg-yellow-500/30 rounded-full animate-ping" />
                <span className="relative w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
              <div className="absolute bottom-1/3 left-1/2 flex items-center justify-center">
                <span className="absolute w-8 h-8 bg-orange-500/30 rounded-full animate-ping" />
                <span className="relative w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
            </div>

            {/* フッター */}
            <div className="p-4 bg-gray-50">
              <Link
                href="/map"
                className="flex items-center justify-center gap-2 w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
              >
                <MapPin className="w-5 h-5" />
                詳細マップを開く
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
