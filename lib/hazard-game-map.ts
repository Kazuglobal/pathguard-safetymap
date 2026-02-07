/**
 * 地図マーカー生成ユーティリティ (A9: MapAgent 相当)
 *
 * PipelineAnalysisResult から地図表示用の
 * マーカーデータと GeoJSON を生成する純粋関数。
 */

import type {
  PipelineAnalysisResult,
  SafetyScore,
  SafetyLevel,
} from "./hazard-game-types"

// ---- Types ----

export interface HazardMapMarker {
  readonly lat: number
  readonly lng: number
  readonly score: SafetyScore
  readonly analysisTimestamp: string
  readonly topHazards: readonly string[]
}

export interface GeoJSONFeature {
  readonly type: "Feature"
  readonly geometry: {
    readonly type: "Point"
    readonly coordinates: readonly [number, number]
  }
  readonly properties: {
    readonly score: number
    readonly level: SafetyLevel
    readonly color: string
    readonly topHazards: readonly string[]
    readonly analysisTimestamp: string
  }
}

export interface GeoJSONFeatureCollection {
  readonly type: "FeatureCollection"
  readonly features: readonly GeoJSONFeature[]
}

// ---- Constants ----

const MARKER_COLORS: Record<SafetyLevel, string> = {
  safe: "#22c55e",
  caution: "#eab308",
  warning: "#f97316",
  danger: "#ef4444",
}

// ---- Public API ----

export function getMarkerColor(level: SafetyLevel): string {
  return MARKER_COLORS[level]
}

export function createHazardMarker(
  result: PipelineAnalysisResult,
  lat: number,
  lng: number
): HazardMapMarker {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(
      `Invalid GPS coordinates: lat=${lat}, lng=${lng}. ` +
      `Valid range: lat [-90, 90], lng [-180, 180]`
    )
  }

  const hazardLabels = result.vision.hazards.map((h) => h.label)
  const highRiskDescriptions = result.think.contextualRisks
    .filter((r) => r.severity === "high")
    .map((r) => r.description)
    .filter((desc) => !hazardLabels.includes(desc))

  const topHazards = [...hazardLabels, ...highRiskDescriptions].slice(0, 5)

  return {
    lat,
    lng,
    score: result.score,
    analysisTimestamp: result.analysisTimestamp,
    topHazards,
  }
}

export function markerToGeoJSON(marker: HazardMapMarker): GeoJSONFeature {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [marker.lng, marker.lat],
    },
    properties: {
      score: marker.score.score,
      level: marker.score.level,
      color: getMarkerColor(marker.score.level),
      topHazards: marker.topHazards,
      analysisTimestamp: marker.analysisTimestamp,
    },
  }
}

export function markersToFeatureCollection(
  markers: readonly HazardMapMarker[]
): GeoJSONFeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map(markerToGeoJSON),
  }
}
