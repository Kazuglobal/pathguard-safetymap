"use client"

/**
 * use-local-safety-alerts.ts
 *
 * 地域安全アラート（声かけ・不審者情報）の取得 Hook。
 * SWR 5分リフレッシュで最新情報を自動更新する。
 */

import useSWR from 'swr'
import { supabase } from '@/lib/supabase-client'

export type LocalAlertCategory = 'suspicious' | 'voice_call' | 'following' | 'other'

export interface LocalSafetyAlert {
  id: string
  prefecture: string
  city: string | null
  category: LocalAlertCategory
  description: string
  source_url: string | null
  occurred_at: string
  push_notified_at: string | null
  created_at: string
}

interface UseLocalSafetyAlertsOptions {
  /** undefined または '全国' で全件取得 */
  prefecture?: string
  /** 何時間前まで取得するか（デフォルト 24 時間） */
  limitHours?: number
}

export interface UseLocalSafetyAlertsResult {
  alerts: LocalSafetyAlert[]
  isLoading: boolean
  error: string | null
  mutate: () => void
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5分

/**
 * occurred_at から相対時間文字列を返す（"〇分前" / "〇時間前" / "〇日前"）
 */
export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  return `${Math.floor(hours / 24)}日前`
}

/**
 * occurred_at から 24 時間以内かどうか判定（速報バッジ用）
 */
export function isBreakingAlert(occurredAt: string): boolean {
  return Date.now() - new Date(occurredAt).getTime() < 24 * 60 * 60_000
}

export function useLocalSafetyAlerts(
  options: UseLocalSafetyAlertsOptions = {}
): UseLocalSafetyAlertsResult {
  const { prefecture, limitHours = 24 } = options

  const cacheKey = ['local_safety_alerts', prefecture ?? 'all', limitHours]

  const fetcher = async (): Promise<LocalSafetyAlert[]> => {
    const since = new Date(Date.now() - limitHours * 60 * 60_000).toISOString()

    let query = supabase
      .from('local_safety_alerts')
      .select(
        'id, prefecture, city, category, description, source_url, occurred_at, push_notified_at, created_at'
      )
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(50)

    if (prefecture && prefecture !== '全国') {
      query = query.eq('prefecture', prefecture)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return (data ?? []) as LocalSafetyAlert[]
  }

  const { data, error, isLoading, mutate } = useSWR<LocalSafetyAlert[]>(
    cacheKey,
    fetcher,
    { refreshInterval: REFRESH_INTERVAL_MS }
  )

  return {
    alerts: data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
    mutate,
  }
}
