"use client"

import useSWR, { mutate as globalMutate } from "swr"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useToast } from "@/components/ui/use-toast"
import { useCallback, useMemo } from "react"

interface ReportInteractionState {
  liked: boolean
  likeCount: number
  saved: boolean
  saveCount: number
}

interface UseReportInteractionsReturn extends ReportInteractionState {
  isLoading: boolean
  error: string | null
  toggleLike: () => Promise<void>
  toggleSave: () => Promise<void>
}

interface ReportStats {
  report_id: string
  likes_count: number
  bookmarks_count: number
}

interface UserInteraction {
  report_id: string
  liked: boolean
  saved: boolean
}

const isUniqueConstraintError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false
  return error.code === "23505" || /duplicate key|already exists/i.test(error.message ?? "")
}

/**
 * Hook for managing single report's like/save state
 */
export function useReportInteractions(reportId: string): UseReportInteractionsReturn {
  const { supabase } = useSupabase()
  const { toast } = useToast()

  // Fetch stats (public - anyone can see counts)
  const statsFetcher = useCallback(async (): Promise<ReportStats | null> => {
    if (!reportId) return null

    try {
      // Get like count
      const { count: likeCount, error: likeError } = await supabase
        .from("report_likes")
        .select("*", { count: "exact", head: true })
        .eq("report_id", reportId)

      if (likeError) {
        console.error("Failed to fetch like count:", likeError)
        return null
      }

      // Get bookmark count
      const { count: saveCount, error: saveError } = await supabase
        .from("report_bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("report_id", reportId)

      if (saveError) {
        console.error("Failed to fetch bookmark count:", saveError)
        return null
      }

      return {
        report_id: reportId,
        likes_count: likeCount ?? 0,
        bookmarks_count: saveCount ?? 0,
      }
    } catch (e) {
      console.error("useReportInteractions stats fetcher error:", e)
      return null
    }
  }, [supabase, reportId])

  // Fetch user's interaction state (requires auth)
  const userInteractionFetcher = useCallback(async (): Promise<UserInteraction | null> => {
    if (!reportId) return null

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { report_id: reportId, liked: false, saved: false }
      }

      // Check if user has liked
      const { data: likeData } = await supabase
        .from("report_likes")
        .select("id")
        .eq("report_id", reportId)
        .eq("user_id", user.id)
        .maybeSingle()

      // Check if user has saved/bookmarked
      const { data: saveData } = await supabase
        .from("report_bookmarks")
        .select("id")
        .eq("report_id", reportId)
        .eq("user_id", user.id)
        .maybeSingle()

      return {
        report_id: reportId,
        liked: !!likeData,
        saved: !!saveData,
      }
    } catch (e) {
      console.error("useReportInteractions user interaction fetcher error:", e)
      return { report_id: reportId, liked: false, saved: false }
    }
  }, [supabase, reportId])

  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR(
    reportId ? `report-stats-${reportId}` : null,
    statsFetcher,
    { refreshInterval: 60000 }
  )

  const { data: userInteraction, error: userError, isLoading: userLoading, mutate: mutateUserInteraction } = useSWR(
    reportId ? `report-user-interaction-${reportId}` : null,
    userInteractionFetcher,
    { refreshInterval: 60000 }
  )

  const toggleLike = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: "ログインが必要です",
        description: "いいねするにはログインしてください",
        variant: "destructive",
      })
      return
    }

    const baseUserInteraction: UserInteraction = userInteraction ?? {
      report_id: reportId,
      liked: false,
      saved: false,
    }
    const hasStats = stats !== undefined && stats !== null
    const baseStats: ReportStats = stats ?? {
      report_id: reportId,
      likes_count: 0,
      bookmarks_count: 0,
    }
    const wasLiked = baseUserInteraction.liked
    const currentLikeCount = baseStats.likes_count

    // Optimistic update
    mutateUserInteraction(
      { ...baseUserInteraction, liked: !wasLiked },
      false
    )
    if (hasStats) {
      const nextLikeCount = Math.max(0, currentLikeCount + (wasLiked ? -1 : 1))
      globalMutate(
        `report-stats-${reportId}`,
        { ...baseStats, likes_count: nextLikeCount },
        false
      )
    }

    try {
      const { error: rpcError } = await supabase.rpc("toggle_report_like", {
        p_user_id: user.id,
        p_report_id: reportId,
      })

      if (rpcError) {
        // Fallback: direct INSERT / DELETE
        const wasLiked = (userInteraction ?? { liked: false }).liked
        if (wasLiked) {
          const { error } = await supabase
            .from("report_likes")
            .delete()
            .eq("user_id", user.id)
            .eq("report_id", reportId)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("report_likes")
            .insert({ user_id: user.id, report_id: reportId })
          if (error) throw error
        }
      }

      // Revalidate to get accurate server state
      mutateUserInteraction()
      globalMutate(`report-stats-${reportId}`)
    } catch (e) {
      // Rollback on error
      mutateUserInteraction()
      globalMutate(`report-stats-${reportId}`)
      toast({
        title: "エラー",
        description: "いいねの更新に失敗しました",
        variant: "destructive",
      })
    }
  }, [supabase, reportId, userInteraction, stats, mutateUserInteraction, toast])

  const toggleSave = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: "ログインが必要です",
        description: "保存するにはログインしてください",
        variant: "destructive",
      })
      return
    }

    const baseUserInteraction: UserInteraction = userInteraction ?? {
      report_id: reportId,
      liked: false,
      saved: false,
    }
    const hasStats = stats !== undefined && stats !== null
    const baseStats: ReportStats = stats ?? {
      report_id: reportId,
      likes_count: 0,
      bookmarks_count: 0,
    }
    const wasSaved = baseUserInteraction.saved
    const currentSaveCount = baseStats.bookmarks_count

    // Optimistic update
    mutateUserInteraction(
      { ...baseUserInteraction, saved: !wasSaved },
      false
    )
    if (hasStats) {
      const nextSaveCount = Math.max(0, currentSaveCount + (wasSaved ? -1 : 1))
      globalMutate(
        `report-stats-${reportId}`,
        { ...baseStats, bookmarks_count: nextSaveCount },
        false
      )
    }

    try {
      const { error: rpcError } = await supabase.rpc("toggle_report_bookmark", {
        p_user_id: user.id,
        p_report_id: reportId,
      })

      if (rpcError) {
        // Fallback: direct INSERT / DELETE
        if (wasSaved) {
          const { error } = await supabase
            .from("report_bookmarks")
            .delete()
            .eq("user_id", user.id)
            .eq("report_id", reportId)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("report_bookmarks")
            .insert({ user_id: user.id, report_id: reportId })
          if (error) throw error
        }
      }

      // Revalidate to get accurate server state
      mutateUserInteraction()
      globalMutate(`report-stats-${reportId}`)

      toast({
        title: wasSaved ? "保存を解除しました" : "保存しました",
        duration: 2000,
      })
    } catch (e) {
      // Rollback on error
      mutateUserInteraction()
      globalMutate(`report-stats-${reportId}`)
      toast({
        title: "エラー",
        description: "保存の更新に失敗しました",
        variant: "destructive",
      })
    }
  }, [supabase, reportId, userInteraction, stats, mutateUserInteraction, toast])

  return {
    liked: userInteraction?.liked ?? false,
    likeCount: stats?.likes_count ?? 0,
    saved: userInteraction?.saved ?? false,
    saveCount: stats?.bookmarks_count ?? 0,
    isLoading: statsLoading || userLoading,
    error: statsError?.message ?? userError?.message ?? null,
    toggleLike,
    toggleSave,
  }
}

