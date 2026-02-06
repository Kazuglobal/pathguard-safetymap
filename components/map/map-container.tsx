"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import Image from "next/image"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useSupabase } from "@/components/providers/supabase-provider"
import MapFloatingControls from "./map-floating-controls"
import MapSidebar from "./map-sidebar"
import DangerReportForm from "../danger-report/danger-report-form"
import type { DangerReport } from "@/lib/types"
import { AlertTriangle, Car, Shield, HelpCircle, Trash2, MapPin } from "lucide-react"
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

// Mapboxのアクセストークンを設定
const mapboxToken = getMapboxToken()
const tokenValidation = validateMapboxToken()

if (!tokenValidation.isValid) {
  console.error("Mapbox token validation failed:", tokenValidation.error)
}

mapboxgl.accessToken = mapboxToken || ""

async function reverseGeocodeLocation(latitude: number, longitude: number) {
  const token = getMapboxToken()
  if (!token) {
    console.warn("Mapbox token is missing; skip reverse geocoding.")
    return { prefecture: null as string | null, city: null as string | null }
  }

  try {
    const params = new URLSearchParams({
      access_token: token,
      language: "ja",
      types: "region,place,locality,district",
      limit: "5",
    })

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params.toString()}`,
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
  onPreview: () => void
  onRetry: () => void
  onImageError: () => void
}

function MapImagePopupContent({
  url,
  hasError,
  onPreview,
  onRetry,
  onImageError,
}: MapImagePopupContentProps) {
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

  return (
    <button
      type="button"
      className="relative block w-28 sm:w-36 overflow-hidden rounded-xl shadow-md"
      onClick={onPreview}
    >
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={url}
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
// MapContainer コンポーネント
export default function MapContainer() {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [dangerReports, setDangerReports] = useState<DangerReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReportFormOpen, setIsReportFormOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null)
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
  const mapInitialized = useRef(false)
  const selectionMarker = useRef<mapboxgl.Marker | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [mapImageOverlays, setMapImageOverlays] = useState<MapImageOverlayEntry[]>([])
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false) // ReportDetailModal 用
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // モバイルでのサイドバー表示状態
  const clickListenerAdded = useRef(false)
  const styleChangeInProgress = useRef(false)
  const mapClickHandler = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null)
  const mapImagePopupRefs = useRef<Map<string, mapboxgl.Popup>>(new Map())
  const mapImagePopupRootRefs = useRef<Map<string, ReturnType<typeof createRoot>>>(new Map())

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

  // 送信された報告の情報を保持する状態 (型を更新)
  const [submittedReport, setSubmittedReport] = useState<SubmittedReportState | null>(null)

  // 送信された報告のプレビューモーダルの状態
  const [isSubmittedPreviewOpen, setIsSubmittedPreviewOpen] = useState(false)

  // 審査中の報告を保持する状態を追加
  const [pendingReports, setPendingReports] = useState<DangerReport[]>([])

  // 管理者かどうかを判定する状態（MapHeaderから受け取るように変更する方が良いかも）
  const [isAdmin, setIsAdmin] = useState(false) // とりあえず残す

  // ユーザー情報を取得して isAdmin 状態を更新する useEffect
  useEffect(() => {
    let isMounted = true
    let retryCount = 0
    const maxRetries = 3

    const checkAdminStatus = async () => {
      if (!supabase) return;
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          // "Auth session missing"はセッション同期待ち、リトライする
          if (error.message?.includes("Auth session missing")) {
            if (retryCount < maxRetries && isMounted) {
              retryCount++
              setTimeout(checkAdminStatus, 500 * retryCount)
              return
            }
            // リトライ後も失敗 = 未ログイン（正常）
            if (isMounted) setIsAdmin(false)
            return
          }
          console.error("Error fetching user:", error);
          return;
        }
        // user.app_metadata.role === 'admin' で判定 (実際のロール管理方法に合わせて変更)
        if (user?.app_metadata?.role === 'admin') {
          if (isMounted) setIsAdmin(true);
        } else {
          if (isMounted) setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error in checkAdminStatus:", err);
        if (isMounted) setIsAdmin(false); // エラー時は念のため false に
      }
    };
    checkAdminStatus();
    return () => { isMounted = false }
  }, [supabase]); // supabase クライアントが変わった時にも再チェック

  // --- ▼▼▼ モバイル判定と地点選択待ち state を追加 ▼▼▼ ---
  const isMobile = useMediaQuery("(max-width: 768px)"); // md ブレークポイント (Tailwind)
  const [awaitingLocationSelection, setAwaitingLocationSelection] = useState(false);
  
  // ヘルプの表示状態管理
  const [isHelpVisible, setIsHelpVisible] = useState(true);
  const [isHelpDismissed, setIsHelpDismissed] = useState(false);
  const [showMobileMapHint, setShowMobileMapHint] = useState(false);
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

  useEffect(() => {
    setMapImageOverlays((prev) => {
      if (prev.length === 0) return prev

      const validReportIds = new Set(combinedReports.map((report) => report.id))
      const filtered = prev.filter((overlay) => !overlay.reportId || validReportIds.has(overlay.reportId))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [combinedReports])

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
          onPreview={() => setPreviewImage(overlay.url)}
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
  }, [mapImageOverlays, setPreviewImage])

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

  // --- ▼▼▼ handleMapClick を修正 ▼▼▼ ---
  const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
    const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    console.log(`Map clicked at: ${coordinates}. isMobile=${isMobile}, awaitingLocationSelection=${awaitingLocationSelection}, isReportFormOpen=${isReportFormOpen}`);

    if (awaitingLocationSelection) {
      // 地点選択モード：位置を選択
      console.log("Location selection mode: Setting location");
      setSelectedLocation(coordinates);

      if (isMobile) {
        // モバイル：地点を選択するだけ（フォームはボトムバーの「この地点で報告する」ボタンで開く）
        toast({
          title: "地点を選択しました",
          description: "「この地点で報告する」をタップして続行"
        });
      } else {
        // デスクトップ：地点選択後すぐにフォームを開く
        setIsReportFormOpen(true);
        setAwaitingLocationSelection(false);
        toast({
          title: "地点を選択しました",
          description: "選択した地点で危険箇所を報告できます"
        });
      }
    } else if (isReportFormOpen) {
      // フォームが開いている場合：モバイル・デスクトップ関係なく位置を更新
      console.log("Form is open: Updating location");
      setSelectedLocation(coordinates);
      toast({
        title: "地点を変更しました",
        description: "新しい位置に報告地点を変更しました"
      });
    } else {
      // その他の場合：何もしない（通常の地図操作）
      console.log("Normal map interaction: No action taken");
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
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: `mapbox://styles/mapbox/${mapStyle}`, // Initial style from state
        center: [139.6917, 35.6895], // Tokyo center
        zoom: 12,
        attributionControl: true,
      });

      map.current.on("error", (e) => { 
        console.error("Mapbox error:", e.error || e); 
        const errorMessage = e.error?.message || e.message || "不明なエラー";
        setMapError(`マップエラー: ${errorMessage}`); 
      });

      map.current.on("load", () => {
        mapInitialized.current = true;
        addClickListener();
        setIsLoading(false);
        // Add controls after load
        map.current?.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
        map.current?.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "bottom-right");
      });
    } catch (error: any) {
      console.error("Error initializing map:", error);
      setMapError(`マップ初期化エラー: ${error.message}`);
      setIsLoading(false);
    }

    return () => {
      if (map.current) {
        if (mapClickHandler.current) map.current.off("click", mapClickHandler.current);
        map.current.remove(); map.current = null;
        mapInitialized.current = false; clickListenerAdded.current = false; mapClickHandler.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]); // Add supabase dependency

  // --- Report Form Logic ---
  useEffect(() => {
    if (isReportFormOpen && map.current) {
      if (!clickListenerAdded.current) addClickListener();
      if (!selectedLocation) {
        const center = map.current.getCenter();
        const initialLocation: [number, number] = [center.lng, center.lat];
        setSelectedLocation(initialLocation);
        // updateSelectionMarker is called via useEffect below
      }
    }
    if (!isReportFormOpen && !submittedReport && selectionMarker.current) {
      selectionMarker.current.remove(); selectionMarker.current = null;
      setSelectedLocation(null); // Reset location when form closes without submission
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReportFormOpen, submittedReport]); // submittedReport dependency added

  // --- Location Selection Mode: Ensure click listener is active ---
  useEffect(() => {
    if (awaitingLocationSelection && map.current && mapInitialized.current) {
      // 地点選択モードの時は、クリックリスナーが確実に有効になるようにする
      if (!clickListenerAdded.current || !mapClickHandler.current) {
        addClickListener();
      } else {
        // 既にリスナーが追加されている場合でも、最新のhandleMapClickを確実に使用する
        if (mapClickHandler.current) {
          map.current.off("click", mapClickHandler.current);
        }
        mapClickHandler.current = handleMapClick;
        map.current.on("click", mapClickHandler.current);
      }
      console.log("Location selection mode: Click listener ensured to be active");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingLocationSelection]);

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

    const fetchDangerReports = async () => {
      setIsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;

        // Base query for approved reports
        let approvedQuery = supabase
          .from("danger_reports")
          .select(`*`) // Select を最初に戻す
          .eq("status", "approved"); // status filter は必須

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
        setDangerReports((approvedData ?? []) as DangerReport[]);

        // Fetch user's pending reports if logged in and filter is enabled
        let userPendingReports: DangerReport[] = [];
        if (userId && filterOptions.showPending) {
          // pending は filter が少ないので、メソッドチェーンで書けるかもしれない
          const { data: pendingData, error: pendingError } = await supabase
            .from("danger_reports")
            .select(`*`) // Select を最初に戻す
            .eq("status", "pending")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (pendingError) console.error("Error fetching pending reports:", pendingError);
          else userPendingReports = (pendingData ?? []) as DangerReport[];
        }
        setPendingReports(userPendingReports);

      } catch (error: any) {
        console.error("Error fetching reports object:", error); // オブジェクト全体
        console.error("Error fetching reports message:", error?.message); // メッセージ
        console.error("Error fetching reports stack:", error?.stack); // スタックトレース
        console.error("Error fetching reports stringified:", JSON.stringify(error)); // JSON文字列化

        toast({ title: "データ取得エラー", description: `危険箇所データの取得エラー: ${error?.message || '詳細不明'}`, variant: "destructive" }); // messageがない場合も考慮
        setDangerReports([]);
        setPendingReports([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDangerReports();
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

  // --- Event Handlers ---
  const handleFilterChange = (newFilters: Partial<typeof filterOptions>) => {
    setFilterOptions(prev => ({ ...prev, ...newFilters }));
  };

  const handleReportSubmit = async (reportData: Partial<DangerReport> & { imageFile?: File | null }) => {
    if (!supabase || !selectedLocation) { // Check supabase and selectedLocation
      toast({ title: "エラー", description: "地図上で位置を選択してください。", variant: "destructive" });
      return;
    }

    // 画像ファイルを取り出す (プロパティ名は要確認)
    const imageFile = reportData.imageFile;
    // insert するデータから imageFile を除外
    const { imageFile: _removed, ...reportDataToInsert } = reportData;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ユーザー情報が取得できませんでした。", variant: "destructive" });
        return;
      }

      // 1. 基本情報をまず INSERT (processed_image_urls は含めないか NULL)
      console.log("Inserting basic report data...");

      const locationDetails = selectedLocation
        ? await reverseGeocodeLocation(selectedLocation[1], selectedLocation[0])
        : { prefecture: null as string | null, city: null as string | null };

      const { data: insertedData, error: insertError } = await supabase
      .from("danger_reports")
      .insert({
        ...reportDataToInsert, // imageFile を除外したデータ
        user_id: user.id,
        latitude: selectedLocation[1],
        longitude: selectedLocation[0],
        prefecture: locationDetails.prefecture,
        city: locationDetails.city,
        status: 'pending',
        title: reportDataToInsert.title || '無題の報告',
        danger_type: reportDataToInsert.danger_type || 'other',
        danger_level: reportDataToInsert.danger_level || 1,
        // processed_image_urls は API 側で設定されるため、ここでは設定しない (NULL or default)
        // processed_image_urls: [], // ← 削除
      })
      .select()
      .single();

      if (insertError) throw insertError;
      if (!insertedData) throw new Error("挿入されたレポートデータの取得に失敗しました。");

      const newReportId = insertedData.id;
      console.log(`Report inserted successfully with ID: ${newReportId}`);

      // 2. 画像ファイルがあれば、画像処理 API を呼び出す
      let finalReportData = insertedData as DangerReport; // 型アサーション
      if (imageFile && newReportId) {
        console.log(`Image file found, calling /api/image/process for report ID: ${newReportId}`);
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('reportId', newReportId);

        try {
          const response = await fetch('/api/image/process', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            // APIエラーが発生してもレポート自体は作成されているので、警告を出すに留める
            console.error("Error calling /api/image/process:", errorData.message);
            toast({
              title: "画像処理エラー",
              description: `レポートは保存されましたが、画像の処理に失敗しました: ${errorData.message || '不明なエラー'}`,
              variant: "destructive",
            });
            // finalReportData は INSERT 直後のまま
          } else {
            const result = await response.json();
            console.log("Image processed successfully:", result);
            // API から返された更新後の URL 配列でローカルデータを更新
            finalReportData = { ...finalReportData, processed_image_urls: result.updatedUrls || [] };
            toast({ title: "画像処理完了", description: "画像がアップロード・処理されました。" });
          }
        } catch (apiError: any) {
           console.error("Network or other error calling /api/image/process:", apiError);
           toast({
             title: "画像処理APIエラー",
             description: `レポートは保存されましたが、画像の処理中に通信エラー等が発生しました: ${apiError.message || '詳細不明'}`,
             variant: "destructive",
           });
           // finalReportData は INSERT 直後のまま
        }
      } else {
         console.log("No image file provided or report ID missing, skipping image processing.");
      }


      // 3. 後続処理 (トースト、ポイント、プレビュー、ローカル状態更新)
      toast({ title: "報告完了", description: "危険箇所報告が送信されました。" }); // 最終的な完了トースト

      // Gamification (エラーがあっても続行)
      try {
        if (user?.id) { // user.id が存在するか確認
           await addPoints(supabase, user.id, 20);
           toast({ title: "ポイント獲得", description: "報告送信で +20pt 獲得しました。" });
        } else {
           console.warn("User ID not found for gamification points.");
        }
      } catch (e: any) { console.error("Gamification error:", e); }

      // プレビュー用のデータを設定 (selectedLocation が null でないことを確認)
      if (selectedLocation) {
        setSubmittedReport({
          location: selectedLocation,
          originalImage: finalReportData.image_url || null,
          processedImages: finalReportData.processed_image_urls || [],
        });
      } else {
        console.error("Selected location is null, cannot set submitted report state.");
        // selectedLocation が null の場合のエラーハンドリングが必要な場合がある
      }

      setIsReportFormOpen(false); // Close form

      // プレビューモーダル表示 (API の結果を反映したデータで判断)
      if (finalReportData.image_url || (finalReportData.processed_image_urls && finalReportData.processed_image_urls.length > 0)) {
        // selectedLocation が null の場合でもプレビューは表示できるかもしれない
        // ただし、SubmittedReportPreview が location を期待している場合は問題
        if (selectedLocation) {
            setIsSubmittedPreviewOpen(true);
        }
      }

      // ローカル状態を更新 (API の結果を反映したデータを使う)
      setPendingReports(prev => [finalReportData, ...prev]);

    } catch (error: any) {
      console.error("Error submitting report:", error);
      toast({ title: "送信エラー", description: `報告の送信エラー: ${error.message}`, variant: "destructive" });
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
    if (!supabase || !isAdmin) {
      // 管理者でない場合は何もしない（ボタンが表示されないはずだが念のため）
      toast({ title: "権限エラー", description: "レポートの削除権限がありません。", variant: "destructive" });
      return;
    }

    const reportToDelete = dangerReports.find(r => r.id === reportId) || pendingReports.find(r => r.id === reportId);
    if (!reportToDelete) return; // 対象が見つからない場合は何もしない

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

      // 2. (任意) 関連する画像をストレージから削除する処理
      // 必要であれば DangerReportDetailModal の deleteProcessedImage を参考に実装

      toast({ title: "削除成功", description: `レポート (ID: ${reportId}) を削除しました。` });

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

    if (isMobile) {
      if (awaitingLocationSelection) {
        // すでに地点選択モードなら解除
        setAwaitingLocationSelection(false);
        toast({ title: "地点選択をキャンセルしました" });
        console.log("Location selection cancelled by user.");
      } else {
        // 地点選択モードを開始
        setAwaitingLocationSelection(true);
        toast({ title: "地点選択", description: "地図をタップして報告地点を選択してください。" });
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
          onToggleAR={() => setIsARMode(!isARMode)}
          isARMode={isARMode}
          onToggleSidebar={toggleSidebar}
          isMobile={isMobile}
        />

        {/* 検索バー - 最上部に配置（デスクトップはヘッダー下）、地点選択モード中は非表示 */}
        {!awaitingLocationSelection && (
          <div
            className="absolute left-0 right-0 z-30 px-3 sm:px-4 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] md:top-[calc(env(safe-area-inset-top,0px)+4.5rem)]"
          >
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80">
              <MapSearch map={map.current} onSelectLocation={(coords) => { if (isReportFormOpen) { setSelectedLocation(coords); flyToLocation(coords[0], coords[1]); } }} />
            </div>
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
              <div className="bg-white/90 px-4 py-2 rounded-md shadow-md pointer-events-auto">
                <p className="text-sm text-blue-600 font-medium">
                  {selectedLocation ? "位置選択済み。地図クリックで変更可。" : "地図をクリックして位置を選択"}
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
            <div className="absolute bottom-4 right-4 w-96 bg-white rounded-lg shadow-lg z-60 max-h-[calc(100vh-10rem)] overflow-y-auto">
              <DangerReportForm
                onSubmit={handleReportSubmit}
                onCancel={() => setIsReportFormOpen(false)}
                selectedLocation={selectedLocation}
              />
            </div>
          )}

          {/* Report Form - モバイル用（フルスクリーンモーダル）- Portal経由でbodyに直接レンダリング */}
          {isReportFormOpen && isMobile && createPortal(
            <div className="fixed inset-0 z-[60] flex flex-col bg-white mobile-fullscreen-form">
              {/* モバイルフォームヘッダー */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white safe-area-top">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsReportFormOpen(false);
                    // 地点選択モードに戻す
                    setAwaitingLocationSelection(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <MapPin className="w-4 h-4" />
                  <span>地点を変更</span>
                </Button>
                <h2 className="text-lg font-bold text-gray-800">危険箇所の報告</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsReportFormOpen(false);
                    setSelectedLocation(null);
                    if (selectionMarker.current) {
                      selectionMarker.current.remove();
                      selectionMarker.current = null;
                    }
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  閉じる
                </Button>
              </div>

              {/* 選択地点の表示 */}
              {selectedLocation && (
                <div className="flex-shrink-0 px-4 py-2 bg-blue-50 border-b border-blue-100">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <MapPin className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-blue-600 font-medium">選択中の地点</p>
                      <p className="text-xs text-blue-800">
                        緯度: {selectedLocation[1].toFixed(6)}, 経度: {selectedLocation[0].toFixed(6)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsReportFormOpen(false);
                        setAwaitingLocationSelection(true);
                      }}
                      className="text-xs h-9 px-3 border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      変更
                    </Button>
                  </div>
                </div>
              )}

              {/* フォーム本体 */}
              <div className="flex-1 overflow-y-auto">
                <DangerReportForm
                  onSubmit={handleReportSubmit}
                  onCancel={() => {
                    setIsReportFormOpen(false);
                    setSelectedLocation(null);
                    if (selectionMarker.current) {
                      selectionMarker.current.remove();
                      selectionMarker.current = null;
                    }
                  }}
                  selectedLocation={selectedLocation}
                  isMobileFullscreen={true}
                />
              </div>
            </div>,
            document.body
          )}
          {/* --- ▼▼▼ モバイル用地点選択UI（ボトムシート）- Portal経由でbodyに直接レンダリング ▼▼▼ --- */}
          {isMobile && awaitingLocationSelection && createPortal(
            <>
              {/* 上部のコンパクトなガイド */}
              <div className="fixed top-2 left-1/2 transform -translate-x-1/2 z-[60] pointer-events-none">
                <div className="bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-blue-200 px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <p className="text-sm font-medium text-blue-800">地図をタップして地点を選択</p>
                  </div>
                </div>
              </div>

              {/* 下部の確認バー - ナビゲーションバーの上に固定表示 */}
              <div className="fixed bottom-0 left-0 right-0 z-[60] mobile-bottom-bar">
                <div className="bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] border-t border-gray-200">
                  {selectedLocation ? (
                    <div className="px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-gray-900">地点を選択しました</p>
                          <p className="text-xs text-gray-500 truncate">
                            {selectedLocation[1].toFixed(5)}, {selectedLocation[0].toFixed(5)}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <Button
                          size="default"
                          variant="outline"
                          onClick={() => {
                            setAwaitingLocationSelection(false);
                            setSelectedLocation(null);
                            if (selectionMarker.current) {
                              selectionMarker.current.remove();
                              selectionMarker.current = null;
                            }
                            toast({ title: "地点選択をキャンセルしました" });
                          }}
                          className="flex-1 h-12 text-base font-medium rounded-xl"
                        >
                          キャンセル
                        </Button>
                        <Button
                          size="default"
                          onClick={() => {
                            setAwaitingLocationSelection(false);
                            setIsReportFormOpen(true);
                          }}
                          className="flex-[2] h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                        >
                          この地点で報告する
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <p className="text-sm text-gray-600">地図をタップして地点を選んでください</p>
                        </div>
                        <Button
                          size="default"
                          variant="ghost"
                          onClick={() => {
                            setAwaitingLocationSelection(false);
                            toast({ title: "地点選択をキャンセルしました" });
                          }}
                          className="text-gray-500 hover:text-gray-700 h-10 px-4"
                        >
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>,
            document.body
          )}
          {/* --- ▲▲▲ モバイル用地点選択UI ▲▲▲ --- */}
          
          {/* --- ▼▼▼ デスクトップ用地点選択ヘルプ ▼▼▼ --- */}
          {!isMobile && isReportFormOpen && !isHelpDismissed && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-blue-200 min-w-80">
                <div className="px-4 py-3 bg-blue-50/50 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 text-sm">✚</span>
                      </div>
                      <p className="text-sm font-medium text-blue-800">地点選択モード</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsHelpVisible(false)}
                      className="text-blue-600 hover:text-blue-800 h-6 px-2"
                    >
                      ×
                    </Button>
                  </div>
                </div>
                {isHelpVisible && (
                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-700 mb-2">
                      🖱️ <strong>クリック</strong>：地図上の任意の場所を選択
                    </p>
                    <p className="text-sm text-gray-700 mb-3">
                      🤏 <strong>ドラッグ</strong>：青いマーカーを移動して位置調整
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsHelpVisible(false)}
                        className="flex-1 text-gray-500 hover:text-gray-700"
                      >
                        説明を隠す
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsHelpDismissed(true);
                          toast({ title: "ヘルプを非表示にしました", description: "？ボタンから再表示できます" });
                        }}
                        className="text-gray-400 hover:text-red-600"
                      >
                        完全に消す
                      </Button>
                    </div>
                  </div>
                )}
                {!isHelpVisible && (
                  <div className="px-4 py-2">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsHelpVisible(true)}
                        className="flex-1 text-blue-600 hover:text-blue-800"
                      >
                        💡 使い方を表示
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsHelpDismissed(true);
                          toast({ title: "ヘルプを非表示にしました", description: "？ボタンから再表示できます" });
                        }}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* --- ▼▼▼ ヘルプ再表示ボタン（デスクトップ） ▼▼▼ --- */}
          {!isMobile && isReportFormOpen && isHelpDismissed && (
            <div className="absolute top-4 right-4 z-10">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsHelpDismissed(false);
                  setIsHelpVisible(true);
                }}
                className="w-8 h-8 p-0 bg-white/90 hover:bg-white border-blue-200 text-blue-600 shadow-lg rounded-full"
              >
                ？
              </Button>
            </div>
          )}
          {/* --- ▲▲▲ --- */}

        {/* Dialogs and Modals */}
        <ImagePreviewDialog isOpen={!!previewImage} imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
        <DangerReportDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          report={selectedReport}
          isAdmin={isAdmin}
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
        />
        {/* ARビュー */}
        {isARMode && (
          <ARView
            reports={combinedReports}
            onClose={() => setIsARMode(false)}
          />
        )}
      </div>
    </div>
  )
}
