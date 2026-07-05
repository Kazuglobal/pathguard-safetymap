"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import Map, { Layer, Source } from "react-map-gl/mapbox"
import type { MapRef, MapMouseEvent, MapTouchEvent } from "react-map-gl/mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import * as turf from "@turf/turf"
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
import { RouteOverviewMap } from "@/components/routes/route-overview-map"
import { ChildSelector } from "@/components/routes/child-selector"
import { RouteComparisonTable } from "@/components/routes/route-comparison-table"
import { RouteDangerReportDialog } from "@/components/routes/route-danger-report-dialog"
import { useToast } from "@/components/ui/use-toast"
import { useUserRoutes } from "@/hooks/use-user-routes"
import { useRouteDangerCounts } from "@/hooks/use-route-danger-counts"
import {
  Plus,
  RefreshCw,
  Undo2,
  MapIcon,
  AlertCircle,
  Route as RouteIcon,
  MousePointerClick,
  Pencil,
  Navigation,
  MapPin,
  Loader2,
  Search,
} from "lucide-react"
import type {
  UserRoute,
  CreateRouteInput,
  UpdateRouteInput,
  RouteSharePayload,
} from "@/lib/types"
import { DEFAULT_MAPBOX_STYLE, getMapboxToken } from "@/lib/mapbox-config"

type InputMode = "click" | "draw" | "route"

const DEFAULT_VIEW_STATE = {
  longitude: 139.753,
  latitude: 35.6844,
  zoom: 12,
}

type ViewMode = "list" | "creation" | "edit"

interface RouteManagerProps {
  onRouteSelect?: (route: UserRoute) => void
}

export function pruneComparisonRouteIds(
  previousRouteIds: string[],
  visibleRoutes: Pick<UserRoute, "id">[]
) {
  const nextRouteIds = previousRouteIds.filter((routeId) =>
    visibleRoutes.some((route) => route.id === routeId)
  )

  return nextRouteIds.length === previousRouteIds.length ? previousRouteIds : nextRouteIds
}

interface RouteFormFieldsProps {
  routeName: string
  routeDescription: string
  childName: string
  validationError: string | null
  error: string | null
  onRouteNameChange: (value: string) => void
  onRouteDescriptionChange: (value: string) => void
  onChildNameChange: (value: string) => void
}

