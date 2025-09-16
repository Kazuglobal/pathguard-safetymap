"use client"

import React, { useCallback, useEffect, useState } from "react"
import { NavigationWrapper } from "@/components/ui/navigation-wrapper"
import { SupabaseProvider, useSupabase } from "@/components/providers/supabase-provider"
import type { User } from "@supabase/supabase-js"

interface LayoutProviderInnerProps {
  children: React.ReactNode
}

function LayoutProviderInner({ children }: LayoutProviderInnerProps) {
  const { supabase } = useSupabase()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.warn("Supabase環境変数が設定されていません")
          return
        }
        const { data, error } = await supabase.auth.getUser()
        if (error) {
          if (error.message?.includes("fetch failed")) {
            console.warn("Supabaseサーバーに接続できません。オフラインモードで続行します。")
          } else {
            console.error("ユーザー取得エラー:", error.message)
          }
          return
        }
        if (isMounted) setUser(data.user ?? null)
      } catch (e: any) {
        if (e?.message?.includes("fetch failed")) {
          console.warn("Supabaseサーバーに接続できません。オフラインモードで続行します。")
        } else {
          console.error("Supabase接続エラー:", e?.message || e)
        }
      }
    }

    loadUser()

    // Keep user state in sync with auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error("サインアウトに失敗しました:", (e as Error)?.message || e)
    }
  }, [supabase])

  return (
    <NavigationWrapper user={user} onLogout={handleLogout}>
      {children}
    </NavigationWrapper>
  )
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      <LayoutProviderInner>{children}</LayoutProviderInner>
    </SupabaseProvider>
  )
}

