// =============================================
// 事故統計 サーバ側ヘルパー (Phase 0 / B4)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md §7.2
//
// 既存 lib/traffic-accident-data.ts は "use client" のため API ルートから使えない。
// ここでは型のみ import し、RPC を1本だけ呼ぶ最小の server-safe 関数を提供する。
// 全面的な client/server 分割は Phase 1 で実施する。
// =============================================

import type { AccidentStats } from "@/lib/traffic-accident-data"
import { getActor } from '@/lib/auth/actor'
import { nearbyStats } from '@/lib/db/repos/accidents.repo'
import {
  ACCIDENT_IMAGE_CONTEXT_PARAMS,
  adjustYearsForAccidentDataset,
} from "@/lib/accident-stats-year-window"

export interface FetchNearbyAccidentOptions {
  readonly radiusMeters?: number
  readonly years?: number
}

/**
 * ピン地点周辺の事故統計を取得する (server-safe)。
 *
 * 既存呼び出し側の契約互換のため Supabase クライアント引数は残し、
 * 認証はリクエストCookie、データはD1リポジトリから取得する。
 * 取得に失敗した場合は **null を返す**（ゲームは事故データ無しで継続＝graceful degrade）。
 */
export async function fetchNearbyAccidentStats(
  pin: { latitude: number; longitude: number },
  options: FetchNearbyAccidentOptions = {},
): Promise<AccidentStats | null> {
  const { latitude, longitude } = pin

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null
  }

  const radiusMeters = options.radiusMeters ?? ACCIDENT_IMAGE_CONTEXT_PARAMS.radiusMeters
  const requestedYears = options.years ?? ACCIDENT_IMAGE_CONTEXT_PARAMS.years
  const years = adjustYearsForAccidentDataset(requestedYears)

  try {
    const actor = await getActor()
    if (actor.kind === 'anon') return null
    return await nearbyStats(actor, {
      latitude,
      longitude,
      radiusMeters,
      years,
    })
  } catch (error) {
    console.error("fetchNearbyAccidentStats failed:", error)
    return null
  }
}
