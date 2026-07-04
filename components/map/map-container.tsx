"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import Image from "next/image"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useSupabase } from "@/components/providers/supabase-provider"
import MapFloatingControls from "./map-floating-controls"
import MapSidebar from "./map-sidebar"
import DangerReportForm, { type DangerReportSubmitPayload } from "../danger-report/danger-report-form"
import type { DangerReport } from "@/lib/types"
import { AlertTriangle, Car, Shield, HelpCircle, Trash2, MapPin, UserX } from "lucide-react"
import Map3DToggle from "./map-3d-toggle"
import { Button } from "@/components/ui/button"
import MapSearch from "./map-search"
import ImagePreviewDialog from "../danger-report/image-preview-dialog"
import DangerReportDetailModal from "../danger-report/danger-report-detail-modal" // 以前の履歴から推測
import { useToast } from "@/components/ui/use-toast"
import SubmittedReportPreview from "../danger-report/submitted-report-preview"
import { createRoot } from "react-dom/client"
import { createPortal } from "react-dom"
import { addPoints } from "@/lib/gamification"
import { jsArrayToPgLiteral } from "@/lib/arrayLiteral"; // ヘルパー関数をインポート
import { useMediaQuery } from "@/hooks/use-media-query"
import { getMapboxToken, validateMapboxToken } from "@/lib/mapbox-config"
import ARView from "./ar-view"
import { useCurrentLocation } from "@/hooks/use-current-location"
import { isValidCoordinates } from "@/lib/coordinates"
import { extractStoragePathFromPublicUrl } from "@/lib/storage-path"
import { useDangerReportSignedImageUrl } from "@/lib/danger-report-image-access"
import {
  PUBLIC_DANGER_REPORT_STATUSES,
  resolveInitialDangerReportStatus,
  shouldRetryDangerReportInsertAsPending,
} from "@/lib/danger-report-status"
import { useAccidentHeatmap } from "@/hooks/use-accident-heatmap"
import { AccidentHeatmapLayer } from "./accident-heatmap-layer"
import { AccidentHeatmapControls } from "./accident-heatmap-controls"
import { useAccidentStats } from "@/hooks/use-accident-stats"
import { useRouteDangers } from "@/hooks/use-route-dangers"
import AccidentStatsPanel from "@/components/danger-report/accident-stats-panel"
import { X } from "lucide-react"
import { buildRouteReportNotification } from "@/hooks/use-notifications"
import { useUserRoutes } from "@/hooks/use-user-routes"
import { RouteHazardPanel } from "@/components/map/route-hazard-panel"
import { HazardImageModal } from "@/components/map/hazard-image-modal"
import { classifyMapboxError } from "@/lib/mapbox-error-utils"
import { shouldShowMapNavigationControl, syncMapNavigationControl } from "@/lib/mapbox-controls"
import { localizeMapLabels } from "@/lib/hunter/map-labels"
import { getRouteHazardRequestState } from "@/lib/route-hazard-request-state"
import {
  HAZARD_TILE_CONFIG,
  buildHazardExplanation,
  getHazardAreaLabel,
  getHazardEvacuationPoints,
} from "@/lib/hazard-scenarios"
import { buildRouteSafetySummary } from "@/lib/safety-scoring/route-safety-scorer"
import { buildRouteSafetyEvidenceItems } from "@/lib/safety-scoring/route-safety-scorer"
import {
  buildFamilyShareAction,
  buildFamilyShareMapLabel,
  buildFamilyShareSummary,
} from "@/lib/report-generation/family-share-card"
import type { HazardImageResult, HazardType, RouteHazardMarker, UserRoute } from "@/lib/types"
import MapTopOverlay, { type MapTopOverlayPanel } from "@/components/map/map-top-overlay"
import { dismissTransientMapUi } from "@/lib/map-overlay-ui"
import { buildMapDisplayOverlayOptions } from "@/lib/map-display-options"
import { useSearchParams } from "next/navigation"
import { SuspiciousAlertLayer } from "./suspicious-alert-layer"
import SuspiciousAlertForm, { type SuspiciousAlertFormPayload } from "../danger-report/suspicious-alert-form"
import {
  SUSPICIOUS_DANGER_TYPE,
  DEFAULT_ALERT_RADIUS_M,
  resolveAlertRadius,
  getAlertFitBounds,
} from "@/lib/suspicious-alert"

// Mapboxのアクセストークンを設定
const mapboxToken = getMapboxToken()
const tokenValidation = validateMapboxToken()

if (!tokenValidation.isValid) {
  console.error("Mapbox token validation failed:", tokenValidation.error)
}

mapboxgl.accessToken = mapboxToken || ""

const REVERSE_GEOCODE_DECIMALS = 3

function toCoarseCoordinate(value: number, decimals = REVERSE_GEOCODE_DECIMALS): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

