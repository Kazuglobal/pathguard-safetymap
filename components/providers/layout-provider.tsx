"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { NavigationWrapper } from "@/components/ui/navigation-wrapper"
import { AuthContextProvider, type AuthStatus } from "@/components/providers/auth-context"
import { isProtectedPath } from "@/lib/auth/protected-paths"
import { LOGGED_OUT_PATH, loginPathFor } from "@/lib/auth/login-path"
import { getDisplayName } from "@/lib/user-display-name"
import { shouldShowFloatingPrompts, shouldShowPushPrompts } from "@/lib/navigation-visibility"
import { clearAllLocalRouteGeometry, clearOtherUsersLocalRouteGeometry } from "@/lib/route-local-geometry"
import {
  SupabaseProvider,
  isAbortLikeFetchError,
  useSupabase,
} from "@/components/providers/supabase-provider"
import { Toaster } from "@/components/ui/toaster"
import { PushPermissionPrompt } from "@/components/notifications/push-permission-prompt"
import { AppOnboardingGate } from "@/components/onboarding/app-onboarding-gate"
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar"
import { IosInstallPrompt } from "@/components/pwa/ios-install-prompt"
import { PrivacyUpdateNotice } from "@/components/notices/privacy-update-notice"
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"

interface LayoutProviderInnerProps {
  children: React.ReactNode
}

function LayoutProviderInner({ children }: LayoutProviderInnerProps) {
  const { supabase } = useSupabase()
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  // 確定するまでは loading。ヘッダーに「ログイン/新規登録」を先に描かないために使う
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const logoutInFlightRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const settle = (nextUser: User | null) => {
      if (!isMounted) return
      setUser(nextUser)
      setStatus(nextUser ? "authenticated" : "unauthenticated")
    }
    // 通信エラーなどで判定できないときは、先に届いた INITIAL_SESSION の結果を上書きしない
    const settleIfUnknown = () => {
      if (!isMounted) return
      setStatus((current) => (current === "loading" ? "unauthenticated" : current))
    }

    const loadUser = async () => {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.warn("Supabase環境変数が設定されていません")
          settle(null)
          return
        }
        const { data, error } = await supabase.auth.getUser()
        if (error) {
          if (isAbortLikeFetchError(error)) {
            return
          }
          // "Auth session missing" is expected when user is not logged in - not an error
          if (
            error.message?.includes("Auth session missing") ||
            error.message?.includes("Invalid Refresh Token") ||
            error.message?.includes("Refresh Token Not Found")
          ) {
            // Session gone — expected, not an error
            settle(null)
            return
          }
          if (error.message?.includes("fetch failed")) {
            console.warn("Supabaseサーバーに接続できません。オフラインモードで続行します。")
          } else {
            console.error("ユーザー取得エラー:", error.message)
          }
          settleIfUnknown()
          return
        }
        settle(data.user ?? null)
      } catch (e: any) {
        if (isAbortLikeFetchError(e)) {
          return
        }
        if (e?.message?.includes("fetch failed")) {
          console.warn("Supabaseサーバーに接続できません。オフラインモードで続行します。")
        } else {
          console.error("Supabase接続エラー:", e?.message || e)
        }
        settleIfUnknown()
      }
    }

    loadUser()

    // Keep user state in sync with auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      settle(session?.user ?? null)
      // ログアウトになったら(期限切れ・別タブでのログアウト・別の端末での退会も)、この端末に残した通学路の元の線を消す
      if (event === "SIGNED_OUT") clearAllLocalRouteGeometry()
      // 自分でログアウトしたとき以外(期限切れ・別タブでのログアウト)に、保護された画面を開いていたら
      // その場でログイン画面へ移す。戻り先を付けて、ログインし直したら同じ画面に戻れるようにする
      if (event === "SIGNED_OUT" && !logoutInFlightRef.current) {
        const { pathname, search } = window.location
        if (isProtectedPath(pathname)) {
          router.replace(loginPathFor(`${pathname}${search}`))
        }
      }
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  // 古い応答(前のユーザー・前回の読み込み)で新しい呼び名を上書きしないための通し番号
  const profileRequestSeqRef = useRef(0)
  const refreshProfile = useCallback(async () => {
    profileRequestSeqRef.current += 1
    const seq = profileRequestSeqRef.current
    const isLatest = () => seq === profileRequestSeqRef.current
    try {
      const response = await fetch("/api/profile", { credentials: "same-origin" })
      if (!isLatest()) return
      if (!response.ok) {
        setDisplayName(null)
        return
      }
      const { profile } = (await response.json()) as { profile?: { display_name?: string | null } | null }
      if (!isLatest()) return
      setDisplayName(getDisplayName(profile))
    } catch {
      if (isLatest()) setDisplayName(null)
    }
  }, [])

  // 呼び名はユーザーが変わったときだけ読み直す(ページ移動のたびには取りに行かない)
  const userId = user?.id ?? null
  useEffect(() => {
    if (!userId) {
      // 進行中の読み込みがあっても、その結果を使わない
      profileRequestSeqRef.current += 1
      setDisplayName(null)
      return
    }
    // 別のアカウントがこの端末に残した通学路の元の線は消す(同じ端末でアカウントを切り替えたとき)
    clearOtherUsersLocalRouteGeometry(userId)
    void refreshProfile()
  }, [userId, refreshProfile])

  const handleLogout = useCallback(async () => {
    if (logoutInFlightRef.current) return
    logoutInFlightRef.current = true
    setIsLoggingOut(true)
    try {
      await supabase.auth.signOut()
      // この端末に残した通学路の元の線(自宅・学校の位置)も消す
      clearAllLocalRouteGeometry()
      router.replace(LOGGED_OUT_PATH)
      router.refresh()
    } catch (e) {
      console.error("サインアウトに失敗しました:", (e as Error)?.message || e)
    } finally {
      logoutInFlightRef.current = false
      setIsLoggingOut(false)
    }
  }, [router, supabase])

  const authValue = useMemo(
    () => ({ status, user, displayName, isLoggingOut, logout: handleLogout, refreshProfile }),
    [status, user, displayName, isLoggingOut, handleLogout, refreshProfile],
  )

  return (
    <AuthContextProvider value={authValue}>
      <NavigationWrapper
        user={user}
        authStatus={status}
        displayName={displayName}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      >
        {children}
      </NavigationWrapper>
      <Toaster />
      <ServiceWorkerRegistrar />
      {user && <AppOnboardingGate />}
      {user && shouldShowPushPrompts(pathname) && <PushPermissionPrompt />}
      {user && shouldShowPushPrompts(pathname) && <IosInstallPrompt />}
      {user && shouldShowFloatingPrompts(pathname) && <PrivacyUpdateNotice />}
    </AuthContextProvider>
  )
}

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/accidents' || pathname.startsWith('/accidents/')) return <>{children}</>
  return (
    <SupabaseProvider>
      <LayoutProviderInner>{children}</LayoutProviderInner>
    </SupabaseProvider>
  )
}

