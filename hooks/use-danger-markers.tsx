"use client"

import { useEffect, type ElementType, type MutableRefObject } from "react"
import mapboxgl from "mapbox-gl"
import { createRoot } from "react-dom/client"
import { AlertTriangle, Car, Shield, HelpCircle, UserX } from "lucide-react"
import type { DangerReport } from "@/lib/types"
import { addPoints } from "@/lib/gamification"
import { SUSPICIOUS_DANGER_TYPE } from "@/lib/suspicious-alert"

const getDangerTypeMarkerClass = (dangerType: string) => {
  return `danger-marker-${dangerType}` || 'danger-marker-other'; // Simplified
}

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

interface UseDangerMarkersParams {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  mapInitializedRef: MutableRefObject<boolean>
  dangerReports: DangerReport[]
  pendingReports: DangerReport[]
  showPending: boolean
  supabase: any
  onSelectReport: (report: DangerReport) => void
}

/**
 * 危険レポート（承認済み＋pending）の地図マーカー描画を担うフック。
 * マーカー要素の生成・アイコン描画・クリック時のモーダル表示とポイント付与を含む。
 * map-container.tsx から挙動を変えずに抽出。
 */
export function useDangerMarkers({
  mapRef,
  mapInitializedRef,
  dangerReports,
  pendingReports,
  showPending,
  supabase,
  onSelectReport,
}: UseDangerMarkersParams) {
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapInitializedRef.current) return;

    // Remove existing markers before adding new ones
    document.querySelectorAll('.danger-marker, .pending-marker').forEach(marker => marker.remove());

    const addMarker = (report: DangerReport, isPending: boolean) => {
      const markerElement = document.createElement("div");
      const typeClass = getDangerTypeMarkerClass(report.danger_type);
      markerElement.className = `${isPending ? 'pending-marker' : 'danger-marker'} danger-level-${report.danger_level} ${typeClass}`; // クラス名は残す
      markerElement.style.cursor = 'pointer';

      // --- ▼▼▼ 危険度に基づく色分け ▼▼▼ ---
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
      let IconComponent: ElementType = HelpCircle; // Default icon
      if (report.danger_type === "traffic") IconComponent = Car;
      else if (report.danger_type === "crime") IconComponent = Shield;
      else if (report.danger_type === "disaster") IconComponent = AlertTriangle;
      else if (report.danger_type === SUSPICIOUS_DANGER_TYPE) IconComponent = UserX;
      root.render(<IconComponent className="h-5 w-5 text-white" />); // Adjusted size

      new mapboxgl.Marker(markerElement)
        .setLngLat([report.longitude, report.latitude])
        .addTo(map); // Add to map

      markerElement.addEventListener("click", async (e) => {
        e.stopPropagation();
        onSelectReport(report); // Set selected report for modal

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
      if (showPending) {
        pendingReports.forEach(report => addMarker(report, true));
      }
    } catch (error) {
      console.error("Error adding markers:", error);
    }
  // Re-evaluate dependencies: mapStyle might not be needed if markers don't change with style
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dangerReports, pendingReports, showPending, mapInitializedRef.current]); // Removed mapStyle, is3DEnabled, selectedLocation
}
