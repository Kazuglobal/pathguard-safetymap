"use client"

import { Button } from "@/components/ui/button"
import { UserX } from "lucide-react"
import Map3DToggle from "./map-3d-toggle"

/**
 * MapTopOverlay の各パネルスロットに流し込む中身。
 * map-container.tsx のインラインJSXから見た目・文言そのまま抽出。
 */

interface ThreeDPanelContentProps {
  is3DEnabled: boolean
  onToggle: () => void
}

export function ThreeDPanelContent({ is3DEnabled, onToggle }: ThreeDPanelContentProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">3D表示</p>
        <p className="text-xs text-slate-500">建物と地形を立体表示して周辺の見通しを確認できます。</p>
      </div>
      <Map3DToggle
        is3DEnabled={is3DEnabled}
        onToggle={onToggle}
        className="h-11 w-full justify-center border border-slate-200 bg-white"
      />
    </div>
  )
}

interface ARPanelContentProps {
  isARMode: boolean
  isParentChildARActive: boolean
  hasSelectedRoute: boolean
  onToggleAR: () => void
  onOpenParentChildAR: () => void
}

export function ARPanelContent({
  isARMode,
  isParentChildARActive,
  hasSelectedRoute,
  onToggleAR,
  onOpenParentChildAR,
}: ARPanelContentProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">AR表示</p>
        <p className="text-xs text-slate-500">周辺の危険報告を現地視点で重ねて確認できます。</p>
      </div>
      <Button
        type="button"
        variant={isARMode ? "default" : "outline"}
        className="h-11 w-full justify-center"
        onClick={onToggleAR}
      >
        {isARMode ? "ARを閉じる" : "ARを開く"}
      </Button>
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-950">親子で通学路確認</p>
        <p className="mt-1 text-xs leading-5 text-amber-800">
          選択中の通学路に近い危険ポイントだけを、子ども向けの短い注意で確認します。
        </p>
        <Button
          type="button"
          variant={isParentChildARActive ? "default" : "outline"}
          className="mt-3 h-11 w-full justify-center"
          onClick={onOpenParentChildAR}
          disabled={!hasSelectedRoute}
        >
          親子で通学路確認
        </Button>
        {!hasSelectedRoute && (
          <p className="mt-2 text-xs text-amber-700">先に通学路を選択してください。</p>
        )}
      </div>
    </div>
  )
}

interface SuspiciousPanelContentProps {
  isSuspiciousVisible: boolean
  hasReports: boolean
  onToggleVisible: () => void
  onOpenAlertForm: () => void
}

export function SuspiciousPanelContent({
  isSuspiciousVisible,
  hasReports,
  onToggleVisible,
  onOpenAlertForm,
}: SuspiciousPanelContentProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">不審者情報</p>
        <p className="text-xs text-slate-500">
          不審者の目撃エリアを、半径つきのオレンジの円で地図に表示します。
        </p>
      </div>
      <Button
        type="button"
        variant={isSuspiciousVisible ? "default" : "outline"}
        className={`h-11 w-full justify-center ${isSuspiciousVisible ? "bg-orange-500 text-white hover:bg-orange-600" : "border-orange-200 text-orange-700 hover:bg-orange-50"}`}
        onClick={onToggleVisible}
      >
        {isSuspiciousVisible ? "地図から非表示にする" : "地図に表示する"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-center"
        onClick={onOpenAlertForm}
      >
        <UserX className="mr-2 h-4 w-4 text-orange-600" />
        不審者アラートを投稿
      </Button>
      {!hasReports && (
        <p className="text-xs text-slate-400">
          まだ不審者情報がありません。「不審者アラートを投稿」から登録できます。
        </p>
      )}
    </div>
  )
}
