"use client"

import useSWR from "swr"
import { useSupabase } from "@/components/providers/supabase-provider"

export interface MissionRow {
  id: string
  title: string
  description: string | null
  period: string | null // daily / weekly
  target_value: number
  reward_points: number | null
  reward_badge_id: string | null
  target_type: string | null // 'hazard_game_play' 等。導線の判定に使う
}

interface ProgressRow {
  mission_id: number
  progress: number | null
  completed: boolean | null
}

export function useMissions() {
  const { supabase } = useSupabase()

  const fetcher = async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error) {
        // "Auth session missing"は未ログイン状態なのでエラーではない
        if (!error.message?.includes("Auth session missing")) {
          console.error("useMissions: getUser error", error)
        }
        return { missions: [], progress: {} as Record<string, ProgressRow> }
      }
      if (!user) return { missions: [], progress: {} as Record<string, ProgressRow> }

      const { data: missions } = await supabase
        .from("missions")
        .select("id, title, description, period, target_value, reward_points, reward_badge_id, target_type")

      const { data: progressRows } = await supabase
        .from("user_mission_progress")
        .select("mission_id, progress, completed")
        .eq("user_id", user.id)

      const progressMap: Record<string, ProgressRow> = {}
      ;(progressRows ?? []).forEach((p: any) => {
        progressMap[String(p.mission_id)] = p
      })

      return { missions: (missions ?? []) as MissionRow[], progress: progressMap }
    } catch (e) {
      console.error("useMissions: unexpected error", e)
      return { missions: [], progress: {} as Record<string, ProgressRow> }
    }
  }

  const { data, error, isLoading, mutate } = useSWR("missions", fetcher, {
    refreshInterval: 60_000,
  })

  return {
    missions: data?.missions ?? [],
    progress: data?.progress ?? ({} as Record<string, ProgressRow>),
    isLoading,
    error,
    mutate,
  }
} 
