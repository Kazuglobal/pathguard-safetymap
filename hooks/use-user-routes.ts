"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useSupabase } from "@/components/providers/supabase-provider"
import { invalidateFetchCache } from "@/lib/reports-fetch-cache"
import { mergeLocalRouteGeometry, removeLocalRouteGeometry, saveLocalRouteGeometry } from "@/lib/route-local-geometry"
import type {
  UserRoute,
  CreateRouteInput,
  UpdateRouteInput,
  RouteChildProfile,
} from "@/lib/types"

/**
 * いま一覧を表示している（または読み込み中の）ユーザー。
 * undefined = 初回の認証確認がまだ / null = 未ログイン・ログアウト / string = そのユーザー
 */
type ActiveUserId = string | null | undefined

interface AuthSessionLike {
  user?: { id?: string | null } | null
}

/**
 * ログイン中のユーザーの通学路一覧。
 *
 * - 認証の確認はマウントごとに 1 回だけ行う。onAuthStateChange はユーザーが変わったとき
 *   （別のユーザーでのログイン・ログアウト）だけ反映し、TOKEN_REFRESHED やタブ復帰時の
 *   SIGNED_IN、INITIAL_SESSION の重複のように同じユーザーのままのイベントでは取り直さない。
 * - isLoading は「いまのユーザーの一覧をまだ一度も取れていない」間だけ true。
 *   ルートの追加・編集などのあとの取り直し中は、表示中の一覧をそのまま残す。
 */
