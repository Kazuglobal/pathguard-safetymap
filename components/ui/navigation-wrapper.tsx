"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { Navigation } from "@/components/ui/navigation"
import type { User } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"

interface NavigationWrapperProps {
  user: User | null
  onLogout: () => Promise<void>
  isLoggingOut?: boolean
  children: React.ReactNode
}

export function NavigationWrapper({ user, onLogout, isLoggingOut = false, children }: NavigationWrapperProps) {
  const pathname = usePathname()

  // ナビゲーションを表示しないページ（ランディングは表示対象）
  const noNavPages = ['/login', '/register', '/forgot-password', '/reset-password', '/safety-quest']
  const showNavigation = !noNavPages.some(page => pathname.startsWith(page))

  // ランディングページか判定（トップナビはモバイルで非表示、デスクトップで表示）
  const isLandingPage = pathname === '/landing'

  // マップページはフルスクリーン表示（ナビゲーションはオーバーレイ）
  const isMapPage = pathname === '/map' || pathname === '/3d-route-poc'

  // マップページ以外は通常のパディング
  const mainPaddingClass = showNavigation && !isMapPage ? "pb-24 md:pb-0" : undefined

  return (
    <div className={cn(
      "min-h-screen bg-background",
      isMapPage ? "relative" : "flex flex-col"
    )}>
      {/* ナビゲーション（デスクトップヘッダーはmainより前に配置） */}
      {showNavigation && (
        <Navigation
          user={user}
          onLogout={onLogout}
          isLoggingOut={isLoggingOut}
          hideTopNavMobile={isLandingPage || isMapPage}
          isOverlay={isMapPage}
        />
      )}

      {/* メインコンテンツ（マップページは最背面） */}
      <main className={cn(
        isMapPage ? "fixed inset-0" : "flex-1",
        mainPaddingClass
      )}>
        {children}
      </main>
    </div>
  )
}
