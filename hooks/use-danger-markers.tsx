"use client"

import { useEffect, type MutableRefObject } from "react"
import mapboxgl from "mapbox-gl"
import { createRoot } from "react-dom/client"
import type { DangerReport } from "@/lib/types"
import { DangerClusterBadge, DangerPin } from "@/components/map/danger-pin"
import { getDangerTypePresentation } from "@/lib/map/danger-type-presentation"
import { getDangerLevelPresentation } from "@/lib/report-generation/danger-level-presentation"
import { isValidCoordinates } from "@/lib/coordinates"
import {
  findPointsWithLabelRoom,
  groupMarkersByProximity,
  spreadOverlappingPins,
  CLUSTER_MAX_ZOOM,
  PIN_LABEL_MIN_ZOOM,
  type MarkerGroup,
} from "@/lib/map/marker-clustering"

interface UseDangerMarkersParams {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  mapInitializedRef: MutableRefObject<boolean>
  dangerReports: DangerReport[]
  pendingReports: DangerReport[]
  showPending: boolean
  supabase: any
  onSelectReport: (report: DangerReport) => void
}

/** クラスタリング計算に使う内部表現(ClusterablePoint互換) */
interface MarkerEntry {
  latitude: number
  longitude: number
  report: DangerReport
  isPending: boolean
}

/**
 * 危険レポート（承認済み＋pending）の地図マーカー描画を担うフック。
 * マーカー要素の生成・アイコン描画・クリック時のモーダル表示とポイント付与を含む。
 *
 * 密集対策(2026-07-08):
 * - CLUSTER_MAX_ZOOM 未満: 近接ピンを「N件」クラスタにまとめ、タップでズームイン
 * - CLUSTER_MAX_ZOOM 以上: 重なりピンだけを扇状に散らして全件タップ可能にする
 * ズーム変更(zoomend)のたびに再グループ化する。DOMマーカー方式は維持
 * (Mapboxネイティブクラスタへ置換しない設計判断。lib/map/marker-clustering.ts 参照)。
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

    const markerResources: Array<{
      marker: mapboxgl.Marker
      unmount?: () => void
    }> = []

    const removeRenderedMarkers = () => {
      for (const { marker, unmount } of markerResources.splice(0)) {
        marker.remove()
        unmount?.()
      }
    }

    const addMarker = (
      report: DangerReport,
      isPending: boolean,
      displayLngLat: [number, number],
      showLabel: boolean,
    ) => {
      const markerElement = document.createElement("div");
      const type = getDangerTypePresentation(report.danger_type);
      const level = getDangerLevelPresentation(report.danger_level);
      markerElement.className = `danger-marker${isPending ? " pending-marker" : ""} danger-level-${report.danger_level} danger-marker-${type.id}`;
      markerElement.setAttribute("role", "button");
      markerElement.setAttribute("tabindex", "0");
      markerElement.setAttribute(
        "aria-label",
        `${type.label}の危険報告（${level.kidLabel}）${isPending ? "（確認中）" : ""}。詳細を開きます`,
      );

      const root = createRoot(markerElement);
      root.render(
        <DangerPin
          dangerType={report.danger_type}
          dangerLevel={report.danger_level}
          isPending={isPending}
          showLabel={showLabel}
        />,
      );

      const marker = new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat(displayLngLat)
        .addTo(map);
      markerResources.push({ marker, unmount: () => root.unmount() })

      const openReport = () => {
        onSelectReport(report);
      };

      markerElement.addEventListener("click", (e) => {
        e.stopPropagation();
        openReport();
      });
      markerElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          openReport();
        }
      });
    };

    const addClusterMarker = (
      lngLat: [number, number],
      entries: MarkerEntry[],
      currentZoom: number,
    ) => {
      // クラスタ色はメンバー中の最大危険度(安全側: 最悪ケースを見せる)
      const maxLevel = Math.max(...entries.map((entry) => entry.report.danger_level));
      const count = entries.length;
      const size = Math.min(54, 40 + count * 2);

      const markerElement = document.createElement("div");
      markerElement.className = "danger-cluster-marker";
      markerElement.style.setProperty("--cluster-size", `${size}px`);
      markerElement.style.setProperty(
        "--cluster-color",
        getDangerLevelPresentation(maxLevel).colorHex,
      );
      markerElement.setAttribute("role", "button");
      markerElement.setAttribute("tabindex", "0");
      markerElement.setAttribute(
        "aria-label",
        `このあたりに${count}件の報告があります。タップで拡大します`,
      );

      const root = createRoot(markerElement);
      root.render(<DangerClusterBadge count={count} />);

      const marker = new mapboxgl.Marker(markerElement).setLngLat(lngLat).addTo(map);
      markerResources.push({ marker, unmount: () => root.unmount() })

      const expandCluster = () => {
        map.easeTo({
          center: lngLat,
          zoom: Math.min(currentZoom + 2, CLUSTER_MAX_ZOOM + 0.5),
        });
      };

      markerElement.addEventListener("click", (e) => {
        e.stopPropagation();
        expandCluster();
      });
      markerElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          expandCluster();
        }
      });
    };

    const renderMarkers = () => {
      // Mapbox 側のイベント購読も含めて前回の Marker を破棄する。
      removeRenderedMarkers()

      const entries: MarkerEntry[] = [
        ...dangerReports.map((report) => ({ report, isPending: false })),
        ...(showPending ? pendingReports.map((report) => ({ report, isPending: true })) : []),
      ]
        .filter(({ report }) => isValidCoordinates(report.latitude, report.longitude))
        .map(({ report, isPending }) => ({
          latitude: report.latitude,
          longitude: report.longitude,
          report,
          isPending,
        }));

      const zoom = map.getZoom();

      try {
        // 高ズーム: 重なりだけ扇状に散らして全件表示 / 通常ズーム: 近接ピンをクラスタへ
        const displayed: MarkerGroup<MarkerEntry>[] =
          zoom >= CLUSTER_MAX_ZOOM
            ? spreadOverlappingPins(entries, zoom).map((spread) => ({
                latitude: spread.latitude,
                longitude: spread.longitude,
                items: [spread.item],
              }))
            : groupMarkersByProximity(entries, zoom);

        // ラベルは拡大時かつ周囲に空きがあるピンだけ。近くに他のマーカーがあると
        // ラベル同士が重なるか、隣のピンを覆ってしまう。
        const hasLabelRoom =
          zoom >= PIN_LABEL_MIN_ZOOM ? findPointsWithLabelRoom(displayed, zoom) : null;

        displayed.forEach((group, index) => {
          const lngLat: [number, number] = [group.longitude, group.latitude];
          if (group.items.length === 1) {
            const entry = group.items[0];
            addMarker(entry.report, entry.isPending, lngLat, hasLabelRoom?.[index] ?? false);
          } else {
            addClusterMarker(lngLat, group.items, zoom);
          }
        });
      } catch (error) {
        console.error("Error adding markers:", error);
      }
    };

    renderMarkers();
    map.on('zoomend', renderMarkers);

    return () => {
      map.off('zoomend', renderMarkers);
      removeRenderedMarkers()
    };
  // Re-evaluate dependencies: mapStyle might not be needed if markers don't change with style
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dangerReports, pendingReports, showPending, mapInitializedRef.current]); // Removed mapStyle, is3DEnabled, selectedLocation
}
