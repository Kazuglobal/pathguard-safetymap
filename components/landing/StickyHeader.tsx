"use client"

import * as React from "react"
import Link from "next/link"
import { Search, Bell, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "top", label: "トップ", href: "#top" },
  { id: "mimamori", label: "見守り保険", href: "#mimamori" },
  { id: "goods", label: "防犯グッズ", href: "#goods" },
  { id: "premium", label: "プレミアム", href: "#premium" },
  { id: "local", label: "自治体連携", href: "#local" },
] as const

export function StickyHeader() {
  const [activeTab, setActiveTab] = React.useState<string>("top")

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 md:hidden">
      {/* メインヘッダー（モバイルのみ） */}
      <div className="flex items-center justify-between h-14 px-4">
        {/* ロゴ */}
        <Link href="/landing" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">
            <span className="text-sky-600">Path</span>
            <span className="text-gray-900">Guardian</span>
          </span>
        </Link>

        {/* 右側アイコン */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="検索"
          >
            <Search className="w-5 h-5 text-gray-600" />
          </button>
          <button
            type="button"
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="通知"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {/* 通知バッジ */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </div>

      {/* タブバー */}
      <div className="relative">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex px-4 gap-1 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative",
                  activeTab === tab.id
                    ? "text-red-600"
                    : "text-gray-500 hover:text-gray-800"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
        {/* フェードグラデーション（右側） */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      </div>
    </header>
  )
}