function RouteFormFields({
  routeName,
  routeDescription,
  childName,
  validationError,
  error,
  onRouteNameChange,
  onRouteDescriptionChange,
  onChildNameChange,
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

      <div className="space-y-2">
        <label className="text-sm font-medium">対象の子ども（任意）</label>
        <Input
          data-testid="child-name-input"
          value={childName}
          onChange={(e) => onChildNameChange(e.target.value)}
          placeholder="例：さくら"
          maxLength={40}
        />
        <p className="text-xs text-muted-foreground">
          空欄の場合は家族共通の通学路として扱います。
        </p>
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
  const { toast } = useToast()
  const userRoutes = useUserRoutes()
  const {
    routes,
    isLoading,
    error,
    addRoute,
    updateRoute,
    deleteRoute,
    setPrimaryRoute,
    refreshRoutes,
  } = userRoutes
  const childProfiles = userRoutes.childProfiles ?? [{ id: "all", label: "すべて", routeCount: routes.length }]

  const mapToken = useMemo(() => getMapboxToken(), [])

  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [selectedChildId, setSelectedChildId] = useState("all")
  const [comparisonRouteIds, setComparisonRouteIds] = useState<string[]>([])
  const [editingRoute, setEditingRoute] = useState<UserRoute | null>(null)
  const [routeToDelete, setRouteToDelete] = useState<UserRoute | null>(null)
  const [routeForReport, setRouteForReport] = useState<UserRoute | null>(null)

  // Form state
  const [routeName, setRouteName] = useState("")
  const [routeDescription, setRouteDescription] = useState("")
  const [childName, setChildName] = useState("")
  const [creationPoints, setCreationPoints] = useState<[number, number][]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pointLat, setPointLat] = useState("")
  const [pointLng, setPointLng] = useState("")

  // Drawing mode state
  const [inputMode, setInputMode] = useState<InputMode>("route")
  const [isDrawing, setIsDrawing] = useState(false)
  const mapRef = useRef<MapRef | null>(null)
  const lastPointRef = useRef<[number, number] | null>(null)

  // Route search mode state
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null)
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null)
  const [startAddressLabel, setStartAddressLabel] = useState<string | null>(null)
  const [endAddressLabel, setEndAddressLabel] = useState<string | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)

  // Location search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<
    { id: string; place_name: string; center: [number, number] }[]
  >([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Minimum distance between points during drawing (in meters)
  const MIN_POINT_DISTANCE = 10

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Location search function
  const handleLocationSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!searchQuery.trim()) return

    setIsSearching(true)
    setShowSearchResults(true)

    try {
      const response = await fetch(
        `/api/mapbox/geocode?query=${encodeURIComponent(searchQuery)}&country=jp&language=ja`
      )
      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(
          data.map((feature: { id: string; place_name: string; center: [number, number] }) => ({
            id: feature.id,
            place_name: feature.place_name,
            center: feature.center,
          }))
        )
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error("住所検索エラー:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  const pointsGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    return {
      type: "FeatureCollection" as const,
      features: creationPoints.map((coordinate, index) => ({
        type: "Feature" as const,
        properties: { index },
        geometry: {
          type: "Point" as const,
          coordinates: coordinate,
        },
      })),
    }
  }, [creationPoints])

  const lineGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    return {
      type: "FeatureCollection" as const,
      features:
        creationPoints.length >= 2
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "LineString" as const,
                  coordinates: creationPoints,
                },
              },
            ]
          : [],
    }
  }, [creationPoints])

  const formatPointLabel = useCallback((point: [number, number]) => {
    return `${point[1].toFixed(4)}, ${point[0].toFixed(4)}`
  }, [])

  const formatRouteDistance = useCallback((meters: number | null) => {
    if (meters === null) {
      return "距離情報なし"
    }
    if (meters < 1000) {
      return `${meters}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
  }, [])

  const formatRouteTime = useCallback((minutes: number | null) => {
    if (minutes === null) {
      return "時間情報なし"
    }
    return `${minutes}分`
  }, [])

  const formatUpdatedAtLabel = useCallback((updatedAt: string) => {
    const parsedDate = new Date(updatedAt)
    if (Number.isNaN(parsedDate.getTime())) {
      return "更新日時不明"
    }

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsedDate)
  }, [])

  const buildRouteSharePayload = useCallback(
    (route: UserRoute): RouteSharePayload => {
      const updatedAtLabel = formatUpdatedAtLabel(route.updated_at)
      const cautionText = route.description?.trim() || "要注意点はアプリで確認してください"

      return {
        routeId: route.id,
        title: route.name,
        updatedAtLabel,
        text: [
          `${route.name}`,
          `出発地: ${route.start_address}`,
          `到着地: ${route.end_address}`,
          `距離: ${formatRouteDistance(route.distance_meters)}`,
          `所要時間: ${formatRouteTime(route.estimated_time_minutes)}`,
          `要注意点: ${cautionText}`,
          `更新日時: ${updatedAtLabel}`,
        ].join("\n"),
      }
    },
    [formatRouteDistance, formatRouteTime, formatUpdatedAtLabel]
  )

  const buildRouteChildFields = useCallback((rawChildName: string) => {
    const normalizedChildName = rawChildName.trim()

    if (!normalizedChildName) {
      return {
        child_id: null,
        child_name: null,
      }
    }

    return {
      child_id: `child-${normalizedChildName.toLowerCase()}`,
      child_name: normalizedChildName,
    }
  }, [])

  const resetFormState = useCallback(() => {
    setRouteName("")
    setRouteDescription("")
    setChildName("")
    setCreationPoints([])
    setValidationError(null)
    setEditingRoute(null)
    setPointLat("")
    setPointLng("")
    setIsDrawing(false)
    lastPointRef.current = null
    setStartPoint(null)
    setEndPoint(null)
    setStartAddressLabel(null)
    setEndAddressLabel(null)
    setIsLoadingRoute(false)
    setSearchQuery("")
    setSearchResults([])
    setShowSearchResults(false)
  }, [])

  const handleRouteClick = useCallback(
    (route: UserRoute) => {
      setSelectedRouteId(route.id)
      onRouteSelect?.(route)
    },
    [onRouteSelect]
  )

  const handleToggleCompareRoute = useCallback((route: UserRoute) => {
    setComparisonRouteIds((prev) =>
      prev.includes(route.id)
        ? prev.filter((routeId) => routeId !== route.id)
        : [...prev, route.id].slice(-3)
    )
  }, [])

  const handleAddRouteClick = useCallback(() => {
    resetFormState()
    if (selectedChildId !== "all" && selectedChildId !== "shared") {
      const selectedChild = childProfiles.find((profile) => profile.id === selectedChildId)
      setChildName(selectedChild?.label ?? "")
    }
    setViewMode("creation")
  }, [childProfiles, resetFormState, selectedChildId])

  const handleEditClick = useCallback((route: UserRoute) => {
    setEditingRoute(route)
    setRouteName(route.name)
    setRouteDescription(route.description || "")
    setChildName(route.child_name || "")
    setValidationError(null)
    setViewMode("edit")
  }, [])

  const handleDeleteClick = useCallback((route: UserRoute) => {
    setRouteToDelete(route)
  }, [])

  const filteredRoutes = useMemo(() => {
    if (selectedChildId === "all") {
      return routes
    }

    return routes.filter((route) => (route.child_id ?? "shared") === selectedChildId)
  }, [routes, selectedChildId])

  const comparisonRoutes = useMemo(
    () => filteredRoutes.filter((route) => comparisonRouteIds.includes(route.id)),
    [comparisonRouteIds, filteredRoutes]
  )

  const { counts: routeDangerCounts } = useRouteDangerCounts(filteredRoutes)

  useEffect(() => {
    setComparisonRouteIds((prev) => pruneComparisonRouteIds(prev, filteredRoutes))
    setSelectedRouteId((prev) =>
      prev && !filteredRoutes.some((route) => route.id === prev) ? null : prev
    )
  }, [filteredRoutes])

  useEffect(() => {
    if (!childProfiles.some((profile) => profile.id === selectedChildId)) {
      setSelectedChildId("all")
    }
  }, [childProfiles, selectedChildId])

  const handleGenerateReportClick = useCallback((route: UserRoute) => {
    setRouteForReport(route)
  }, [])

  const handleShareRoute = useCallback(
    async (route: UserRoute) => {
      const payload = buildRouteSharePayload(route)

      try {
        if (typeof navigator.share === "function") {
          await navigator.share({
            title: payload.title,
            text: payload.text,
          })
          toast({
            title: "共有シートを開きました",
            description: "家族向けに通学路情報を共有できます。",
          })
          return
        }

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(payload.text)
          toast({
            title: "共有内容をコピーしました",
            description: "家族向けメッセージを貼り付けて共有できます。",
          })
          return
        }

        toast({
          title: "共有できませんでした",
          description: "この端末では共有機能が利用できません。",
          variant: "destructive",
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        toast({
          title: "共有できませんでした",
          description: "時間をおいて再度お試しください。",
          variant: "destructive",
        })
      }
    },
    [buildRouteSharePayload, toast]
  )

  const handleCloseReportDialog = useCallback(() => {
    setRouteForReport(null)
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

  // Fetch route from Mapbox Directions API
  const fetchRouteFromAPI = useCallback(
    async (start: [number, number], end: [number, number]) => {
      setIsLoadingRoute(true)
      setValidationError(null)

      try {
        const response = await fetch("/api/mapbox/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "getRoute",
            waypoints: [
              { coordinates: start },
              { coordinates: end },
            ],
            profile: "walking",
            geometries: "geojson",
            overview: "full",
          }),
        })

        if (!response.ok) {
          throw new Error("ルートの取得に失敗しました")
        }

        const data = await response.json()

        if (data.routes && data.routes.length > 0) {
          const routeCoordinates = data.routes[0].geometry
            .coordinates as [number, number][]
          setCreationPoints(routeCoordinates)
        } else {
          setValidationError("ルートが見つかりませんでした")
        }
      } catch (err) {
        setValidationError(
          err instanceof Error ? err.message : "ルートの取得に失敗しました"
        )
      } finally {
        setIsLoadingRoute(false)
      }
    },
    []
  )

  // Handle search result click. In auto-route mode, use results as start/end points.
  const handleSearchResultClick = useCallback(
    (result: { center: [number, number]; place_name: string }) => {
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: result.center,
          zoom: 14,
          duration: 1500,
        })
      }

      if (viewMode === "creation" && inputMode === "route") {
        if (!startPoint) {
          setStartPoint(result.center)
          setStartAddressLabel(result.place_name)
          setCreationPoints([result.center])
          setValidationError(null)
        } else if (!endPoint) {
          setEndPoint(result.center)
          setEndAddressLabel(result.place_name)
          void fetchRouteFromAPI(startPoint, result.center)
        }
      }

      setShowSearchResults(false)
      setSearchQuery(result.place_name)
    },
    [endPoint, fetchRouteFromAPI, inputMode, startPoint, viewMode]
  )

  // Handle map click for route mode (set start/end points)
  const handleRoutePointClick = useCallback(
    (event: MapMouseEvent) => {
      if (viewMode !== "creation" || inputMode !== "route") {
        return
      }

      const clickedPoint: [number, number] = [event.lngLat.lng, event.lngLat.lat]

      if (!startPoint) {
        setStartPoint(clickedPoint)
        setStartAddressLabel(null)
        setCreationPoints([clickedPoint])
        setValidationError(null)
      } else if (!endPoint) {
        setEndPoint(clickedPoint)
        setEndAddressLabel(null)
        // Fetch route when both points are set
        fetchRouteFromAPI(startPoint, clickedPoint)
      }
    },
    [viewMode, inputMode, startPoint, endPoint, fetchRouteFromAPI]
  )

  // Reset route points
  const handleResetRoutePoints = useCallback(() => {
    setStartPoint(null)
    setEndPoint(null)
    setStartAddressLabel(null)
    setEndAddressLabel(null)
    setCreationPoints([])
    setValidationError(null)
  }, [])

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      if (viewMode !== "creation") return

      if (inputMode === "click") {
        appendPoint(event.lngLat.lng, event.lngLat.lat, false)
      } else if (inputMode === "route") {
        handleRoutePointClick(event)
      }
    },
    [appendPoint, viewMode, inputMode, handleRoutePointClick]
  )

  // Calculate distance between two points in meters
  const getDistanceMeters = useCallback(
    (point1: [number, number], point2: [number, number]): number => {
      const from = turf.point(point1)
      const to = turf.point(point2)
      // @ts-expect-error - turf types are not fully compatible
      return turf.distance(from, to, { units: "meters" })
    },
    []
  )

  // Simplify the drawn route to reduce point count
  const simplifyRoute = useCallback(
    (points: [number, number][]): [number, number][] => {
      if (points.length < 3) return points

      // @ts-expect-error - turf types are not fully compatible
      const line = turf.lineString(points)
      // Tolerance in kilometers (about 5 meters)
      // @ts-expect-error - turf types are not fully compatible
      const simplified = turf.simplify(line, {
        tolerance: 0.005,
        highQuality: true,
      })

      return simplified.geometry.coordinates as [number, number][]
    },
    []
  )

  // Handle drawing start (mouse down or touch start)
  const handleDrawStart = useCallback(
    (event: MapMouseEvent) => {
      if (viewMode !== "creation" || inputMode !== "draw") {
        return
      }

      event.preventDefault()
      setIsDrawing(true)
      const point: [number, number] = [event.lngLat.lng, event.lngLat.lat]
      setCreationPoints([point])
      lastPointRef.current = point
      setValidationError(null)

      // Disable map panning during drawing
      if (mapRef.current) {
        mapRef.current.getMap().dragPan.disable()
      }
    },
    [viewMode, inputMode]
  )

  // Handle drawing move (mouse move or touch move)
  const handleDrawMove = useCallback(
    (event: MapMouseEvent) => {
      if (!isDrawing || viewMode !== "creation" || inputMode !== "draw") {
        return
      }

      const newPoint: [number, number] = [event.lngLat.lng, event.lngLat.lat]

      // Only add point if it's far enough from the last point
      if (lastPointRef.current) {
        const distance = getDistanceMeters(lastPointRef.current, newPoint)
        if (distance >= MIN_POINT_DISTANCE) {
          setCreationPoints((prev) => [...prev, newPoint])
          lastPointRef.current = newPoint
        }
      }
    },
    [isDrawing, viewMode, inputMode, getDistanceMeters, MIN_POINT_DISTANCE]
  )

  // Touch event handlers
  const handleTouchDrawStart = useCallback(
    (event: MapTouchEvent) => {
      if (viewMode !== "creation" || inputMode !== "draw") {
        return
      }

      event.preventDefault()
      setIsDrawing(true)
      const point: [number, number] = [event.lngLat.lng, event.lngLat.lat]
      setCreationPoints([point])
      lastPointRef.current = point
      setValidationError(null)

      if (mapRef.current) {
        mapRef.current.getMap().dragPan.disable()
      }
    },
    [viewMode, inputMode]
  )

  const handleTouchDrawMove = useCallback(
    (event: MapTouchEvent) => {
      if (!isDrawing || viewMode !== "creation" || inputMode !== "draw") {
        return
      }

      const newPoint: [number, number] = [event.lngLat.lng, event.lngLat.lat]

      if (lastPointRef.current) {
        const distance = getDistanceMeters(lastPointRef.current, newPoint)
        if (distance >= MIN_POINT_DISTANCE) {
          setCreationPoints((prev) => [...prev, newPoint])
          lastPointRef.current = newPoint
        }
      }
    },
    [isDrawing, viewMode, inputMode, getDistanceMeters, MIN_POINT_DISTANCE]
  )

  // Handle mode toggle
  const handleModeToggle = useCallback((mode: InputMode) => {
    setInputMode(mode)
    setIsDrawing(false)
    lastPointRef.current = null
    // Reset route mode state when switching modes
    setStartPoint(null)
    setEndPoint(null)
    setStartAddressLabel(null)
    setEndAddressLabel(null)
    setCreationPoints([])
    setValidationError(null)
  }, [])

  // Handle drawing end when touch/mouse leaves the map or ends outside
  const finishDrawing = useCallback(() => {
    if (!isDrawing) return

    setIsDrawing(false)
    lastPointRef.current = null

    if (mapRef.current) {
      mapRef.current.getMap().dragPan.enable()
    }

    setCreationPoints((prev) => {
      if (prev.length < 2) {
        setValidationError("もう少し長くなぞってください")
        return prev
      }
      return simplifyRoute(prev)
    })
  }, [isDrawing, simplifyRoute])

  // Listen for touch/mouse end events at document level to handle
  // cases where the user's finger leaves the map area
  useEffect(() => {
    if (!isDrawing) return

    const handleGlobalEnd = () => {
      finishDrawing()
    }

    // Prevent page scroll while drawing
    const preventScroll = (e: TouchEvent) => {
      if (isDrawing) {
        e.preventDefault()
      }
    }

    document.addEventListener("mouseup", handleGlobalEnd)
    document.addEventListener("touchend", handleGlobalEnd)
    document.addEventListener("touchcancel", handleGlobalEnd)
    document.addEventListener("touchmove", preventScroll, { passive: false })

    return () => {
      document.removeEventListener("mouseup", handleGlobalEnd)
      document.removeEventListener("touchend", handleGlobalEnd)
      document.removeEventListener("touchcancel", handleGlobalEnd)
      document.removeEventListener("touchmove", preventScroll)
    }
  }, [isDrawing, finishDrawing])

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
      setValidationError(
        inputMode === "route"
          ? "開始地点と終了地点を設定してください。住所検索か地図タップが使えます"
          : "ルートには2つ以上のポイントが必要です"
      )
      return false
    }
    setValidationError(null)
    return true
  }, [routeName, viewMode, creationPoints, inputMode])

  const handleSaveRoute = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    const childFields = buildRouteChildFields(childName)

    if (viewMode === "creation") {
      const [startLng, startLat] = creationPoints[0]!
      const [endLng, endLat] = creationPoints[creationPoints.length - 1]!
      const input: CreateRouteInput = {
        name: routeName.trim(),
        description: routeDescription.trim() || undefined,
        ...childFields,
        start_lat: startLat,
        start_lng: startLng,
        end_lat: endLat,
        end_lng: endLng,
        start_address: startAddressLabel || formatPointLabel(creationPoints[0]!),
        end_address:
          endAddressLabel || formatPointLabel(creationPoints[creationPoints.length - 1]!),
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
        ...childFields,
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
    childName,
    creationPoints,
    startAddressLabel,
    endAddressLabel,
    editingRoute,
    addRoute,
    updateRoute,
    buildRouteChildFields,
    resetFormState,
    formatPointLabel,
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
            {/* Input Mode Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium">入力方法</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  data-testid="route-mode-button"
                  variant={inputMode === "route" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleModeToggle("route")}
                  className="flex-1"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  自動ルート
                </Button>
                <Button
                  data-testid="draw-mode-button"
                  variant={inputMode === "draw" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleModeToggle("draw")}
                  className="flex-1"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  なぞって描画
                </Button>
                <Button
                  data-testid="click-mode-button"
                  variant={inputMode === "click" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleModeToggle("click")}
                  className="flex-1"
                >
                  <MousePointerClick className="h-4 w-4 mr-2" />
                  クリック追加
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {inputMode === "route"
                ? "住所検索または地図タップで開始地点と終了地点を決めると、自動で通学路を作成できます"
                : inputMode === "draw"
                  ? "地図上で通学路をなぞって描画してください"
                  : "地図をクリック（または座標入力）してポイントを追加してください"}
            </p>

            {/* Route mode: show start/end points status */}
            {inputMode === "route" && (
              <div className="space-y-2 rounded-md border p-3 bg-muted/50">
                <div ref={searchRef} className="space-y-2">
                  <label className="text-sm font-medium">学校名や住所から探す</label>
                  <form onSubmit={handleLocationSearch} className="relative">
                    <Input
                      type="text"
                      placeholder="学校名や住所を検索"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1 h-8 w-8"
                      disabled={isSearching}
                    >
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                  {showSearchResults && searchResults.length > 0 && (
                    <Card className="max-h-48 overflow-auto border bg-background shadow-sm">
                      <ul className="py-1">
                        {searchResults.map((result) => (
                          <li
                            key={result.id}
                            className="px-3 py-2 hover:bg-muted cursor-pointer flex items-start text-sm"
                            onClick={() => handleSearchResultClick(result)}
                          >
                            <MapPin className="h-3 w-3 mr-2 mt-0.5 shrink-0 text-muted-foreground" />
                            <span className="line-clamp-2">{result.place_name}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                  {showSearchResults && searchResults.length === 0 && !isSearching && searchQuery && (
                    <Card className="border bg-background shadow-sm">
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        検索結果が見つかりませんでした
                      </div>
                    </Card>
                  )}
                  <p className="text-xs text-muted-foreground">
                    1回目の選択で開始地点、2回目の選択で終了地点を設定します。
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span>開始地点：</span>
                  {startPoint ? (
                    <span
                      data-testid="route-start-summary"
                      className="text-green-600 line-clamp-1"
                    >
                      {startAddressLabel || formatPointLabel(startPoint)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">住所検索か地図で設定</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-red-600" />
                  <span>終了地点：</span>
                  {endPoint ? (
                    <span
                      data-testid="route-end-summary"
                      className="text-red-600 line-clamp-1"
                    >
                      {endAddressLabel || formatPointLabel(endPoint)}
                    </span>
                  ) : startPoint ? (
                    <span className="text-muted-foreground">住所検索か地図で設定</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
                {creationPoints.length >= 2 && (
                  <div className="rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
                    保存前の確認: {creationPoints.length}ポイントで通学路を作成しています
                  </div>
                )}
                {isLoadingRoute && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    ルートを検索中...
                  </div>
                )}
                {(startPoint || endPoint) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetRoutePoints}
                    className="mt-2"
                  >
                    <Undo2 className="h-4 w-4 mr-2" />
                    地点をリセット
                  </Button>
                )}
              </div>
            )}

            <RouteFormFields
              routeName={routeName}
              routeDescription={routeDescription}
              childName={childName}
              validationError={validationError}
              error={error}
              onRouteNameChange={setRouteName}
              onRouteDescriptionChange={setRouteDescription}
              onChildNameChange={setChildName}
            />

            {inputMode === "click" && (
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
              childName={childName}
              validationError={validationError}
              error={error}
              onRouteNameChange={setRouteName}
              onRouteDescriptionChange={setRouteDescription}
              onChildNameChange={setChildName}
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
              <ChildSelector
                options={childProfiles}
                selectedChildId={selectedChildId}
                onSelectChild={setSelectedChildId}
              />
              {filteredRoutes.length > 1 && (
                <div
                  className="rounded-[16px] border px-4 py-3 text-sm font-bold"
                  style={{ borderColor: "rgba(67,57,43,.1)", background: "#FFFDF7", color: "#847661" }}
                >
                  比較したいルートを2つ以上選ぶと、距離と所要時間をまとめて見比べられます。
                </div>
              )}
              {comparisonRoutes.length >= 2 && (
                <RouteComparisonTable routes={comparisonRoutes} />
              )}
              {filteredRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={selectedRouteId === route.id}
                  onClick={handleRouteClick}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  onSetPrimary={handleSetPrimaryClick}
                  onGenerateReport={handleGenerateReportClick}
                  onShare={handleShareRoute}
                  showCompareToggle={filteredRoutes.length > 1}
                  isComparisonSelected={comparisonRouteIds.includes(route.id)}
                  onToggleCompare={handleToggleCompareRoute}
                  dangerCount={routeDangerCounts[route.id]}
                />
              ))}
              {filteredRoutes.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-600">
                  選択した子どもに紐づく通学路はまだありません。
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Map Container */}
      <div
        data-testid="route-map-container"
        className="h-64 bg-muted rounded-lg overflow-hidden relative"
        style={{
          // Only disable touch actions while actively drawing
          touchAction: isDrawing ? "none" : "auto",
        }}
      >
        {mapToken && viewMode === "list" ? (
          filteredRoutes.some((route) => route.route_geometry) ? (
            // 一覧では登録ルート全体が見える読み取り専用マップ(日本語ラベル・自動フィット)
            <RouteOverviewMap
              routes={filteredRoutes.filter((route) => route.route_geometry)}
              mapToken={mapToken}
            />
          ) : (
            <div
              className="flex h-full flex-col items-center justify-center gap-2 border-2 border-dashed text-center"
              style={{
                borderColor: "rgba(67,57,43,.14)",
                background: "#F3EAD6",
                color: "#847661",
                borderRadius: 12,
              }}
            >
              <MapIcon className="h-8 w-8" aria-hidden="true" />
              <p className="text-sm font-bold">
                ルートをかくと、ここに 通学路のちずが ひろがります
              </p>
            </div>
          )
        ) : mapToken ? (
          <Map
            ref={mapRef}
            mapboxAccessToken={mapToken}
            mapStyle={DEFAULT_MAPBOX_STYLE}
            initialViewState={DEFAULT_VIEW_STATE}
            onClick={
              viewMode === "creation" && (inputMode === "click" || inputMode === "route")
                ? handleMapClick
                : undefined
            }
            onMouseDown={
              viewMode === "creation" && inputMode === "draw"
                ? handleDrawStart
                : undefined
            }
            onMouseMove={
              viewMode === "creation" && inputMode === "draw"
                ? handleDrawMove
                : undefined
            }
            onMouseUp={
              viewMode === "creation" && inputMode === "draw"
                ? finishDrawing
                : undefined
            }
            onTouchStart={
              viewMode === "creation" && inputMode === "draw"
                ? handleTouchDrawStart
                : undefined
            }
            onTouchMove={
              viewMode === "creation" && inputMode === "draw"
                ? handleTouchDrawMove
                : undefined
            }
            onTouchEnd={
              viewMode === "creation" && inputMode === "draw"
                ? finishDrawing
                : undefined
            }
            cursor={
              viewMode === "creation"
                ? inputMode === "draw"
                  ? isDrawing
                    ? "grabbing"
                    : "crosshair"
                  : "crosshair"
                : "grab"
            }
            attributionControl={false}
            style={{ width: "100%", height: "100%" }}
          >
            {creationPoints.length > 1 && (
              <Source id="route-line-source" type="geojson" data={lineGeoJson}>
                <Layer
                  id="route-line-layer"
                  type="line"
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={{
                    "line-color": isDrawing ? "#60a5fa" : "#2563eb",
                    "line-width": 4,
                  }}
                />
              </Source>
            )}
            {creationPoints.length > 0 && inputMode !== "route" && (
              <Source id="route-points-source" type="geojson" data={pointsGeoJson}>
                <Layer
                  id="route-points-layer"
                  type="circle"
                  paint={{
                    "circle-radius": inputMode === "draw" ? 4 : 6,
                    "circle-color": "#2563eb",
                    "circle-stroke-width": 2,
                    "circle-stroke-color": "#ffffff",
                  }}
                />
              </Source>
            )}
            {/* Start point marker */}
            {startPoint && inputMode === "route" && (
              <Source
                id="start-point-source"
                type="geojson"
                data={{
                  type: "FeatureCollection" as const,
                  features: [
                    {
                      type: "Feature" as const,
                      properties: {},
                      geometry: {
                        type: "Point" as const,
                        coordinates: startPoint,
                      },
                    },
                  ],
                }}
              >
                <Layer
                  id="start-point-layer"
                  type="circle"
                  paint={{
                    "circle-radius": 10,
                    "circle-color": "#22c55e",
                    "circle-stroke-width": 3,
                    "circle-stroke-color": "#ffffff",
                  }}
                />
              </Source>
            )}
            {/* End point marker */}
            {endPoint && inputMode === "route" && (
              <Source
                id="end-point-source"
                type="geojson"
                data={{
                  type: "FeatureCollection" as const,
                  features: [
                    {
                      type: "Feature" as const,
                      properties: {},
                      geometry: {
                        type: "Point" as const,
                        coordinates: endPoint,
                      },
                    },
                  ],
                }}
              >
                <Layer
                  id="end-point-layer"
                  type="circle"
                  paint={{
                    "circle-radius": 10,
                    "circle-color": "#ef4444",
                    "circle-stroke-width": 3,
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
            {inputMode === "route"
              ? isLoadingRoute
                ? "ルート検索中..."
                : !startPoint
                  ? "開始地点をタップ"
                  : !endPoint
                    ? "終了地点をタップ"
                    : "ルート生成完了"
              : inputMode === "draw"
                ? isDrawing
                  ? "描画中..."
                  : "地図をなぞって通学路を描画"
                : "クリックでポイント追加"}
          </div>
        )}
        {/* Location Search Box(作成・編集時のみ。一覧の読み取り専用マップでは出さない) */}
        {mapToken && viewMode !== "list" && !(viewMode === "creation" && inputMode === "route") && (
          <div
            ref={searchRef}
            className="absolute right-3 top-3 z-10"
          >
            <form onSubmit={handleLocationSearch} className="relative">
              <Input
                type="text"
                placeholder="市町村を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 sm:w-48 pr-8 bg-white/95 text-sm h-8 shadow-sm"
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute right-0 top-0 h-8 w-8"
                disabled={isSearching}
              >
                {isSearching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
              </Button>
            </form>
            {showSearchResults && searchResults.length > 0 && (
              <Card className="absolute right-0 w-64 mt-1 max-h-48 overflow-auto shadow-lg">
                <ul className="py-1">
                  {searchResults.map((result) => (
                    <li
                      key={result.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer flex items-start text-sm"
                      onClick={() => handleSearchResultClick(result)}
                    >
                      <MapPin className="h-3 w-3 mr-2 mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-2">{result.place_name}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {showSearchResults && searchResults.length === 0 && !isSearching && searchQuery && (
              <Card className="absolute right-0 w-64 mt-1 shadow-lg">
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  検索結果が見つかりませんでした
                </div>
              </Card>
            )}
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

      {/* Danger Report Dialog */}
      {routeForReport && (
        <RouteDangerReportDialog
          open={routeForReport !== null}
          onClose={handleCloseReportDialog}
          route={routeForReport}
        />
      )}
    </div>
  )
}
