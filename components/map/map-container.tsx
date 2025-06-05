"use client"

import { useState, useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useSupabase } from "@/components/providers/supabase-provider"
import MapHeader from "./map-header"
import MapSidebar from "./map-sidebar"
import DangerReportForm from "../danger-report/danger-report-form"
import type { DangerReport } from "@/lib/types"
import { AlertTriangle, Car, Shield, HelpCircle, Trash2 } from "lucide-react"
import Map3DToggle from "./map-3d-toggle"
import { Button } from "@/components/ui/button"
import MapSearch from "./map-search"
import ImagePreviewDialog from "../danger-report/image-preview-dialog"
import DangerReportDetailModal from "../danger-report/danger-report-detail-modal" // 以前の履歴から推測
import { useToast } from "@/components/ui/use-toast"
import SubmittedReportPreview from "../danger-report/submitted-report-preview"
import { createRoot } from "react-dom/client"
import { addPoints } from "@/lib/gamification"
import { jsArrayToPgLiteral } from "@/lib/arrayLiteral"; // ヘルパー関数をインポート
import { useMediaQuery } from "@/hooks/use-media-query"

// Mapboxのアクセストークンを設定
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
if (!mapboxToken) {
  console.error(
    "Mapbox access token is missing. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment variables.",
  )
}
mapboxgl.accessToken = mapboxToken || ""

