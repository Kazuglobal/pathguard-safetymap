"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { Navigation } from "@/components/ui/navigation"
import type { User } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"

interface NavigationWrapperProps {
  user: User | null
  onLogout: () => Promise<void>
  children: React.ReactNode
}

export function NavigationWrapper({ user, onLogout, children }: NavigationWrapperProps) {
  const pathname = usePathname()
  
  // ナビゲーションを表示しないページ
  const noNavPages = ['/login', '/register', '/landing']
  const showNavigation = !noNavPages.some(page => pathname.startsWith(page))

  const mainPaddingClass = showNavigation ? "pb-24 md:pb-0" : undefined

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ナビゲーション */}
      {showNavigation && (
        <Navigation
          user={user}
          onLogout={onLogout}
        />
      )}
      
      {/* メインコンテンツ */}
      <main className={cn("flex-1", mainPaddingClass)}>
        {children}
      </main>
    </div>
  )
}
