"use client"

import { useOptionalAuth, type AuthStatus } from "@/components/providers/auth-context"

/**
 * 紹介HPのボタンの出し分けに使うログインの状態(UIUX改装 項目54)。
 * ヘッダーと最後の呼びかけで同じ判定を使う。LayoutProvider の外(テストなど)では未ログインとして扱う。
 */
export function useLpAuthStatus(): AuthStatus {
  return useOptionalAuth()?.status ?? "unauthenticated"
}
