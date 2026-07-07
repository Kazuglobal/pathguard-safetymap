"use client"

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import type { DangerReport } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast"
import { PUBLIC_DANGER_REPORT_STATUSES } from "@/lib/danger-report-status"
import { isAbortLikeError, isTransientFetchError, sleep } from "@/lib/map/map-fetch-utils"
import { NATIONWIDE } from "@/lib/user-region"
import { DANGER_LEVEL_MAX } from "@/lib/report-generation/danger-level-presentation"

/** 地図の現在の表示範囲。bbox絞り込みに使う（lng/lat の緯度経度） */
export interface DangerReportBounds {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

interface DangerReportFilterOptions {
  dangerType: string
  dangerLevel: string
  dateRange: string
  showPending: boolean
  /** 都道府県での絞り込み。未指定または NATIONWIDE("全国") なら絞り込まない */
  prefecture?: string
  /** 地図の表示範囲での絞り込み。未指定なら絞り込まない（全件取得） */
  bounds?: DangerReportBounds | null
}

interface UseDangerReportsParams {
  supabase: any
  filterOptions: DangerReportFilterOptions
  toast: ReturnType<typeof useToast>["toast"]
  setIsLoading: Dispatch<SetStateAction<boolean>>
  enabled?: boolean
}

/**
 * 地域・表示範囲・タイプ・危険度・期間のフィルタをクエリに適用する。
 * 公開レポートと自分の審査中レポートの両方に同じ条件を使う
 * (pending側にだけ適用し忘れると、絞り込み中も審査中リストに全件出続ける)。
 */
function applyReportContentFilters(query: any, filterOptions: DangerReportFilterOptions) {
  // Filter by prefecture (region)
  if (filterOptions.prefecture && filterOptions.prefecture !== NATIONWIDE) {
    query = query.eq('prefecture', filterOptions.prefecture)
  }
  // Filter by map viewport (bbox) — 大量報告時に全件取得しないための絞り込み
  if (filterOptions.bounds) {
    const { minLng, minLat, maxLng, maxLat } = filterOptions.bounds
    query = query
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng)
  }
  // Filter by danger type
  if (filterOptions.dangerType !== "all") {
    query = query.eq('danger_type', filterOptions.dangerType)
  }
  // Filter by danger level
  // 表示は1〜4にクランプ(danger-level-presentation)だが、生データには
  // 5がありうる。最上位(4)のフィルタは gte で4と5の両方にマッチさせる
  if (filterOptions.dangerLevel !== "all") {
    const level = parseInt(filterOptions.dangerLevel, 10)
    if (level >= DANGER_LEVEL_MAX) {
      query = query.gte('danger_level', DANGER_LEVEL_MAX)
    } else {
      query = query.eq('danger_level', level)
    }
  }
  // Filter by date range
  // 注意: 旧実装は new Date(0)(1970年)に setDate していたため実質no-opだった。
  // 現在時刻を起点に週/月/年を遡る
  if (filterOptions.dateRange !== "all") {
    const now = new Date()
    const startDate = new Date(now)
    if (filterOptions.dateRange === "week") startDate.setDate(now.getDate() - 7)
    else if (filterOptions.dateRange === "month") startDate.setMonth(now.getMonth() - 1)
    else if (filterOptions.dateRange === "year") startDate.setFullYear(now.getFullYear() - 1)
    query = query.gte('created_at', startDate.toISOString())
  }
  return query
}

/**
 * 危険レポート（公開済み＋ログインユーザー自身の pending）の取得と保持を担うフック。
 * フィルタ変更時の再取得、リクエストの世代管理・abort、過渡的エラーのリトライを含む。
 * map-container.tsx からロジックを変えずに抽出。
 */
