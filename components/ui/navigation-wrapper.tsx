"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { Navigation } from "@/components/ui/navigation"
import type { User } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"
import { shouldShowMobileBottomNav, shouldShowSiteFooter } from "@/lib/navigation-visibility"
import { SiteFooter } from "@/components/layout/site-footer"
import type { AuthStatus } from "@/components/providers/auth-context"

interface NavigationWrapperProps {
  user: User | null
  authStatus?: AuthStatus
  displayName?: string | null
  onLogout: () => Promise<void>
  isLoggingOut?: boolean
  children: React.ReactNode
}

export function NavigationWrapper({
  user,
  authStatus,
  displayName = null,
  onLogout,
  isLoggingOut = false,
  children,
}: NavigationWrapperProps) {
  const pathname = usePathname()

  // ナビゲーションを表示しないページ（ランディングは表示対象）
  const noNavPages = ['/login', '/register', '/forgot-password', '/reset-password', '/safety-quest', '/lp']
  const showNavigation = !noNavPages.some(page => pathname.startsWith(page))

  // ランディングページか判定（トップナビはモバイルで非表示、デスクトップで表示）
  const isLandingPage = pathname === '/landing'

  // マップページはフルスクリーン表示（ナビゲーションはオーバーレイ）
  const isMapPage = pathname === '/map' || pathname === '/3d-route-poc'

  // マップページ以外は通常のパディング(下部タブバーは lg 未満で出るので、その高さぶん空ける)
  const mainPaddingClass = showNavigation && !isMapPage ? "pb-24 lg:pb-0" : undefined

  // 共通のフッター(UIUX改装 項目32)。出す画面では、下部タブバーのための余白はフッターの側で空ける
  const showFooter = shouldShowSiteFooter(pathname)

  return (
    <div className={cn(
      "min-h-screen bg-background",
      isMapPage ? "relative" : "flex flex-col"
    )}>
      {/* ナビゲーション（デスクトップヘッダーはmainより前に配置） */}
      {showNavigation && (
        <Navigation
          user={user}
          authStatus={authStatus}
          displayName={displayName}
          onLogout={onLogout}
          isLoggingOut={isLoggingOut}
          hideTopNavMobile={isLandingPage || isMapPage}
          isOverlay={isMapPage}
          hideBottomNavMobile={!shouldShowMobileBottomNav(pathname)}
        />
      )}

      {/* メインコンテンツ（マップページは最背面） */}
      <main className={cn(
        isMapPage ? "fixed inset-0" : "flex-1",
        !showFooter && mainPaddingClass
      )}>
        {children}
      </main>

      {showFooter && <SiteFooter reserveBottomNav={Boolean(mainPaddingClass)} />}
    </div>
  )
}
