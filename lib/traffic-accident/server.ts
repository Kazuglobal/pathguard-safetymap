// =============================================
// 事故統計 サーバ側ヘルパー (Phase 0 / B4)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md §7.2
//
// 既存 lib/traffic-accident-data.ts は "use client" のため API ルートから使えない。
// ここでは型のみ import し、RPC を1本だけ呼ぶ最小の server-safe 関数を提供する。
// 全面的な client/server 分割は Phase 1 で実施する。
// =============================================

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AccidentStats } from "@/lib/traffic-accident-data"

const DEFAULT_RADIUS_METERS = 300
const DEFAULT_YEARS = 5

export interface FetchNearbyAccidentOptions {
  readonly radiusMeters?: number
  readonly years?: number
}

/**
 * ピン地点周辺の事故統計を取得する (server-safe)。
 *
 * 認証用に既に作成済みの Supabase クライアントを受け取り、同じ接続で RPC を呼ぶ。
 * 取得に失敗した場合は **null を返す**（ゲームは事故データ無しで継続＝graceful degrade）。
 */
export async function fetchNearbyAccidentStats(
  client: SupabaseClient,
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

  const radiusMeters = options.radiusMeters ?? DEFAULT_RADIUS_METERS
  const years = options.years ?? DEFAULT_YEARS

  try {
    // 既存 RPC（get_nearby_accident_stats）は生成型に無いため any キャストで呼ぶ。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any).rpc("get_nearby_accident_stats", {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_meters: radiusMeters,
      p_years: years,
    })

    if (error || !data) return null
    return data as AccidentStats
  } catch (error) {
    console.error("fetchNearbyAccidentStats failed:", error)
    return null
  }
}