// --- 型定義 ---
// 送信済みレポートの状態用
interface SubmittedReportState {
  location: [number, number];
  originalImage: string | null;
  processedImages: string[]; // 複数画像に対応
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
  const mapInitialized = useRef(false)
  const selectionMarker = useRef<mapboxgl.Marker | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false) // ReportDetailModal 用
  const clickListenerAdded = useRef(false)
  const styleChangeInProgress = useRef(false)
  const mapClickHandler = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null)

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
    const checkAdminStatus = async () => {
      if (!supabase) return;
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Error fetching user:", error);
          return;
        }
        // user.app_metadata.role === 'admin' で判定 (実際のロール管理方法に合わせて変更)
        // console.log("User object for admin check:", user); // デバッグ用にユーザーオブジェクト全体を出力
        if (user?.app_metadata?.role === 'admin') {
          console.log("Admin user detected, setting isAdmin to true.");
          setIsAdmin(true);
        } else {
          console.log("User is not admin, setting isAdmin to false.");
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error in checkAdminStatus:", err);
        setIsAdmin(false); // エラー時は念のため false に
      }
    };
    checkAdminStatus();
  }, [supabase]); // supabase クライアントが変わった時にも再チェック

  // --- ▼▼▼ モバイル判定と地点選択待ち state を追加 ▼▼▼ ---
  const isMobile = useMediaQuery("(max-width: 768px)"); // md ブレークポイント (Tailwind)
  const [awaitingLocationSelection, setAwaitingLocationSelection] = useState(false);
  // --- ▲▲▲ --- 

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
    markerElement.className = isSubmitted ? "submitted-marker" : "selection-marker"; // Add appropriate CSS class

    selectionMarker.current = new mapboxgl.Marker({ element: markerElement, draggable: !isSubmitted })
      .setLngLat(coordinates)
      .addTo(map.current);

    if (isSubmitted) {
      markerElement.style.cursor = "pointer";
      markerElement.addEventListener("click", (e) => {
        e.stopPropagation();
        setIsSubmittedPreviewOpen(true);
      });
    } else {
      selectionMarker.current.on("dragend", () => {
        if (!selectionMarker.current) return;
        const lngLat = selectionMarker.current.getLngLat();
        const newCoordinates: [number, number] = [lngLat.lng, lngLat.lat];
        setSelectedLocation(newCoordinates); // Update state on drag end
      });
    }
  };

  const flyToLocation = (longitude: number, latitude: number, zoom = 15) => {
    map.current?.flyTo({ center: [longitude, latitude], zoom: zoom, essential: true });
  };

  // --- ▼▼▼ handleMapClick を修正 ▼▼▼ ---
  const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
    const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    // --- ▼▼▼ 詳細ログを追加 ▼▼▼ ---
    console.log(`Map clicked at: ${coordinates}. isMobile=${isMobile}, awaitingLocationSelection=${awaitingLocationSelection}, isReportFormOpen=${isReportFormOpen}`);
    // --- ▲▲▲ --- 

    if (awaitingLocationSelection) {
      console.log("Condition met: awaitingLocationSelection is true. Selecting location and opening form."); // 実行確認ログ
      setSelectedLocation(coordinates);
      setIsReportFormOpen(true);
      setAwaitingLocationSelection(false); // 地点選択モードを解除
    } else if (isReportFormOpen && !isMobile) { // デスクトップでフォームが開いている場合のみ
      console.log("Condition met: Form open on desktop. Updating location."); // 実行確認ログ
      setSelectedLocation(coordinates);
      // updateSelectionMarker は useEffect で呼ばれる
    }
    // それ以外（モバイルでフォームが開いている、単に地図を閲覧中など）は何もしない
     else {
      console.log("Condition not met: Map click ignored."); // 実行確認ログ
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

      map.current.on("error", (e) => { console.error("Mapbox error:", e); setMapError(`マップエラー: ${e.error?.message || "不明"}`); });

      map.current.on("load", () => {
        mapInitialized.current = true;
        addClickListener();
        setIsLoading(false);
        // Add controls after load
        map.current?.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.current?.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "top-right");
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

  useEffect(() => {
    if (selectedLocation && isReportFormOpen) {
      updateSelectionMarker(selectedLocation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation, isReportFormOpen]);

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

      // --- ▼▼▼ 背景色を直接設定 ▼▼▼ ---
      let backgroundColor = '#6b7280'; // Default: gray-500 (other)
      switch (report.danger_type) {
        case "traffic":
          backgroundColor = '#3b82f6'; // blue-500
          break;
        case "crime":
          backgroundColor = '#ef4444'; // red-500
          break;
        case "disaster":
          backgroundColor = '#facc15'; // yellow-400
          break;
      }
      markerElement.style.backgroundColor = backgroundColor;
      // --- ▲▲▲ 背景色を直接設定 ▲▲▲ ---

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
      const { data: insertedData, error: insertError } = await supabase
      .from("danger_reports")
      .insert({
        ...reportDataToInsert, // imageFile を除外したデータ
        user_id: user.id,
        latitude: selectedLocation[1],
        longitude: selectedLocation[0],
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
    <div className="flex flex-col h-screen">
      <MapHeader
        onAddReport={handleAddReportClick} // 作成したハンドラーを渡す
        isReportFormOpen={isReportFormOpen}
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        is3DEnabled={is3DEnabled}
        toggle3DMode={toggle3DMode}
        // ▼ モバイルでの地点選択モードの状態を渡す (ボタンの表示切替などに利用)
        isSelectingLocation={isMobile && awaitingLocationSelection}
      />
      <div className="relative flex flex-col md:flex-row flex-1 overflow-hidden pt-12 sm:pt-0 px-4 md:px-0">
        {/* Search components */}
        <div className="absolute top-0 inset-x-4 z-10 py-2 flex justify-center sm:hidden">
          <MapSearch map={map.current} onSelectLocation={(coords) => { if (isReportFormOpen) { setSelectedLocation(coords); flyToLocation(coords[0], coords[1]); } }} />
        </div>
        <div className="hidden sm:absolute sm:top-12 sm:left-8 sm:z-10 sm:flex sm:items-center sm:max-w-md sm:w-auto">
          <MapSearch map={map.current} onSelectLocation={(coords) => { if (isReportFormOpen) { setSelectedLocation(coords); flyToLocation(coords[0], coords[1]); } }} />
        </div>
        {/* 3D Toggle */}
        <div className="absolute top-24 right-4 z-20">
          <Map3DToggle is3DEnabled={is3DEnabled} onToggle={toggle3DMode} />
        </div>
        {/* Sidebar */}
        <div className="block w-full md:block md:w-auto">
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
          />
        </div>
        {/* Map Area */}
        <div className="flex-1 relative w-full">
          <div ref={mapContainer} className="absolute inset-0" style={{ width: "100%", height: "100%", minHeight: "500px" }} />
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
          {/* Report Form */}
          {isReportFormOpen && (
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-lg z-10 max-h-[calc(100vh-10rem)] overflow-y-auto">
              <DangerReportForm
                onSubmit={handleReportSubmit}
                onCancel={() => setIsReportFormOpen(false)} // Reset location handled by useEffect
                selectedLocation={selectedLocation}
              />
            </div>
          )}
          {/* --- ▼▼▼ 地点選択待ちメッセージを追加 ▼▼▼ --- */}
          {isMobile && awaitingLocationSelection && (
            <div className="absolute top-16 left-4 right-4 z-10 px-4 py-2 flex justify-center pointer-events-none">
              <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-md shadow-md pointer-events-auto animate-pulse">
                <p className="text-sm font-medium">地図をタップして報告地点を選択</p>
              </div>
            </div>
          )}
          {/* --- ▲▲▲ --- */}
        </div>
      </div>

      {/* Dialogs and Modals */}
      <ImagePreviewDialog isOpen={!!previewImage} imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
      <DangerReportDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        report={selectedReport}
        isAdmin={isAdmin}
      />
      <SubmittedReportPreview
        isOpen={isSubmittedPreviewOpen}
        onClose={() => { setIsSubmittedPreviewOpen(false); setSubmittedReport(null); }} // Clear submitted report on close
        originalImage={submittedReport?.originalImage ?? null}
        processedImages={submittedReport?.processedImages ?? []}
      />
    </div>
  )
}