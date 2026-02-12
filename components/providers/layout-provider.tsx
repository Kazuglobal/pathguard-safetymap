"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { NavigationWrapper } from "@/components/ui/navigation-wrapper"
import { SupabaseProvider, useSupabase } from "@/components/providers/supabase-provider"
import { Toaster } from "@/components/ui/toaster"
import type { User } from "@supabase/supabase-js"

interface LayoutProviderInnerProps {
  children: React.ReactNode
}

function LayoutProviderInner({ children }: LayoutProviderInnerProps) {
  const { supabase } = useSupabase()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const logoutInFlightRef = useRef(false)

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
          // "Auth session missing" is expected when user is not logged in - not an error
          if (error.message?.includes("Auth session missing")) {
            // User not logged in - this is normal, no logging needed
            return
          }
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null)
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  const handleLogout = useCallback(async () => {
    if (logoutInFlightRef.current) return
    logoutInFlightRef.current = true
    setIsLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.replace("/login")
      router.refresh()
    } catch (e) {
      console.error("サインアウトに失敗しました:", (e as Error)?.message || e)
    } finally {
      logoutInFlightRef.current = false
      setIsLoggingOut(false)
    }
  }, [router, supabase])

  return (
    <>
      <NavigationWrapper user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut}>
        {children}
      </NavigationWrapper>
      <Toaster />
    </>
  )
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      <LayoutProviderInner>{children}</LayoutProviderInner>
    </SupabaseProvider>
  )
}

