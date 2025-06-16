"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { Navigation } from "@/components/ui/navigation"
import type { User } from "@supabase/supabase-js"

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

  return (
    <div className="min-h-screen bg-background">
      {/* ナビゲーション */}
      {showNavigation && (
        <Navigation 
          user={user} 
          onLogout={onLogout}
        />
      )}
      
      {/* メインコンテンツ */}
      <main>
        {children}
      </main>
    </div>
  )
}