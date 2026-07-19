"use client"

import type { ComponentProps } from "react"
import { createPortal } from "react-dom"
import { MapPin } from "lucide-react"
import DangerReportForm from "@/components/danger-report/danger-report-form"

type FormProps = ComponentProps<typeof DangerReportForm>

interface MapReportFormsProps {
  isReportFormOpen: boolean
  isMobile: boolean
  onSubmit: FormProps["onSubmit"]
  selectedLocation: FormProps["selectedLocation"]
  locationSource: FormProps["locationSource"]
  selectedRouteId: FormProps["selectedRouteId"]
  selectedRouteName: FormProps["selectedRouteName"]
  /** デスクトップ用フォームの「閉じる」 */
  onDesktopCancel: () => void
  /** モバイル用フォームの「地点を変更」（フォームを閉じて地点選択モードへ戻す） */
  onMobileChangeLocation: () => void
  /** モバイル用フォームの「とじる」/キャンセル（フォームを閉じて地点・マーカーをクリア） */
  onMobileClose: () => void
}

/**
 * 危険レポート入力フォームの配置（デスクトップ=右下サイドパネル / モバイル=Portalでのフルスクリーン）。
 * map-container.tsx から見た目・挙動を変えずに抽出した表示コンポーネント。
 */
export function MapReportForms({
  isReportFormOpen,
  isMobile,
  onSubmit,
  selectedLocation,
  locationSource,
  selectedRouteId,
  selectedRouteName,
  onDesktopCancel,
  onMobileChangeLocation,
  onMobileClose,
}: MapReportFormsProps) {
  if (!isReportFormOpen) return null

  if (!isMobile) {
    // Report Form - デスクトップ用（サイドパネル形式）
    return (
      <div
        className="absolute bottom-4 right-4 z-60 max-h-[calc(100vh-10rem)] w-96 overflow-y-auto overflow-x-hidden rounded-[24px] border paper-surface"
        style={{ borderColor: "rgba(67,57,43,.14)", boxShadow: "0 2px 0 rgba(67,57,43,.08), 0 30px 60px -30px rgba(67,57,43,.55)" }}
      >
        <DangerReportForm
          onSubmit={onSubmit}
          onCancel={onDesktopCancel}
          selectedLocation={selectedLocation}
          locationSource={locationSource}
          selectedRouteId={selectedRouteId}
          selectedRouteName={selectedRouteName}
        />
      </div>
    )
  }

  // Report Form - モバイル用（フルスクリーンモーダル）- Portal経由でbodyに直接レンダリング
  return createPortal(
    <div className="fixed inset-0 z-[60] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden paper-surface mobile-fullscreen-form">
      {/* モバイルフォームヘッダー */}
      <div
        className="safe-area-top flex flex-shrink-0 items-center justify-between border-b px-3 py-2.5"
        style={{ borderColor: "rgba(67,57,43,.1)", fontFamily: 'var(--font-app, "Zen Maru Gothic"), sans-serif' }}
      >
        <button
          type="button"
          onClick={onMobileChangeLocation}
          className="chunky-press inline-flex min-h-[40px] items-center gap-1 rounded-full border-2 bg-white px-3 text-[12.5px] font-black"
          style={{ borderColor: "rgba(67,57,43,.14)", color: "#0C7A55", boxShadow: "0 3px 0 rgba(67,57,43,.16)" }}
        >
          <MapPin className="h-4 w-4" strokeWidth={2.6} />
          地点を変更
        </button>
        <h2 className="text-[16px] font-black" style={{ color: "#43392B" }}>危険箇所を報告</h2>
        <button
          type="button"
          onClick={onMobileClose}
          className="inline-flex min-h-[40px] items-center rounded-full px-3 text-[13px] font-black"
          style={{ color: "#847661" }}
        >
          とじる
        </button>
      </div>

      {/* フォーム本体 */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <DangerReportForm
          onSubmit={onSubmit}
          onCancel={onMobileClose}
          selectedLocation={selectedLocation}
          locationSource={locationSource}
          selectedRouteId={selectedRouteId}
          selectedRouteName={selectedRouteName}
          isMobileFullscreen={true}
        />
      </div>
    </div>,
    document.body
  )
}

export default MapReportForms
