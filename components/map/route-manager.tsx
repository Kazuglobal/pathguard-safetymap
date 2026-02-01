"use client"

import { useState, useCallback, useMemo } from "react"
import Map, { Layer, Source } from "react-map-gl/mapbox"
import type { MapLayerMouseEvent } from "react-map-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RouteCard } from "@/components/routes/route-card"
import { useUserRoutes } from "@/hooks/use-user-routes"
import {
  Plus,
  RefreshCw,
  Undo2,
  MapIcon,
  AlertCircle,
  Route as RouteIcon,
} from "lucide-react"
import type { UserRoute, CreateRouteInput, UpdateRouteInput } from "@/lib/types"
import { DEFAULT_MAPBOX_STYLE, getMapboxToken } from "@/lib/mapbox-config"

const DEFAULT_VIEW_STATE = {
  longitude: 139.753,
  latitude: 35.6844,
  zoom: 12,
}

type ViewMode = "list" | "creation" | "edit"

interface RouteManagerProps {
  onRouteSelect?: (route: UserRoute) => void
}

interface RouteFormFieldsProps {
  routeName: string
  routeDescription: string
  validationError: string | null
  error: string | null
  onRouteNameChange: (value: string) => void
  onRouteDescriptionChange: (value: string) => void
}

function RouteFormFields({
  routeName,
  routeDescription,
  validationError,
  error,
  onRouteNameChange,
  onRouteDescriptionChange,
}: RouteFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">ルート名 *</label>
        <Input
          data-testid="route-name-input"
          value={routeName}
          onChange={(e) => onRouteNameChange(e.target.value)}
          placeholder="例：通学路A"
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">説明（任意）</label>
        <Textarea
          data-testid="route-description-input"
          value={routeDescription}
          onChange={(e) => onRouteDescriptionChange(e.target.value)}
          placeholder="ルートの説明を入力"
          rows={2}
        />
      </div>

      {(validationError || error) && (
        <p className="text-sm text-destructive">{validationError || error}</p>
      )}
    </>
  )
}

interface RouteFormActionsProps {
  onCancel: () => void
  onSave: () => void
}

function RouteFormActions({ onCancel, onSave }: RouteFormActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        data-testid="cancel-route-button"
        variant="outline"
        onClick={onCancel}
      >
        キャンセル
      </Button>
      <Button data-testid="save-route-button" onClick={onSave}>
        保存
      </Button>
    </div>
  )
}

