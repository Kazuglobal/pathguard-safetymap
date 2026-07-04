"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useOptionalSupabase } from "@/components/providers/supabase-provider"
import { PUBLIC_DANGER_REPORT_STATUSES } from "@/lib/danger-report-status"
import { findDangersNearRoute } from "@/lib/geo/route-danger-finder"
import type { DangerReport, UserRoute } from "@/lib/types"

type DangerReportCoordinates = Pick<DangerReport, "latitude" | "longitude">

export interface UseRouteDangerCountsResult {
  /** routeId ごとの、近くにある注意ポイント数。 */
  counts: Record<string, number>
  isLoading: boolean
}

/**
 * 通学路の一覧に対して、各ルート周辺の注意ポイント数をまとめて求める。
 *
 * useRouteDangers はルート1本ごとに danger_reports 全件を取得するため一覧では重い。
 * ここでは公開ステータスの通報を一度だけ取得し、ジオメトリを持つ各ルートについて
 * findDangersNearRoute で件数を数える。Supabase プロバイダが無い環境（テスト等）では
 * 何も取得せず空の結果を返し、呼び出し側を壊さない。
 */
export function useRouteDangerCounts(
  routes: UserRoute[],
  bufferMeters: number = 100
): UseRouteDangerCountsResult {
  const supabaseContext = useOptionalSupabase()
  const supabase = supabaseContext?.supabase

  const [counts, setCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)

  // ジオメトリを持つルートの署名。中身が変わったときだけ再取得する。
  const routesSignature = useMemo(
    () =>
      routes
        .filter((route) => route.route_geometry)
        .map((route) => route.id)
        .join(","),
    [routes]
  )

  const routesRef = useRef(routes)
  routesRef.current = routes

  useEffect(() => {
    if (!supabase || routesSignature === "") {
      setCounts({})
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("danger_reports")
          .select("latitude, longitude")
          .in("status", [...PUBLIC_DANGER_REPORT_STATUSES])

        if (cancelled) return

        if (error || !Array.isArray(data)) {
          setCounts({})
          return
        }

        const allDangers = (data as DangerReportCoordinates[]).filter(
          (danger) =>
            Number.isFinite(danger.latitude) &&
            Number.isFinite(danger.longitude)
        )
        const nextCounts: Record<string, number> = {}

        for (const route of routesRef.current) {
          if (!route.route_geometry) continue
          nextCounts[route.id] = findDangersNearRoute(
            route.route_geometry,
            allDangers,
            bufferMeters
          ).length
        }

        setCounts(nextCounts)
      } catch {
        if (!cancelled) {
          setCounts({})
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [supabase, routesSignature, bufferMeters])

  return { counts, isLoading }
}
