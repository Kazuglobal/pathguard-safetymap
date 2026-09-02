"use client"

import useSWR from "swr"

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
  const fetcher = async () => {
    try {
      const response = await fetch("/api/missions", { credentials: "same-origin" })
      if (!response.ok) return { missions: [], progress: {} as Record<string, ProgressRow> }
      return await response.json() as { missions: MissionRow[]; progress: Record<string, ProgressRow> }
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
