"use client"

import { AlertTriangle, Route as RouteIcon, Waves } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
}

export function RouteHazardPanel({
  routes,
  selectedRouteId,
  selectedHazardsCount,
  toggles,
  isLoading,
  onRouteChange,
  onToggleChange,
}: RouteHazardPanelProps) {
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
      </CardContent>
    </Card>
  )
}