export function useUserRoutes() {
  const [routes, setRoutes] = useState<UserRoute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Keep routes in ref to avoid circular dependencies
  const routesRef = useRef<UserRoute[]>(routes)
  routesRef.current = routes

  const activeUserIdRef = useRef<ActiveUserId>(undefined)
  // いまのユーザーの一覧を一度でも取得できたか。取得できていれば、取り直しの間も一覧を出したままにする
  const hasLoadedRef = useRef(false)
  // 最後に始めた読み込みの番号。古い応答が新しい状態（ログアウト後など）を上書きしないようにする
  const loadSeqRef = useRef(0)

  const { supabase } = useSupabase()

  const primaryRoute = useMemo(() => {
    return routes.find((r) => r.is_favorite) || null
  }, [routes])

  const childProfiles = useMemo<RouteChildProfile[]>(() => {
    const groupedProfiles = new Map<string, RouteChildProfile>()

    for (const route of routes) {
      const profileId = route.child_id ?? "shared"
      const profileLabel = route.child_name?.trim() || "共通"
      const existingProfile = groupedProfiles.get(profileId)

      if (existingProfile) {
        existingProfile.routeCount += 1
        continue
      }

      groupedProfiles.set(profileId, {
        id: profileId,
        label: profileLabel,
        routeCount: 1,
      })
    }

    return [
      { id: "all", label: "すべて", routeCount: routes.length },
      ...Array.from(groupedProfiles.values()).sort((left, right) => {
        if (left.id === "shared") {
          return 1
        }
        if (right.id === "shared") {
          return -1
        }
        return left.label.localeCompare(right.label, "ja")
      }),
    ]
  }, [routes])

  const checkAuth = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      return session.user
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  }, [supabase])

  /**
   * 追加・編集などの操作の直前に行う認証確認。ユーザーがまだ定まっていない
   * （初回の確認で見つからなかった等）ときは、ここで分かったユーザーを覚えて、操作のあとの取り直しにつなげる。
   */
  const requireUser = useCallback(async () => {
    const user = await checkAuth()
    if (user?.id && typeof activeUserIdRef.current !== "string") {
      activeUserIdRef.current = user.id
    }
    return user
  }, [checkAuth])

  /**
   * /api/routes から一覧を取り直す。認証の確認はしない（呼び出し側がユーザーを把握している）。
   * 一覧をまだ一度も取れていないときだけ isLoading を立て、表示中の一覧は取り直しの間も残す。
   */
  const loadRoutes = useCallback(async () => {
    // ログアウトしたあと（進行中だった追加・編集の続きなど）からは取りにいかない
    if (activeUserIdRef.current === null) return
    const userId = activeUserIdRef.current

    loadSeqRef.current += 1
    const seq = loadSeqRef.current
    const isLatest = () => seq === loadSeqRef.current

    setError(null)
    if (!hasLoadedRef.current) {
      setIsLoading(true)
    }

    try {
      const response = await fetch("/api/routes", { credentials: "same-origin" })
      if (!isLatest()) return
      if (!response.ok) {
        setError(`通学路の取得に失敗しました (${response.status})`)
        return
      }
      const payload = await response.json() as { routes?: UserRoute[] }
      if (!isLatest()) return
      hasLoadedRef.current = true
      // サーバーには両端を削った線しか無いので、この端末で作った通学路は手元の元の線を重ねて表示する
      setRoutes(typeof userId === "string" ? mergeLocalRouteGeometry(userId, payload.routes ?? []) : payload.routes ?? [])
    } catch (err) {
      if (!isLatest()) return
      setError(
        err instanceof Error ? err.message : "通学路の取得に失敗しました"
      )
    } finally {
      if (isLatest()) {
        setIsLoading(false)
      }
    }
  }, [])

  /** ログアウトしたとき: 前のユーザーの一覧と、進行中の読み込みの結果を捨てる */
  const clearForSignedOut = useCallback(() => {
    activeUserIdRef.current = null
    hasLoadedRef.current = false
    loadSeqRef.current += 1
    setRoutes((prev) => (prev.length === 0 ? prev : []))
    setError(null)
    setIsLoading(false)
  }, [])

  /**
   * 表示するユーザーを決める。同じユーザーなら何もしない
   * （一覧を取り直さず、スケルトンにも戻さない）。
   */
  const applyUser = useCallback(
    (userId: string | null) => {
      const previousUserId = activeUserIdRef.current
      if (previousUserId === userId) return

      if (typeof previousUserId === "string") {
        // 別のユーザーに切り替わった・ログアウトした: 前のユーザーの一覧と、
        // そのときに取った共有の応答（lib/reports-fetch-cache）を残さない
        invalidateFetchCache()
        setRoutes((prev) => (prev.length === 0 ? prev : []))
      }

      if (userId === null) {
        clearForSignedOut()
        return
      }

      activeUserIdRef.current = userId
      hasLoadedRef.current = false
      void loadRoutes()
    },
    [clearForSignedOut, loadRoutes]
  )

  const validateRouteInput = useCallback(
    (input: CreateRouteInput | UpdateRouteInput, isCreate: boolean): string | null => {
      if (isCreate) {
        const createInput = input as CreateRouteInput
        if (!createInput.name || createInput.name.trim() === "") {
          return "ルート名を入力してください"
        }
        if (createInput.name.length > 100) {
          return "ルート名は100文字以内で入力してください"
        }
        if (
          createInput.route_geometry &&
          createInput.route_geometry.coordinates.length < 2
        ) {
          return "ルートには2つ以上のポイントが必要です"
        }
      } else {
        const updateInput = input as UpdateRouteInput
        if (updateInput.name !== undefined) {
          if (updateInput.name.trim() === "") {
            return "ルート名を入力してください"
          }
          if (updateInput.name.length > 100) {
            return "ルート名は100文字以内で入力してください"
          }
        }
        if (
          updateInput.route_geometry &&
          updateInput.route_geometry.coordinates.length < 2
        ) {
          return "ルートには2つ以上のポイントが必要です"
        }
      }
      return null
    },
    []
  )

  const addRoute = useCallback(
    async (input: CreateRouteInput): Promise<boolean> => {
      setError(null)

      const user = await requireUser()
      if (!user) {
        setError("ログインが必要です")
        return false
      }

      const validationError = validateRouteInput(input, true)
      if (validationError) {
        setError(validationError)
        return false
      }

      try {
        const response = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ ...input, is_favorite: false }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string }
          setError(payload.error ?? "ルートの作成に失敗しました")
          return false
        }

        // 元の線・起点・終点・住所はこの端末にだけ残す(サーバーには粗くしたものだけが保存される)
        const created = await response.json().catch(() => ({})) as { route?: { id?: unknown } }
        if (typeof created.route?.id === "string") {
          saveLocalRouteGeometry(user.id, created.route.id, {
            start_lat: input.start_lat,
            start_lng: input.start_lng,
            end_lat: input.end_lat,
            end_lng: input.end_lng,
            start_address: input.start_address,
            end_address: input.end_address,
            route_geometry: input.route_geometry ?? null,
          })
        }

        await loadRoutes()
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "ルートの作成に失敗しました"
        )
        return false
      }
    },
    [supabase, requireUser, validateRouteInput, loadRoutes]
  )

  const updateRoute = useCallback(
    async (id: string, input: UpdateRouteInput): Promise<boolean> => {
      setError(null)

      const user = await requireUser()
      if (!user) {
        setError("ログインが必要です")
        return false
      }

      const validationError = validateRouteInput(input, false)
      if (validationError) {
        setError(validationError)
        return false
      }

      try {
        const updateData: Record<string, unknown> = {}

        if (input.name !== undefined) {
          updateData.name = input.name.trim()
        }
        if (input.description !== undefined) {
          updateData.description = input.description?.trim() || null
        }
        if (input.child_id !== undefined) {
          updateData.child_id = input.child_id
        }
        if (input.child_name !== undefined) {
          updateData.child_name = input.child_name?.trim() || null
        }
        if (input.start_lat !== undefined) {
          updateData.start_lat = input.start_lat
        }
        if (input.start_lng !== undefined) {
          updateData.start_lng = input.start_lng
        }
        if (input.end_lat !== undefined) {
          updateData.end_lat = input.end_lat
        }
        if (input.end_lng !== undefined) {
          updateData.end_lng = input.end_lng
        }
        if (input.start_address !== undefined) {
          updateData.start_address = input.start_address
        }
        if (input.end_address !== undefined) {
          updateData.end_address = input.end_address
        }
        if (input.route_geometry !== undefined) {
          updateData.route_geometry = input.route_geometry
        }
        if (input.is_favorite !== undefined) {
          updateData.is_favorite = input.is_favorite
        }

        const response = await fetch(`/api/routes/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(updateData),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string }
          setError(payload.error ?? "ルートの更新に失敗しました")
          return false
        }

        await loadRoutes()
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "ルートの更新に失敗しました"
        )
        return false
      }
    },
    [supabase, requireUser, validateRouteInput, loadRoutes]
  )

  const deleteRoute = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null)

      const user = await requireUser()
      if (!user) {
        setError("ログインが必要です")
        return false
      }

      // Prevent deleting the only primary route - use ref to get current routes
      const currentRoutes = routesRef.current
      const routeToDelete = currentRoutes.find((r) => r.id === id)
      if (routeToDelete?.is_favorite && currentRoutes.length === 1) {
        setError("唯一のルートは削除できません")
        return false
      }

      try {
        const response = await fetch(`/api/routes/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "same-origin",
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string }
          setError(payload.error ?? "ルートの削除に失敗しました")
          return false
        }

        removeLocalRouteGeometry(user.id, id)
        await loadRoutes()
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "ルートの削除に失敗しました"
        )
        return false
      }
    },
    [supabase, requireUser, loadRoutes]
  )

  const setPrimaryRoute = useCallback(
    async (id: string): Promise<void> => {
      setError(null)

      const user = await requireUser()
      if (!user) {
        setError("ログインが必要です")
        return
      }

      try {
        const currentRoutes = routesRef.current
        const currentPrimary = currentRoutes.find((r) => r.is_favorite)
        if (currentPrimary?.id === id) {
          return
        }

        const response = await fetch(`/api/routes/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ primary: true }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { error?: string }
          setError(payload.error ?? "プライマリルートの設定に失敗しました")
          return
        }

        await loadRoutes()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "プライマリルートの設定に失敗しました"
        )
      }
    },
    [supabase, requireUser, loadRoutes]
  )

  const refreshRoutes = useCallback(() => {
    if (typeof activeUserIdRef.current === "string") {
      void loadRoutes()
      return
    }

    // 初回の認証確認に失敗した・未ログインと判定されたときだけ、認証を確認し直してから読み込む
    setError(null)
    setIsLoading(true)
    void (async () => {
      try {
        const user = await checkAuth()
        if (user?.id) {
          applyUser(user.id)
        } else {
          clearForSignedOut()
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "通学路の取得に失敗しました"
        )
        setIsLoading(false)
      }
    })()
  }, [applyUser, checkAuth, clearForSignedOut, loadRoutes])

  // 初回の認証確認はマウントごとに 1 回だけ。先に認証イベントでユーザーが決まっていれば、そちらを優先する
  useEffect(() => {
    if (activeUserIdRef.current !== undefined) return

    let cancelled = false
    void (async () => {
      try {
        const user = await checkAuth()
        if (cancelled || activeUserIdRef.current !== undefined) return
        applyUser(user?.id ?? null)
      } catch (err) {
        if (cancelled || activeUserIdRef.current !== undefined) return
        setError(
          err instanceof Error ? err.message : "通学路の取得に失敗しました"
        )
        setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [checkAuth, applyUser])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(
      (event: string, session: AuthSessionLike | null) => {
        if (event === "SIGNED_OUT") {
          applyUser(null)
          return
        }

        const userId = session?.user?.id
        if (userId) {
          applyUser(userId)
        }
        // INITIAL_SESSION が null のとき（未ログイン・一時的な取得失敗）は初回の認証確認の結果に任せる
      }
    )

    return () => data.subscription.unsubscribe()
  }, [supabase, applyUser])

  return {
    routes,
    childProfiles,
    primaryRoute,
    isLoading,
    error,
    addRoute,
    updateRoute,
    deleteRoute,
    setPrimaryRoute,
    refreshRoutes,
  }
}