export function RouteManager({ onRouteSelect }: RouteManagerProps) {
  const {
    routes,
    isLoading,
    error,
    addRoute,
    updateRoute,
    deleteRoute,
    setPrimaryRoute,
    refreshRoutes,
  } = useUserRoutes()

  const mapToken = useMemo(() => getMapboxToken(), [])

  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [editingRoute, setEditingRoute] = useState<UserRoute | null>(null)
  const [routeToDelete, setRouteToDelete] = useState<UserRoute | null>(null)

  // Form state
  const [routeName, setRouteName] = useState("")
  const [routeDescription, setRouteDescription] = useState("")
  const [creationPoints, setCreationPoints] = useState<[number, number][]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pointLat, setPointLat] = useState("")
  const [pointLng, setPointLng] = useState("")

  const pointsGeoJson = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: creationPoints.map((coordinate, index) => ({
        type: "Feature",
        properties: { index },
        geometry: {
          type: "Point",
          coordinates: coordinate,
        },
      })),
    }
  }, [creationPoints])

  const lineGeoJson = useMemo(() => {
    return {
      type: "FeatureCollection",
      features:
        creationPoints.length >= 2
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: creationPoints,
                },
              },
            ]
          : [],
    }
  }, [creationPoints])

  const resetFormState = useCallback(() => {
    setRouteName("")
    setRouteDescription("")
    setCreationPoints([])
    setValidationError(null)
    setEditingRoute(null)
    setPointLat("")
    setPointLng("")
  }, [])

  const handleRouteClick = useCallback(
    (route: UserRoute) => {
      setSelectedRouteId(route.id)
      onRouteSelect?.(route)
    },
    [onRouteSelect]
  )

  const handleAddRouteClick = useCallback(() => {
    resetFormState()
    setViewMode("creation")
  }, [resetFormState])

  const handleEditClick = useCallback((route: UserRoute) => {
    setEditingRoute(route)
    setRouteName(route.name)
    setRouteDescription(route.description || "")
    setValidationError(null)
    setViewMode("edit")
  }, [])

  const handleDeleteClick = useCallback((route: UserRoute) => {
    setRouteToDelete(route)
  }, [])

  const handleSetPrimaryClick = useCallback(
    async (route: UserRoute) => {
      await setPrimaryRoute(route.id)
    },
    [setPrimaryRoute]
  )

  const handleCancelClick = useCallback(() => {
    resetFormState()
    setViewMode("list")
  }, [resetFormState])

  const handleUndoPoint = useCallback(() => {
    setCreationPoints((prev) => prev.slice(0, -1))
  }, [])

  const appendPoint = useCallback((lng: number, lat: number, clearInputs: boolean) => {
    setCreationPoints((prev) => [...prev, [lng, lat]])
    if (clearInputs) {
      setPointLat("")
      setPointLng("")
    }
    setValidationError(null)
  }, [])

  const handleAddPoint = useCallback(() => {
    const lat = Number.parseFloat(pointLat)
    const lng = Number.parseFloat(pointLng)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setValidationError("緯度・経度を数値で入力してください")
      return
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setValidationError("緯度・経度の範囲が正しくありません")
      return
    }

    appendPoint(lng, lat, true)
  }, [appendPoint, pointLat, pointLng])

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (viewMode !== "creation") {
        return
      }
      appendPoint(event.lngLat.lng, event.lngLat.lat, false)
    },
    [appendPoint, viewMode]
  )

  const validateForm = useCallback((): boolean => {
    if (!routeName.trim()) {
      setValidationError("ルート名を入力してください")
      return false
    }
    if (routeName.length > 100) {
      setValidationError("ルート名は100文字以内で入力してください")
      return false
    }
    if (viewMode === "creation" && creationPoints.length < 2) {
      setValidationError("ルートには2つ以上のポイントが必要です")
      return false
    }
    setValidationError(null)
    return true
  }, [routeName, viewMode, creationPoints])

  const handleSaveRoute = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    if (viewMode === "creation") {
      const [startLng, startLat] = creationPoints[0]!
      const [endLng, endLat] = creationPoints[creationPoints.length - 1]!
      const input: CreateRouteInput = {
        name: routeName.trim(),
        description: routeDescription.trim() || undefined,
        start_lat: startLat,
        start_lng: startLng,
        end_lat: endLat,
        end_lng: endLng,
        start_address: "起点",
        end_address: "終点",
        route_geometry:
          creationPoints.length >= 2
            ? {
                type: "LineString",
                coordinates: creationPoints,
              }
            : undefined,
      }

      const success = await addRoute(input)
      if (success) {
        resetFormState()
        setViewMode("list")
      }
    } else if (viewMode === "edit" && editingRoute) {
      const input: UpdateRouteInput = {
        name: routeName.trim(),
        description: routeDescription.trim() || undefined,
      }

      const success = await updateRoute(editingRoute.id, input)
      if (success) {
        resetFormState()
        setViewMode("list")
      }
    }
  }, [
    validateForm,
    viewMode,
    routeName,
    routeDescription,
    creationPoints,
    editingRoute,
    addRoute,
    updateRoute,
    resetFormState,
  ])

  const handleConfirmDelete = useCallback(async () => {
    if (routeToDelete) {
      const success = await deleteRoute(routeToDelete.id)
      if (success) {
        setRouteToDelete(null)
      }
    }
  }, [routeToDelete, deleteRoute])

  const handleCancelDelete = useCallback(() => {
    setRouteToDelete(null)
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="route-manager" className="space-y-4">
        <div data-testid="route-manager-loading" className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  // Error state
  if (error && routes.length === 0) {
    return (
      <div data-testid="route-manager" className="space-y-4">
        <div
          data-testid="route-manager-error"
          className="flex flex-col items-center justify-center p-8 text-center"
        >
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-destructive mb-4">{error}</p>
          <Button
            data-testid="retry-button"
            variant="outline"
            onClick={refreshRoutes}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            再試行
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="route-manager" className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <RouteIcon className="h-5 w-5" />
          通学路一覧
        </h2>
        <Button
          data-testid="add-route-button"
          onClick={handleAddRouteClick}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          ルート追加
        </Button>
      </div>

      {viewMode === "list" && error && routes.length > 0 && (
        <div
          data-testid="route-manager-inline-error"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* Creation Panel */}
      {viewMode === "creation" && (
        <Card data-testid="route-creation-panel">
          <CardHeader>
            <CardTitle className="text-base">新しいルートを作成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              地図をクリック（または座標入力）してルートのポイントを追加してください
            </p>

            <RouteFormFields
              routeName={routeName}
              routeDescription={routeDescription}
              validationError={validationError}
              error={error}
              onRouteNameChange={setRouteName}
              onRouteDescriptionChange={setRouteDescription}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">ポイント追加</label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  data-testid="route-point-lat-input"
                  value={pointLat}
                  onChange={(e) => setPointLat(e.target.value)}
                  placeholder="緯度"
                />
                <Input
                  data-testid="route-point-lng-input"
                  value={pointLng}
                  onChange={(e) => setPointLng(e.target.value)}
                  placeholder="経度"
                />
                <Button
                  data-testid="add-point-button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddPoint}
                >
                  追加
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                例: 35.6895, 139.6917
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                data-testid="undo-point-button"
                variant="outline"
                size="sm"
                onClick={handleUndoPoint}
                disabled={creationPoints.length === 0}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                ポイントを戻す
              </Button>
              <span className="text-sm text-muted-foreground">
                {creationPoints.length} ポイント
              </span>
            </div>

            <RouteFormActions
              onCancel={handleCancelClick}
              onSave={handleSaveRoute}
            />
          </CardContent>
        </Card>
      )}

      {/* Edit Panel */}
      {viewMode === "edit" && editingRoute && (
        <Card data-testid="route-edit-panel">
          <CardHeader>
            <CardTitle className="text-base">ルートを編集</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RouteFormFields
              routeName={routeName}
              routeDescription={routeDescription}
              validationError={validationError}
              error={error}
              onRouteNameChange={setRouteName}
              onRouteDescriptionChange={setRouteDescription}
            />

            <RouteFormActions
              onCancel={handleCancelClick}
              onSave={handleSaveRoute}
            />
          </CardContent>
        </Card>
      )}

      {/* Route List */}
      {viewMode === "list" && (
        <>
          {routes.length === 0 ? (
            <div
              data-testid="route-manager-empty"
              className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed"
            >
              <MapIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                まだ通学路が登録されていません
              </p>
              <p className="text-sm text-muted-foreground">
                「ルート追加」ボタンから新しいルートを作成しましょう
              </p>
            </div>
          ) : (
            <div data-testid="route-list" className="space-y-3">
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={selectedRouteId === route.id}
                  onClick={handleRouteClick}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  onSetPrimary={handleSetPrimaryClick}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Map Container */}
      <div
        data-testid="route-map-container"
        className="h-64 bg-muted rounded-lg overflow-hidden relative"
      >
        {mapToken ? (
          <Map
            mapboxAccessToken={mapToken}
            mapStyle={DEFAULT_MAPBOX_STYLE}
            initialViewState={DEFAULT_VIEW_STATE}
            onClick={viewMode === "creation" ? handleMapClick : undefined}
            cursor={viewMode === "creation" ? "crosshair" : "grab"}
            attributionControl={false}
            style={{ width: "100%", height: "100%" }}
          >
            {creationPoints.length > 1 && (
              <Source id="route-line-source" type="geojson" data={lineGeoJson}>
                <Layer
                  id="route-line-layer"
                  type="line"
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={{ "line-color": "#2563eb", "line-width": 4 }}
                />
              </Source>
            )}
            {creationPoints.length > 0 && (
              <Source id="route-points-source" type="geojson" data={pointsGeoJson}>
                <Layer
                  id="route-points-layer"
                  type="circle"
                  paint={{
                    "circle-radius": 6,
                    "circle-color": "#2563eb",
                    "circle-stroke-width": 2,
                    "circle-stroke-color": "#ffffff",
                  }}
                />
              </Source>
            )}
          </Map>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            <MapIcon className="h-5 w-5 mr-2" />
            マップを表示するにはトークンが必要です
          </div>
        )}
        {mapToken && viewMode === "creation" && (
          <div className="absolute left-3 top-3 rounded-md bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
            クリックでポイント追加
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={routeToDelete !== null}
        onOpenChange={(open) => !open && handleCancelDelete()}
      >
        <DialogContent data-testid="delete-confirmation-dialog">
          <DialogHeader>
            <DialogTitle>ルートを削除</DialogTitle>
            <DialogDescription>
              「{routeToDelete?.name}」を削除してもよろしいですか？
              この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-destructive" data-testid="delete-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              data-testid="cancel-delete-button"
              variant="outline"
              onClick={handleCancelDelete}
            >
              キャンセル
            </Button>
            <Button
              data-testid="confirm-delete-button"
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
