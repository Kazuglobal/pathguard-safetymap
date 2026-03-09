"use client"

import * as React from "react"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useToast } from "@/components/ui/use-toast"

type LandingReactionType = "helpful" | "caution"

type LandingReactionState = {
  helpful: boolean
  caution: boolean
}

type ReactionRow = {
  report_id: string
  reaction_type: LandingReactionType
}

const emptyReactionState = (): LandingReactionState => ({
  helpful: false,
  caution: false,
})

export function useLandingReportReactions(reportIds: string[]) {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [reactions, setReactions] = React.useState<Record<string, LandingReactionState>>({})
  const [isLoading, setIsLoading] = React.useState(false)
  const reactionsRef = React.useRef<Record<string, LandingReactionState>>({})
  const hasLoadedInitialStateRef = React.useRef(false)
  const pendingOptimisticKeysRef = React.useRef(new Set<string>())
  const inFlightToggleKeysRef = React.useRef(new Set<string>())

  const reportIdsKey = React.useMemo(() => reportIds.join(","), [reportIds])
  const stableReportIds = React.useMemo(() => reportIds.slice(), [reportIdsKey])
  const updateReactions = React.useCallback((
    updater: Record<string, LandingReactionState> | ((prev: Record<string, LandingReactionState>) => Record<string, LandingReactionState>)
  ) => {
    setReactions((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      reactionsRef.current = next
      return next
    })
  }, [])

  React.useEffect(() => {
    let cancelled = false
    hasLoadedInitialStateRef.current = false
    pendingOptimisticKeysRef.current.clear()

    async function loadReactions() {
      if (!stableReportIds.length) {
        updateReactions({})
        hasLoadedInitialStateRef.current = true
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) {
            updateReactions({})
            hasLoadedInitialStateRef.current = true
          }
          return
        }

        const { data, error } = await supabase
          .from("danger_report_reactions")
          .select("report_id, reaction_type")
          .eq("user_id", user.id)
          .in("report_id", stableReportIds)

        if (error) throw error

        const nextReactions: Record<string, LandingReactionState> = {}
        stableReportIds.forEach((reportId) => {
          nextReactions[reportId] = emptyReactionState()
        })

        ;((data ?? []) as ReactionRow[]).forEach((row) => {
          if (!nextReactions[row.report_id]) {
            nextReactions[row.report_id] = emptyReactionState()
          }
          nextReactions[row.report_id][row.reaction_type] = true
        })

        if (!cancelled) {
          const pendingOptimisticKeys = Array.from(pendingOptimisticKeysRef.current)

          updateReactions((prev) => {
            const mergedReactions = { ...nextReactions }

            pendingOptimisticKeys.forEach((key) => {
              const [reportId, reactionType] = key.split(":") as [string, LandingReactionType]
              mergedReactions[reportId] = {
                ...(mergedReactions[reportId] ?? emptyReactionState()),
                [reactionType]: prev[reportId]?.[reactionType] ?? false,
              }
            })

            return mergedReactions
          })
          hasLoadedInitialStateRef.current = true
          pendingOptimisticKeysRef.current.clear()
        }
      } catch {
        if (!cancelled) hasLoadedInitialStateRef.current = true
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadReactions()

    return () => {
      cancelled = true
    }
  }, [reportIdsKey, stableReportIds, supabase, updateReactions])

  const toggleReaction = React.useCallback(async (reportId: string, reactionType: LandingReactionType) => {
    const reactionKey = `${reportId}:${reactionType}`
    if (inFlightToggleKeysRef.current.has(reactionKey)) {
      return
    }

    inFlightToggleKeysRef.current.add(reactionKey)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: "ログインが必要です",
          description: "リアクションするにはログインしてください",
          variant: "destructive",
        })
        return
      }

      const current = reactionsRef.current[reportId] ?? emptyReactionState()
      const wasActive = current[reactionType]

      if (!hasLoadedInitialStateRef.current) {
        pendingOptimisticKeysRef.current.add(reactionKey)
      }

      updateReactions((prev) => ({
        ...prev,
        [reportId]: {
          ...(prev[reportId] ?? emptyReactionState()),
          [reactionType]: !wasActive,
        },
      }))

      if (wasActive) {
        const { error } = await supabase
          .from("danger_report_reactions")
          .delete()
          .eq("user_id", user.id)
          .eq("report_id", reportId)
          .eq("reaction_type", reactionType)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from("danger_report_reactions")
          .insert({
            user_id: user.id,
            report_id: reportId,
            reaction_type: reactionType,
          })

        if (error) throw error
      }
    } catch {
      const current = reactionsRef.current[reportId] ?? emptyReactionState()
      const revertedValue = !current[reactionType]

      updateReactions((prev) => ({
        ...prev,
        [reportId]: {
          ...(prev[reportId] ?? emptyReactionState()),
          [reactionType]: revertedValue,
        },
      }))
      toast({
        title: "エラー",
        description: "リアクションの更新に失敗しました",
        variant: "destructive",
      })
    } finally {
      inFlightToggleKeysRef.current.delete(reactionKey)
      if (hasLoadedInitialStateRef.current) {
        pendingOptimisticKeysRef.current.delete(reactionKey)
      }
    }
  }, [supabase, toast, updateReactions])

  return {
    reactions,
    isLoading,
    toggleReaction,
  }
}
