"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Flame, Layers, Navigation, Route as RouteIcon, Waves } from "lucide-react"

import Map3DToggle from "@/components/map/map-3d-toggle"
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
import type { HazardType, UserRoute } from "@/lib/types"

interface RouteHazardPanelProps {
  routes: UserRoute[]
  selectedRouteId: string | null
  selectedHazardsCount: number
  toggles: Record<HazardType, boolean>
  isLoading: boolean
  onRouteChange: (routeId: string) => void
  onToggleChange: (hazardType: HazardType, checked: boolean) => void
  isMobile?: boolean
  mapStyle?: string
  onMapStyleChange?: (style: string) => void
  is3DEnabled?: boolean
  onToggle3D?: () => void
  onToggleAR?: () => void
  isARMode?: boolean
  onToggleHeatmap?: () => void
  isHeatmapVisible?: boolean
}

function HazardPanelContent({
  routes,
  selectedRouteId,
  selectedHazardsCount,
  toggles,
  isLoading,
  onRouteChange,
  onToggleChange,
}: RouteHazardPanelProps) {
  return (
    <>
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
            <AlertTriangle className="h-4 w-4 text-sky-600" />
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
            <Waves className="h-4 w-4 text-blue-700" />
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
  selectedRouteId,
  selectedHazardsCount,
  toggles,
  isLoading,
  onRouteChange,
  onToggleChange,
  isMobile = false,
  mapStyle,
  onMapStyleChange,
  is3DEnabled = false,
  onToggle3D,
  onToggleAR,
  isARMode = false,
  onToggleHeatmap,
  isHeatmapVisible = false,
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

  if (isMobile) {
    return (
      <>
        <div className="absolute left-3 z-20 top-[calc(env(safe-area-inset-top,0px)+4.25rem)]">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDrawerOpen(true)}
            className="h-10 gap-2 rounded-full border-gray-200/80 bg-white/95 px-3 shadow-lg backdrop-blur-sm hover:bg-white"
            aria-label="ハザード・地図設定を開く"
          >
            <Layers className="h-4 w-4 text-sky-700" />
            <span>ハザード・地図</span>
            <Badge variant="secondary" className="bg-sky-50 text-sky-900">
              {selectedHazardsCount}
            </Badge>
          </Button>
        </div>

        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent className="max-h-[85vh] rounded-t-3xl px-0 pb-6">
            <DrawerHeader className="px-4 text-left">
              <DrawerTitle>ハザード・地図設定</DrawerTitle>
              <DrawerDescription>
                ハザード表示と地図の見え方をまとめて切り替えます
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-4 overflow-y-auto px-4">
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">通学ルートハザード</p>
                  <p className="text-xs text-muted-foreground">
                    選択した通学ルートだけにハザード判定を重ねて表示します
                  </p>
                </div>
                <HazardPanelContent
                  routes={routes}
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
          通学ルートハザード
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          選択した通学ルートだけにハザード判定を重ねて表示します
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <HazardPanelContent
          routes={routes}
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
