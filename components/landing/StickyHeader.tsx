"use client"

import Link from "next/link"

import { BrandLogo } from "@/components/brand/brand-logo"
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
        {/* 紹介HP・ログインの画面と同じロゴ(UIUX改装 項目3) */}
        <Link href="/landing" aria-label="PathGuardian のホーム" className={`flex items-center rounded-full ${tankenTokens.cls.focus}`}>
          <BrandLogo size="md" />
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
