"use client"

import Link from "next/link"
import { Shield } from "lucide-react"

import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/**
 * モバイル用の固定ヘッダー(md以上ではグローバルナビが表示されるので隠す)。
 * かつてここにあった「見守り保険/防犯グッズ/プレミアム/自治体連携」タブは
 * 遷移先が存在しないダミーだったため撤去した。
 */
export function StickyHeader() {
  return (
    <header
      className="fixed left-0 right-0 top-0 z-40 border-b md:hidden"
      style={{
        background: "rgba(251,245,233,.94)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderColor: "rgba(67,57,43,.1)",
      }}
    >
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/landing" className={`flex items-center gap-2 rounded-full ${tankenTokens.cls.focus}`}>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl border-2"
            style={{
              background: C.primary,
              borderColor: "rgba(67,57,43,.2)",
              boxShadow: "0 2px 0 rgba(12,122,85,.8)",
            }}
          >
            <Shield className="h-5 w-5 text-white" strokeWidth={2.4} />
          </div>
          <span className="text-xl font-black" style={{ color: C.ink }}>
            Path<span style={{ color: C.primary }}>Guardian</span>
          </span>
        </Link>

        <Link
          href="/map"
          className={`rounded-full px-4 py-1.5 text-sm font-bold text-white transition-transform active:translate-y-[2px] active:shadow-none ${tankenTokens.cls.focus}`}
          style={{
            background: C.primary,
            boxShadow: "0 3px 0 #0C7A55",
          }}
        >
          地図をみる
        </Link>
      </div>
    </header>
  )
}
