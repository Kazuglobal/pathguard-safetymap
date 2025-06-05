"use client"

import useSWR from "swr"
import { useSupabase } from "@/components/providers/supabase-provider"

interface MissionRow {
  id: string
  title: string
  description: string | null
  period: string | null // daily / weekly
  target_value: number
  reward_points: number | null
  reward_badge_id: string | null
}

interface ProgressRow {
  mission_id: number
  progress: number | null
  completed: boolean | null
}

export function useMissions() {
  const { supabase } = useSupabase()

  const fetcher = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { missions: [], progress: {} as Record<number, ProgressRow> }

    const { data: missions } = await supabase
      .from("missions")
      .select("id, title, description, period, target_value, reward_points, reward_badge_id")

    const { data: progressRows } = await supabase
      .from("user_mission_progress")
      .select("mission_id, progress, completed")
      .eq("user_id", user.id)

    const progressMap: Record<number, ProgressRow> = {}
    ;(progressRows ?? []).forEach((p) => {
      progressMap[p.mission_id] = p
    })

    return { missions: missions ?? [], progress: progressMap }
  }

  const { data, error, isLoading, mutate } = useSWR("missions", fetcher, {
    refreshInterval: 60_000,
  })

  return {
    missions: data?.missions ?? [],
    progress: data?.progress ?? ({} as Record<number, ProgressRow>),
    isLoading,
    error,
    mutate,
  }
} 