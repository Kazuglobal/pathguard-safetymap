"use client"

import { createContext, useContext } from "react"
import type { User } from "@supabase/supabase-js"

/**
 * ログイン状態。確定するまでは "loading"。
 * loading の間は「ログイン」「新規登録」や「ゲストさん」を出さず、プレースホルダを出す。
 */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated"

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  /** 表示名。未設定・読み込み中は null(lib/user-display-name.ts の規則) */
  displayName: string | null
  isLoggingOut: boolean
  /** ログアウトして LOGGED_OUT_PATH へ移る(全画面共通の入口) */
  logout: () => Promise<void>
  /** プロフィールを編集したあとに表示名を読み直す */
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthContextProvider = AuthContext.Provider

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside LayoutProvider")
  return value
}

/** LayoutProvider の外(テストや /accidents など)でも落ちずに使う版 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
