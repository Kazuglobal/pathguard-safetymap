"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { Flame, Layers, Navigation, Route as RouteIcon } from "lucide-react"

import { HazardReasonList } from "@/components/map/hazard-reason-list"
import { RouteHazardList } from "@/components/map/route-hazard-list"
import Map3DToggle from "@/components/map/map-3d-toggle"
import { RouteSafetySummaryCard } from "@/components/map/route-safety-summary-card"
import MapStyleSelector from "@/components/map/map-style-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getRouteHazardPresentation } from "@/lib/map/route-hazard-presentation"
import type { HazardType, RouteHazardMarker, UserRoute } from "@/lib/types"
import type { RouteSafetyEvidenceItem, RouteSafetySummary } from "@/lib/safety-scoring/route-safety-scorer"

// 地図マーカーと同じ絵・色(route-hazard-presentation)をトグルにも使う
const FLOOD = getRouteHazardPresentation("flood")
const TSUNAMI = getRouteHazardPresentation("tsunami")
const FloodIcon = FLOOD.icon
const TsunamiIcon = TSUNAMI.icon

interface RouteHazardPanelProps {
  routes: UserRoute[]
  /** 通学路の一覧の読み込みのようす(渡さなければ読み込み済みとみなす) */
  routesStatus?: RoutesStatus
  selectedRouteId: string | null
  selectedHazardsCount: number
  summary?: RouteSafetySummary
  evidenceItems?: RouteSafetyEvidenceItem[]
  hazards?: RouteHazardMarker[]
  /** 通学路の近くの事故多発地点一覧（RouteAccidentHotspotList）を差し込む */
  accidentHotspotSlot?: ReactNode
  toggles: Record<HazardType, boolean>
  isLoading: boolean
  onRouteChange: (routeId: string) => void
  onToggleChange: (hazardType: HazardType, checked: boolean) => void
  onHazardSelect?: (hazard: RouteHazardMarker) => void
  isMobile?: boolean
  mapStyle?: string
  onMapStyleChange?: (style: string) => void
  is3DEnabled?: boolean
  onToggle3D?: () => void
  onToggleAR?: () => void
  isARMode?: boolean
  onToggleHeatmap?: () => void
  isHeatmapVisible?: boolean
  variant?: "default" | "inline"
}

/**
 * 通学路が無い・道すじ(線)が無いときの理由と、直し方(UIUX改装 項目50)。
 * 線が無いと、地図に通学路を引けず、道ぞいの危険も調べられない
 */
function RouteGeometryNotice({
  routeCount,
  selectedRoute,
  routesStatus,
}: {
  routeCount: number
  selectedRoute: UserRoute | null
  routesStatus: RoutesStatus
}) {
  // 読み込み中・読み込めなかったときは「まだ登録されていません」と言わない(同じ通学路を二重に登録させないため)
  if (routeCount === 0 && routesStatus !== "ready") {
    return (
      <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" data-testid="route-geometry-notice">
        {routesStatus === "loading"
          ? "通学路を読み込んでいます…"
          : "通学路を読み込めませんでした。通信状態を確認して、地図を開き直してください。"}
      </p>
    )
  }
  const message =
    routeCount === 0
      ? "通学路がまだ登録されていません。登録すると、通学路の近くの危険と事故の多い場所をここで確かめられます。"
      : selectedRoute && !selectedRoute.route_geometry?.coordinates?.length
        ? "この通学路には道すじ(線)が無いので、地図に線を引けず、道ぞいの危険も調べられません。道すじをかかずに登録したときや、位置を粗く保存する設定で別の端末から登録したときに起きます。通学路の画面で道すじをかき直してください。"
        : null
  if (!message) return null
  return (
    <div role="status" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" data-testid="route-geometry-notice">
      <p>{message}</p>
      <Link href="/routes" className="inline-flex min-h-9 items-center font-bold underline underline-offset-4">
        {routeCount === 0 ? "通学路を登録する" : "通学路の画面へ"}
      </Link>
    </div>
  )
}

/** 通学路の一覧の読み込みのようす(map-container が useUserRoutes の isLoading・error から決める) */
export type RoutesStatus = "loading" | "error" | "ready"

