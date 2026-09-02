"use client"

import type { Dispatch, SetStateAction } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { DangerReport } from "@/lib/types"
import type { useToast } from "@/components/ui/use-toast"

interface UseDeleteDangerReportParams {
  supabase: SupabaseClient | null
  dangerReports: DangerReport[]
  pendingReports: DangerReport[]
  setDangerReports: Dispatch<SetStateAction<DangerReport[]>>
  setPendingReports: Dispatch<SetStateAction<DangerReport[]>>
  selectedReport: DangerReport | null
  setSelectedReport: Dispatch<SetStateAction<DangerReport | null>>
  setIsDetailModalOpen: Dispatch<SetStateAction<boolean>>
  setIsLoading: Dispatch<SetStateAction<boolean>>
  isAdmin: boolean
  currentUserId: string | null
  toast: ReturnType<typeof useToast>["toast"]
}

/**
 * 危険レポートの削除処理（権限チェック → confirm → DB削除 → 画像削除 → state更新）。
 * map-container.tsx から挙動をそのまま抽出。
 */
export function useDeleteDangerReport({
  supabase,
  dangerReports,
  pendingReports,
  setDangerReports,
  setPendingReports,
  selectedReport,
  setSelectedReport,
  setIsDetailModalOpen,
  setIsLoading,
  isAdmin,
  currentUserId,
  toast,
}: UseDeleteDangerReportParams) {
  const handleDeleteReport = async (reportId: string) => {
    if (!supabase) return

    const reportToDelete = dangerReports.find(r => r.id === reportId) || pendingReports.find(r => r.id === reportId)
    if (!reportToDelete) return // 対象が見つからない場合は何もしない

    // DB側のRLS（danger_reports_delete）は「管理者」または「本人のpendingレポート」のみ削除を許可している。
    // UIの許可条件をそれに合わせておく（不一致だとボタンは出るのにDBで弾かれる、という事態を防ぐ）。
    const isOwnReport = currentUserId != null && reportToDelete.user_id === currentUserId
    const canDelete = isAdmin || (isOwnReport && reportToDelete.status === 'pending')

    if (!canDelete) {
      toast({
        title: "権限エラー",
        description: isOwnReport
          ? "審査中（pending）の投稿のみ削除できます。"
          : "レポートの削除権限がありません。",
        variant: "destructive",
      })
      return
    }

    const confirmationMessage = `以下のレポートを削除しますか？\n\nID: ${reportId}\nタイトル: ${reportToDelete.title}\n\nこの操作は元に戻せません。`
    if (!window.confirm(confirmationMessage)) {
      return // キャンセルされたら何もしない
    }

    try {
      setIsLoading(true) // 処理中の表示

      const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({})) as {
        error?: string
        mediaDeleteFailed?: boolean
      }
      if (!response.ok) throw new Error(payload.error || 'レポートの削除に失敗しました')
      const storageDeleteFailed = payload.mediaDeleteFailed === true

      toast({
        title: "削除成功",
        description: storageDeleteFailed
          ? `レポート (ID: ${reportId}) を削除しました。（画像の削除は一部失敗しました）`
          : `レポート (ID: ${reportId}) を削除しました。`,
      })

      // 2. ローカルの state を更新
      setDangerReports(prev => prev.filter(report => report.id !== reportId))
      setPendingReports(prev => prev.filter(report => report.id !== reportId))

      // 3. (任意) 選択中のレポートだったら選択解除
      if (selectedReport?.id === reportId) {
        setSelectedReport(null)
        setIsDetailModalOpen(false)
      }

    } catch (error: any) {
      console.error("Error deleting report:", error)
      toast({ title: "削除エラー", description: `レポートの削除中にエラーが発生しました: ${error.message}`, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return handleDeleteReport
}
