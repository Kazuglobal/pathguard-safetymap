"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { createBrowserClient } from "@supabase/ssr"
import type { UserRoute, CreateRouteInput, UpdateRouteInput } from "@/lib/types"

export function useUserRoutes() {
  const [routes, setRoutes] = useState<UserRoute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Keep routes in ref to avoid circular dependencies
  const routesRef = useRef<UserRoute[]>(routes)
  routesRef.current = routes

  const supabaseRef = useRef(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )
  const supabase = supabaseRef.current

  const primaryRoute = useMemo(() => {
    return routes.find((r) => r.is_favorite) || null
  }, [routes])

  const checkAuth = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  }, [supabase])

  const fetchRoutes = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const user = await checkAuth()
      if (!user) {
        setRoutes([])
        setIsLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from("user_routes")
        .select("*")
        .eq("user_id", user.id)
        .order("is_favorite", { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setRoutes(data || [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "通学路の取得に失敗しました"
      )
    } finally {
      setIsLoading(false)
    }
  }, [supabase, checkAuth])

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

      const user = await checkAuth()
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
        const { error: insertError } = await supabase
          .from("user_routes")
          .insert({
            user_id: user.id,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            start_lat: input.start_lat,
            start_lng: input.start_lng,
            end_lat: input.end_lat,
            end_lng: input.end_lng,
            start_address: input.start_address,
            end_address: input.end_address,
            route_geometry: input.route_geometry || null,
            is_favorite: false,
          })

        if (insertError) {
          setError(insertError.message)
          return false
        }

        await fetchRoutes()
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "ルートの作成に失敗しました"
        )
        return false
      }
    },
    [supabase, checkAuth, validateRouteInput, fetchRoutes]
  )

  const updateRoute = useCallback(
    async (id: string, input: UpdateRouteInput): Promise<boolean> => {
      setError(null)

      const user = await checkAuth()
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

        const { error: updateError } = await supabase
          .from("user_routes")
          .update(updateData)
          .match({ id, user_id: user.id })

        if (updateError) {
          setError(updateError.message)
          return false
        }

        await fetchRoutes()
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "ルートの更新に失敗しました"
        )
        return false
      }
    },
    [supabase, checkAuth, validateRouteInput, fetchRoutes]
  )

  const deleteRoute = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null)

      const user = await checkAuth()
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
        const { error: deleteError } = await supabase
          .from("user_routes")
          .delete()
          .match({ id, user_id: user.id })

        if (deleteError) {
          setError(deleteError.message)
          return false
        }

        await fetchRoutes()
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "ルートの削除に失敗しました"
        )
        return false
      }
    },
    [supabase, checkAuth, fetchRoutes]
  )

  const setPrimaryRoute = useCallback(
    async (id: string): Promise<void> => {
      setError(null)

      const user = await checkAuth()
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

        const { error: clearError } = await supabase
          .from("user_routes")
          .update({ is_favorite: false })
          .eq("user_id", user.id)

        if (clearError) {
          setError(clearError.message)
          return
        }

        // Then set the new primary
        const { error: setErrorResult } = await supabase
          .from("user_routes")
          .update({ is_favorite: true })
          .match({ id, user_id: user.id })

        if (setErrorResult) {
          setError(setErrorResult.message)
          return
        }

        await fetchRoutes()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "プライマリルートの設定に失敗しました"
        )
      }
    },
    [supabase, checkAuth, fetchRoutes]
  )

  const refreshRoutes = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    fetchRoutes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  return {
    routes,
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
