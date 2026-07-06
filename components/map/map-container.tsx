"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useSupabase } from "@/components/providers/supabase-provider"
import MapFloatingControls from "./map-floating-controls"
import MapSidebar from "./map-sidebar"
import type { DangerReport } from "@/lib/types"
import MapSearch from "./map-search"
import ImagePreviewDialog from "../danger-report/image-preview-dialog"
import DangerReportDetailModal from "../danger-report/danger-report-detail-modal" // 以前の履歴から推測
import { useToast } from "@/components/ui/use-toast"
import SubmittedReportPreview from "../danger-report/submitted-report-preview"
import { useMediaQuery } from "@/hooks/use-media-query"
import { getMapboxToken, validateMapboxToken } from "@/lib/mapbox-config"
import ARView from "./ar-view"
import { useCurrentLocation } from "@/hooks/use-current-location"
import { useInitialMapView } from "@/hooks/use-initial-map-view"
import { CURRENT_LOCATION_ZOOM } from "@/lib/map-center"
import { isValidCoordinates } from "@/lib/coordinates"
import { useEventCallback } from "@/hooks/use-event-callback"
import { useAdminStatus } from "@/hooks/use-admin-status"
import { useDangerReports, type DangerReportBounds } from "@/hooks/use-danger-reports"
import { useDangerReportSubmit, type SubmittedReportState } from "@/hooks/use-danger-report-submit"
import { useMapImageOverlays, type MapImageOverlayEntry } from "@/hooks/use-map-image-overlays"
import { useDangerMarkers } from "@/hooks/use-danger-markers"
import { AccidentStatsOverlay } from "@/components/map/accident-stats-overlay"
import { MapReportForms } from "@/components/map/map-report-forms"
import { MobileLocationSheet } from "@/components/map/mobile-location-sheet"
import { MapStatusOverlays } from "@/components/map/map-status-overlays"
import { useMap3DMode } from "@/hooks/use-map-3d-mode"
import { useHazardTileLayers } from "@/hooks/use-hazard-tile-layers"
import { useSelectedRouteLayer } from "@/hooks/use-selected-route-layer"
import { useRouteHazards } from "@/hooks/use-route-hazards"
import { useRouteHazardMarkers } from "@/hooks/use-route-hazard-markers"
import { useDeleteDangerReport } from "@/hooks/use-delete-danger-report"
import { useSuspiciousAlert } from "@/hooks/use-suspicious-alert"
import {
  ThreeDPanelContent,
  ARPanelContent,
  SuspiciousPanelContent,
} from "@/components/map/map-top-overlay-panels"
import { useAccidentHeatmap } from "@/hooks/use-accident-heatmap"
import { AccidentHeatmapLayer } from "./accident-heatmap-layer"
import { AccidentHeatmapControls } from "./accident-heatmap-controls"
import { useAccidentStats } from "@/hooks/use-accident-stats"
import { useRouteDangers } from "@/hooks/use-route-dangers"
import { useUserRoutes } from "@/hooks/use-user-routes"
import { RouteHazardPanel } from "@/components/map/route-hazard-panel"
import { HazardImageModal } from "@/components/map/hazard-image-modal"
import { classifyMapboxError } from "@/lib/mapbox-error-utils"
import { shouldShowMapNavigationControl, syncMapNavigationControl } from "@/lib/mapbox-controls"
import { localizeMapLabels } from "@/lib/hunter/map-labels"
import { buildRouteSafetySummary } from "@/lib/safety-scoring/route-safety-scorer"
import { buildRouteSafetyEvidenceItems } from "@/lib/safety-scoring/route-safety-scorer"
import type { HazardImageResult, HazardType, RouteHazardMarker, UserRoute } from "@/lib/types"
import MapTopOverlay, { type MapTopOverlayPanel } from "@/components/map/map-top-overlay"
import { dismissTransientMapUi } from "@/lib/map-overlay-ui"
import { buildMapDisplayOverlayOptions } from "@/lib/map-display-options"
import { SuspiciousAlertLayer } from "./suspicious-alert-layer"
import SuspiciousAlertForm from "../danger-report/suspicious-alert-form"
import { getStoredRegion, setStoredRegion } from "@/lib/user-region"

