"use client"

import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import { useOptionalSupabase } from "@/components/providers/supabase-provider"
import { findDangersNearRoute } from "@/lib/geo/route-danger-finder"
import { fetchPublicReports } from "@/lib/reports-fetch-cache"
import type { DangerReport, UserRoute } from "@/lib/types"

type DangerReportCoordinates = Pick<DangerReport, "latitude" | "longitude">

export interface UseRouteDangerCountsResult {
  /** routeId ごとの、近くにある注意ポイント数。 */
  counts: Record<string, number>
  /** いまのルートの件数をまだ数え終えていないとき true（最初の描画から立つ）。 */
  isLoading: boolean
}

interface SettledCounts {
  /** どの条件（バッファ距離 + ルートの署名）で数えた結果か */
  key: string
  counts: Record<string, number>
}

const NO_COUNTS: Record<string, number> = Object.freeze({}) as Record<string, number>

/**
 * 重い集計の合間にブラウザへ制御を返す（カードの描画やタップを止めないため）。
 * scheduler.yield があれば使い、なければ setTimeout(0) で次のタスクへ回す。
 */
function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (typeof scheduler?.yield === "function") {
    return scheduler.yield()
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * ジオメトリを持つルートごとに findDangersNearRoute で件数を数える。
 * 1 本数えるごとに制御を返し、途中で不要になったら（isCancelled）null を返して打ち切る。
 * 例外はそのまま投げる（どれか 1 本でも失敗したら全体を空にする、従来どおりの扱いを保つ）。
 */
async function countDangersPerRoute(
  routes: UserRoute[],
  dangers: DangerReportCoordinates[],
  bufferMeters: number,
  isCancelled: () => boolean
): Promise<Record<string, number> | null> {
  const counts: Record<string, number> = {}
  for (const route of routes) {
    if (!route.route_geometry) continue
    await yieldToMain()
    if (isCancelled()) return null
    counts[route.id] = findDangersNearRoute(route.route_geometry, dangers, bufferMeters).length
  }
  return counts
}

/**
 * 通学路の一覧に対して、各ルート周辺の注意ポイント数をまとめて求める。
 *
 * useRouteDangers はルート1本ごとに危険箇所を取るため一覧では重い。ここでは公開ステータスの
 * 通報を一度だけ取得し（lib/reports-fetch-cache で useRouteDangers と同じリクエストを共有する）、
 * ジオメトリを持つ各ルートについて findDangersNearRoute で件数を数える。
 * 集計は取得が終わってから 1 ルートずつ制御を返しながら行い、結果の反映は startTransition で
 * 急がない更新にする。カードは先に出し、件数はあとから埋まる。
 * Supabase プロバイダが無い環境（テスト等）では何も取得せず空の結果を返し、呼び出し側を壊さない。
 */
export function useRouteDangerCounts(
  routes: UserRoute[],
  bufferMeters: number = 100
): UseRouteDangerCountsResult {
  const supabaseContext = useOptionalSupabase()
  const supabase = supabaseContext?.supabase

  // ジオメトリを持つルートの署名。中身が変わったときだけ数え直す。
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

  // 数える必要があるときだけ、条件を表すキーを持つ（null = 数えない）
  const requestKey = supabase && routesSignature !== "" ? `${bufferMeters}|${routesSignature}` : null
  const [settled, setSettled] = useState<SettledCounts | null>(null)

  useEffect(() => {
    if (requestKey === null) {
      setSettled(null)
      return
    }

    let cancelled = false
    const isCancelled = () => cancelled

    const load = async () => {
      let nextCounts: Record<string, number> = {}
      try {
        const payload = await fetchPublicReports<DangerReportCoordinates>()
        if (cancelled) return

        const data = payload?.reports
        if (Array.isArray(data)) {
          const allDangers = data.filter(
            (danger) =>
              Number.isFinite(danger.latitude) &&
              Number.isFinite(danger.longitude)
          )
          const counted = await countDangersPerRoute(
            routesRef.current,
            allDangers,
            bufferMeters,
            isCancelled
          )
          if (counted === null) return
          nextCounts = counted
        }
      } catch {
        nextCounts = {}
      }

      if (cancelled) return
      // 件数の反映は急がない更新にし、カードの操作や入力を優先させる
      startTransition(() => {
        setSettled({ key: requestKey, counts: nextCounts })
      })
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [requestKey, bufferMeters])

  const counts = requestKey !== null && settled ? settled.counts : NO_COUNTS
  const isLoading = requestKey !== null && settled?.key !== requestKey

  return { counts, isLoading }
}
