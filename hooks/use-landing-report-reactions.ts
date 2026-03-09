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

  const reportIdsKey = React.useMemo(() => reportIds.join(","), [reportIds])
  const stableReportIds = React.useMemo(() => reportIds.slice(), [reportIdsKey])

  React.useEffect(() => {
    let cancelled = false

    async function loadReactions() {
      if (!stableReportIds.length) {
        setReactions({})
        return
      }

      setIsLoading(true)

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) setReactions({})
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
          setReactions(nextReactions)
        }
      } catch {
        if (!cancelled) {
          setReactions({})
        }
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
  }, [reportIdsKey, stableReportIds, supabase])

  const toggleReaction = React.useCallback(async (reportId: string, reactionType: LandingReactionType) => {
    const current = reactions[reportId] ?? emptyReactionState()
    const wasActive = current[reactionType]

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast({
        title: "ログインが必要です",
        description: "リアクションするにはログインしてください",
        variant: "destructive",
      })
      return
    }

    setReactions((prev) => ({
      ...prev,
      [reportId]: {
        ...(prev[reportId] ?? emptyReactionState()),
        [reactionType]: !wasActive,
      },
    }))

    try {
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
      setReactions((prev) => ({
        ...prev,
        [reportId]: {
          ...(prev[reportId] ?? emptyReactionState()),
          [reactionType]: wasActive,
        },
      }))
      toast({
        title: "エラー",
        description: "リアクションの更新に失敗しました",
        variant: "destructive",
      })
    }
  }, [reactions, supabase, toast])

  return {
    reactions,
    isLoading,
    toggleReaction,
  }
}
