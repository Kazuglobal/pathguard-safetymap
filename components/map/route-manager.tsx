"use client"

import * as React from "react"
import { useState, useCallback } from "react"
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

type ViewMode = "list" | "creation" | "edit"

interface RouteManagerProps {
  onRouteSelect?: (route: UserRoute) => void
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

  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [editingRoute, setEditingRoute] = useState<UserRoute | null>(null)
  const [routeToDelete, setRouteToDelete] = useState<UserRoute | null>(null)

  // Form state
  const [routeName, setRouteName] = useState("")
  const [routeDescription, setRouteDescription] = useState("")
  const [creationPoints, setCreationPoints] = useState<[number, number][]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  const resetFormState = useCallback(() => {
    setRouteName("")
    setRouteDescription("")
    setCreationPoints([])
    setValidationError(null)
    setEditingRoute(null)
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

  const validateForm = useCallback((): boolean => {
    if (!routeName.trim()) {
      setValidationError("ルート名を入力してください")
      return false
    }
    if (routeName.length > 100) {
      setValidationError("ルート名は100文字以内で入力してください")
      return false
    }
    setValidationError(null)
    return true
  }, [routeName])

  const handleSaveRoute = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    if (viewMode === "creation") {
      const input: CreateRouteInput = {
        name: routeName.trim(),
        description: routeDescription.trim() || undefined,
        start_lat: creationPoints[0]?.[1] || 0,
        start_lng: creationPoints[0]?.[0] || 0,
        end_lat: creationPoints[creationPoints.length - 1]?.[1] || 0,
        end_lng: creationPoints[creationPoints.length - 1]?.[0] || 0,
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
      await deleteRoute(routeToDelete.id)
      setRouteToDelete(null)
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

      {/* Creation Panel */}
      {viewMode === "creation" && (
        <Card data-testid="route-creation-panel">
          <CardHeader>
            <CardTitle className="text-base">新しいルートを作成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              地図をクリックしてルートのポイントを追加してください
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">ルート名 *</label>
              <Input
                data-testid="route-name-input"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="例：通学路A"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">説明（任意）</label>
              <Textarea
                data-testid="route-description-input"
                value={routeDescription}
                onChange={(e) => setRouteDescription(e.target.value)}
                placeholder="ルートの説明を入力"
                rows={2}
              />
            </div>

            {(validationError || error) && (
              <p className="text-sm text-destructive">{validationError || error}</p>
            )}

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

            <div className="flex justify-end gap-2">
              <Button
                data-testid="cancel-route-button"
                variant="outline"
                onClick={handleCancelClick}
              >
                キャンセル
              </Button>
              <Button
                data-testid="save-route-button"
                onClick={handleSaveRoute}
              >
                保存
              </Button>
            </div>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">ルート名 *</label>
              <Input
                data-testid="route-name-input"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="例：通学路A"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">説明（任意）</label>
              <Textarea
                data-testid="route-description-input"
                value={routeDescription}
                onChange={(e) => setRouteDescription(e.target.value)}
                placeholder="ルートの説明を入力"
                rows={2}
              />
            </div>

            {(validationError || error) && (
              <p className="text-sm text-destructive">{validationError || error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                data-testid="cancel-route-button"
                variant="outline"
                onClick={handleCancelClick}
              >
                キャンセル
              </Button>
              <Button
                data-testid="save-route-button"
                onClick={handleSaveRoute}
              >
                保存
              </Button>
            </div>
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
        className="h-64 bg-muted rounded-lg flex items-center justify-center"
      >
        <div className="text-muted-foreground text-sm flex items-center gap-2">
          <MapIcon className="h-5 w-5" />
          マップ表示エリア
        </div>
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
