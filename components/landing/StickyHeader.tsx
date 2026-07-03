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
    <header
      className="fixed top-0 left-0 right-0 z-40 border-b md:hidden"
      style={{ background: "rgba(251,245,233,.94)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderColor: "rgba(67,57,43,.1)" }}
    >
      {/* メインヘッダー（モバイルのみ） */}
      <div className="flex items-center justify-between h-14 px-4">
        {/* ロゴ */}
        <Link href="/landing" className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl border-2"
            style={{ background: "#159E72", borderColor: "rgba(67,57,43,.2)", boxShadow: "0 2px 0 rgba(12,122,85,.8)" }}
          >
            <Shield className="w-5 h-5 text-white" strokeWidth={2.4} />
          </div>
          <span className="text-xl font-black" style={{ color: "#43392B" }}>
            Path<span style={{ color: "#159E72" }}>Guardian</span>
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
                  "px-4 py-3 text-sm font-black whitespace-nowrap transition-colors relative",
                  activeTab === tab.id
                    ? "text-[#0C7A55]"
                    : "text-[#847661] hover:text-[#43392B]"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full" style={{ background: "#FFC93E" }} />
                )}
              </button>
            ))}
          </div>
        </div>
        {/* フェードグラデーション（右側） */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8"
          style={{ background: "linear-gradient(to left, #FBF5E9, transparent)" }}
        />
      </div>
    </header>
  )
}