// Mapboxのアクセストークンを設定
const mapboxToken = getMapboxToken()
const tokenValidation = validateMapboxToken()

if (!tokenValidation.isValid) {
  console.error("Mapbox token validation failed:", tokenValidation.error)
}

mapboxgl.accessToken = mapboxToken || ""

// --- 型定義 ---
// SubmittedReportState / MapImageOverlayEntry はそれぞれ hooks/use-danger-report-submit.ts /
// hooks/use-map-image-overlays.tsx へ移動（import 済み）

type LocationSelectionSource = "manual" | "gps" | null
type ActiveARKind = "nearby" | "parent_child_route"

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
    prefecture: getStoredRegion(),
  })
  // 地図の現在の表示範囲（bbox）。大量報告時に全件取得しないための絞り込みに使う。
  const [mapBounds, setMapBounds] = useState<DangerReportBounds | null>(null)
  const boundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dangerReportsFilterOptions = useMemo(
    () => ({ ...filterOptions, bounds: mapBounds }),
    [filterOptions, mapBounds],
  )
  // 危険レポート取得（公開済み＋自分の pending）。挙動はそのままフックへ抽出。
  const {
    dangerReports,
    pendingReports,
    setDangerReports,
    setPendingReports,
  } = useDangerReports({ supabase, filterOptions: dangerReportsFilterOptions, toast, setIsLoading })
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapStyle, setMapStyle] = useState("streets-v12")
  const [isARMode, setIsARMode] = useState(false)
  const [activeARKind, setActiveARKind] = useState<ActiveARKind>("nearby")
  const [activeTopPanel, setActiveTopPanel] = useState<MapTopOverlayPanel>(null)
  const [dismissSearchResultsSignal, setDismissSearchResultsSignal] = useState(0)
  const mapInitialized = useRef(false)
  const navigationControlRef = useRef<mapboxgl.NavigationControl | null>(null)
  const selectionMarker = useRef<mapboxgl.Marker | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false) // ReportDetailModal 用
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // モバイルでのサイドバー表示状態
  const clickListenerAdded = useRef(false)
  const styleChangeInProgress = useRef(false)
  const mapClickHandler = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null)
  const accidentMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const accidentMarkerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 3D表示（terrain/sky/pitch）の切り替え。挙動はそのままフックへ抽出。
  const { is3DEnabled, toggle3DMode, enable3DMode, disable3DMode } = useMap3DMode({
    mapRef: map,
    styleChangeInProgressRef: styleChangeInProgress,
    setMapError,
  })

  const {
    routes: userRoutes,
    primaryRoute,
    isLoading: isUserRoutesLoading,
  } = useUserRoutes()
  // 初期表示センター（登録ルート → 現在地 → 東京フォールバックの優先順で決定）
  const {
    initialView: initialMapView,
    lateCurrentLocation,
  } = useInitialMapView({
    primaryRoute,
    routes: userRoutes,
    isRoutesLoading: Boolean(isUserRoutesLoading),
  })
  const lateLocationConsumedRef = useRef(false)
  const [selectedUserRouteId, setSelectedUserRouteId] = useState<string | null>(null)
  const [hazardLayerVisibility, setHazardLayerVisibility] = useState<Record<HazardType, boolean>>({
    flood: false,
    tsunami: false,
  })
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

  // 送信された報告の情報を保持する状態 (型を更新)
  const [submittedReport, setSubmittedReport] = useState<SubmittedReportState | null>(null)

  // 送信された報告のプレビューモーダルの状態
  const [isSubmittedPreviewOpen, setIsSubmittedPreviewOpen] = useState(false)

  // 管理者判定・ログインユーザーID取得（挙動はそのままフックへ抽出）
  const { isAdmin, currentUserId } = useAdminStatus(supabase)

  // --- ▼▼▼ モバイル判定と地点選択待ち state を追加 ▼▼▼ ---
  const isMobile = useMediaQuery("(max-width: 768px)"); // md ブレークポイント (Tailwind)
  const [awaitingLocationSelection, setAwaitingLocationSelection] = useState(false);

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
  // 地図上の画像プレビューポップアップ管理。挙動はそのままフックへ抽出。
  const {
    setMapImageOverlays,
    previewImage,
    setPreviewImage,
  } = useMapImageOverlays({ mapRef: map, supabase, combinedReports })
  const selectedUserRoute = useMemo<UserRoute | null>(() => {
    if (!selectedUserRouteId) return null
    return userRoutes.find((route) => route.id === selectedUserRouteId) ?? null
  }, [selectedUserRouteId, userRoutes])
  // 通学路ハザードのAPI取得。挙動はそのままフックへ抽出。
  const {
    routeHazards,
    isRouteHazardsLoading,
    routeHazardError,
    routeHazardsFetchedAt,
    setRouteHazardError,
    resetRouteHazards,
  } = useRouteHazards({ selectedUserRoute, hazardLayerVisibility })
  const visibleRouteHazards = useMemo(
    () => routeHazards.filter((hazard) => hazardLayerVisibility[hazard.hazard_type]),
    [hazardLayerVisibility, routeHazards],
  )
  // ハザードマーカーのポップアップから「災害イメージを見る」を開く
  const handleHazardDetailOpen = useCallback((hazard: RouteHazardMarker) => {
    setActiveHazardMarker(hazard)
    setSelectedHazardScenarioKey(hazard.scenario_key)
    setHazardImageResult(null)
    setHazardImageError(null)
    setIsHazardModalOpen(true)
  }, [])
  // ハザードのマーカー/ポップアップ描画、選択経路ライン、ハザードタイル。挙動はそのままフックへ抽出。
  const { clearRouteHazardMarkers, clearRouteHazardPopup } = useRouteHazardMarkers({
    mapRef: map,
    mapInitializedRef: mapInitialized,
    visibleRouteHazards,
    onHazardDetail: handleHazardDetailOpen,
  })
  useSelectedRouteLayer({
    mapRef: map,
    mapInitializedRef: mapInitialized,
    selectedUserRoute,
    mapStyleSyncToken,
  })
  useHazardTileLayers({
    mapRef: map,
    mapInitializedRef: mapInitialized,
    hazardLayerVisibility,
    mapStyleSyncToken,
  })
  // 危険レポート送信（INSERT →画像処理API →ポイント/プレビュー/state更新）。挙動はそのままフックへ抽出。
  // 不審者アラートフックからも使うため、利用箇所より前で生成する。
  const handleReportSubmit = useDangerReportSubmit({
    supabase,
    selectedLocation,
    selectedUserRoute,
    toast,
    setSubmittedReport,
    setIsSubmittedPreviewOpen,
    setPendingReports,
  })
  // 不審者アラートの地図フロー一式（表示トグル・?suspiciousAlert=1・ドラフト円・送信/AI審査反映）。
  // 挙動はそのままフックへ抽出。
  const {
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
  } = useSuspiciousAlert({
    mapRef: map,
    selectedLocation,
    setSelectedLocation,
    setLocationSelectionSource,
    dangerReports,
    pendingReports,
    setDangerReports,
    setPendingReports,
    submitDangerReport: handleReportSubmit,
    toast,
  })
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
    if (selectedUserRouteId) return

    if (preferredRouteId && userRoutes.some((route) => route.id === preferredRouteId)) {
      setSelectedUserRouteId(preferredRouteId)
      return
    }

    if (!primaryRoute) return
    setSelectedUserRouteId(primaryRoute.id)
  }, [preferredRouteId, primaryRoute, selectedUserRouteId, userRoutes])

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

  // --- ▼▼▼ handleMapClick（useEventCallback で常に最新 state を読む） ▼▼▼ ---
  // Mapbox へ一度だけ登録されても stale closure にならないよう useEventCallback 経由にする。
  const handleMapClick = useEventCallback((e: mapboxgl.MapMouseEvent) => {
    const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    console.log(`Map clicked at: ${coordinates}. isMobile=${isMobile}, awaitingLocationSelection=${awaitingLocationSelection}, isReportFormOpen=${isReportFormOpen}`);
    dismissTransientMapUi({
      setActiveTopPanel,
      setDismissSearchResultsSignal,
    })

    // 不審者アラート入力中は、地図クリックで中心点を指定する（プレビュー円・ピンは effect 側で更新）。
    // useEventCallback により常に最新の isSuspiciousAlertOpen を読むため、マップ初期化前に
    // フォームが開いた場合（?suspiciousAlert=1 直接遷移）でも確実に分岐する。
    if (isSuspiciousAlertOpen) {
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
  });
  // --- ▲▲▲ ---

  const addClickListener = () => {
    if (!map.current || clickListenerAdded.current) return;
    if (mapClickHandler.current) map.current.off("click", mapClickHandler.current);
    mapClickHandler.current = handleMapClick;
    map.current.on("click", mapClickHandler.current);
    clickListenerAdded.current = true;
  };

  // --- Map Initialization ---
  // initialMapView が確定するまで初期化を待つ（ルート取得中のみ。東京が一瞬見えるのを防ぐ）
  useEffect(() => {
    if (!mapContainer.current || mapInitialized.current || !supabase || !initialMapView) return;

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
        center: initialMapView.center,
        zoom: initialMapView.zoom,
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

        // 危険レポートのbbox絞り込み用に、表示範囲を初期化＆パン/ズームのたびに更新する
        const updateMapBounds = () => {
          if (!map.current) return
          const bounds = map.current.getBounds()
          if (!bounds) return
          setMapBounds({
            minLng: bounds.getWest(),
            minLat: bounds.getSouth(),
            maxLng: bounds.getEast(),
            maxLat: bounds.getNorth(),
          })
        }
        updateMapBounds()
        map.current.on("moveend", () => {
          if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current)
          boundsDebounceRef.current = setTimeout(updateMapBounds, 300)
        })
      });
    } catch (error: any) {
      console.error("Error initializing map:", error);
      setMapError(`マップ初期化エラー: ${error.message}`);
      setIsLoading(false);
    }

    return () => {
      if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current)
      boundsDebounceRef.current = null
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
  }, [supabase, initialMapView]);

  // 東京フォールバックで初期化した後に現在地が取れた場合、一度だけそこへ移動する
  useEffect(() => {
    if (!lateCurrentLocation || lateLocationConsumedRef.current) return
    if (!map.current || !mapInitialized.current) return
    lateLocationConsumedRef.current = true
    flyToLocation(lateCurrentLocation[0], lateCurrentLocation[1], CURRENT_LOCATION_ZOOM)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lateCurrentLocation, isLoading])

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
  // handleMapClick は useEventCallback で常に最新 state を読むため、モード変化ごとの再登録
  // （旧 stale closure 対策）は不要。ここではリスナー未登録時の保険の付け直しだけ行う。
  useEffect(() => {
    if (!map.current || !mapInitialized.current) return;
    if ((awaitingLocationSelection || isSuspiciousAlertOpen) && !clickListenerAdded.current) {
      addClickListener();
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

  // --- Marker Rendering ---
  // 危険レポートの地図マーカー描画。挙動はそのままフックへ抽出。
  useDangerMarkers({
    mapRef: map,
    mapInitializedRef: mapInitialized,
    dangerReports,
    pendingReports,
    showPending: filterOptions.showPending,
    supabase,
    onSelectReport: (report) => {
      setSelectedReport(report)
      setIsDetailModalOpen(true)
    },
  })

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
    resetRouteHazards()
    setActiveHazardMarker(null)
    setHazardImageResult(null)
    setHazardImageError(null)
  }, [resetRouteHazards])

  const handleHazardLayerToggle = useCallback((hazardType: HazardType, checked: boolean) => {
    setHazardLayerVisibility((prev) => ({ ...prev, [hazardType]: checked }))
  }, [])

  const handleRouteHazardSelect = useCallback((hazard: RouteHazardMarker) => {
    handleHazardDetailOpen(hazard)
    flyToLocation(hazard.coordinates[0], hazard.coordinates[1], 16)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleHazardDetailOpen])

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
        next.showPending === prev.showPending &&
        next.prefecture === prev.prefecture
      ) {
        return prev
      }
      if (next.prefecture !== prev.prefecture) {
        setStoredRegion(next.prefecture)
      }
      return next
    });
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

  // レポート削除（権限チェック → confirm → DB/画像削除 → state更新）。挙動はそのままフックへ抽出。
  const handleDeleteReport = useDeleteDangerReport({
    supabase,
    dangerReports,
    pendingReports,
    setDangerReports,
    setPendingReports,
    selectedReport,
    setSelectedReport,
    setIsDetailModalOpen,
    setIsLoading,
    isAdmin,
    currentUserId,
    toast,
  })

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
    // 地図初期化前に消費すると flyTo が空振りするため、load 完了(isLoading=false)まで待つ
    if (!map.current || !mapInitialized.current) return
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
  }, [gpsLocation, isLoading])
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
              <ThreeDPanelContent is3DEnabled={is3DEnabled} onToggle={toggle3DMode} />
            }
            arPanelSlot={
              <ARPanelContent
                isARMode={isARMode}
                isParentChildARActive={isARMode && activeARKind === "parent_child_route"}
                hasSelectedRoute={Boolean(selectedUserRoute)}
                onToggleAR={toggleARMode}
                onOpenParentChildAR={handleOpenParentChildARMode}
              />
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
              <SuspiciousPanelContent
                isSuspiciousVisible={isSuspiciousVisible}
                hasReports={suspiciousAlertReports.length > 0}
                onToggleVisible={() => setIsSuspiciousVisible((v) => !v)}
                onOpenAlertForm={() => {
                  setActiveTopPanel(null)
                  setIsSuspiciousVisible(true)
                  setIsSuspiciousAlertOpen(true)
                }}
              />
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
        <AccidentStatsOverlay
          status={clickedLocationStatsStatus}
          stats={clickedLocationStats}
          isMobile={isMobile}
          awaitingLocationSelection={awaitingLocationSelection}
          isReportFormOpen={isReportFormOpen}
          onReset={resetClickedLocationStats}
        />

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
                  clearSuspiciousDraftMarker();
                }}
                isSubmitting={isSuspiciousSubmitting}
              />
            </div>
          </div>
        )}

        {/* 各種ステータス表示（モバイルヒント・地点選択ピル・エラー・読み込み中） */}
        <MapStatusOverlays
          showMobileMapHint={showMobileMapHint}
          onDismissHint={() => setShowMobileMapHint(false)}
          isReportFormOpen={isReportFormOpen}
          selectedLocation={selectedLocation}
          mapError={mapError}
          isLoading={isLoading}
        />
          {/* 危険レポート入力フォーム（デスクトップ=右下 / モバイル=Portalフルスクリーン） */}
          <MapReportForms
            isReportFormOpen={isReportFormOpen}
            isMobile={isMobile}
            onSubmit={handleReportSubmit}
            selectedLocation={selectedLocation}
            locationSource={locationSelectionSource}
            selectedRouteId={selectedUserRoute?.id ?? null}
            selectedRouteName={selectedUserRoute?.name ?? null}
            onDesktopCancel={() => setIsReportFormOpen(false)}
            onMobileChangeLocation={() => {
              setIsReportFormOpen(false);
              // 地点選択モードに戻す
              setAwaitingLocationSelection(true);
            }}
            onMobileClose={() => {
              setIsReportFormOpen(false);
              setSelectedLocation(null);
              setLocationSelectionSource(null);
              if (selectionMarker.current) {
                selectionMarker.current.remove();
                selectionMarker.current = null;
              }
            }}
          />
          {/* モバイル用地点選択UI（ボトムシート）- Portal経由でbodyに直接レンダリング */}
          <MobileLocationSheet
            isMobile={isMobile}
            awaitingLocationSelection={awaitingLocationSelection}
            selectedLocation={selectedLocation}
            onCancelWithLocation={() => {
              setAwaitingLocationSelection(false);
              setSelectedLocation(null);
              setLocationSelectionSource(null);
              if (selectionMarker.current) {
                selectionMarker.current.remove();
                selectionMarker.current = null;
              }
              toast({ title: "ばしょえらびを やめたよ" });
            }}
            onConfirm={() => {
              setAwaitingLocationSelection(false);
              setIsReportFormOpen(true);
            }}
            onCancelWaiting={() => {
              setAwaitingLocationSelection(false);
              toast({ title: "ばしょえらびを やめたよ" });
            }}
          />
          

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