export function useDangerReports({
  supabase,
  filterOptions,
  toast,
  setIsLoading,
  enabled = true,
}: UseDangerReportsParams) {
  const [dangerReports, setDangerReports] = useState<DangerReport[]>([])
  // 審査中の報告を保持する状態
  const [pendingReports, setPendingReports] = useState<DangerReport[]>([])
  const reportsFetchAbortRef = useRef<AbortController | null>(null)
  const reportsFetchRequestIdRef = useRef(0)

  useEffect(() => {
    if (!supabase || !enabled) return // Ensure supabase is initialized and caller is ready

    const requestId = reportsFetchRequestIdRef.current + 1
    reportsFetchRequestIdRef.current = requestId

    reportsFetchAbortRef.current?.abort()
    const abortController = new AbortController()
    reportsFetchAbortRef.current = abortController

    const fetchDangerReports = async () => {
      setIsLoading(true)
      try {
        const retryDelaysMs = [0, 250, 800]

        for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
          if (attempt > 0) {
            await sleep(retryDelaysMs[attempt])
          }

          try {
            // Use cached session state to avoid unnecessary auth network calls on each filter change.
            const { data: sessionData } = await supabase.auth.getSession()
            const userId = sessionData.session?.user?.id

            // Base query for publicly visible reports
            let approvedQuery = supabase
              .from("danger_reports")
              .select(`*`) // Select を最初に戻す
              .in("status", [...PUBLIC_DANGER_REPORT_STATUSES])
              .abortSignal(abortController.signal)

            approvedQuery = applyReportContentFilters(approvedQuery, filterOptions)

            const { data: approvedData, error: approvedError } = await approvedQuery.order("created_at", { ascending: false })

            if (approvedError) throw approvedError
            if (abortController.signal.aborted || requestId !== reportsFetchRequestIdRef.current) return
            setDangerReports((approvedData ?? []) as DangerReport[])

            // Fetch user's pending reports if logged in and filter is enabled
            let userPendingReports: DangerReport[] = []
            if (userId && filterOptions.showPending) {
              let pendingQuery = supabase
                .from("danger_reports")
                .select(`*`) // Select を最初に戻す
                .eq("status", "pending")
                .eq("user_id", userId)
                .abortSignal(abortController.signal)

              pendingQuery = applyReportContentFilters(pendingQuery, filterOptions)

              const { data: pendingData, error: pendingError } = await pendingQuery
                .order("created_at", { ascending: false })

              if (pendingError) console.error("Error fetching pending reports:", pendingError)
              else userPendingReports = (pendingData ?? []) as DangerReport[]
            }

            if (abortController.signal.aborted || requestId !== reportsFetchRequestIdRef.current) return
            setPendingReports(userPendingReports)
            return
          } catch (attemptError: any) {
            if (abortController.signal.aborted || requestId !== reportsFetchRequestIdRef.current) return

            const canRetry = isTransientFetchError(attemptError) && attempt < retryDelaysMs.length - 1
            if (canRetry) {
              console.warn(`[danger_reports] transient fetch error (attempt ${attempt + 1}), retrying...`, attemptError)
              continue
            }

            throw attemptError
          }
        }
      } catch (error: any) {
        if (abortController.signal.aborted || requestId !== reportsFetchRequestIdRef.current || isAbortLikeError(error)) {
          return
        }
        console.error("Error fetching reports object:", error) // オブジェクト全体
        console.error("Error fetching reports message:", error?.message) // メッセージ
        console.error("Error fetching reports stack:", error?.stack) // スタックトレース
        console.error("Error fetching reports stringified:", JSON.stringify(error)) // JSON文字列化

        toast({ title: "データ取得エラー", description: `危険箇所データの取得エラー: ${error?.message || '詳細不明'}`, variant: "destructive" }) // messageがない場合も考慮
        setDangerReports([])
        setPendingReports([])
      } finally {
        if (requestId !== reportsFetchRequestIdRef.current) return
        setIsLoading(false)
      }
    }

    fetchDangerReports()
    return () => {
      abortController.abort()
    }
  }, [supabase, filterOptions, toast, setIsLoading, enabled])

  return { dangerReports, pendingReports, setDangerReports, setPendingReports }
}
