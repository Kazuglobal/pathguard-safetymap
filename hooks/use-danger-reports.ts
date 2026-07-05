"use client"

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import type { DangerReport } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast"
import { PUBLIC_DANGER_REPORT_STATUSES } from "@/lib/danger-report-status"
import { isAbortLikeError, isTransientFetchError, sleep } from "@/lib/map/map-fetch-utils"

interface DangerReportFilterOptions {
  dangerType: string
  dangerLevel: string
  dateRange: string
  showPending: boolean
}

interface UseDangerReportsParams {
  supabase: any
  filterOptions: DangerReportFilterOptions
  toast: ReturnType<typeof useToast>["toast"]
  setIsLoading: Dispatch<SetStateAction<boolean>>
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
}: UseDangerReportsParams) {
  const [dangerReports, setDangerReports] = useState<DangerReport[]>([])
  // 審査中の報告を保持する状態
  const [pendingReports, setPendingReports] = useState<DangerReport[]>([])
  const reportsFetchAbortRef = useRef<AbortController | null>(null)
  const reportsFetchRequestIdRef = useRef(0)

  useEffect(() => {
    if (!supabase) return // Ensure supabase is initialized

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

            // Filter by danger type
            if (filterOptions.dangerType !== "all") {
              // 型エラーを回避するために as any を一時的に使う
              approvedQuery = (approvedQuery as any).eq('danger_type', filterOptions.dangerType)
            }
            // Filter by danger level
            if (filterOptions.dangerLevel !== "all") {
              approvedQuery = (approvedQuery as any).eq('danger_level', parseInt(filterOptions.dangerLevel, 10))
            }
            // Filter by date range
            if (filterOptions.dateRange !== "all") {
              const now = new Date()
              let startDate = new Date(0) // Default to beginning of time
              if (filterOptions.dateRange === "week") startDate.setDate(now.getDate() - 7)
              else if (filterOptions.dateRange === "month") startDate.setMonth(now.getMonth() - 1)
              else if (filterOptions.dateRange === "year") startDate.setFullYear(now.getFullYear() - 1)
              approvedQuery = (approvedQuery as any).gte('created_at', startDate.toISOString())
            }

            const { data: approvedData, error: approvedError } = await approvedQuery.order("created_at", { ascending: false })

            if (approvedError) throw approvedError
            if (abortController.signal.aborted || requestId !== reportsFetchRequestIdRef.current) return
            setDangerReports((approvedData ?? []) as DangerReport[])

            // Fetch user's pending reports if logged in and filter is enabled
            let userPendingReports: DangerReport[] = []
            if (userId && filterOptions.showPending) {
              const { data: pendingData, error: pendingError } = await supabase
                .from("danger_reports")
                .select(`*`) // Select を最初に戻す
                .eq("status", "pending")
                .eq("user_id", userId)
                .abortSignal(abortController.signal)
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
  }, [supabase, filterOptions, toast, setIsLoading])

  return { dangerReports, pendingReports, setDangerReports, setPendingReports }
}