async function reverseGeocodeLocation(latitude: number, longitude: number) {
  const token = getMapboxToken()
  if (!token) {
    console.warn("Mapbox token is missing; skip reverse geocoding.")
    return { prefecture: null as string | null, city: null as string | null }
  }

  if (!isValidCoordinates(latitude, longitude)) {
    console.warn("Invalid coordinates for reverse geocoding", { latitude, longitude })
    return { prefecture: null as string | null, city: null as string | null }
  }

  // Send coarse coordinates (~100m) to reduce precise-location exposure to external services.
  const coarseLatitude = toCoarseCoordinate(latitude)
  const coarseLongitude = toCoarseCoordinate(longitude)

  try {
    const params = new URLSearchParams({
      access_token: token,
      language: "ja",
      types: "region,place,locality,district",
      limit: "5",
    })

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${coarseLongitude},${coarseLatitude}.json?${params.toString()}`,
    )

    if (!response.ok) {
      console.warn("Reverse geocoding request failed", response.status)
      return { prefecture: null, city: null }
    }

    const data = await response.json()
    const features: any[] = Array.isArray(data?.features) ? data.features : []

    let prefecture: string | null = null
    let city: string | null = null

    const processFeature = (feature: any) => {
      if (!feature) return
      const types: string[] = feature.place_type ?? []
      if (!prefecture && types.includes("region")) {
        prefecture = feature.text ?? feature.place_name ?? null
      }
      if (
        !city &&
        (types.includes("place") || types.includes("locality") || types.includes("district"))
      ) {
        city = feature.text ?? feature.place_name ?? null
      }
      if (Array.isArray(feature.context)) {
        feature.context.forEach(processFeature)
      }
    }

    features.forEach(processFeature)

    return { prefecture, city }
  } catch (error) {
    console.warn("Reverse geocoding lookup failed", error)
    return { prefecture: null, city: null }
  }
}

// --- 型定義 ---
// 送信済みレポートの状態用
interface MapImagePopupContentProps {
  url: string
  hasError: boolean
  supabase: any
  onPreview: (resolvedUrl: string) => void
  onRetry: () => void
  onImageError: () => void
}

function MapImagePopupContent({
  url,
  hasError,
  supabase,
  onPreview,
  onRetry,
  onImageError,
}: MapImagePopupContentProps) {
  // danger-reports バケット非公開化に備え、DB保存済みの公開URL文字列を
  // 表示直前に短TTLの署名URLへ差し替える。
  // 注意: この popup は mapboxgl.Popup + createRoot() による独立したReactツリーで
  // 描画されるため、上位の SupabaseProvider context は継承されない。
  // そのため supabase クライアントは props で明示的に受け取る。
  const signedUrl = useDangerReportSignedImageUrl(supabase, url)

  if (hasError) {
    return (
      <div className="w-28 sm:w-36 rounded-xl border border-blue-100 bg-white/90 px-3 py-2 shadow-md">
        <p className="mb-2 text-center text-xs text-slate-500">画像を読み込めませんでした</p>
        <Button type="button" variant="outline" size="sm" className="h-8 w-full" onClick={onRetry}>
          再試行
        </Button>
      </div>
    )
  }

  if (!signedUrl) {
    return (
      <div className="w-28 sm:w-36 rounded-xl border border-blue-100 bg-white/90 px-3 py-2 shadow-md">
        <div className="flex aspect-[4/3] w-full items-center justify-center">
          <span className="text-xs text-slate-400">読み込み中...</span>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="relative block w-28 sm:w-36 overflow-hidden rounded-xl shadow-md"
      onClick={() => onPreview(signedUrl)}
    >
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={signedUrl}
          alt="加工画像プレビュー"
          fill
          sizes="(max-width: 640px) 112px, 144px"
          className="object-cover"
          onError={onImageError}
          priority
        />
      </div>
    </button>
  )
}

interface SubmittedReportState {
  reportId: string
  title: string
  summary: string
  action: string | null
  mapLabel: string
  location: [number, number]
  originalImage: string | null
  processedImages: string[] // 複数画像に対応
}

interface MapImageOverlayEntry {
  id: string
  url: string
  reportId?: string
  reportTitle?: string | null
  type?: "original" | "processed"
  index?: number
  coordinates: [number, number]
  hasError?: boolean
}

type LocationSelectionSource = "manual" | "gps" | null
type ActiveARKind = "nearby" | "parent_child_route"

function isAbortLikeError(error: unknown): boolean {
  if (!error) return false
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error)

  return (
    message.includes("The operation was aborted") ||
    message.includes("operation was aborted") ||
    message.includes("aborted") ||
    message.includes("AbortError")
  )
}

function isTransientFetchError(error: unknown): boolean {
  if (!error) return false
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error)

  return (
    isAbortLikeError(error) ||
    message.includes("fetch failed") ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("network_error") ||
    message.includes("timeout")
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// MapContainer コンポーネント
interface MapContainerProps {
  autoOpenReport?: boolean
  preferredRouteId?: string | null
}

export default function MapContainer({
  autoOpenReport = false,
  preferredRouteId = null,
}: MapContainerProps) {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [dangerReports, setDangerReports] = useState<DangerReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReportFormOpen, setIsReportFormOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null)
  const [locationSelectionSource, setLocationSelectionSource] =
    useState<LocationSelectionSource>(null)
  const [selectedReport, setSelectedReport] = useState<DangerReport | null>(null)
  const [filterOptions, setFilterOptions] = useState({
    dangerType: "all",
    dangerLevel: "all",
    dateRange: "all",
    showPending: true,
  })
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapStyle, setMapStyle] = useState("streets-v12")
  const [is3DEnabled, setIs3DEnabled] = useState(false)
  const [isARMode, setIsARMode] = useState(false)
  const [activeARKind, setActiveARKind] = useState<ActiveARKind>("nearby")
  const [activeTopPanel, setActiveTopPanel] = useState<MapTopOverlayPanel>(null)
  const [dismissSearchResultsSignal, setDismissSearchResultsSignal] = useState(0)
  const mapInitialized = useRef(false)
  const navigationControlRef = useRef<mapboxgl.NavigationControl | null>(null)
  const selectionMarker = useRef<mapboxgl.Marker | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [mapImageOverlays, setMapImageOverlays] = useState<MapImageOverlayEntry[]>([])
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false) // ReportDetailModal 用
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // モバイルでのサイドバー表示状態
  const reportsFetchAbortRef = useRef<AbortController | null>(null)
  const reportsFetchRequestIdRef = useRef(0)
  const clickListenerAdded = useRef(false)
  const styleChangeInProgress = useRef(false)
  const mapClickHandler = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null)
  const mapImagePopupRefs = useRef<Map<string, mapboxgl.Popup>>(new Map())
  const mapImagePopupRootRefs = useRef<Map<string, ReturnType<typeof createRoot>>>(new Map())
  const accidentMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const accidentMarkerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const routeHazardMarkersRef = useRef<mapboxgl.Marker[]>([])
  const routeHazardPopupRef = useRef<mapboxgl.Popup | null>(null)

  const {
    routes: userRoutes,
    primaryRoute,
  } = useUserRoutes()
  const [selectedUserRouteId, setSelectedUserRouteId] = useState<string | null>(null)
  const [hazardLayerVisibility, setHazardLayerVisibility] = useState<Record<HazardType, boolean>>({
    flood: false,
    tsunami: false,
  })
  const [routeHazards, setRouteHazards] = useState<RouteHazardMarker[]>([])
  const [isRouteHazardsLoading, setIsRouteHazardsLoading] = useState(false)
  const [routeHazardError, setRouteHazardError] = useState<string | null>(null)
  const [routeHazardsFetchedAt, setRouteHazardsFetchedAt] = useState<string | null>(null)
  const [activeHazardMarker, setActiveHazardMarker] = useState<RouteHazardMarker | null>(null)
  const [isHazardModalOpen, setIsHazardModalOpen] = useState(false)
  const [selectedHazardScenarioKey, setSelectedHazardScenarioKey] = useState<string | null>(null)
  const [hazardImageResult, setHazardImageResult] = useState<HazardImageResult | null>(null)
  const [hazardImageError, setHazardImageError] = useState<string | null>(null)
  const [isHazardImageLoading, setIsHazardImageLoading] = useState(false)
  const [mapStyleSyncToken, setMapStyleSyncToken] = useState(0)

  // --- Accident Heatmap ---
  const accidentHeatmap = useAccidentHeatmap()

  // --- Accident Statistics for clicked location ---
  const {
    stats: clickedLocationStats,
    status: clickedLocationStatsStatus,
    fetchStats: fetchClickedLocationStats,
    reset: resetClickedLocationStats,
  } = useAccidentStats()

  const destroyAllMapImagePopups = useCallback(() => {
    const popupRefs = mapImagePopupRefs.current
    const rootRefs = mapImagePopupRootRefs.current

    rootRefs.forEach((root) => {
      Promise.resolve().then(() => root.unmount())
    })
    rootRefs.clear()

    popupRefs.forEach((popup) => {
      popup.remove()
    })
    popupRefs.clear()
  }, [])

  const clearRouteHazardMarkers = useCallback(() => {
    routeHazardMarkersRef.current.forEach((marker) => marker.remove())
    routeHazardMarkersRef.current = []
  }, [])

  const clearRouteHazardPopup = useCallback(() => {
    routeHazardPopupRef.current?.remove()
    routeHazardPopupRef.current = null
  }, [])

  const fitRouteBounds = useCallback((route: UserRoute) => {
    if (!map.current || !route.route_geometry?.coordinates?.length) return

    const bounds = new mapboxgl.LngLatBounds()
    route.route_geometry.coordinates.forEach((coordinate) => {
      bounds.extend(coordinate as [number, number])
    })

    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 80, duration: 800 })
    }
  }, [])

  // 送信された報告の情報を保持する状態 (型を更新)
  const [submittedReport, setSubmittedReport] = useState<SubmittedReportState | null>(null)

  // 送信された報告のプレビューモーダルの状態
  const [isSubmittedPreviewOpen, setIsSubmittedPreviewOpen] = useState(false)

  // 審査中の報告を保持する状態を追加
  const [pendingReports, setPendingReports] = useState<DangerReport[]>([])

  // 管理者かどうかを判定する状態（MapHeaderから受け取るように変更する方が良いかも）
  const [isAdmin, setIsAdmin] = useState(false) // とりあえず残す

  // 本人削除の判定に使うログインユーザーID（未ログイン時は null）
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // ユーザー情報を取得して isAdmin 状態を更新する useEffect
  useEffect(() => {
    let isMounted = true
    let retryCount = 0
    const maxRetries = 3

    const checkAdminStatus = async () => {
      if (!supabase) return
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        if (error) {
          // "Auth session missing"はセッション同期待ち、リトライする
          if (error.message?.includes("Auth session missing")) {
            if (retryCount < maxRetries && isMounted) {
              retryCount++
              setTimeout(checkAdminStatus, 500 * retryCount)
              return
            }
            // リトライ後も失敗 = 未ログイン（正常）
            if (isMounted) {
              setIsAdmin(false)
              setCurrentUserId(null)
            }
            return
          }
          console.error("Error fetching user:", error)
          if (isMounted) {
            setIsAdmin(false)
            setCurrentUserId(null)
          }
          return
        }

        if (!user) {
          if (isMounted) {
            setIsAdmin(false)
            setCurrentUserId(null)
          }
          return
        }

        if (isMounted) setCurrentUserId(user.id)

        const adminStatusResponse = await fetch("/api/auth/admin-status", {
          cache: "no-store",
        })
        if (!adminStatusResponse.ok) {
          throw new Error(`Admin status request failed: ${adminStatusResponse.status}`)
        }

        const adminStatus = (await adminStatusResponse.json()) as { isAdmin?: boolean }
        if (isMounted) {
          setIsAdmin(Boolean(adminStatus.isAdmin))
        }
      } catch (err) {
        console.error("Error in checkAdminStatus:", err)
        if (isMounted) setIsAdmin(false) // エラー時は念のため false に
      }
    }
    checkAdminStatus()
    return () => {
      isMounted = false
    }
  }, [supabase]) // supabase クライアントが変わった時にも再チェック

  // --- ▼▼▼ モバイル判定と地点選択待ち state を追加 ▼▼▼ ---
  const isMobile = useMediaQuery("(max-width: 768px)"); // md ブレークポイント (Tailwind)
  const [awaitingLocationSelection, setAwaitingLocationSelection] = useState(false);

  // --- 不審者アラート 地図化 ---
  const [isSuspiciousAlertOpen, setIsSuspiciousAlertOpen] = useState(false);
  // 「表示」パネルの不審者情報トグル（3D/AR/事故ヒートマップ/ハザードと同様）
  const [isSuspiciousVisible, setIsSuspiciousVisible] = useState(false);
  const [alertDraftRadius, setAlertDraftRadius] = useState<number>(DEFAULT_ALERT_RADIUS_M);
  const [alertFocusedId, setAlertFocusedId] = useState<string | null>(null);
  const [isSuspiciousSubmitting, setIsSuspiciousSubmitting] = useState(false);
  const suspiciousMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // handleMapClick が初期化時の古いクロージャで登録されても最新値を読めるよう ref に同期する
  const isSuspiciousAlertOpenRef = useRef(false);
  const suspiciousAlertSearchParams = useSearchParams();

  useEffect(() => {
    isSuspiciousAlertOpenRef.current = isSuspiciousAlertOpen;
  }, [isSuspiciousAlertOpen]);

  // 報告メニューから ?suspiciousAlert=1 で来たら専用フォームを開く
  useEffect(() => {
    if (!suspiciousAlertSearchParams) return;
    if (suspiciousAlertSearchParams.get("suspiciousAlert") === "1") {
      setIsSuspiciousAlertOpen(true);
    }
  }, [suspiciousAlertSearchParams]);

  // 表示する不審者アラート（承認済み＋自分のpending）に、入力中ドラフトを加える
  const suspiciousAlertReports = useMemo(() => {
    const base = [...dangerReports, ...pendingReports].filter(
      (r) => r.danger_type === SUSPICIOUS_DANGER_TYPE,
    );
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
      } as DangerReport);
    }
    return base;
  }, [dangerReports, pendingReports, isSuspiciousAlertOpen, selectedLocation, alertDraftRadius]);

  // 入力中: 中心に大きいパルスマーカーを置き、円全体が収まるよう自動フィットする
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (suspiciousMarkerRef.current) {
      suspiciousMarkerRef.current.remove();
      suspiciousMarkerRef.current = null;
    }
    if (
      !isSuspiciousAlertOpen ||
      !selectedLocation ||
      !isValidCoordinates(selectedLocation[1], selectedLocation[0])
    ) {
      setAlertFocusedId(null);
      return;
    }
    const el = document.createElement("div");
    el.className = "suspicious-alert-marker";
    suspiciousMarkerRef.current = new mapboxgl.Marker(el).setLngLat(selectedLocation).addTo(m);
    setAlertFocusedId("__suspicious_draft__");
    const bounds = getAlertFitBounds(selectedLocation, alertDraftRadius);
    if (bounds) {
      try {
        m.fitBounds(bounds as any, { padding: 80, duration: 600, maxZoom: 17 });
      } catch (e) {
        console.error("fitBounds for suspicious alert failed", e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuspiciousAlertOpen, selectedLocation, alertDraftRadius]);
  
  // ヘルプの表示状態管理
  const [isHelpVisible, setIsHelpVisible] = useState(true);
  const [isHelpDismissed, setIsHelpDismissed] = useState(false);
  const [showMobileMapHint, setShowMobileMapHint] = useState(false);

  // GPS現在地取得フック
  const {
    location: gpsLocation,
    isLoading: isAcquiringGPS,
    requestLocation: requestGPSLocation,
    reset: resetGPSLocation,
  } = useCurrentLocation()
  const gpsConsumedRef = useRef(false)
  // --- ▲▲▲ ---

  useEffect(() => {
    if (!isMobile) {
      setShowMobileMapHint(false);
      return;
    }
    setShowMobileMapHint(true);
    const timer = window.setTimeout(() => setShowMobileMapHint(false), 6000);
    return () => window.clearTimeout(timer);
  }, [isMobile]);

  const mapMinHeight = isMobile ? 500 : 500;
  const mapAreaClassName = `flex-1 relative w-full${isMobile ? " rounded-3xl border border-blue-100/70 bg-gradient-to-b from-blue-50/80 via-white to-white shadow-[0_18px_40px_-25px_rgba(30,64,175,0.45)]" : ""}`;
  const mapCanvasClassName = `absolute inset-0${isMobile ? " rounded-3xl overflow-hidden ring-1 ring-blue-100/60" : ""}`;

  const combinedReports = useMemo(() => [...dangerReports, ...pendingReports], [dangerReports, pendingReports]);
  const selectedUserRoute = useMemo<UserRoute | null>(() => {
    if (!selectedUserRouteId) return null
    return userRoutes.find((route) => route.id === selectedUserRouteId) ?? null
  }, [selectedUserRouteId, userRoutes])
  const visibleRouteHazards = useMemo(
    () => routeHazards.filter((hazard) => hazardLayerVisibility[hazard.hazard_type]),
    [hazardLayerVisibility, routeHazards],
  )
  const {
    dangers: routeDangers,
    isLoading: isRouteDangersLoading,
  } = useRouteDangers(selectedUserRouteId ?? "")
  const routeSafetySummary = useMemo(
    () =>
      buildRouteSafetySummary({
        routeName: selectedUserRoute?.name,
        routeHazards: visibleRouteHazards,
        routeDangers,
        isLoading: Boolean(selectedUserRouteId) && (isRouteHazardsLoading || isRouteDangersLoading),
      }),
    [
      isRouteDangersLoading,
      isRouteHazardsLoading,
      routeDangers,
      selectedUserRoute?.name,
      selectedUserRouteId,
      visibleRouteHazards,
    ],
  )
  const routeSafetyEvidenceItems = useMemo(
    () =>
      buildRouteSafetyEvidenceItems({
        routeHazards: visibleRouteHazards,
        routeDangers,
        hazardFetchedAt: routeHazardsFetchedAt,
      }),
    [routeDangers, routeHazardsFetchedAt, visibleRouteHazards],
  )

  useEffect(() => {
    setMapImageOverlays((prev) => {
      if (prev.length === 0) return prev

      const validReportIds = new Set(combinedReports.map((report) => report.id))
      const filtered = prev.filter((overlay) => !overlay.reportId || validReportIds.has(overlay.reportId))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [combinedReports])

  useEffect(() => {
    if (selectedUserRouteId) return

    if (preferredRouteId && userRoutes.some((route) => route.id === preferredRouteId)) {
      setSelectedUserRouteId(preferredRouteId)
      return
    }

    if (!primaryRoute) return
    setSelectedUserRouteId(primaryRoute.id)
  }, [preferredRouteId, primaryRoute, selectedUserRouteId, userRoutes])

  useEffect(() => {
    if (!map.current) return

    const mapInstance = map.current
    const popupRefs = mapImagePopupRefs.current
    const rootRefs = mapImagePopupRootRefs.current
    const activeOverlayIds = new Set(mapImageOverlays.map((overlay) => overlay.id))

    popupRefs.forEach((popup, id) => {
      if (!activeOverlayIds.has(id)) {
        popup.remove()
        popupRefs.delete(id)

        const root = rootRefs.get(id)
        if (root) {
          Promise.resolve().then(() => root.unmount())
          rootRefs.delete(id)
        }
      }
    })

    mapImageOverlays.forEach((overlay) => {
      if (!overlay.coordinates) return

      let popup = popupRefs.get(overlay.id)
      if (!popup) {
        popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          anchor: "top",
          offset: [0, -18],
          className: "map-image-popup",
        }).addTo(mapInstance)

        popup.on("close", () => {
          setMapImageOverlays((prev) => prev.filter((entry) => entry.id !== overlay.id))
        })

        popupRefs.set(overlay.id, popup)
      }

      popup.setLngLat(overlay.coordinates)

      let root = rootRefs.get(overlay.id)
      if (!root) {
        const container = document.createElement("div")
        popup.setDOMContent(container)
        root = createRoot(container)
        rootRefs.set(overlay.id, root)
      }

      root.render(
        <MapImagePopupContent
          url={overlay.url}
          hasError={overlay.hasError ?? false}
          supabase={supabase}
          onPreview={(resolvedUrl) => setPreviewImage(resolvedUrl)}
          onRetry={() =>
            setMapImageOverlays((prev) =>
              prev.map((entry) =>
                entry.id === overlay.id ? { ...entry, hasError: false } : entry
              )
            )
          }
          onImageError={() =>
            setMapImageOverlays((prev) =>
              prev.map((entry) =>
                entry.id === overlay.id ? { ...entry, hasError: true } : entry
              )
            )
          }
        />
      )
    })
  }, [mapImageOverlays, setPreviewImage, supabase])

  useEffect(() => destroyAllMapImagePopups, [destroyAllMapImagePopups])

  // --- Mapbox GL JS Helper Functions ---
  const layerExists = (mapInstance: mapboxgl.Map, layerId: string): boolean => {
    try { return !!mapInstance.getLayer(layerId) } catch (e) { return false }
  }
  const sourceExists = (mapInstance: mapboxgl.Map, sourceId: string): boolean => {
    try { return !!mapInstance.getSource(sourceId) } catch (e) { return false }
  }
  const safeAddLayer = (mapInstance: mapboxgl.Map, layerId: string, layerConfig: any) => {
    if (!layerExists(mapInstance, layerId)) {
      try { mapInstance.addLayer(layerConfig); return true }
      catch (error) { console.error(`Error adding layer ${layerId}:`, error); return false }
    } return false
  }
  const safeRemoveLayer = (mapInstance: mapboxgl.Map, layerId: string) => {
    if (layerExists(mapInstance, layerId)) {
      try { mapInstance.removeLayer(layerId); return true }
      catch (error) { console.error(`Error removing layer ${layerId}:`, error); return false }
    } return false
  }
  const safeAddSource = (mapInstance: mapboxgl.Map, sourceId: string, sourceConfig: any) => {
    if (!sourceExists(mapInstance, sourceId)) {
      try { mapInstance.addSource(sourceId, sourceConfig); return true }
      catch (error) { console.error(`Error adding source ${sourceId}:`, error); return false }
    } return false
  }

  // --- 3D Mode Logic ---
  const toggle3DMode = () => {
    if (!map.current || styleChangeInProgress.current) return;
    const newIs3DEnabled = !is3DEnabled;
    setIs3DEnabled(newIs3DEnabled);
    try {
      if (newIs3DEnabled) {
        if (!map.current.loaded()) map.current.once("load", enable3DMode);
        else enable3DMode();
      } else {
        disable3DMode();
      }
    } catch (error) {
      console.error("Error toggling 3D mode:", error);
      setMapError("3Dモードの切り替え中にエラーが発生しました。");
      setIs3DEnabled(!newIs3DEnabled); // Revert state on error
    }
  };

  const enable3DMode = () => {
    if (!map.current) return;
    try {
      if (!sourceExists(map.current, "mapbox-dem")) {
        safeAddSource(map.current, "mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
      }
      map.current.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      if (!layerExists(map.current, "sky")) {
        safeAddLayer(map.current, "sky", { id: "sky", type: "sky", paint: { "sky-type": "atmosphere", "sky-atmosphere-sun": [0.0, 0.0], "sky-atmosphere-sun-intensity": 15 } });
      }
      map.current.setPitch(60);
      map.current.setBearing(30);
    } catch (error) { console.error("Error enabling 3D mode:", error); throw error; }
  };

  const disable3DMode = () => {
    if (!map.current) return;
    try {
      map.current.setTerrain(null);
      safeRemoveLayer(map.current, "sky");
      map.current.setPitch(0);
      map.current.setBearing(0);
    } catch (error) { console.error("Error disabling 3D mode:", error); throw error; }
  };

  // --- Marker and Map Interaction Logic ---
  const updateSelectionMarker = (coordinates: [number, number], isSubmitted = false) => {
    if (!map.current) return;
    if (selectionMarker.current) selectionMarker.current.remove();

    const markerElement = document.createElement("div");
    
    if (isSubmitted) {
      markerElement.className = "submitted-marker";
      markerElement.style.cssText = `
        width: 20px; height: 20px; border-radius: 50%;
        background: #22c55e; border: 3px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3); cursor: pointer;
      `;
    } else {
      markerElement.className = "selection-marker";
      markerElement.style.cssText = `
        width: 24px; height: 24px; border-radius: 50%;
        background: #3b82f6; border: 4px solid white;
        box-shadow: 0 4px 15px rgba(59,130,246,0.5);
        cursor: grab; transition: all 0.2s ease;
        animation: pulse 2s infinite;
      `;
      
      // パルスアニメーション用のスタイルを追加
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { box-shadow: 0 4px 15px rgba(59,130,246,0.5); }
          50% { box-shadow: 0 4px 25px rgba(59,130,246,0.8); }
          100% { box-shadow: 0 4px 15px rgba(59,130,246,0.5); }
        }
      `;
      if (!document.querySelector('#marker-pulse-style')) {
        style.id = 'marker-pulse-style';
        document.head.appendChild(style);
      }
    }

    selectionMarker.current = new mapboxgl.Marker({ 
      element: markerElement, 
      draggable: !isSubmitted 
    }).setLngLat(coordinates).addTo(map.current);

    if (isSubmitted) {
      markerElement.addEventListener("click", (e) => {
        e.stopPropagation();
        setIsSubmittedPreviewOpen(true);
      });
    } else {
      selectionMarker.current.on("drag", () => {
        markerElement.style.cursor = "grabbing";
      });
      
      selectionMarker.current.on("dragend", () => {
        markerElement.style.cursor = "grab";
        if (!selectionMarker.current) return;
        const lngLat = selectionMarker.current.getLngLat();
        const newCoordinates: [number, number] = [lngLat.lng, lngLat.lat];
        setSelectedLocation(newCoordinates);
        setLocationSelectionSource("manual");
        toast({ 
          title: "地点を移動しました", 
          description: "ドラッグで位置を調整しました" 
        });
      });
    }
  };

  const flyToLocation = (longitude: number, latitude: number, zoom = 15) => {
    map.current?.flyTo({ center: [longitude, latitude], zoom: zoom, essential: true });
  };

  const showTemporaryAccidentMarker = useCallback((coords: [number, number]) => {
    if (accidentMarkerRef.current) {
      accidentMarkerRef.current.remove()
      accidentMarkerRef.current = null
    }
    if (accidentMarkerTimerRef.current) {
      clearTimeout(accidentMarkerTimerRef.current)
      accidentMarkerTimerRef.current = null
    }
    if (!map.current) return
    if (!isValidCoordinates(coords[1], coords[0])) {
      console.warn("Skipped accident marker due to invalid coordinates", { coords })
      return
    }

    const el = document.createElement('div')
    el.className = 'accident-highlight-marker'
    const marker = new mapboxgl.Marker(el)
      .setLngLat(coords)
      .addTo(map.current)
    accidentMarkerRef.current = marker

    const timerId = setTimeout(() => {
      marker.remove()
      if (accidentMarkerRef.current === marker) {
        accidentMarkerRef.current = null
      }
      if (accidentMarkerTimerRef.current === timerId) {
        accidentMarkerTimerRef.current = null
      }
    }, 8000)
    accidentMarkerTimerRef.current = timerId
  }, []);

  // --- ▼▼▼ handleMapClick を修正 ▼▼▼ ---
  const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
    const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    console.log(`Map clicked at: ${coordinates}. isMobile=${isMobile}, awaitingLocationSelection=${awaitingLocationSelection}, isReportFormOpen=${isReportFormOpen}`);
    dismissTransientMapUi({
      setActiveTopPanel,
      setDismissSearchResultsSignal,
    })

    // 不審者アラート入力中は、地図クリックで中心点を指定する（プレビュー円・ピンは effect 側で更新）。
    // ref 経由で読むことで、マップ初期化前にフォームが開いた場合（?suspiciousAlert=1 直接遷移）でも確実に分岐する。
    if (isSuspiciousAlertOpenRef.current) {
      setSelectedLocation(coordinates);
      setLocationSelectionSource("manual");
      return;
    }

    if (awaitingLocationSelection) {
      // 地点選択モード：位置を選択
      console.log("Location selection mode: Setting location");
      setSelectedLocation(coordinates);
      setLocationSelectionSource("manual");

      if (isMobile) {
        // モバイル：地点を選択するだけ（下部の確認バーが次の一歩を案内するため、
        // トーストは出さない — 二重の案内はノイズになる）
      } else {
        // デスクトップ：地点選択後すぐにフォームを開く
        setIsReportFormOpen(true);
        setAwaitingLocationSelection(false);
      }
    } else if (isReportFormOpen) {
      // フォームが開いている場合：モバイル・デスクトップ関係なく位置を更新
      console.log("Form is open: Updating location");
      setSelectedLocation(coordinates);
      setLocationSelectionSource("manual");
      toast({
        title: "地点を変更しました",
        description: "新しい位置に報告地点を変更しました"
      });
    } else {
      // 通常の地図クリック時に事故統計を取得・表示
      console.log("Normal map click: Fetching accident statistics");
      fetchClickedLocationStats({
        latitude: coordinates[1],
        longitude: coordinates[0],
        radiusMeters: 300,
        years: 5,
      });

      // サイドバーを開く（モバイル時）
      if (isMobile) {
        setIsSidebarOpen(true);
      }
    }
  };
  // --- ▲▲▲ ---

  const addClickListener = () => {
    if (!map.current || clickListenerAdded.current) return;
    if (mapClickHandler.current) map.current.off("click", mapClickHandler.current);
    mapClickHandler.current = handleMapClick;
    map.current.on("click", mapClickHandler.current);
    clickListenerAdded.current = true;
  };

  // --- Map Initialization ---
  useEffect(() => {
    if (!mapContainer.current || mapInitialized.current || !supabase) return;

    if (!mapboxgl.supported()) {
      setMapError("このブラウザはMapboxをサポートしていません。WebGLが有効か確認してください。"); setIsLoading(false); return;
    }
    if (!mapboxgl.accessToken) {
      setMapError("Mapboxアクセストークンが設定されていません。環境変数を確認してください。"); setIsLoading(false); return;
    }

    try {
      const shouldRenderNavigationControl = shouldShowMapNavigationControl(
        typeof window !== "undefined" && typeof window.matchMedia === "function"
          ? window.matchMedia("(max-width: 768px)").matches
          : isMobile,
      )
      if (!navigationControlRef.current) {
        navigationControlRef.current = new mapboxgl.NavigationControl({ showCompass: false })
      }

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: `mapbox://styles/mapbox/${mapStyle}`, // Initial style from state
        center: [139.6917, 35.6895], // Tokyo center
        zoom: 12,
        attributionControl: true,
      });

      map.current.on("error", (e) => {
        const classifiedError = classifyMapboxError({
          error: e.error || e,
          sourceId: (e as { sourceId?: string }).sourceId,
        })

        if (classifiedError.severity === "overlay") {
          console.warn("Hazard overlay error:", e.error || e)
          setRouteHazardError((current) => current ?? classifiedError.message)
          return
        }

        console.error("Mapbox error:", e.error || e)
        setMapError(`マップエラー: ${classifiedError.message}`)
      });

      // 地名・施設名ラベルを日本語優先に(スタイル変更後も再適用。shield系は除外済み)
      map.current.on("style.load", () => {
        if (map.current) localizeMapLabels(map.current)
      });

      map.current.on("load", () => {
        mapInitialized.current = true;
        addClickListener();
        setIsLoading(false);
        setMapStyleSyncToken((prev) => prev + 1)
        if (map.current) localizeMapLabels(map.current)
        // Add controls after load
        if (map.current && navigationControlRef.current) {
          syncMapNavigationControl({
            map: map.current,
            control: navigationControlRef.current,
            shouldShow: shouldRenderNavigationControl,
          })
        }
        map.current?.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "bottom-right");
      });
    } catch (error: any) {
      console.error("Error initializing map:", error);
      setMapError(`マップ初期化エラー: ${error.message}`);
      setIsLoading(false);
    }

    return () => {
      accidentMarkerRef.current?.remove()
      accidentMarkerRef.current = null
      if (accidentMarkerTimerRef.current) clearTimeout(accidentMarkerTimerRef.current)
      accidentMarkerTimerRef.current = null
      clearRouteHazardMarkers()
      clearRouteHazardPopup()
      if (map.current) {
        if (mapClickHandler.current) map.current.off("click", mapClickHandler.current);
        map.current.remove(); map.current = null;
        navigationControlRef.current = null
        mapInitialized.current = false; clickListenerAdded.current = false; mapClickHandler.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]); // Add supabase dependency

  useEffect(() => {
    if (!map.current || !mapInitialized.current || !navigationControlRef.current) return

    syncMapNavigationControl({
      map: map.current,
      control: navigationControlRef.current,
      shouldShow: shouldShowMapNavigationControl(isMobile),
    })
  }, [isMobile])

  // autoOpenReport: ナビの報告CTAから遷移したとき自動でフォームを開く
  useEffect(() => {
    if (!autoOpenReport || isLoading) return
    if (isMobile) {
      setAwaitingLocationSelection(true)
    } else {
      setIsReportFormOpen(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenReport, isLoading])

  // --- Report Form Logic ---
  useEffect(() => {
    if (isReportFormOpen && map.current) {
      if (!clickListenerAdded.current) addClickListener();
      if (!selectedLocation) {
        const center = map.current.getCenter();
        const initialLocation: [number, number] = [center.lng, center.lat];
        setSelectedLocation(initialLocation);
        setLocationSelectionSource("manual");
        // updateSelectionMarker is called via useEffect below
      }
    }
    if (!isReportFormOpen && !submittedReport && selectionMarker.current) {
      selectionMarker.current.remove(); selectionMarker.current = null;
      setSelectedLocation(null); // Reset location when form closes without submission
      setLocationSelectionSource(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReportFormOpen, submittedReport]); // submittedReport dependency added

  // --- Location Selection Mode: Ensure click listener is active ---
  // awaitingLocationSelection / isSuspiciousAlertOpen の変化時に最新の handleMapClick を再登録し、
  // 各モードのクロージャ（不審者アラート分岐など）が確実に最新になるようにする。
  useEffect(() => {
    if (!map.current || !mapInitialized.current) return;
    if (awaitingLocationSelection || isSuspiciousAlertOpen) {
      if (!clickListenerAdded.current || !mapClickHandler.current) {
        addClickListener();
      } else {
        if (mapClickHandler.current) {
          map.current.off("click", mapClickHandler.current);
        }
        mapClickHandler.current = handleMapClick;
        map.current.on("click", mapClickHandler.current);
      }
    } else if (clickListenerAdded.current && mapClickHandler.current) {
      // どのモードでもない通常状態に戻ったら、最新（分岐なし）の handleMapClick を再登録する
      map.current.off("click", mapClickHandler.current);
      mapClickHandler.current = handleMapClick;
      map.current.on("click", mapClickHandler.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingLocationSelection, isSuspiciousAlertOpen]);

  useEffect(() => {
    // 地点選択モード中またはフォームが開いている時にマーカーを表示
    if (selectedLocation && (isReportFormOpen || awaitingLocationSelection)) {
      updateSelectionMarker(selectedLocation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation, isReportFormOpen, awaitingLocationSelection]);

  useEffect(() => {
    if (submittedReport) {
      updateSelectionMarker(submittedReport.location, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedReport]);

  // --- Map Style Change Logic ---
  useEffect(() => {
    if (!map.current || !mapInitialized.current || !mapStyle) return;

    try {
      styleChangeInProgress.current = true;
      const was3DEnabled = is3DEnabled;
      if (mapClickHandler.current) { map.current.off("click", mapClickHandler.current); clickListenerAdded.current = false; }
      if (was3DEnabled) { try { disable3DMode(); } catch (e) { console.error("Error disabling 3D before style change:", e); } }

      map.current.setStyle(`mapbox://styles/mapbox/${mapStyle}`);

      map.current.once("style.load", () => {
        if (!map.current) return;
        addClickListener(); // Re-add listener after style load
        setMapStyleSyncToken((prev) => prev + 1)
        if (was3DEnabled) {
          setTimeout(() => { // Delay slightly to ensure resources are ready
            if (map.current && is3DEnabled) { // Check state again before enabling
              try { enable3DMode(); } catch(e) { console.error("Error re-enabling 3D after style change:", e); }
            }
            styleChangeInProgress.current = false;
          }, 500); // Reduced delay slightly
        } else {
          styleChangeInProgress.current = false;
        }
      });
    } catch (error: any) {
      console.error("Error changing map style:", error);
      setMapError(`スタイル変更エラー: ${error.message}`);
      styleChangeInProgress.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]); // Removed is3DEnabled from dependency array to prevent loop

  useEffect(() => {
    if (!map.current || !mapInitialized.current) return

    const mapInstance = map.current

    const syncLayer = (hazardType: HazardType) => {
      const config = HAZARD_TILE_CONFIG[hazardType]
      const sourceId = `${config.id}-source`
      const layerId = `${config.id}-layer`

      if (!hazardLayerVisibility[hazardType]) {
        safeRemoveLayer(mapInstance, layerId)
        if (sourceExists(mapInstance, sourceId)) {
          try {
            mapInstance.removeSource(sourceId)
          } catch (error) {
            console.error(`Error removing source ${sourceId}:`, error)
          }
        }
        return
      }

      if (!sourceExists(mapInstance, sourceId)) {
        safeAddSource(mapInstance, sourceId, {
          type: "raster",
          tiles: [config.tileUrl],
          tileSize: 256,
          attribution: "国土交通省 重ねるハザードマップ",
        })
      }

      if (!layerExists(mapInstance, layerId)) {
        safeAddLayer(mapInstance, layerId, {
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: {
            "raster-opacity": hazardType === "flood" ? 0.72 : 0.78,
          },
        })
      }
    }

    syncLayer("flood")
    syncLayer("tsunami")
  }, [hazardLayerVisibility, mapStyleSyncToken])

  useEffect(() => {
    if (!map.current || !mapInitialized.current) return

    const mapInstance = map.current
    const sourceId = "selected-user-route-source"
    const layerId = "selected-user-route-layer"

    safeRemoveLayer(mapInstance, layerId)
    if (sourceExists(mapInstance, sourceId)) {
      try {
        mapInstance.removeSource(sourceId)
      } catch (error) {
        console.error(`Error removing source ${sourceId}:`, error)
      }
    }

    if (!selectedUserRoute?.route_geometry?.coordinates?.length) return

    safeAddSource(mapInstance, sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: selectedUserRoute.route_geometry,
      },
    })

    safeAddLayer(mapInstance, layerId, {
      id: layerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#1d4ed8",
        "line-width": 5,
        "line-opacity": 0.88,
      },
    })
  }, [mapStyleSyncToken, selectedUserRoute])

  useEffect(() => {
    const requestState = getRouteHazardRequestState(selectedUserRoute, hazardLayerVisibility)

    if (!selectedUserRoute?.route_geometry?.coordinates?.length) {
      setRouteHazards([])
      setRouteHazardError(null)
      setRouteHazardsFetchedAt(null)
      setIsRouteHazardsLoading(requestState.isLoading)
      return
    }

    if (!requestState.shouldFetch) {
      setRouteHazardError(null)
      setIsRouteHazardsLoading(requestState.isLoading)
      return
    }

    let cancelled = false
    setIsRouteHazardsLoading(requestState.isLoading)
    setRouteHazardError(null)

    fetch(`/api/hazard/route-risks?routeId=${encodeURIComponent(selectedUserRoute.id)}`)
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) {
          throw new Error(body.error || "危険箇所の取得に失敗しました")
        }
        return body
      })
      .then((body) => {
        if (cancelled) return
        const markers = Array.isArray(body.markers)
          ? body.markers.map((marker: RouteHazardMarker) => ({
              ...marker,
              area_label: marker.area_label ?? getHazardAreaLabel(marker.area_context),
              explanation:
                marker.explanation ??
                buildHazardExplanation({
                  hazardType: marker.hazard_type,
                  depthLabel: marker.depth_label,
                }),
              evacuation_points:
                marker.evacuation_points?.length
                  ? marker.evacuation_points
                  : getHazardEvacuationPoints(marker.hazard_type),
            }))
          : []
        setRouteHazards(markers)
        setRouteHazardsFetchedAt(new Date().toISOString())
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message =
          error instanceof Error ? error.message : "危険箇所の取得に失敗しました"
        setRouteHazardError(message)
        setRouteHazards([])
        setRouteHazardsFetchedAt(null)
      })
      .finally(() => {
        if (!cancelled) {
          setIsRouteHazardsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [hazardLayerVisibility, selectedUserRoute])

  useEffect(() => {
    if (!selectedUserRoute) return
    fitRouteBounds(selectedUserRoute)
  }, [fitRouteBounds, selectedUserRoute])

  // --- Accident Heatmap: fetch data on map move ---
  useEffect(() => {
    if (!map.current || !accidentHeatmap.isVisible) return

    const handleMoveEnd = () => {
      if (!map.current) return
      const bounds = map.current.getBounds()
      if (!bounds) return
      accidentHeatmap.fetchForViewport({
        minLng: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),
        maxLat: bounds.getNorth(),
      })
    }

    map.current.on('moveend', handleMoveEnd)
    handleMoveEnd()

    return () => {
      map.current?.off('moveend', handleMoveEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accidentHeatmap.isVisible, accidentHeatmap.filters])

  // --- Map Cursor Style Management ---
  useEffect(() => {
    if (!map.current) return;
    
    const mapCanvas = map.current.getCanvas();
    if (awaitingLocationSelection || isReportFormOpen) {
      mapCanvas.style.cursor = 'crosshair';
    } else {
      mapCanvas.style.cursor = '';
    }
  }, [awaitingLocationSelection, isReportFormOpen]);

  // --- Help Visibility Reset ---
  useEffect(() => {
    // 新しい報告を開始する時はヘルプを再表示（完全に消されていない場合のみ）
    if ((awaitingLocationSelection || isReportFormOpen) && !isHelpDismissed) {
      setIsHelpVisible(true);
    }
  }, [awaitingLocationSelection, isReportFormOpen, isHelpDismissed]);

  // --- Data Fetching ---
  useEffect(() => {
    if (!supabase) return; // Ensure supabase is initialized

    const requestId = reportsFetchRequestIdRef.current + 1
    reportsFetchRequestIdRef.current = requestId

    reportsFetchAbortRef.current?.abort()
    const abortController = new AbortController()
    reportsFetchAbortRef.current = abortController

    const fetchDangerReports = async () => {
      setIsLoading(true);
      try {
        const retryDelaysMs = [0, 250, 800]

        for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
          if (attempt > 0) {
            await sleep(retryDelaysMs[attempt])
          }

          try {
            // Use cached session state to avoid unnecessary auth network calls on each filter change.
            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData.session?.user?.id;

            // Base query for publicly visible reports
            let approvedQuery = supabase
              .from("danger_reports")
              .select(`*`) // Select を最初に戻す
              .in("status", [...PUBLIC_DANGER_REPORT_STATUSES])
              .abortSignal(abortController.signal);

            // Filter by danger type
            if (filterOptions.dangerType !== "all") {
              // 型エラーを回避するために as any を一時的に使う
              approvedQuery = (approvedQuery as any).eq('danger_type', filterOptions.dangerType);
            }
            // Filter by danger level
            if (filterOptions.dangerLevel !== "all") {
              approvedQuery = (approvedQuery as any).eq('danger_level', parseInt(filterOptions.dangerLevel, 10));
            }
            // Filter by date range
            if (filterOptions.dateRange !== "all") {
              const now = new Date();
              let startDate = new Date(0); // Default to beginning of time
              if (filterOptions.dateRange === "week") startDate.setDate(now.getDate() - 7);
              else if (filterOptions.dateRange === "month") startDate.setMonth(now.getMonth() - 1);
              else if (filterOptions.dateRange === "year") startDate.setFullYear(now.getFullYear() - 1);
              approvedQuery = (approvedQuery as any).gte('created_at', startDate.toISOString());
            }

            const { data: approvedData, error: approvedError } = await approvedQuery.order("created_at", { ascending: false });

            if (approvedError) throw approvedError;
            if (abortController.signal.aborted || requestId !== reportsFetchRequestIdRef.current) return;
            setDangerReports((approvedData ?? []) as DangerReport[]);

            // Fetch user's pending reports if logged in and filter is enabled
            let userPendingReports: DangerReport[] = [];
            if (userId && filterOptions.showPending) {
              const { data: pendingData, error: pendingError } = await supabase
                .from("danger_reports")
                .select(`*`) // Select を最初に戻す
                .eq("status", "pending")
                .eq("user_id", userId)
                .abortSignal(abortController.signal)
                .order("created_at", { ascending: false });

              if (pendingError) console.error("Error fetching pending reports:", pendingError);
              else userPendingReports = (pendingData ?? []) as DangerReport[];
            }

            if (abortController.signal.aborted || requestId !== reportsFetchRequestIdRef.current) return;
            setPendingReports(userPendingReports);
            return
          } catch (attemptError: any) {
            if (abortController.signal.aborted || requestId !== reportsFetchRequestIdRef.current) return

            const canRetry = isTransientFetchError(attemptError) && attempt < retryDelaysMs.length - 1
            if (canRetry) {
              console.warn(`[danger_reports] transient fetch error (attempt ${attempt + 1}), retrying...`, attemptError)
              continue
            }

            throw attemptError
          }
        }
      } catch (error: any) {
        if (abortController.signal.aborted || requestId !== reportsFetchRequestIdRef.current || isAbortLikeError(error)) {
          return
        }
        console.error("Error fetching reports object:", error); // オブジェクト全体
        console.error("Error fetching reports message:", error?.message); // メッセージ
        console.error("Error fetching reports stack:", error?.stack); // スタックトレース
        console.error("Error fetching reports stringified:", JSON.stringify(error)); // JSON文字列化

        toast({ title: "データ取得エラー", description: `危険箇所データの取得エラー: ${error?.message || '詳細不明'}`, variant: "destructive" }); // messageがない場合も考慮
        setDangerReports([]);
        setPendingReports([]);
      } finally {
        if (requestId !== reportsFetchRequestIdRef.current) return;
        setIsLoading(false);
      }
    };

    fetchDangerReports();
    return () => {
      abortController.abort()
    }
  }, [supabase, filterOptions, toast]);

  // --- Marker Rendering ---
  const getDangerTypeMarkerClass = (dangerType: string) => {
    return `danger-marker-${dangerType}` || 'danger-marker-other'; // Simplified
  };

    useEffect(() => {
      if (!map.current || !mapInitialized.current) return;

      // Remove existing markers before adding new ones
      document.querySelectorAll('.danger-marker, .pending-marker').forEach(marker => marker.remove());

      const addMarker = (report: DangerReport, isPending: boolean) => {
        const markerElement = document.createElement("div");
        const typeClass = getDangerTypeMarkerClass(report.danger_type);
        markerElement.className = `${isPending ? 'pending-marker' : 'danger-marker'} danger-level-${report.danger_level} ${typeClass}`; // クラス名は残す
        markerElement.style.cursor = 'pointer';

        // --- ▼▼▼ 危険度に基づく色分け ▼▼▼ ---
        const getDangerLevelColor = (level: number) => {
          switch (level) {
            case 1:
              return '#22c55e' // green-500
            case 2:
              return '#22c55e' // green-500
            case 3:
              return '#eab308' // yellow-500
            case 4:
              return '#f97316' // orange-500
            case 5:
              return '#ef4444' // red-500
            default:
              return '#6b7280' // gray-500
          }
        }
        
        const backgroundColor = getDangerLevelColor(report.danger_level);
        markerElement.style.backgroundColor = backgroundColor;
        markerElement.style.border = '2px solid white';
        markerElement.style.borderRadius = '50%';
        markerElement.style.width = '24px';
        markerElement.style.height = '24px';
        markerElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        // --- ▲▲▲ 危険度に基づく色分け ▲▲▲ ---

        // Render icon inside marker
        const root = createRoot(markerElement);
        let IconComponent: React.ElementType = HelpCircle; // Default icon
        if (report.danger_type === "traffic") IconComponent = Car;
        else if (report.danger_type === "crime") IconComponent = Shield;
        else if (report.danger_type === "disaster") IconComponent = AlertTriangle;
        else if (report.danger_type === SUSPICIOUS_DANGER_TYPE) IconComponent = UserX;
        root.render(<IconComponent className="h-5 w-5 text-white" />); // Adjusted size

        new mapboxgl.Marker(markerElement)
          .setLngLat([report.longitude, report.latitude])
          .addTo(map.current!); // Add to map

        markerElement.addEventListener("click", async (e) => {
          e.stopPropagation();
          setSelectedReport(report); // Set selected report for modal
          setIsDetailModalOpen(true);

          // Add gamification points (consider moving this logic)
          if (supabase && report.user_id) { // Check if supabase and user_id exist
            try { await addPoints(supabase, report.user_id, 5); }
            catch (err) { console.error("Error adding points on marker click:", err); }
          }
        });
      };

      try {
        // Add markers for approved reports
        dangerReports.forEach(report => addMarker(report, false));

        // Add markers for pending reports if filter is enabled
        if (filterOptions.showPending) {
          pendingReports.forEach(report => addMarker(report, true));
        }
      } catch (error) {
        console.error("Error adding markers:", error);
      }
    // Re-evaluate dependencies: mapStyle might not be needed if markers don't change with style
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dangerReports, pendingReports, filterOptions.showPending, mapInitialized.current]); // Removed mapStyle, is3DEnabled, selectedLocation

  useEffect(() => {
    if (!map.current || !mapInitialized.current) return

    clearRouteHazardMarkers()
    clearRouteHazardPopup()

    visibleRouteHazards.forEach((hazard) => {
      const markerElement = document.createElement("button")
      markerElement.type = "button"
      markerElement.className = "route-hazard-marker"
      markerElement.style.width = "30px"
      markerElement.style.height = "30px"
      markerElement.style.borderRadius = "9999px"
      markerElement.style.border = "2px solid white"
      markerElement.style.background = hazard.hazard_type === "tsunami" ? "#1d4ed8" : "#f97316"
      markerElement.style.color = "white"
      markerElement.style.boxShadow = "0 6px 16px rgba(15,23,42,0.28)"
      markerElement.style.cursor = "pointer"

      const root = createRoot(markerElement)
      root.render(<AlertTriangle className="h-4 w-4" />)

      const markerInstance = new mapboxgl.Marker(markerElement)
        .setLngLat(hazard.coordinates)
        .addTo(map.current!)

      markerElement.addEventListener("click", (event) => {
        event.stopPropagation()
        clearRouteHazardPopup()

        const popupContent = document.createElement("div")
        popupContent.className = "space-y-3 p-1"

        const title = document.createElement("div")
        title.innerHTML = `<div style="font-weight:700;font-size:14px;">${hazard.title}</div><div style="font-size:12px;color:#475569;">${hazard.summary}</div>`
        popupContent.appendChild(title)

        const meta = document.createElement("div")
        meta.style.fontSize = "12px"
        meta.style.color = "#334155"
        meta.textContent = `${hazard.area_label} / ${hazard.depth_label}`
        popupContent.appendChild(meta)

        const button = document.createElement("button")
        button.type = "button"
        button.textContent = "災害イメージを見る"
        button.style.width = "100%"
        button.style.borderRadius = "8px"
        button.style.border = "0"
        button.style.padding = "8px 12px"
        button.style.background = "#0f172a"
        button.style.color = "#fff"
        button.style.fontSize = "12px"
        button.style.fontWeight = "600"
        button.style.cursor = "pointer"
        button.addEventListener("click", () => {
          setActiveHazardMarker(hazard)
          setSelectedHazardScenarioKey(hazard.scenario_key)
          setHazardImageResult(null)
          setHazardImageError(null)
          setIsHazardModalOpen(true)
        })
        popupContent.appendChild(button)

        routeHazardPopupRef.current = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          offset: 16,
          maxWidth: "280px",
        })
          .setLngLat(hazard.coordinates)
          .setDOMContent(popupContent)
          .addTo(map.current!)
      })

      routeHazardMarkersRef.current.push(markerInstance)
    })

    return () => {
      clearRouteHazardMarkers()
      clearRouteHazardPopup()
    }
  }, [clearRouteHazardMarkers, clearRouteHazardPopup, visibleRouteHazards])

  // --- Helper Labels/Colors (Consider moving to utils) ---
  const getDangerTypeLabel = (type: string) => {
    switch (type) {
      case "traffic": return "交通危険"; case "crime": return "犯罪危険";
      case "disaster": return "災害危険"; case "other": return "その他";
      default: return type;
    }
  };
  const getDangerLevelColor = (level: number) => {
    switch (level) {
      case 1: return "#4ade80"; case 2: return "#a3e635"; case 3: return "#facc15";
      case 4: return "#fb923c"; case 5: return "#f87171"; default: return "#94a3b8";
    }
  };

  const toggleARMode = useCallback(() => {
    setActiveARKind("nearby")
    setIsARMode((prev) => !prev)
  }, [])

  const handleOpenParentChildARMode = useCallback(() => {
    if (!selectedUserRoute) {
      toast({
        title: "通学路を選択してください",
        description: "親子で確認する通学路を先に選んでください。",
      })
      return
    }

    setActiveARKind("parent_child_route")
    setIsARMode(true)
    setActiveTopPanel("ar")
  }, [selectedUserRoute, toast])

  // --- Event Handlers ---
  const handleRouteSelectionChange = useCallback((routeId: string) => {
    setSelectedUserRouteId(routeId)
    setRouteHazardError(null)
    setRouteHazards([])
    setRouteHazardsFetchedAt(null)
    setActiveHazardMarker(null)
    setHazardImageResult(null)
    setHazardImageError(null)
  }, [])

  const handleHazardLayerToggle = useCallback((hazardType: HazardType, checked: boolean) => {
    setHazardLayerVisibility((prev) => ({ ...prev, [hazardType]: checked }))
  }, [])

  const handleRouteHazardSelect = useCallback((hazard: RouteHazardMarker) => {
    setActiveHazardMarker(hazard)
    setSelectedHazardScenarioKey(hazard.scenario_key)
    setHazardImageResult(null)
    setHazardImageError(null)
    setIsHazardModalOpen(true)
    flyToLocation(hazard.coordinates[0], hazard.coordinates[1], 16)
  }, [])

  const handleGenerateHazardImage = useCallback(async () => {
    if (!activeHazardMarker) return

    const scenarioKey = selectedHazardScenarioKey ?? activeHazardMarker.scenario_key
    setIsHazardImageLoading(true)
    setHazardImageError(null)

    try {
      const response = await fetch("/api/hazard/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hazardType: activeHazardMarker.hazard_type,
          riskLevel: activeHazardMarker.risk_level,
          depthMinMeters: activeHazardMarker.depth_min_m,
          depthMaxMeters: activeHazardMarker.depth_max_m,
          areaContext: activeHazardMarker.area_context,
          scenarioKey,
          locationLabel: `${activeHazardMarker.area_label} in Japan`,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        throw new Error(body.error || "災害イメージの生成に失敗しました")
      }

      setHazardImageResult(body)
      setActiveHazardMarker((prev) =>
        prev ? { ...prev, scenario_key: scenarioKey } : prev,
      )
    } catch (error) {
      setHazardImageError(
        error instanceof Error ? error.message : "災害イメージの生成に失敗しました",
      )
    } finally {
      setIsHazardImageLoading(false)
    }
  }, [activeHazardMarker, selectedHazardScenarioKey])

  const handleFilterChange = (newFilters: Partial<typeof filterOptions>) => {
    setFilterOptions((prev) => {
      const next = { ...prev, ...newFilters }
      if (
        next.dangerType === prev.dangerType &&
        next.dangerLevel === prev.dangerLevel &&
        next.dateRange === prev.dateRange &&
        next.showPending === prev.showPending
      ) {
        return prev
      }
      return next
    });
  };

  const handleReportSubmit = async (
    reportData: DangerReportSubmitPayload & { imageFile?: File | null },
    options?: { suppressPreview?: boolean; suppressSuccessToast?: boolean }
  ): Promise<{ reportId: string; imageUrl: string | null }> => {
    if (!supabase || !selectedLocation) { // Check supabase and selectedLocation
      toast({ title: "エラー", description: "地図上で位置を選択してください。", variant: "destructive" });
      throw new Error("地図上で位置を選択してください。");
    }

    if (!isValidCoordinates(selectedLocation[1], selectedLocation[0])) {
      toast({ title: "エラー", description: "位置情報が不正です。地図で地点を再選択してください。", variant: "destructive" });
      throw new Error("位置情報が不正です。地図で地点を再選択してください。");
    }

    // insert するデータからファイル・画像URL配列を除外（アップロードは API 側へ一本化）
    const {
      imageFile: legacyImageFile,
      originalImageFile,
      processedImageFiles,
      route_context_id,
      route_context_name,
      image_url: _ignoredImageUrl,
      processed_image_urls: _ignoredProcessedImageUrls,
      ...reportDataToInsert
    } = reportData;

    const originalFileToUpload =
      (originalImageFile instanceof File ? originalImageFile : null)
      ?? (legacyImageFile instanceof File ? legacyImageFile : null);
    const processedFilesToUpload = (processedImageFiles || []).filter(
      (file): file is File => file instanceof File,
    );

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ユーザー情報が取得できませんでした。", variant: "destructive" });
        throw new Error("ユーザー情報が取得できませんでした。");
      }

      // 1. 基本情報をまず INSERT (processed_image_urls は含めないか NULL)
      console.log("Inserting basic report data...");

      const locationDetails = selectedLocation
        ? await reverseGeocodeLocation(selectedLocation[1], selectedLocation[0])
        : { prefecture: null as string | null, city: null as string | null };

      const initialStatus = resolveInitialDangerReportStatus(reportDataToInsert.status);

      const insertReport = async (status: string) =>
        supabase
          .from("danger_reports")
          .insert({
            ...reportDataToInsert, // imageFile を除外したデータ
            user_id: user.id,
            latitude: selectedLocation[1],
            longitude: selectedLocation[0],
            prefecture: locationDetails.prefecture,
            city: locationDetails.city,
            status,
            title: reportDataToInsert.title || '無題の報告',
            danger_type: reportDataToInsert.danger_type || 'other',
            danger_level: reportDataToInsert.danger_level || 1,
            // processed_image_urls は API 側で設定されるため、ここでは設定しない (NULL or default)
            // processed_image_urls: [], // ← 削除
          })
          .select()
          .single();

      let { data: insertedData, error: insertError } = await insertReport(initialStatus);

      // Some environments enforce stricter insert checks for "published".
      // Retry once as "pending" to avoid blocking report submissions.
      if (shouldRetryDangerReportInsertAsPending(initialStatus, insertError)) {
        console.warn("[danger_reports] insert blocked for published, retrying as pending", insertError);
        const retryResult = await insertReport("pending");
        insertedData = retryResult.data;
        insertError = retryResult.error;
      }

      if (insertError) throw insertError;
      if (!insertedData) throw new Error("挿入されたレポートデータの取得に失敗しました。");

      const newReportId = insertedData.id;
      console.log(`Report inserted successfully with ID: ${newReportId}`);

      if (route_context_name) {
        const routeNotification = buildRouteReportNotification({
          userId: user.id,
          reportId: newReportId,
          reportTitle: reportDataToInsert.title || "無題の報告",
          routeId: route_context_id,
          routeName: route_context_name,
        })

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(routeNotification)

        if (notificationError) {
          console.warn("route notification insert failed", notificationError)
        }
      }

      // 危険レポートアラート: 通学路300m圏内のユーザーにプッシュ通知 (fire-and-forget)
      fetch('/api/push/notify-danger-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: newReportId }),
      }).catch(() => {
        // プッシュ通知の失敗はレポート投稿の成功に影響しない
      })

      // 2. 画像があれば、画像処理 API を呼び出す（original / processed）
      let finalReportData = insertedData as DangerReport; // 型アサーション
      if (newReportId && (originalFileToUpload || processedFilesToUpload.length > 0)) {
        console.log(`Calling /api/image/process for report ID: ${newReportId}`);

        const uploadViaApi = async (file: File, imageType: "original" | "processed") => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("reportId", newReportId);
          formData.append("imageType", imageType);
          const response = await fetch("/api/image/process", {
            method: "POST",
            body: formData,
          });
          let data: any = {};
          try {
            data = await response.json();
          } catch {
            data = {};
          }
          if (!response.ok) {
            throw new Error(data.message || `画像処理APIエラー: status=${response.status}`);
          }
          return data;
        };

        try {
          if (originalFileToUpload) {
            const originalResult = await uploadViaApi(originalFileToUpload, "original");
            finalReportData = {
              ...finalReportData,
              image_url: originalResult.imageUrl || finalReportData.image_url || null,
            };
          }

          for (const processedFile of processedFilesToUpload) {
            const processedResult = await uploadViaApi(processedFile, "processed");
            finalReportData = {
              ...finalReportData,
              processed_image_urls: processedResult.updatedUrls || finalReportData.processed_image_urls || [],
            };
          }

          if (originalFileToUpload || processedFilesToUpload.length > 0) {
            toast({ title: "画像処理完了", description: "画像がアップロード・処理されました。" });
          }
        } catch (apiError: any) {
          console.error("Error calling /api/image/process:", apiError);
          toast({
            title: "画像処理エラー",
            description: `レポートは保存されましたが、画像の処理に失敗しました: ${apiError.message || "不明なエラー"}`,
            variant: "destructive",
          });
        }
      } else {
        console.log("No image file provided or report ID missing, skipping image processing.");
      }


      // 3. 後続処理 (トースト、ポイント、プレビュー、ローカル状態更新)
      if (!options?.suppressSuccessToast) {
        toast({ title: "報告完了", description: "危険箇所報告が送信されました。" }); // 最終的な完了トースト
      }

      // Gamification (エラーがあっても続行)
      try {
        if (user?.id) { // user.id が存在するか確認
           await addPoints(supabase, user.id, 20);
           if (!options?.suppressSuccessToast) {
             toast({ title: "ポイント獲得", description: "報告送信で +20pt 獲得しました。" });
           }
        } else {
           console.warn("User ID not found for gamification points.");
        }
      } catch (e: any) { console.error("Gamification error:", e); }

      // プレビュー用のデータを設定 (selectedLocation が null でないことを確認)
      if (selectedLocation && !options?.suppressPreview) {
        setSubmittedReport({
          reportId: newReportId,
          title: finalReportData.title || "無題の報告",
          summary: buildFamilyShareSummary(finalReportData.description, finalReportData.title),
          action: buildFamilyShareAction(
            finalReportData.learning_checkpoints,
            selectedUserRoute?.name
              ? `${selectedUserRoute.name}で立ち止まる場所と待機位置を確認する`
              : null,
          ),
          mapLabel: buildFamilyShareMapLabel(
            [route_context_name ?? selectedUserRoute?.name ?? null, finalReportData.prefecture, finalReportData.city],
            selectedLocation,
          ),
          location: selectedLocation,
          originalImage: finalReportData.image_url || null,
          processedImages: finalReportData.processed_image_urls || [],
        });
      } else {
        console.error("Selected location is null, cannot set submitted report state.");
        // selectedLocation が null の場合のエラーハンドリングが必要な場合がある
      }

      // TEMP: Keep form open to show VLM analysis results
      // setIsReportFormOpen(false); // Close form

      // プレビューモーダル表示 (API の結果を反映したデータで判断)
      if (!options?.suppressPreview && (finalReportData.image_url || (finalReportData.processed_image_urls && finalReportData.processed_image_urls.length > 0))) {
        // selectedLocation が null の場合でもプレビューは表示できるかもしれない
        // ただし、SubmittedReportPreview が location を期待している場合は問題
        if (selectedLocation) {
            setIsSubmittedPreviewOpen(true);
        }
      }

      // ローカル状態を更新 (API の結果を反映したデータを使う)
      setPendingReports(prev => [finalReportData, ...prev]);

      // Return report ID and image URL for VLM analysis
      return {
        reportId: newReportId,
        imageUrl: finalReportData.image_url || null,
      };
    } catch (error: any) {
      console.error("Error submitting report:", error);
      toast({ title: "送信エラー", description: `報告の送信エラー: ${error.message}`, variant: "destructive" });
      throw error; // Re-throw so form can handle it
    }
  };

  // 不審者アラートの送信: 既存の挿入/画像パイプラインを再利用し、AI一次審査で公開可否を決める
  const handleSuspiciousAlertSubmit = async (payload: SuspiciousAlertFormPayload) => {
    if (!selectedLocation) {
      toast({ title: "場所を選んでください", description: "住所検索・現在地・地図タップで地点を指定できます。", variant: "destructive" });
      return;
    }
    setIsSuspiciousSubmitting(true);
    try {
      const radius = resolveAlertRadius(payload.radiusM);
      const memo = payload.memo?.trim() ?? "";
      const reportPayload: DangerReportSubmitPayload = {
        title: memo ? memo.slice(0, 40) : "不審者情報",
        description: memo || null,
        danger_type: SUSPICIOUS_DANGER_TYPE,
        danger_level: 4,
        alert_radius_m: radius,
        status: "pending",
        ai_moderation_status: "pending",
        originalImageFile: payload.originalImageFile ?? null,
      };

      const { reportId } = await handleReportSubmit(reportPayload, {
        suppressPreview: true,
        suppressSuccessToast: true,
      });

      const moderationResponse = await fetch("/api/suspicious-alert/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });

      type ModerationResponseBody = {
        verdict?: { status?: string; reason?: string; score?: number }
        report?: DangerReport
        error?: string
      };
      const moderationBody = (await moderationResponse.json().catch(() => ({}))) as ModerationResponseBody;

      if (!moderationResponse.ok || !moderationBody.verdict || !moderationBody.report) {
        console.error("AI一次審査に失敗しました:", moderationBody.error ?? moderationResponse.statusText);
        toast({
          title: "アラートを受け付けました",
          description: "自動審査に失敗したため、内容確認のうえ公開されます（あなたの地図には表示中）。",
        });
      } else if (moderationBody.verdict.status === "approved") {
        setPendingReports((prev) => prev.filter((r) => r.id !== reportId));
        setDangerReports((prev) => [
          moderationBody.report as DangerReport,
          ...prev.filter((r) => r.id !== reportId),
        ]);
        toast({
          title: "アラートを地図に公開しました",
          description: "危険エリアを全員の地図に表示しています。",
        });
      } else {
        setPendingReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, ...(moderationBody.report as DangerReport) } : r)),
        );
        toast({
          title: "アラートを受け付けました",
          description: "内容確認のうえ公開されます（あなたの地図には表示中）。",
        });
      }

      // 円全体が見えるようにフィットしてフォームを閉じる
      const bounds = getAlertFitBounds(selectedLocation, radius);
      if (bounds && map.current) {
        try {
          map.current.fitBounds(bounds as any, { padding: 80, maxZoom: 17 });
        } catch (e) {
          console.error("fitBounds after submit failed", e);
        }
      }
      setIsSuspiciousAlertOpen(false);
      setIsSuspiciousVisible(true); // 投稿直後は自分のアラートを地図に表示したままにする
      setAlertFocusedId(reportId ?? null);
      setSelectedLocation(null);
      setLocationSelectionSource(null);
      if (suspiciousMarkerRef.current) {
        suspiciousMarkerRef.current.remove();
        suspiciousMarkerRef.current = null;
      }
    } catch (error) {
      console.error("不審者アラートの送信に失敗しました:", error);
      // handleReportSubmit 側でエラートーストは表示済み
    } finally {
      setIsSuspiciousSubmitting(false);
    }
  };

  const handleSidebarReportSelect = (report: DangerReport) => {
    setSelectedReport(report);
    setIsDetailModalOpen(true);
    if (map.current) flyToLocation(report.longitude, report.latitude);
    // モバイルではサイドバーを閉じる
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // --- ▼▼▼ レポート削除処理関数 ▼▼▼ ---
  const handleDeleteReport = async (reportId: string) => {
    if (!supabase) return;

    const reportToDelete = dangerReports.find(r => r.id === reportId) || pendingReports.find(r => r.id === reportId);
    if (!reportToDelete) return; // 対象が見つからない場合は何もしない

    // DB側のRLS（danger_reports_delete）は「管理者」または「本人のpendingレポート」のみ削除を許可している。
    // UIの許可条件をそれに合わせておく（不一致だとボタンは出るのにDBで弾かれる、という事態を防ぐ）。
    const isOwnReport = currentUserId != null && reportToDelete.user_id === currentUserId;
    const canDelete = isAdmin || (isOwnReport && reportToDelete.status === 'pending');

    if (!canDelete) {
      toast({
        title: "権限エラー",
        description: isOwnReport
          ? "審査中（pending）の投稿のみ削除できます。"
          : "レポートの削除権限がありません。",
        variant: "destructive",
      });
      return;
    }

    const confirmationMessage = `以下のレポートを削除しますか？\n\nID: ${reportId}\nタイトル: ${reportToDelete.title}\n\nこの操作は元に戻せません。`; // シンプルなメッセージに変更
    if (!window.confirm(confirmationMessage)) {
      return; // キャンセルされたら何もしない
    }

    try {
      setIsLoading(true); // 処理中の表示

      // 1. DBからレポートを削除
      const { error: deleteError } = await supabase
        .from('danger_reports')
        .delete()
        .eq('id', reportId);

      if (deleteError) throw deleteError;

      // 2. 関連する画像をストレージから削除する（ベストエフォート。失敗してもDB削除自体は成功扱い）
      let storageDeleteFailed = false;
      const imageUrls = [reportToDelete.image_url, ...(reportToDelete.processed_image_urls ?? [])].filter(
        (url): url is string => Boolean(url),
      );
      if (imageUrls.length > 0) {
        const storagePaths = imageUrls
          .map((url) => extractStoragePathFromPublicUrl(url, 'danger-reports'))
          .filter((path): path is string => Boolean(path));

        if (storagePaths.length > 0) {
          const { error: storageError } = await supabase.storage.from('danger-reports').remove(storagePaths);
          if (storageError) {
            console.error("Error deleting report images from storage:", storageError);
            storageDeleteFailed = true;
          }
        }
      }

      toast({
        title: "削除成功",
        description: storageDeleteFailed
          ? `レポート (ID: ${reportId}) を削除しました。（画像の削除は一部失敗しました）`
          : `レポート (ID: ${reportId}) を削除しました。`,
      });

      // 3. ローカルの state を更新
      setDangerReports(prev => prev.filter(report => report.id !== reportId));
      setPendingReports(prev => prev.filter(report => report.id !== reportId));

      // 4. (任意) 選択中のレポートだったら選択解除
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
        setIsDetailModalOpen(false);
      }

    } catch (error: any) {
      console.error("Error deleting report:", error);
      toast({ title: "削除エラー", description: `レポートの削除中にエラーが発生しました: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  // --- ▲▲▲ レポート削除処理関数 ▲▲▲ ---

  // --- ▼▼▼ 報告ボタンクリック時のハンドラーを MapHeader に渡すための関数 ▼▼▼ ---
  const handleAddReportClick = () => {
    setIsReportFormOpen(false); // フォームを一旦閉じる
    setSubmittedReport(null); // 送信済みプレビューもクリア
    setSelectedLocation(null); // 選択地点もクリア
    setLocationSelectionSource(null);

    if (isMobile) {
      if (awaitingLocationSelection) {
        // すでに地点選択モードなら解除
        setAwaitingLocationSelection(false);
        toast({ title: "地点選択をキャンセルしました" });
        console.log("Location selection cancelled by user.");
      } else {
        // 地点選択モードを開始(案内は下部の確認バーが担うためトーストは出さない)
        setAwaitingLocationSelection(true);
        console.log("Awaiting location selection... (mobile)");
        // この時点ではフォームは開かない
      }
    } else {
      // デスクトップ: フォームを直接開く
      setAwaitingLocationSelection(false);
      setIsReportFormOpen(true);
      console.log("Opening report form directly (desktop).");
    }
  };
  // --- ▲▲▲ ---

  // --- ▼▼▼ 現在地で報告ハンドラー ▼▼▼ ---
  const handleReportAtCurrentLocation = useCallback(() => {
    gpsConsumedRef.current = false
    resetGPSLocation()
    requestGPSLocation()
  }, [resetGPSLocation, requestGPSLocation])

  // GPS位置取得成功時: 地図を移動してフォームを開く
  useEffect(() => {
    if (!gpsLocation || gpsConsumedRef.current) return
    if (!isValidCoordinates(gpsLocation[1], gpsLocation[0])) {
      resetGPSLocation()
      toast({
        title: "位置情報エラー",
        description: "現在地の座標が不正です。再取得してください。",
        variant: "destructive",
      })
      return
    }

    gpsConsumedRef.current = true

    setSelectedLocation(gpsLocation)
    setLocationSelectionSource("gps")
    flyToLocation(gpsLocation[0], gpsLocation[1], 16)
    setAwaitingLocationSelection(false)
    setIsReportFormOpen(true)
    resetGPSLocation()

    toast({
      title: "現在地を候補として設定しました",
      description: "現在地は端末の推定値です。地図で確認・調整してから報告してください。",
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsLocation])
  // --- ▲▲▲ 現在地で報告ハンドラー ▲▲▲ ---

  const mapDisplayOverlayOptions = useMemo(
    () =>
      buildMapDisplayOverlayOptions({
        isHeatmapVisible: accidentHeatmap.isVisible,
        isFloodVisible: hazardLayerVisibility.flood,
        isTsunamiVisible: hazardLayerVisibility.tsunami,
        isSuspiciousVisible: isSuspiciousVisible,
        onToggleHeatmap: accidentHeatmap.toggleVisibility,
        onToggleFlood: () => handleHazardLayerToggle("flood", !hazardLayerVisibility.flood),
        onToggleTsunami: () => handleHazardLayerToggle("tsunami", !hazardLayerVisibility.tsunami),
        onToggleSuspicious: () => setIsSuspiciousVisible((v) => !v),
      }),
    [
      accidentHeatmap.isVisible,
      accidentHeatmap.toggleVisibility,
      handleHazardLayerToggle,
      hazardLayerVisibility.flood,
      hazardLayerVisibility.tsunami,
      isSuspiciousVisible,
    ],
  )

  // --- Render ---
  return (
    <div className="fullscreen-map-container">
      {/* メインマップエリア */}
      <div className="relative w-full h-full">
        {/* フローティングコントロール */}
        <MapFloatingControls
          onAddReport={handleAddReportClick}
          isReportFormOpen={isReportFormOpen}
          mapStyle={mapStyle}
          setMapStyle={setMapStyle}
          is3DEnabled={is3DEnabled}
          toggle3DMode={toggle3DMode}
          isSelectingLocation={isMobile && awaitingLocationSelection}
          onToggleAR={toggleARMode}
          isARMode={isARMode}
          onToggleSidebar={toggleSidebar}
          isMobile={isMobile}
          onReportAtCurrentLocation={handleReportAtCurrentLocation}
          isAcquiringGPS={isAcquiringGPS}
          onToggleHeatmap={accidentHeatmap.toggleVisibility}
          isHeatmapVisible={accidentHeatmap.isVisible}
          displayOverlayOptions={mapDisplayOverlayOptions}
        />

        {!awaitingLocationSelection && (
          <MapTopOverlay
            activePanel={activeTopPanel}
            is3DEnabled={is3DEnabled}
            isARMode={isARMode}
            isHeatmapVisible={accidentHeatmap.isVisible}
            isSuspiciousVisible={isSuspiciousVisible}
            onPanelChange={setActiveTopPanel}
            onToggle3D={toggle3DMode}
            onToggleAR={toggleARMode}
            onToggleHeatmap={accidentHeatmap.toggleVisibility}
            onToggleSuspicious={() => setIsSuspiciousVisible((v) => !v)}
            searchSlot={
              <MapSearch
                map={map.current}
                dismissResultsSignal={dismissSearchResultsSignal}
                className="rounded-[1.75rem]"
                inputClassName="h-14 border-0 bg-transparent pl-5 pr-12 text-base shadow-none focus-visible:ring-0"
                onSelectLocation={(coords) => {
                  if (isReportFormOpen) {
                    setSelectedLocation(coords)
                    setLocationSelectionSource("manual")
                    flyToLocation(coords[0], coords[1])
                  }
                }}
              />
            }
            threeDPanelSlot={
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">3D表示</p>
                  <p className="text-xs text-slate-500">建物と地形を立体表示して周辺の見通しを確認できます。</p>
                </div>
                <Map3DToggle
                  is3DEnabled={is3DEnabled}
                  onToggle={toggle3DMode}
                  className="h-11 w-full justify-center border border-slate-200 bg-white"
                />
              </div>
            }
            arPanelSlot={
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">AR表示</p>
                  <p className="text-xs text-slate-500">周辺の危険報告を現地視点で重ねて確認できます。</p>
                </div>
                <Button
                  type="button"
                  variant={isARMode ? "default" : "outline"}
                  className="h-11 w-full justify-center"
                  onClick={toggleARMode}
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
                    variant={isARMode && activeARKind === "parent_child_route" ? "default" : "outline"}
                    className="mt-3 h-11 w-full justify-center"
                    onClick={handleOpenParentChildARMode}
                    disabled={!selectedUserRoute}
                  >
                    親子で通学路確認
                  </Button>
                  {!selectedUserRoute && (
                    <p className="mt-2 text-xs text-amber-700">先に通学路を選択してください。</p>
                  )}
                </div>
              </div>
            }
            heatmapPanelSlot={
              <AccidentHeatmapControls
                filters={accidentHeatmap.filters}
                onFiltersChange={accidentHeatmap.setFilters}
                isVisible={accidentHeatmap.isVisible}
                onToggleVisibility={accidentHeatmap.toggleVisibility}
                isLoading={accidentHeatmap.isLoading}
                featureCount={accidentHeatmap.featureCount}
                error={accidentHeatmap.error}
                isMobile={false}
              />
            }
            hazardPanelSlot={
              <RouteHazardPanel
                routes={userRoutes}
                selectedRouteId={selectedUserRouteId}
                selectedHazardsCount={visibleRouteHazards.length}
                summary={selectedUserRouteId ? routeSafetySummary : undefined}
                evidenceItems={selectedUserRouteId ? routeSafetyEvidenceItems : []}
                hazards={visibleRouteHazards}
                toggles={hazardLayerVisibility}
                isLoading={isRouteHazardsLoading}
                onRouteChange={handleRouteSelectionChange}
                onToggleChange={handleHazardLayerToggle}
                onHazardSelect={handleRouteHazardSelect}
                variant="inline"
              />
            }
            suspiciousPanelSlot={
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
                  onClick={() => setIsSuspiciousVisible((v) => !v)}
                >
                  {isSuspiciousVisible ? "地図から非表示にする" : "地図に表示する"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center"
                  onClick={() => {
                    setActiveTopPanel(null)
                    setIsSuspiciousVisible(true)
                    setIsSuspiciousAlertOpen(true)
                  }}
                >
                  <UserX className="mr-2 h-4 w-4 text-orange-600" />
                  不審者アラートを投稿
                </Button>
                {suspiciousAlertReports.length === 0 && (
                  <p className="text-xs text-slate-400">
                    まだ不審者情報がありません。「不審者アラートを投稿」から登録できます。
                  </p>
                )}
              </div>
            }
          />
        )}

        {routeHazardError && (
          <div
            className={`absolute left-3 z-20 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-red-200 bg-white/95 px-4 py-3 text-sm text-red-600 shadow-lg backdrop-blur-sm ${
              isMobile
                ? "top-[calc(env(safe-area-inset-top,0px)+12.5rem)]"
                : "top-[calc(env(safe-area-inset-top,0px)+24rem)]"
            }`}
          >
            {routeHazardError}
          </div>
        )}

        {/* 事故統計パネル - 地図クリック時に表示 */}
        {clickedLocationStatsStatus !== 'idle' && !awaitingLocationSelection && !isReportFormOpen && (
          <div className={`absolute z-40 ${
            isMobile
              ? 'bottom-4 left-4 right-4 max-h-[60vh]'
              : 'top-24 right-4 w-96 max-h-[calc(100vh-8rem)]'
          } overflow-y-auto`}>
            {clickedLocationStatsStatus === 'loading' && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-lg">
                <div className="flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="ml-3 text-gray-600">事故統計を取得中...</span>
                </div>
              </div>
            )}
            {clickedLocationStatsStatus === 'error' && (
              <div className="bg-white rounded-xl border border-red-200 p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-red-600 font-medium">事故統計の取得に失敗しました</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetClickedLocationStats}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {clickedLocationStatsStatus === 'loaded' && clickedLocationStats && (
              <div className="relative bg-white rounded-xl shadow-lg border border-gray-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetClickedLocationStats}
                  className="absolute top-2 right-2 z-20 h-8 w-8 p-0 bg-white/90 hover:bg-white"
                >
                  <X className="h-4 w-4" />
                </Button>
                <AccidentStatsPanel stats={clickedLocationStats} mode="full" />
              </div>
            )}
          </div>
        )}

        {/* Sidebar (フローティング) */}
        <div className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ${!isSidebarOpen ? '-translate-x-full' : ''}`}>
          <MapSidebar
            dangerReports={dangerReports}
            pendingReports={pendingReports}
            isLoading={isLoading}
            selectedReport={selectedReport}
            onFilterChange={handleFilterChange}
            filterOptions={filterOptions}
            onReportSelect={handleSidebarReportSelect}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onDeleteReport={handleDeleteReport}
            isMobile={isMobile}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>

        {/* サイドバーが開いている時のオーバーレイ */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Map Canvas (フルスクリーン) */}
        <div
          ref={mapContainer}
          className="absolute inset-0 w-full h-full"
          style={{ minHeight: mapMinHeight }}
          onPointerDownCapture={() => {
            if (showMobileMapHint) setShowMobileMapHint(false);
          }}
        />

        {/* 事故ヒートマップレイヤー */}
        <AccidentHeatmapLayer
          map={map.current}
          geoJSON={accidentHeatmap.geoJSON}
          isVisible={accidentHeatmap.isVisible}
        />

        {/* 不審者アラート 危険エリア円レイヤー（「表示」パネルのトグル。入力中は常に表示してプレビュー） */}
        <SuspiciousAlertLayer
          map={map.current}
          reports={suspiciousAlertReports}
          isVisible={isSuspiciousVisible || isSuspiciousAlertOpen}
          focusedId={alertFocusedId}
        />

        {/* 不審者アラート 専用入力フォーム（モバイル/タブレットはボトムナビの上／デスクトップ右） */}
        {/* ボトムナビ（navigation.tsx の fixed bottom-0 z-50, h-20, md:hidden）に重ならないよう
            md 未満では下端をナビ高さ分（約5rem＋safe-area）持ち上げる。md 以上はナビが消えるため右下に配置。 */}
        {isSuspiciousAlertOpen && (
          <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-[60] px-3 md:inset-x-auto md:bottom-4 md:right-4 md:w-[24rem] md:px-0">
            <div className="max-h-[70dvh] overflow-y-auto overscroll-contain rounded-2xl border border-orange-100 bg-white p-4 shadow-2xl">
              <SuspiciousAlertForm
                selectedLocation={selectedLocation}
                onLocationPick={(coords) => {
                  // カメラ寄せは draft effect の fitBounds に任せる（二重移動を避ける）
                  setSelectedLocation(coords);
                  setLocationSelectionSource("manual");
                }}
                onRadiusChange={(radiusM) => setAlertDraftRadius(radiusM)}
                onSubmit={handleSuspiciousAlertSubmit}
                onCancel={() => {
                  setIsSuspiciousAlertOpen(false);
                  setAlertFocusedId(null);
                  if (suspiciousMarkerRef.current) {
                    suspiciousMarkerRef.current.remove();
                    suspiciousMarkerRef.current = null;
                  }
                }}
                isSubmitting={isSuspiciousSubmitting}
              />
            </div>
          </div>
        )}

        {/* モバイルマップヒント */}
        {showMobileMapHint && (
          <div
            className="absolute left-1/2 z-10 sm:hidden pointer-events-none -translate-x-1/2 top-[calc(env(safe-area-inset-top,0px)+6.75rem)]"
          >
            <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-blue-100/80 text-blue-700 text-xs font-medium pointer-events-auto">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span>ここが地図エリアです</span>
              <button
                type="button"
                onClick={() => setShowMobileMapHint(false)}
                className="ml-1 text-blue-500 hover:text-blue-700 focus:outline-none"
                aria-label="地図エリアのヒントを閉じる"
              >
                ×
              </button>
            </div>
          </div>
        )}
          {/* Map Overlays: Selection Info, Error, Loading */}
          {isReportFormOpen && (
            <div className="absolute top-20 left-0 right-0 z-10 px-4 py-2 flex justify-center pointer-events-none">
              <div
                className="pointer-events-auto rounded-full border px-4 py-2"
                style={{
                  background: "rgba(255,253,247,.95)",
                  borderColor: "rgba(67,57,43,.12)",
                  boxShadow: "0 1px 0 rgba(67,57,43,.05), 0 10px 26px -14px rgba(67,57,43,.45)",
                  fontFamily: 'var(--font-app, "Zen Maru Gothic"), sans-serif',
                }}
              >
                <p className="text-sm font-black" style={{ color: "#0C7A55" }}>
                  {selectedLocation ? "ばしょは えらんだよ。ちずを クリックすると かえられるよ" : "ちずを クリックして ばしょを えらんでね"}
                </p>
              </div>
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-30">
              <div className="max-w-md p-4 bg-white rounded-lg shadow-lg text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">マップエラー</h3>
                <p>{mapError}</p>
                <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>再読み込み</Button>
              </div>
            </div>
          )}
          {isLoading && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-30">
              <div className="p-4 bg-white rounded-lg shadow-lg text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p>読み込み中...</p>
              </div>
            </div>
          )}
          {/* Report Form - デスクトップ用（サイドパネル形式） */}
          {isReportFormOpen && !isMobile && (
            <div
              className="absolute bottom-4 right-4 z-60 max-h-[calc(100vh-10rem)] w-96 overflow-y-auto overflow-x-hidden rounded-[24px] border paper-surface"
              style={{ borderColor: "rgba(67,57,43,.14)", boxShadow: "0 2px 0 rgba(67,57,43,.08), 0 30px 60px -30px rgba(67,57,43,.55)" }}
            >
              <DangerReportForm
                onSubmit={handleReportSubmit}
                onCancel={() => setIsReportFormOpen(false)}
                selectedLocation={selectedLocation}
                locationSource={locationSelectionSource}
                selectedRouteId={selectedUserRoute?.id ?? null}
                selectedRouteName={selectedUserRoute?.name ?? null}
              />
            </div>
          )}

          {/* Report Form - モバイル用（フルスクリーンモーダル）- Portal経由でbodyに直接レンダリング */}
          {isReportFormOpen && isMobile && createPortal(
            <div className="fixed inset-0 z-[60] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden paper-surface mobile-fullscreen-form">
              {/* モバイルフォームヘッダー */}
              <div
                className="safe-area-top flex flex-shrink-0 items-center justify-between border-b px-3 py-2.5"
                style={{ borderColor: "rgba(67,57,43,.1)", fontFamily: 'var(--font-app, "Zen Maru Gothic"), sans-serif' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsReportFormOpen(false);
                    // 地点選択モードに戻す
                    setAwaitingLocationSelection(true);
                  }}
                  className="chunky-press inline-flex min-h-[40px] items-center gap-1 rounded-full border-2 bg-white px-3 text-[12.5px] font-black"
                  style={{ borderColor: "rgba(67,57,43,.14)", color: "#0C7A55", boxShadow: "0 3px 0 rgba(67,57,43,.16)" }}
                >
                  <MapPin className="h-4 w-4" strokeWidth={2.6} />
                  地点を変更
                </button>
                <h2 className="text-[16px] font-black" style={{ color: "#43392B" }}>きけんを おしらせ</h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsReportFormOpen(false);
                    setSelectedLocation(null);
                    setLocationSelectionSource(null);
                    if (selectionMarker.current) {
                      selectionMarker.current.remove();
                      selectionMarker.current = null;
                    }
                  }}
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
                  onSubmit={handleReportSubmit}
                  onCancel={() => {
                    setIsReportFormOpen(false);
                    setSelectedLocation(null);
                    setLocationSelectionSource(null);
                    if (selectionMarker.current) {
                      selectionMarker.current.remove();
                      selectionMarker.current = null;
                    }
                  }}
                  selectedLocation={selectedLocation}
                  locationSource={locationSelectionSource}
                  selectedRouteId={selectedUserRoute?.id ?? null}
                  selectedRouteName={selectedUserRoute?.name ?? null}
                  isMobileFullscreen={true}
                />
              </div>
            </div>,
            document.body
          )}
          {/* --- ▼▼▼ モバイル用地点選択UI（ボトムシート）- Portal経由でbodyに直接レンダリング ▼▼▼ --- */}
          {isMobile && awaitingLocationSelection && createPortal(
            <div style={{ fontFamily: 'var(--font-app, "Zen Maru Gothic"), sans-serif' }}>
              {/* 案内は下部の確認バーに一本化(上部ピルとの二重案内を避ける) */}
              {/* 下部の確認バー - ナビゲーションバーの上に固定表示 */}
              <div className="fixed bottom-0 left-0 right-0 z-[60] mobile-bottom-bar">
                <div
                  className="rounded-t-[26px] border-t paper-surface"
                  style={{ borderColor: "rgba(67,57,43,.12)", boxShadow: "0 -2px 0 rgba(67,57,43,.05), 0 -18px 40px -20px rgba(67,57,43,.5)" }}
                >
                  {selectedLocation ? (
                    <div className="px-4 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
                      <div className="mb-4 flex items-center gap-3">
                        <div
                          className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full border-2 bg-white"
                          style={{ borderColor: "rgba(21,158,114,.4)" }}
                        >
                          <MapPin className="h-5 w-5" style={{ color: "#159E72" }} strokeWidth={2.6} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15.5px] font-black" style={{ color: "#43392B" }}>ここに ピンを たてたよ！</p>
                          <p className="text-[12px] font-bold" style={{ color: "#847661" }}>
                            この ばしょで よければ すすんでね
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAwaitingLocationSelection(false);
                            setSelectedLocation(null);
                            setLocationSelectionSource(null);
                            if (selectionMarker.current) {
                              selectionMarker.current.remove();
                              selectionMarker.current = null;
                            }
                            toast({ title: "ばしょえらびを やめたよ" });
                          }}
                          className="chunky-press h-[52px] flex-1 rounded-full border-2 bg-white text-[14px] font-black"
                          style={{ borderColor: "rgba(67,57,43,.14)", color: "#847661", boxShadow: "0 3px 0 rgba(67,57,43,.16)" }}
                        >
                          やめる
                        </button>
                        <button
                          type="button"
                          data-testid="confirm-location-button"
                          onClick={() => {
                            setAwaitingLocationSelection(false);
                            setIsReportFormOpen(true);
                          }}
                          className="chunky-press h-[52px] flex-[2] rounded-full border-2 text-[15px] font-black text-white"
                          style={{ background: "#159E72", borderColor: "rgba(67,57,43,.18)", boxShadow: "0 4px 0 #0C7A55" }}
                        >
                          ここで おしらせを かく
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#F4801F" }}></span>
                          <p className="text-[13px] font-bold" style={{ color: "#847661" }}>ちずを タップして ばしょを えらんでね</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAwaitingLocationSelection(false);
                            toast({ title: "ばしょえらびを やめたよ" });
                          }}
                          className="h-10 rounded-full px-4 text-[13px] font-black"
                          style={{ color: "#847661" }}
                        >
                          やめる
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
          {/* --- ▲▲▲ モバイル用地点選択UI ▲▲▲ --- */}
          

        {/* Dialogs and Modals */}
        <ImagePreviewDialog isOpen={!!previewImage} imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
        <DangerReportDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          report={selectedReport}
          isAdmin={isAdmin}
          onAccidentNavigate={(coords) => {
            if (!isValidCoordinates(coords[1], coords[0])) {
              toast({
                title: "事故位置データエラー",
                description: "事故位置座標が不正なため地図に移動できません。",
                variant: "destructive",
              })
              return
            }
            setIsDetailModalOpen(false)
            flyToLocation(coords[0], coords[1], 17)
            showTemporaryAccidentMarker(coords)
          }}
          onShowImage={(url, coords, options) => {
            try {
              const targetReport = options?.reportId
                ? combinedReports.find((report) => report.id === options.reportId) ?? selectedReport ?? null
                : selectedReport

              const overlayCoords =
                coords ??
                (targetReport ? ([targetReport.longitude, targetReport.latitude] as [number, number]) : undefined)

              if (overlayCoords) {
                flyToLocation(overlayCoords[0], overlayCoords[1], 16)
              } else {
                console.warn("Unable to display image overlay because coordinates are missing.")
                return
              }

              const inferredType =
                options?.type ?? (targetReport?.processed_image_urls?.includes(url) ? "processed" : "original")
              const derivedIndex =
                inferredType === "processed"
                  ? typeof options?.index === "number"
                    ? options.index
                    : targetReport?.processed_image_urls?.findIndex((imageUrl) => imageUrl === url)
                  : undefined

              const overlayIdParts = [
                options?.reportId ?? targetReport?.id ?? "overlay",
                inferredType ?? "image",
                typeof derivedIndex === "number" && derivedIndex >= 0 ? `${derivedIndex}` : "original",
                url,
              ]
              const overlayId = overlayIdParts.filter(Boolean).join(":")

              setMapImageOverlays((prev) => {
                const nextEntry: MapImageOverlayEntry = {
                  id: overlayId,
                  url,
                  reportId: options?.reportId ?? targetReport?.id ?? undefined,
                  reportTitle: options?.reportTitle ?? targetReport?.title ?? null,
                  type: inferredType,
                  index: typeof derivedIndex === "number" && derivedIndex >= 0 ? derivedIndex : undefined,
                  coordinates: overlayCoords,
                  hasError: false,
                }

                const existingIndex = prev.findIndex((entry) => entry.id === overlayId)
                if (existingIndex !== -1) {
                  const next = [...prev]
                  next[existingIndex] = nextEntry
                  return next
                }

                return [...prev, nextEntry]
              })

              setPreviewImage(null)
            } catch (e) {
              console.error('Failed to show image on map:', e)
            }
          }}
        />
        <SubmittedReportPreview
          isOpen={isSubmittedPreviewOpen}
          onClose={() => { setIsSubmittedPreviewOpen(false); setSubmittedReport(null); }}
          originalImage={submittedReport?.originalImage ?? null}
          processedImages={submittedReport?.processedImages ?? []}
          shareCard={
            submittedReport
              ? {
                  title: submittedReport.title,
                  summary: submittedReport.summary,
                  action: submittedReport.action,
                  mapLabel: submittedReport.mapLabel,
                  imageUrl: submittedReport.processedImages[0] ?? submittedReport.originalImage ?? null,
                }
              : null
          }
        />
        {/* ARビュー */}
        {isARMode && (
          <ARView
            mode={
              activeARKind === "parent_child_route" && selectedUserRoute
                ? {
                    kind: "parent_child_route",
                    routeId: selectedUserRoute.id,
                    routeName: selectedUserRoute.name,
                    childId: selectedUserRoute.child_id,
                    childName: selectedUserRoute.child_name,
                    reports: routeDangers,
                    sessionId: "active",
                  }
                : {
                    kind: "nearby",
                    reports: combinedReports,
                  }
            }
            onClose={() => setIsARMode(false)}
          />
        )}
        <HazardImageModal
          open={isHazardModalOpen}
          marker={activeHazardMarker}
          imageResult={hazardImageResult}
          imageError={hazardImageError}
          isLoading={isHazardImageLoading}
          selectedScenarioKey={selectedHazardScenarioKey}
          onOpenChange={(open) => {
            setIsHazardModalOpen(open)
            if (!open) {
              setHazardImageError(null)
            }
          }}
          onScenarioChange={(scenarioKey) => {
            setSelectedHazardScenarioKey(scenarioKey)
            setHazardImageResult(null)
            setHazardImageError(null)
          }}
          onGenerate={handleGenerateHazardImage}
        />
      </div>
    </div>
  )
}