/**
 * Hook for fetching multiple reports' interaction states at once (for list views)
 */
export function useReportInteractionsBatch(reportIds: string[]): {
  interactions: Map<string, ReportInteractionState>
  isLoading: boolean
  error: string | null
  toggleLike: (reportId: string) => Promise<void>
  toggleSave: (reportId: string) => Promise<void>
} {
  const { supabase } = useSupabase()
  const { toast } = useToast()

  const batchFetcher = useCallback(async (): Promise<Map<string, ReportInteractionState> | null> => {
    if (!reportIds.length) return new Map()

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Fetch all likes counts
      const { data: likesData, error: likesError } = await supabase
        .from("report_likes")
        .select("report_id")
        .in("report_id", reportIds)

      if (likesError) {
        console.error("Failed to fetch likes:", likesError)
      }

      // Fetch all bookmarks counts
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from("report_bookmarks")
        .select("report_id")
        .in("report_id", reportIds)

      if (bookmarksError) {
        console.error("Failed to fetch bookmarks:", bookmarksError)
      }

      // Count by report_id
      const likeCounts = new Map<string, number>()
      const saveCounts = new Map<string, number>()

      likesData?.forEach((item: any) => {
        likeCounts.set(item.report_id, (likeCounts.get(item.report_id) ?? 0) + 1)
      })

      bookmarksData?.forEach((item: any) => {
        saveCounts.set(item.report_id, (saveCounts.get(item.report_id) ?? 0) + 1)
      })

      // Fetch user's interactions if logged in
      const userLikes = new Set<string>()
      const userSaves = new Set<string>()

      if (user) {
        const { data: userLikesData } = await supabase
          .from("report_likes")
          .select("report_id")
          .eq("user_id", user.id)
          .in("report_id", reportIds)

        const { data: userSavesData } = await supabase
          .from("report_bookmarks")
          .select("report_id")
          .eq("user_id", user.id)
          .in("report_id", reportIds)

        userLikesData?.forEach((item: any) => userLikes.add(item.report_id))
        userSavesData?.forEach((item: any) => userSaves.add(item.report_id))
      }

      // Build result map
      const result = new Map<string, ReportInteractionState>()
      reportIds.forEach(id => {
        result.set(id, {
          liked: userLikes.has(id),
          likeCount: likeCounts.get(id) ?? 0,
          saved: userSaves.has(id),
          saveCount: saveCounts.get(id) ?? 0,
        })
      })

      return result
    } catch (e) {
      console.error("useReportInteractionsBatch fetcher error:", e)
      return new Map()
    }
  }, [supabase, reportIds])

  const cacheKey = useMemo(() =>
    reportIds.length > 0 ? `report-interactions-batch-${reportIds.slice().sort().join(",")}` : null,
    [reportIds]
  )

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    batchFetcher,
    { refreshInterval: 60000 }
  )

  const toggleLike = useCallback(async (reportId: string) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: "ログインが必要です",
        description: "いいねするにはログインしてください",
        variant: "destructive",
      })
      return
    }

    const current = data?.get(reportId)
    if (!current) return

    const wasLiked = current.liked

    // Optimistic update
    const optimisticData = new Map(data)
    optimisticData.set(reportId, {
      ...current,
      liked: !wasLiked,
      likeCount: Math.max(0, current.likeCount + (wasLiked ? -1 : 1)),
    })
    mutate(optimisticData, false)

    try {
      const { error: rpcError } = await supabase.rpc("toggle_report_like", {
        p_user_id: user.id,
        p_report_id: reportId,
      })

      if (rpcError) {
        if (wasLiked) {
          const { error } = await supabase
            .from("report_likes")
            .delete()
            .eq("user_id", user.id)
            .eq("report_id", reportId)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("report_likes")
            .insert({ user_id: user.id, report_id: reportId })
          if (error && !isUniqueConstraintError(error)) throw error
        }
      }

      // Revalidate
      mutate()
    } catch (e) {
      console.error("Failed to toggle like:", e)
      mutate()
      toast({
        title: "エラー",
        description: "いいねの更新に失敗しました",
        variant: "destructive",
      })
    }
  }, [supabase, data, mutate, toast])

  const toggleSave = useCallback(async (reportId: string) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: "ログインが必要です",
        description: "保存するにはログインしてください",
        variant: "destructive",
      })
      return
    }

    const current = data?.get(reportId)
    if (!current) return

    const wasSaved = current.saved

    // Optimistic update
    const optimisticData = new Map(data)
    optimisticData.set(reportId, {
      ...current,
      saved: !wasSaved,
      saveCount: Math.max(0, current.saveCount + (wasSaved ? -1 : 1)),
    })
    mutate(optimisticData, false)

    try {
      const { error: rpcError } = await supabase.rpc("toggle_report_bookmark", {
        p_user_id: user.id,
        p_report_id: reportId,
      })

      if (rpcError) {
        if (wasSaved) {
          const { error } = await supabase
            .from("report_bookmarks")
            .delete()
            .eq("user_id", user.id)
            .eq("report_id", reportId)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("report_bookmarks")
            .insert({ user_id: user.id, report_id: reportId })
          if (error && !isUniqueConstraintError(error)) throw error
        }
      }

      mutate()

      toast({
        title: wasSaved ? "保存を解除しました" : "保存しました",
        duration: 2000,
      })
    } catch (e) {
      console.error("Failed to toggle save:", e)
      mutate()
      toast({
        title: "エラー",
        description: "保存の更新に失敗しました",
        variant: "destructive",
      })
    }
  }, [supabase, data, mutate, toast])

  return {
    interactions: data ?? new Map(),
    isLoading,
    error: error?.message ?? null,
    toggleLike,
    toggleSave,
  }
}
