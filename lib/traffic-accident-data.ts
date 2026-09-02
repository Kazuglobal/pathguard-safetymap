/**
 * traffic-accident-data.ts
 * 交通事故統計データ クライアントライブラリ v3
 * PathGuardian - 通学路安全マップ
 *
 * 拡張版 get_nearby_accident_stats v2 対応
 * - 道路環境分析（道路形状・歩車道区分・交差点率・歩道なし率）
 * - 当事者分析（年齢層分布・高齢者率・若年者率）
 * - 時間帯分析（24時間分布・月別分布・ピーク時間/月）
 * - 状況サマリー（自然言語テキスト）
 * - 事故詳細（発生日時・道路形状・歩車道区分・当事者年齢・座標）
 */

"use client";

import {
  ACCIDENT_IMAGE_CONTEXT_PARAMS,
  adjustYearsForAccidentDataset,
  DEFAULT_ACCIDENT_YEARS,
  normalizeSummaryYearText,
} from "@/lib/accident-stats-year-window";

// ============================================================
// 型定義
// ============================================================

export interface NearbyAccident {
  distance_m: number;
  year: number;
  occurred_at: string | null;
  type: string | null;
  severity: "fatal" | "injury";
  fatalities: number;
  injuries: number;
  involved_child: boolean;
  involved_pedestrian: boolean;
  weather: string | null;
  road_shape: string | null;
  sidewalk: string | null;
  road_surface: string | null;
  terrain: string | null;
  party_a_type: string | null;
  party_b_type: string | null;
  injury_a: string | null;
  injury_b: string | null;
  party_a_age: number | null;
  party_b_age: number | null;
  latitude: number;
  longitude: number;
}

export interface RoadEnvironment {
  by_road_shape: Record<string, number>;
  by_sidewalk: Record<string, number>;
  intersection_ratio: number;
  no_sidewalk_ratio: number;
}

export interface PartyAnalysis {
  by_age_group: Record<string, number>;
  elderly_ratio: number;
  young_ratio: number;
}

export interface TimeAnalysis {
  by_hour: Record<string, number>;
  by_month: Record<string, number>;
  peak_hour: number | null;
  peak_month: number | null;
}

export interface SituationSummary {
  total_text: string;
  severity_text: string;
  pedestrian_text: string;
  weather_risk_text: string;
  road_text: string;
  surface_text: string | null;
  elderly_text: string | null;
}

export interface InjuryAnalysis {
  by_injury_level: Record<string, number>;
  severe_ratio: number;
}

export interface AccidentStats {
  total_accidents: number;
  total_fatalities: number;
  total_injuries: number;
  child_involved: number;
  pedestrian_involved: number;
  fatal_accidents: number;
  by_year: Record<string, number>;
  by_time_of_day: Record<string, number>;
  by_weather: Record<string, number>;
  by_accident_type: Record<string, number>;
  by_party_type: Record<string, number>;
  by_road_surface: Record<string, number>;
  by_terrain: Record<string, number>;
  injury_analysis: InjuryAnalysis;
  road_environment: RoadEnvironment;
  party_analysis: PartyAnalysis;
  time_analysis: TimeAnalysis;
  situation_summary: SituationSummary;
  nearest_accidents: NearbyAccident[];
  risk_score: number;
  search_params: {
    latitude: number;
    longitude: number;
    radius_meters: number;
    years: number;
  };
}

export interface RiskLevelInfo {
  level: string;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  description: string;
}

// ============================================================
// リスクレベル判定
// ============================================================
export function getAccidentRiskLevel(score: number): RiskLevelInfo {
  if (score >= 80)
    return {
      level: "critical",
      label: "非常に危険",
      emoji: "🔴",
      color: "#DC2626",
      bgColor: "#FEE2E2",
      description: "過去5年で多数の事故が発生。最大限の注意が必要です。",
    };
  if (score >= 50)
    return {
      level: "high",
      label: "危険",
      emoji: "🟠",
      color: "#EA580C",
      bgColor: "#FFEDD5",
      description:
        "事故が複数回発生しています。通学時は見守りを推奨します。",
    };
  if (score >= 30)
    return {
      level: "moderate",
      label: "やや危険",
      emoji: "🟡",
      color: "#CA8A04",
      bgColor: "#FEF9C3",
      description:
        "一定の事故リスクがあります。子どもへの注意喚起が効果的です。",
    };
  if (score >= 10)
    return {
      level: "low",
      label: "注意",
      emoji: "🔵",
      color: "#2563EB",
      bgColor: "#DBEAFE",
      description: "少数の事故記録があります。基本的な交通ルールの確認を。",
    };
  return {
    level: "safe",
    label: "安全",
    emoji: "🟢",
    color: "#16A34A",
    bgColor: "#DCFCE7",
    description: "近隣での事故記録はほぼありません。",
  };
}

// ============================================================
// 時間帯ラベル
// ============================================================
export function getTimeSlotLabel(slot: string): string {
  const map: Record<string, string> = {
    "07-09_morning_commute": "🌅 朝の通学時間 (7-9時)",
    "14-17_after_school": "🏫 下校時間 (14-17時)",
    "17-19_evening": "🌆 夕方 (17-19時)",
    other: "その他の時間帯",
  };
  return map[slot] || slot;
}

// ============================================================
// D1 Route Handler 呼び出し
// ============================================================
export async function getAccidentStatsRPC(params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  years?: number;
}): Promise<AccidentStats> {
  const requestedYears = params.years ?? DEFAULT_ACCIDENT_YEARS;
  const adjustedYears = adjustYearsForAccidentDataset(requestedYears);
  const radiusMeters = params.radiusMeters ?? ACCIDENT_IMAGE_CONTEXT_PARAMS.radiusMeters;

  const query = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    radiusMeters: String(radiusMeters),
    years: String(adjustedYears),
  });
  const response = await fetch(`/api/traffic-accidents/nearby?${query.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error("事故統計取得エラー: " + (body?.error ?? `HTTP ${response.status}`));
  }
  const stats = await response.json() as AccidentStats;

  // UI表示はユーザー要求年数を優先（DB年限補正はRPC引数側で吸収）
  if (stats?.search_params) {
    stats.search_params.years = requestedYears;
  }
  if (stats?.situation_summary?.total_text) {
    stats.situation_summary.total_text = normalizeSummaryYearText(
      stats.situation_summary.total_text,
      requestedYears
    );
  }

  return stats;
}
/** レポート座標の事故統計をサーバ側で再計算し、D1へ保存する。 */
export async function enrichReportWithAccidents(reportId: string): Promise<AccidentStats | null> {
  if (!reportId || reportId.length > 128) return null;
  const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/accident-stats`, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `事故統計の保存に失敗しました (HTTP ${response.status})`);
  }
  const body = await response.json() as { stats?: AccidentStats };
  return body.stats ?? null;
}
