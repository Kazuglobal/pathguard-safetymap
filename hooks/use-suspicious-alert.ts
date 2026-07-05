"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"
import mapboxgl from "mapbox-gl"
import { useSearchParams } from "next/navigation"
import type { DangerReport } from "@/lib/types"
import type { DangerReportSubmitPayload } from "@/components/danger-report/danger-report-form"
import type { SuspiciousAlertFormPayload } from "@/components/danger-report/suspicious-alert-form"
import type { useToast } from "@/components/ui/use-toast"
import { isValidCoordinates } from "@/lib/coordinates"
import {
  SUSPICIOUS_DANGER_TYPE,
  DEFAULT_ALERT_RADIUS_M,
  resolveAlertRadius,
  getAlertFitBounds,
} from "@/lib/suspicious-alert"

type LocationSelectionSource = "manual" | "gps" | null

interface UseSuspiciousAlertParams {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  selectedLocation: [number, number] | null
  setSelectedLocation: Dispatch<SetStateAction<[number, number] | null>>
  setLocationSelectionSource: Dispatch<SetStateAction<LocationSelectionSource>>
  dangerReports: DangerReport[]
  pendingReports: DangerReport[]
  setDangerReports: Dispatch<SetStateAction<DangerReport[]>>
  setPendingReports: Dispatch<SetStateAction<DangerReport[]>>
  /** 既存の危険レポート送信フロー（useDangerReportSubmit の戻り値） */
  submitDangerReport: (
    reportData: DangerReportSubmitPayload & { imageFile?: File | null },
    options?: { suppressPreview?: boolean; suppressSuccessToast?: boolean },
  ) => Promise<{ reportId: string; imageUrl: string | null }>
  toast: ReturnType<typeof useToast>["toast"]
}

/**
 * 不審者アラートの地図フロー一式（表示トグル・?suspiciousAlert=1 での起動・
 * 入力中ドラフトの円/ピン表示・送信とAI一次審査反映）。
 * map-container.tsx から挙動をそのまま抽出。
 */
