"use client"

import { useEffect, useState } from "react"

/**
 * ログインユーザーの管理者判定とユーザーID取得を担うフック。
 * 認証セッションの同期待ちを考慮してリトライする。
 * (map-container.tsx から挙動を変えずに抽出)
 */
export function useAdminStatus(supabase: any) {
  // 管理者かどうかを判定する状態
  const [isAdmin, setIsAdmin] = useState(false)
  // 本人削除の判定に使うログインユーザーID（未ログイン時は null）
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let retryCount = 0
    const maxRetries = 3

    const checkAdminStatus = async () => {
      if (!supabase) return
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        if (error) {
          // "Auth session missing"はセッション同期待ち、リトライする
          if (error.message?.includes("Auth session missing")) {
            if (retryCount < maxRetries && isMounted) {
              retryCount++
              setTimeout(checkAdminStatus, 500 * retryCount)
              return
            }
            // リトライ後も失敗 = 未ログイン（正常）
            if (isMounted) {
              setIsAdmin(false)
              setCurrentUserId(null)
            }
            return
          }
          console.error("Error fetching user:", error)
          if (isMounted) {
            setIsAdmin(false)
            setCurrentUserId(null)
          }
          return
        }

        if (!user) {
          if (isMounted) {
            setIsAdmin(false)
            setCurrentUserId(null)
          }
          return
        }

        if (isMounted) setCurrentUserId(user.id)

        const adminStatusResponse = await fetch("/api/auth/admin-status", {
          cache: "no-store",
        })
        if (!adminStatusResponse.ok) {
          throw new Error(`Admin status request failed: ${adminStatusResponse.status}`)
        }

        const adminStatus = (await adminStatusResponse.json()) as { isAdmin?: boolean }
        if (isMounted) {
          setIsAdmin(Boolean(adminStatus.isAdmin))
        }
      } catch (err) {
        console.error("Error in checkAdminStatus:", err)
        if (isMounted) setIsAdmin(false) // エラー時は念のため false に
      }
    }
    checkAdminStatus()
    return () => {
      isMounted = false
    }
  }, [supabase]) // supabase クライアントが変わった時にも再チェック

  return { isAdmin, currentUserId }
}