interface HazardPanelContentProps {
  routes: UserRoute[]
  routesStatus: RoutesStatus
  selectedRouteId: string | null
  selectedHazardsCount: number
  toggles: Record<HazardType, boolean>
  isLoading: boolean
  onRouteChange: (routeId: string) => void
  onToggleChange: (hazardType: HazardType, checked: boolean) => void
}

function HazardPanelContent({
  routes,
  routesStatus,
  selectedRouteId,
  selectedHazardsCount,
  toggles,
  isLoading,
  onRouteChange,
  onToggleChange,
}: HazardPanelContentProps) {
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? null
  return (
    <>
      <RouteGeometryNotice routeCount={routes.length} selectedRoute={selectedRoute} routesStatus={routesStatus} />
      <div className="space-y-2">
        <Label htmlFor="route-hazard-select">対象ルート</Label>
        <Select value={selectedRouteId ?? undefined} onValueChange={onRouteChange}>
          <SelectTrigger id="route-hazard-select">
            <SelectValue placeholder="ルートを選択" />
          </SelectTrigger>
          <SelectContent>
            {routes.map((route) => (
              <SelectItem key={route.id} value={route.id}>
                {route.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <FloodIcon className="h-4 w-4" style={{ color: FLOOD.colorHex }} />
            <div>
              <p className="text-sm font-medium">洪水浸水想定</p>
              <p className="text-xs text-muted-foreground">重ねるハザードマップ</p>
            </div>
          </div>
          <Switch
            checked={toggles.flood}
            onCheckedChange={(checked) => onToggleChange("flood", checked)}
            aria-label="洪水ハザードレイヤー切替"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <TsunamiIcon className="h-4 w-4" style={{ color: TSUNAMI.colorHex }} />
            <div>
              <p className="text-sm font-medium">津波浸水想定</p>
              <p className="text-xs text-muted-foreground">重ねるハザードマップ</p>
            </div>
          </div>
          <Switch
            checked={toggles.tsunami}
            onCheckedChange={(checked) => onToggleChange("tsunami", checked)}
            aria-label="津波ハザードレイヤー切替"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
        <span className="text-sm text-amber-900">
          {isLoading ? "危険箇所を判定中..." : "危険箇所"}
        </span>
        <Badge variant="secondary" className="bg-white text-amber-900">
          {selectedHazardsCount}件
        </Badge>
      </div>
    </>
  )
}

export function RouteHazardPanel({
  routes,
  routesStatus = "ready",
  selectedRouteId,
  selectedHazardsCount,
  summary,
  evidenceItems = [],
  hazards = [],
  accidentHotspotSlot,
  toggles,
  isLoading,
  onRouteChange,
  onToggleChange,
  onHazardSelect,
  isMobile = false,
  mapStyle,
  onMapStyleChange,
  is3DEnabled = false,
  onToggle3D,
  onToggleAR,
  isARMode = false,
  onToggleHeatmap,
  isHeatmapVisible = false,
  variant = "default",
}: RouteHazardPanelProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const hasDisplaySettings = useMemo(
    () => Boolean(onMapStyleChange && onToggle3D && mapStyle),
    [mapStyle, onMapStyleChange, onToggle3D],
  )

  const displayControls = hasDisplaySettings ? (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">地図表示</p>
        <p className="text-xs text-muted-foreground">見え方と補助表示を切り替えます</p>
      </div>

      <MapStyleSelector
        currentStyle={mapStyle!}
        onChange={onMapStyleChange!}
        compactLabel={false}
        buttonLabel="地図スタイル"
        buttonClassName="h-11 w-full justify-between px-3"
        contentAlign="start"
      />

      <div className="grid grid-cols-1 gap-2">
        <Map3DToggle
          is3DEnabled={is3DEnabled}
          onToggle={onToggle3D!}
          className="h-11 w-full justify-center border border-slate-200 bg-white"
        />

        {onToggleAR && (
          <Button
            onClick={onToggleAR}
            variant={isARMode ? "default" : "outline"}
            aria-pressed={isARMode}
            className={`h-11 w-full justify-center ${
              isARMode
                ? "bg-sky-600 text-white border-sky-600 hover:bg-sky-700"
                : "border-slate-200 bg-white hover:bg-slate-100"
            }`}
            aria-label="ARビューを開く"
          >
            <Navigation className="mr-2 h-4 w-4" />
            ARビュー
          </Button>
        )}

        {onToggleHeatmap && (
          <Button
            onClick={onToggleHeatmap}
            variant={isHeatmapVisible ? "default" : "outline"}
            aria-pressed={isHeatmapVisible}
            className={`h-11 w-full justify-center ${
              isHeatmapVisible
                ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                : "border-slate-200 bg-white hover:bg-slate-100"
            }`}
            aria-label="事故ヒートマップ表示切替"
          >
            <Flame className="mr-2 h-4 w-4" />
            事故ヒートマップ
          </Button>
        )}
      </div>
    </div>
  ) : null

  if (variant === "inline") {
    return (
      <div className="space-y-4">
        {summary && <RouteSafetySummaryCard summary={summary} />}
        <RouteHazardList hazards={hazards} onSelectHazard={onHazardSelect} />
        {accidentHotspotSlot}
        <HazardReasonList items={evidenceItems} />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">通学路のハザード</p>
          <p className="text-xs text-muted-foreground">
            選んだ通学路だけに、ハザードの判定を重ねて表示します
          </p>
        </div>
        <HazardPanelContent
          routes={routes}
          routesStatus={routesStatus}
          selectedRouteId={selectedRouteId}
          selectedHazardsCount={selectedHazardsCount}
          toggles={toggles}
          isLoading={isLoading}
          onRouteChange={onRouteChange}
          onToggleChange={onToggleChange}
        />
      </div>
    )
  }

  if (isMobile) {
    return (
      <>
        <div className="absolute left-3 right-3 z-20 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] space-y-2">
          {summary && <RouteSafetySummaryCard summary={summary} compact={true} />}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDrawerOpen(true)}
            className="h-10 gap-2 rounded-full border-gray-200/80 bg-white/95 px-3 shadow-lg backdrop-blur-sm hover:bg-white"
            aria-label="通学路の注意点を開く"
          >
            <Layers className="h-4 w-4 text-sky-700" />
            <span>通学路の注意点</span>
            <Badge variant="secondary" className="bg-sky-50 text-sky-900">
              {selectedHazardsCount}
            </Badge>
          </Button>
        </div>

        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent className="max-h-[85vh] rounded-t-3xl px-0 pb-6">
            <DrawerHeader className="px-4 text-left">
              <DrawerTitle>通学路の注意点</DrawerTitle>
              <DrawerDescription>
                安全確認に必要な注意点を先に見て、必要なときだけ地図設定を切り替えます
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-4 overflow-y-auto px-4">
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                {summary && <RouteSafetySummaryCard summary={summary} />}
                <RouteHazardList hazards={hazards} onSelectHazard={onHazardSelect} />
                {accidentHotspotSlot}
                <HazardReasonList items={evidenceItems} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">通学路のハザード</p>
                  <p className="text-xs text-muted-foreground">
                    選んだ通学路だけに、ハザードの判定を重ねて表示します
                  </p>
                </div>
                <HazardPanelContent
                  routes={routes}
                  routesStatus={routesStatus}
                  selectedRouteId={selectedRouteId}
                  selectedHazardsCount={selectedHazardsCount}
                  toggles={toggles}
                  isLoading={isLoading}
                  onRouteChange={onRouteChange}
                  onToggleChange={onToggleChange}
                />
              </div>

              {displayControls}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Card className="absolute left-3 top-[calc(env(safe-area-inset-top,0px)+8rem)] z-20 w-[min(22rem,calc(100vw-1.5rem))] border-gray-200/80 bg-white/95 shadow-xl backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <RouteIcon className="h-4 w-4 text-blue-600" />
          通学路のハザード
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          選んだ通学路だけに、ハザードの判定を重ねて表示します
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && <RouteSafetySummaryCard summary={summary} />}
        <RouteHazardList hazards={hazards} onSelectHazard={onHazardSelect} />
        {accidentHotspotSlot}
        <HazardReasonList items={evidenceItems} />
        <HazardPanelContent
          routes={routes}
          routesStatus={routesStatus}
          selectedRouteId={selectedRouteId}
          selectedHazardsCount={selectedHazardsCount}
          toggles={toggles}
          isLoading={isLoading}
          onRouteChange={onRouteChange}
          onToggleChange={onToggleChange}
        />
      </CardContent>
    </Card>
  )
}
