"use client"

import * as React from "react"
import Link from "next/link"
import { Map, ChevronRight, X, AlertTriangle } from "lucide-react"

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
          className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors p-6 md:p-10 text-left"
        >
          {/* コンテンツ */}
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2">
                リアルタイム更新
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-1 leading-snug">
                今、どこが危ないかわかる！
              </h3>
              <p className="text-slate-400 text-sm">リアルタイム危険マップ2025</p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-slate-400">マップを見る</span>
              <ChevronRight className="w-6 h-6 text-white" />
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
                  <Map className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">マップを読み込み中...</p>
                </div>
              </div>

              {/* 危険箇所マーカー（デモ用） */}
              <div className="absolute top-1/4 left-1/3 flex items-center justify-center">
                <span className="relative w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
              <div className="absolute top-1/2 right-1/4 flex items-center justify-center">
                <span className="relative w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
              <div className="absolute bottom-1/3 left-1/2 flex items-center justify-center">
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
                <Map className="w-5 h-5" />
                詳細マップを開く
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