export function useSuspiciousAlert({
  mapRef,
  selectedLocation,
  setSelectedLocation,
  setLocationSelectionSource,
  dangerReports,
  pendingReports,
  setDangerReports,
  setPendingReports,
  submitDangerReport,
  toast,
}: UseSuspiciousAlertParams) {
  const [isSuspiciousAlertOpen, setIsSuspiciousAlertOpen] = useState(false)
  // 「表示」パネルの不審者情報トグル（3D/AR/事故ヒートマップ/ハザードと同様）
  const [isSuspiciousVisible, setIsSuspiciousVisible] = useState(false)
  const [alertDraftRadius, setAlertDraftRadius] = useState<number>(DEFAULT_ALERT_RADIUS_M)
  const [alertFocusedId, setAlertFocusedId] = useState<string | null>(null)
  const [isSuspiciousSubmitting, setIsSuspiciousSubmitting] = useState(false)
  const suspiciousMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const suspiciousAlertSearchParams = useSearchParams()

  // 報告メニューから ?suspiciousAlert=1 で来たら専用フォームを開く
  useEffect(() => {
    if (!suspiciousAlertSearchParams) return
    if (suspiciousAlertSearchParams.get("suspiciousAlert") === "1") {
      setIsSuspiciousAlertOpen(true)
    }
  }, [suspiciousAlertSearchParams])

  // 表示する不審者アラート（承認済み＋自分のpending）に、入力中ドラフトを加える
  const suspiciousAlertReports = useMemo(() => {
    const base = [...dangerReports, ...pendingReports].filter(
      (r) => r.danger_type === SUSPICIOUS_DANGER_TYPE,
    )
    if (
      isSuspiciousAlertOpen &&
      selectedLocation &&
      isValidCoordinates(selectedLocation[1], selectedLocation[0])
    ) {
      base.push({
        id: "__suspicious_draft__",
        danger_type: SUSPICIOUS_DANGER_TYPE,
        danger_level: 4,
        latitude: selectedLocation[1],
        longitude: selectedLocation[0],
        alert_radius_m: alertDraftRadius,
      } as DangerReport)
    }
    return base
  }, [dangerReports, pendingReports, isSuspiciousAlertOpen, selectedLocation, alertDraftRadius])

  // 入力中: 中心に大きいパルスマーカーを置き、円全体が収まるよう自動フィットする
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    if (suspiciousMarkerRef.current) {
      suspiciousMarkerRef.current.remove()
      suspiciousMarkerRef.current = null
    }
    if (
      !isSuspiciousAlertOpen ||
      !selectedLocation ||
      !isValidCoordinates(selectedLocation[1], selectedLocation[0])
    ) {
      setAlertFocusedId(null)
      return
    }
    const el = document.createElement("div")
    el.className = "suspicious-alert-marker"
    suspiciousMarkerRef.current = new mapboxgl.Marker(el).setLngLat(selectedLocation).addTo(m)
    setAlertFocusedId("__suspicious_draft__")
    const bounds = getAlertFitBounds(selectedLocation, alertDraftRadius)
    if (bounds) {
      try {
        m.fitBounds(bounds as any, { padding: 80, duration: 600, maxZoom: 17 })
      } catch (e) {
        console.error("fitBounds for suspicious alert failed", e)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuspiciousAlertOpen, selectedLocation, alertDraftRadius])

  const clearSuspiciousDraftMarker = useCallback(() => {
    if (suspiciousMarkerRef.current) {
      suspiciousMarkerRef.current.remove()
      suspiciousMarkerRef.current = null
    }
  }, [])

  // 不審者アラートの送信: 既存の挿入/画像パイプラインを再利用し、AI一次審査で公開可否を決める
  const handleSuspiciousAlertSubmit = async (payload: SuspiciousAlertFormPayload) => {
    if (!selectedLocation) {
      toast({ title: "場所を選んでください", description: "住所検索・現在地・地図タップで地点を指定できます。", variant: "destructive" })
      return
    }
    setIsSuspiciousSubmitting(true)
    try {
      const radius = resolveAlertRadius(payload.radiusM)
      const memo = payload.memo?.trim() ?? ""
      const reportPayload: DangerReportSubmitPayload = {
        title: memo ? memo.slice(0, 40) : "不審者情報",
        description: memo || null,
        danger_type: SUSPICIOUS_DANGER_TYPE,
        danger_level: 4,
        alert_radius_m: radius,
        status: "pending",
        ai_moderation_status: "pending",
        originalImageFile: payload.originalImageFile ?? null,
      }

      const { reportId } = await submitDangerReport(reportPayload, {
        suppressPreview: true,
        suppressSuccessToast: true,
      })

      const moderationResponse = await fetch("/api/suspicious-alert/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      })

      type ModerationResponseBody = {
        verdict?: { status?: string; reason?: string; score?: number }
        report?: DangerReport
        error?: string
      }
      const moderationBody = (await moderationResponse.json().catch(() => ({}))) as ModerationResponseBody

      if (!moderationResponse.ok || !moderationBody.verdict || !moderationBody.report) {
        console.error("AI一次審査に失敗しました:", moderationBody.error ?? moderationResponse.statusText)
        toast({
          title: "アラートを受け付けました",
          description: "自動審査に失敗したため、内容確認のうえ公開されます（あなたの地図には表示中）。",
        })
      } else if (moderationBody.verdict.status === "approved") {
        setPendingReports((prev) => prev.filter((r) => r.id !== reportId))
        setDangerReports((prev) => [
          moderationBody.report as DangerReport,
          ...prev.filter((r) => r.id !== reportId),
        ])
        toast({
          title: "アラートを地図に公開しました",
          description: "危険エリアを全員の地図に表示しています。",
        })
      } else {
        setPendingReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, ...(moderationBody.report as DangerReport) } : r)),
        )
        toast({
          title: "アラートを受け付けました",
          description: "内容確認のうえ公開されます（あなたの地図には表示中）。",
        })
      }

      // 円全体が見えるようにフィットしてフォームを閉じる
      const bounds = getAlertFitBounds(selectedLocation, radius)
      if (bounds && mapRef.current) {
        try {
          mapRef.current.fitBounds(bounds as any, { padding: 80, maxZoom: 17 })
        } catch (e) {
          console.error("fitBounds after submit failed", e)
        }
      }
      setIsSuspiciousAlertOpen(false)
      setIsSuspiciousVisible(true) // 投稿直後は自分のアラートを地図に表示したままにする
      setAlertFocusedId(reportId ?? null)
      setSelectedLocation(null)
      setLocationSelectionSource(null)
      clearSuspiciousDraftMarker()
    } catch (error) {
      console.error("不審者アラートの送信に失敗しました:", error)
      // submitDangerReport 側でエラートーストは表示済み
    } finally {
      setIsSuspiciousSubmitting(false)
    }
  }

  return {
    isSuspiciousAlertOpen,
    setIsSuspiciousAlertOpen,
    isSuspiciousVisible,
    setIsSuspiciousVisible,
    setAlertDraftRadius,
    alertFocusedId,
    setAlertFocusedId,
    isSuspiciousSubmitting,
    suspiciousAlertReports,
    clearSuspiciousDraftMarker,
    handleSuspiciousAlertSubmit,
  }
}
