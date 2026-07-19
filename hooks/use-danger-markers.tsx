"use client"

import {
  useEffect,
  type CSSProperties,
  type ElementType,
  type MutableRefObject,
} from "react"
import mapboxgl from "mapbox-gl"
import { createRoot } from "react-dom/client"
import {
  AlertTriangle,
  Car,
  Circle,
  HelpCircle,
  MapPin,
  Shield,
  UserX,
} from "lucide-react"
import type { DangerReport } from "@/lib/types"
import { addPoints } from "@/lib/gamification"
import { SUSPICIOUS_DANGER_TYPE } from "@/lib/suspicious-alert"
import { getDangerLevelPresentation } from "@/lib/report-generation/danger-level-presentation"
import { isValidCoordinates } from "@/lib/coordinates"
import {
  groupMarkersByProximity,
  spreadOverlappingPins,
  CLUSTER_MAX_ZOOM,
} from "@/lib/map/marker-clustering"

const DANGER_TYPE_LABELS: Record<string, string> = {
  traffic: "交通",
  crime: "犯罪",
  disaster: "災害",
  suspicious: "不審者",
  other: "その他",
}

const DANGER_TYPE_COLORS: Record<string, string> = {
  traffic: "#2563EB",
  crime: "#DC2626",
  disaster: "#F97316",
  suspicious: "#C0267E",
  other: "#475569",
}

const getDangerTypeMarkerClass = (dangerType: string) =>
  DANGER_TYPE_LABELS[dangerType]
    ? `danger-marker-${dangerType}`
    : "danger-marker-other"

const getDangerTypeLabel = (dangerType: string) =>
  DANGER_TYPE_LABELS[dangerType] ?? DANGER_TYPE_LABELS.other

const getDangerTypeColor = (dangerType: string) =>
  DANGER_TYPE_COLORS[dangerType] ?? DANGER_TYPE_COLORS.other

const getDangerTypeIcon = (dangerType: string): ElementType => {
  if (dangerType === "traffic") return Car
  if (dangerType === "crime") return Shield
  if (dangerType === "disaster") return AlertTriangle
  if (dangerType === SUSPICIOUS_DANGER_TYPE) return UserX
  return HelpCircle
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
        // zoomend は React の描画と同じフレームで発火することがあるため、
        // root の破棄を microtask に送り同期 unmount 警告を避ける。
        if (unmount) queueMicrotask(unmount)
      }
    }

    const addMarker = (
      report: DangerReport,
      isPending: boolean,
      displayLngLat: [number, number],
    ) => {
      const markerElement = document.createElement("div");
      const typeClass = getDangerTypeMarkerClass(report.danger_type);
      markerElement.className = `danger-marker${isPending ? " pending-marker" : ""} danger-level-${report.danger_level} ${typeClass}`;
      markerElement.setAttribute("role", "button");
      markerElement.setAttribute("tabindex", "0");
      markerElement.setAttribute(
        "aria-label",
        `${getDangerTypeLabel(report.danger_type)}の危険報告${isPending ? "（確認中）" : ""}。あぶなさ${getDangerLevelPresentation(report.danger_level).kidLabel}。詳細を開きます`,
      );

      // カテゴリは大きなピクトグラムと色、危険度は外周リングの本数で分離して示す。
      const root = createRoot(markerElement);
      const IconComponent = getDangerTypeIcon(report.danger_type);
      const categoryColor = getDangerTypeColor(report.danger_type);
      const dangerLevel = getDangerLevelPresentation(report.danger_level).level;
      root.render(
        <span
          className="danger-pin-visual"
          style={{ "--danger-category-color": categoryColor } as CSSProperties}
          aria-hidden="true"
        >
          <span className="danger-severity-halo">
            {Array.from({ length: dangerLevel }, (_, index) => (
              <Circle
                className={`danger-severity-ring danger-severity-ring-${index + 1}`}
                key={index}
              />
            ))}
          </span>
          <MapPin
            className="danger-pin-shape"
            fill={categoryColor}
            stroke="white"
            strokeWidth={2.6}
          />
          <IconComponent className="danger-pin-icon" strokeWidth={2.8} />
        </span>,
      );

      const marker = new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat(displayLngLat)
        .addTo(map);
      markerResources.push({ marker, unmount: () => root.unmount() })

      const openReport = async () => {
        onSelectReport(report);
        if (supabase && report.user_id) {
          try { await addPoints(supabase, report.user_id, 5); }
          catch (err) { console.error("Error adding points on marker click:", err); }
        }
      };

      markerElement.addEventListener("click", (e) => {
        e.stopPropagation();
        void openReport();
      });
      markerElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          void openReport();
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
      const size = Math.min(58, 44 + count * 2);
      const categoryPresentations = Array.from(
        new Map(
          entries.map(({ report }) => {
            const dangerType = DANGER_TYPE_LABELS[report.danger_type]
              ? report.danger_type
              : "other"
            return [
              dangerType,
              {
                Icon: getDangerTypeIcon(dangerType),
                color: getDangerTypeColor(dangerType),
              },
            ] as const
          }),
        ).values(),
      ).slice(0, 3)

      const markerElement = document.createElement("div");
      markerElement.className = "danger-cluster-marker";
      markerElement.style.setProperty("--cluster-size", `${size}px`);
      markerElement.setAttribute("role", "button");
      markerElement.setAttribute("tabindex", "0");
      markerElement.setAttribute(
        "aria-label",
        `このあたりに${count}件の報告があります。タップで拡大します`,
      );

      const root = createRoot(markerElement);
      root.render(
        <span className="danger-cluster-visual" aria-hidden="true">
          <MapPin
            className="danger-cluster-pin"
            fill="#FFFDF7"
            stroke={getDangerLevelPresentation(maxLevel).colorHex}
            strokeWidth={2.2}
          />
          <span className="danger-cluster-categories">
            {categoryPresentations.map(({ Icon, color }, index) => (
              <span
                className={`danger-cluster-category danger-cluster-category-${index + 1}`}
                style={{ backgroundColor: color }}
                key={`${color}-${index}`}
              >
                <Icon strokeWidth={3} />
              </span>
            ))}
          </span>
          <span className="danger-cluster-count">{count}</span>
        </span>,
      );

      const marker = new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat(lngLat)
        .addTo(map);
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
        if (zoom >= CLUSTER_MAX_ZOOM) {
          // 高ズーム: 重なりだけ扇状に散らして全件表示
          for (const spread of spreadOverlappingPins(entries, zoom)) {
            addMarker(spread.item.report, spread.item.isPending, [
              spread.longitude,
              spread.latitude,
            ]);
          }
        } else {
          // 通常ズーム: 近接ピンをクラスタへ
          for (const group of groupMarkersByProximity(entries, zoom)) {
            if (group.items.length === 1) {
              const entry = group.items[0];
              addMarker(entry.report, entry.isPending, [entry.longitude, entry.latitude]);
            } else {
              addClusterMarker([group.longitude, group.latitude], group.items, zoom);
            }
          }
        }
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
