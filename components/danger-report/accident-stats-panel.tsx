/**
 * accident-stats-panel.tsx
 * 交通事故統計 拡張表示パネル v3
 * PathGuardian - 通学路安全マップ
 *
 * 153万件の警察庁オープンデータから、事故の詳細状況・
 * 道路環境・当事者分析・時間帯分析をリッチUIで表示
 *
 * shadcn/ui + Tailwind CSS
 */

"use client";

import { useMemo, useState } from "react";
import type {
  NearbyAccident,
  RoadEnvironment,
  PartyAnalysis,
  TimeAnalysis,
  InjuryAnalysis,
  SituationSummary,
  AccidentStats,
  RiskLevelInfo,
} from "@/lib/traffic-accident-data";
import { getAccidentRiskLevel } from "@/lib/traffic-accident-data";

const MONTH_NAMES = [
  "",
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

const WEATHER_EMOJI: Record<string, string> = {
  晴: "☀️",
  曇: "☁️",
  雨: "🌧️",
  雪: "❄️",
  霧: "🌫️",
};

function ageLabel(code: number | null): string {
  if (code === null || code === 0) return "不明";
  if (code <= 1) return "24歳以下";
  return `${code}歳代`;
}

function toNonNegativeInt(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : 0;

  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

export function isFatalNearbyAccident(
  accident: Pick<NearbyAccident, "severity" | "fatalities">
): boolean {
  const severity = String((accident as { severity?: unknown }).severity ?? "")
    .trim()
    .toLowerCase();

  // DB由来の severity をそのまま採用する
  return severity === "fatal" || severity === "1";
}

export function deriveFatalAccidentCount(
  stats: Pick<AccidentStats, "fatal_accidents" | "total_fatalities" | "nearest_accidents">
): number {
  // DB集計値を最優先する（UI側で再推定しない）
  return toNonNegativeInt((stats as { fatal_accidents?: unknown }).fatal_accidents);
}

export function deriveSeveritySummaryText(
  stats: Pick<
    AccidentStats,
    "fatal_accidents" | "total_fatalities" | "nearest_accidents" | "situation_summary"
  >
): string {
  const backendText = stats.situation_summary?.severity_text?.trim() ?? "";
  if (backendText) return backendText;

  // DBテキストが欠損時のみ最小フォールバック
  const fatalAccidentCount = deriveFatalAccidentCount(stats);
  if (fatalAccidentCount > 0) {
    return `死亡事故${fatalAccidentCount}件が確認されています`;
  }
  return "この地点の死亡事故なし";
}

// ============================================================
// タブコンポーネント
// ============================================================
function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
            active === t.id
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// リスクスコアバー
// ============================================================
function RiskScoreBar({ score }: { score: number }) {
  const risk = getAccidentRiskLevel(score);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">事故リスクスコア</span>
        <span className="text-lg font-bold" style={{ color: risk.color }}>
          {score}
          <span className="text-xs text-gray-400 font-normal">/100</span>
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(100, score)}%`,
            background: `linear-gradient(90deg, ${risk.color}88, ${risk.color})`,
          }}
        />
      </div>
      <p className="text-xs text-gray-500">{risk.description}</p>
    </div>
  );
}

// ============================================================
// 状況サマリーカード (NEW)
// ============================================================
function SituationSummaryCard({
  summary,
  risk,
  severityText,
}: {
  summary: SituationSummary;
  risk: RiskLevelInfo;
  severityText: string;
}) {
  const items = [
    { icon: "📋", text: summary.total_text },
    { icon: "💀", text: severityText },
    { icon: "🚶", text: summary.pedestrian_text },
    { icon: "🌧️", text: summary.weather_risk_text },
    { icon: "🛣️", text: summary.road_text },
  ];
  if (summary.elderly_text) {
    items.push({ icon: "👴", text: summary.elderly_text });
  }

  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      style={{ borderColor: risk.color + "40", backgroundColor: risk.bgColor + "60" }}
    >
      <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1">
        📝 この地点の事故状況
      </h4>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
            <span className="shrink-0 mt-0.5">{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 統計カード
// ============================================================
function StatCard({
  label,
  value,
  sub,
  highlight,
  icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  highlight?: boolean;
  icon?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 text-center ${
        highlight ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
      }`}
    >
      {icon && <div className="text-base mb-0.5">{icon}</div>}
      <div
        className={`text-lg font-bold leading-none ${
          highlight ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
      {sub && (
        <div className="text-[9px] text-gray-400 mt-0.5">{sub}</div>
      )}
    </div>
  );
}

// ============================================================
// 道路環境分析タブ (NEW)
// ============================================================
function RoadEnvironmentPanel({ env }: { env: RoadEnvironment }) {
  const shapeEntries = Object.entries(env.by_road_shape || {}).sort(
    (a, b) => b[1] - a[1]
  );
  const sidewalkEntries = Object.entries(env.by_sidewalk || {}).sort(
    (a, b) => b[1] - a[1]
  );
  const shapeTotal = shapeEntries.reduce((s, [, v]) => s + v, 0);
  const sidewalkTotal = sidewalkEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-4 py-2">
      {/* 警告バナー */}
      {(env.intersection_ratio >= 60 || env.no_sidewalk_ratio >= 30) && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 space-y-1">
          {env.intersection_ratio >= 60 && (
            <p className="text-xs text-amber-800 flex items-center gap-1.5">
              <span>⚠️</span>
              事故の <strong>{env.intersection_ratio}%</strong> が交差点で発生しています
            </p>
          )}
          {env.no_sidewalk_ratio >= 30 && (
            <p className="text-xs text-amber-800 flex items-center gap-1.5">
              <span>⚠️</span>
              歩車道の区分がない場所での事故が <strong>{env.no_sidewalk_ratio}%</strong>
            </p>
          )}
        </div>
      )}

      {/* 道路形状 */}
      {shapeEntries.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700">🛣️ 道路形状別</h4>
          {shapeEntries.map(([label, count]) => {
            const pct = shapeTotal > 0 ? Math.round((count / shapeTotal) * 100) : 0;
            const isIntersection = label.includes("交差点");
            return (
              <div key={label} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className={isIntersection ? "text-orange-700 font-medium" : "text-gray-600"}>
                    {isIntersection ? "🔶 " : ""}
                    {label}
                  </span>
                  <span className="text-gray-400">{count}件 ({pct}%)</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isIntersection ? "#f97316" : "#94a3b8",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 歩車道区分 */}
      {sidewalkEntries.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700">🚶 歩車道区分別</h4>
          {sidewalkEntries.map(([label, count]) => {
            const pct =
              sidewalkTotal > 0 ? Math.round((count / sidewalkTotal) * 100) : 0;
            const noSidewalk = label.includes("区分なし") || label.includes("区別なし");
            return (
              <div key={label} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className={noSidewalk ? "text-red-600 font-medium" : "text-gray-600"}>
                    {noSidewalk ? "🚨 " : ""}
                    {label}
                  </span>
                  <span className="text-gray-400">{count}件 ({pct}%)</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: noSidewalk ? "#dc2626" : "#94a3b8",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 当事者分析タブ (NEW)
// ============================================================
function PartyAnalysisPanel({ party }: { party: PartyAnalysis }) {
  const ageEntries = Object.entries(party.by_age_group || {}).sort((a, b) => {
    const order = [
      "24歳以下",
      "25-34歳",
      "35-44歳",
      "45-54歳",
      "55-64歳",
      "65-74歳",
      "75歳以上",
    ];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  });
  const maxAge = Math.max(...ageEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-4 py-2">
      {/* 高齢者・若年者の警告 */}
      {(party.elderly_ratio >= 30 || party.young_ratio >= 20) && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 space-y-1">
          {party.elderly_ratio >= 30 && (
            <p className="text-xs text-amber-800 flex items-center gap-1.5">
              <span>👴</span>
              高齢者（65歳以上）が当事者の <strong>{party.elderly_ratio}%</strong> に関与
            </p>
          )}
          {party.young_ratio >= 20 && (
            <p className="text-xs text-amber-800 flex items-center gap-1.5">
              <span>🧑</span>
              若年者（24歳以下）が当事者の <strong>{party.young_ratio}%</strong> に関与
            </p>
          )}
        </div>
      )}

      {/* 年齢層分布（横棒グラフ） */}
      {ageEntries.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700">👥 当事者の年齢層分布</h4>
          {ageEntries.map(([label, count]) => {
            const pct = Math.round((count / maxAge) * 100);
            const isElderly = label.includes("65") || label.includes("75");
            const isYoung = label.includes("24");
            return (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={`text-[11px] w-16 shrink-0 text-right ${
                    isElderly
                      ? "text-orange-700 font-medium"
                      : isYoung
                      ? "text-blue-700 font-medium"
                      : "text-gray-500"
                  }`}
                >
                  {label}
                </span>
                <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isElderly
                        ? "#ea580c"
                        : isYoung
                        ? "#2563eb"
                        : "#64748b",
                    }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 w-8 shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 関与率サマリー */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="高齢者関与率"
          value={`${party.elderly_ratio}%`}
          icon="👴"
          highlight={party.elderly_ratio >= 30}
        />
        <StatCard
          label="若年者関与率"
          value={`${party.young_ratio}%`}
          icon="🧑"
          highlight={party.young_ratio >= 25}
        />
      </div>
    </div>
  );
}

// ============================================================
// 時間帯分析タブ (NEW)
// ============================================================
function TimeAnalysisPanel({
  time,
  byWeather,
}: {
  time: TimeAnalysis;
  byWeather: Record<string, number>;
}) {
  const hourEntries = Object.entries(time.by_hour || {})
    .map(([h, c]) => [parseInt(h), c] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const maxHour = Math.max(...hourEntries.map(([, v]) => v), 1);

  const monthEntries = Object.entries(time.by_month || {})
    .map(([m, c]) => [parseInt(m), c] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const maxMonth = Math.max(...monthEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-4 py-2">
      {/* ピーク表示 */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="最多発生時間"
          value={time.peak_hour !== null ? `${time.peak_hour}時台` : "-"}
          icon="⏰"
          highlight={
            time.peak_hour !== null &&
            (time.peak_hour >= 7 && time.peak_hour <= 8)
          }
          sub={
            time.peak_hour !== null &&
            time.peak_hour >= 7 &&
            time.peak_hour <= 8
              ? "通学時間帯"
              : time.peak_hour !== null &&
                time.peak_hour >= 14 &&
                time.peak_hour <= 16
              ? "下校時間帯"
              : undefined
          }
        />
        <StatCard
          label="最多発生月"
          value={
            time.peak_month !== null
              ? MONTH_NAMES[time.peak_month] || "-"
              : "-"
          }
          icon="📅"
        />
      </div>

      {/* 24時間分布 */}
      {hourEntries.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700">⏰ 24時間分布</h4>
          <div className="flex items-end gap-px h-16">
            {Array.from({ length: 24 }, (_, h) => {
              const count =
                hourEntries.find(([hr]) => hr === h)?.[1] || 0;
              const height = maxHour > 0 ? (count / maxHour) * 100 : 0;
              const isSchool =
                (h >= 7 && h <= 8) || (h >= 14 && h <= 16);
              return (
                <div
                  key={h}
                  className="flex-1 flex flex-col items-center justify-end"
                  title={`${h}時: ${count}件`}
                >
                  <div
                    className="w-full rounded-t transition-all duration-300"
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      backgroundColor: isSchool
                        ? "#f97316"
                        : count > 0
                        ? "#60a5fa"
                        : "#e5e7eb",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] text-gray-400 px-0.5">
            <span>0</span>
            <span>6</span>
            <span className="text-orange-500 font-bold">7-8</span>
            <span>12</span>
            <span className="text-orange-500 font-bold">14-16</span>
            <span>18</span>
            <span>23</span>
          </div>
          <p className="text-[9px] text-gray-400 text-center">
            🟧 = 通学・下校時間帯
          </p>
        </div>
      )}

      {/* 月別分布 */}
      {monthEntries.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700">📅 月別分布</h4>
          <div className="flex items-end gap-1 h-12">
            {Array.from({ length: 12 }, (_, m) => {
              const count =
                monthEntries.find(([mo]) => mo === m + 1)?.[1] || 0;
              const height = maxMonth > 0 ? (count / maxMonth) * 100 : 0;
              return (
                <div
                  key={m}
                  className="flex-1 flex flex-col items-center gap-0.5"
                  title={`${m + 1}月: ${count}件`}
                >
                  <span className="text-[8px] text-gray-400">
                    {count > 0 ? count : ""}
                  </span>
                  <div
                    className="w-full rounded-t transition-all duration-300"
                    style={{
                      height: `${Math.max(height, 3)}%`,
                      backgroundColor:
                        count === Math.max(...monthEntries.map(([, c]) => c))
                          ? "#f97316"
                          : "#93c5fd",
                    }}
                  />
                  <span className="text-[8px] text-gray-400">{m + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 天候別 */}
      {byWeather && Object.keys(byWeather).length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700">🌤️ 天候別</h4>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(byWeather)
              .sort((a, b) => b[1] - a[1])
              .map(([w, c]) => {
                const isBad = w === "雨" || w === "雪" || w === "霧";
                return (
                  <span
                    key={w}
                    className={`inline-flex items-center gap-0.5 rounded-full border px-2.5 py-1 text-xs ${
                      isBad
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    {WEATHER_EMOJI[w] || ""} {w} {c}件
                  </span>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 安全分析パネル（v3新規: 当事者種別・損傷程度・路面状態）
// ============================================================
function SafetyAnalysisPanel({
  stats,
}: {
  stats: AccidentStats;
}) {
  const partyTypes = stats.by_party_type || {};
  const roadSurface = stats.by_road_surface || {};
  const terrain = stats.by_terrain || {};
  const injury = stats.injury_analysis || { by_injury_level: {}, severe_ratio: 0 };

  const maxParty = Math.max(...Object.values(partyTypes), 1);
  const maxSurface = Math.max(...Object.values(roadSurface), 1);
  const maxInjury = Math.max(...Object.values(injury.by_injury_level).filter((_, i) => true), 1);

  return (
    <div className="space-y-5 pt-3">
      {/* 当事者種別 */}
      {Object.keys(partyTypes).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            🚗 当事者種別（A+B合算）
          </h4>
          <div className="space-y-1.5">
            {Object.entries(partyTypes)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 6)
              .map(([label, count]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-28 truncate text-right">
                    {label}
                  </span>
                  <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded transition-all"
                      style={{ width: `${(count / maxParty) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-gray-700 w-8 text-right">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 損傷程度 */}
      {Object.keys(injury.by_injury_level).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            🩹 損傷程度（重傷以上: {injury.severe_ratio}%）
          </h4>
          <div className="space-y-1.5">
            {Object.entries(injury.by_injury_level)
              .filter(([label]) => !["0", "対象外当事者"].includes(label))
              .sort(([, a], [, b]) => b - a)
              .map(([label, count]) => {
                const color =
                  label === "死亡" ? "#DC2626" :
                  label === "重傷" ? "#EA580C" :
                  label === "負傷" || label === "軽傷" ? "#CA8A04" :
                  "#6B7280";
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 w-16 text-right">
                      {label}
                    </span>
                    <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${(count / maxInjury) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-gray-700 w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 路面状態 */}
      {Object.keys(roadSurface).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            🌧️ 路面状態
          </h4>
          <div className="space-y-1.5">
            {Object.entries(roadSurface)
              .sort(([, a], [, b]) => b - a)
              .map(([label, count]) => {
                const color =
                  label.includes("乾燥") ? "#16A34A" :
                  label.includes("湿潤") ? "#2563EB" :
                  label.includes("凍結") || label.includes("積雪") ? "#7C3AED" :
                  "#6B7280";
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 w-24 truncate text-right">
                      {label}
                    </span>
                    <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${(count / maxSurface) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-gray-700 w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 地形 */}
      {Object.keys(terrain).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            🏙️ 地形区分
          </h4>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(terrain)
              .sort(([, a], [, b]) => b - a)
              .map(([label, count]) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700"
                >
                  {label}: {count}件
                </span>
              ))}
          </div>
        </div>
      )}

      {/* サマリーテキスト */}
      {stats.situation_summary?.surface_text && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <p className="text-[11px] text-amber-800">
            ⚠️ {stats.situation_summary.surface_text}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 事故詳細リスト（タブ内容） (NEW - 大幅拡張)
// ============================================================
function AccidentDetailList({
  accidents,
}: {
  accidents: NearbyAccident[];
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!accidents || accidents.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-4">
        近隣に事故データはありません
      </p>
    );
  }

  return (
    <div className="space-y-1.5 py-2">
      <h4 className="text-xs font-semibold text-gray-700">
        📍 近隣事故 {accidents.length}件（距離順）
      </h4>
      <div className="space-y-1">
        {accidents.map((acc, i) => {
          const isOpen = expanded === i;
          const isFatal = isFatalNearbyAccident(acc);
          const isPed = acc.type?.includes("人対車両");
          return (
            <div
              key={i}
              className={`rounded-lg border overflow-hidden transition-colors ${
                isFatal
                  ? "border-red-300 bg-red-50"
                  : isPed
                  ? "border-orange-200 bg-orange-50/50"
                  : "border-gray-200 bg-white"
              }`}
            >
              {/* ヘッダー行（クリックで展開） */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                onClick={() => setExpanded(isOpen ? null : i)}
              >
                <span className="font-mono text-[10px] text-gray-400 w-10 shrink-0">
                  {acc.distance_m}m
                </span>
                <span className="text-xs text-gray-700 flex-1 truncate">
                  {isFatal && "💀 "}
                  {isPed && !isFatal && "🚶 "}
                  {acc.type || "不明"}
                </span>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {acc.occurred_at?.slice(0, 10) || `${acc.year}年`}
                </span>
                <svg
                  className={`h-3 w-3 text-gray-400 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* 展開時の詳細 */}
              {isOpen && (
                <div className="px-3 pb-2.5 pt-0 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] mt-2">
                    <Detail label="発生日時" value={acc.occurred_at || `${acc.year}年`} />
                    <Detail
                      label="重傷度"
                      value={
                        isFatal
                          ? `死亡（${acc.fatalities}名）`
                          : `負傷（${acc.injuries}名）`
                      }
                      highlight={isFatal}
                    />
                    <Detail
                      label="天候"
                      value={
                        acc.weather
                          ? `${WEATHER_EMOJI[acc.weather] || ""} ${acc.weather}`
                          : "不明"
                      }
                    />
                    <Detail label="道路形状" value={acc.road_shape || "不明"} />
                    <Detail label="歩車道区分" value={acc.sidewalk || "不明"} />
                    <Detail label="路面状態" value={acc.road_surface || "不明"} />
                    <Detail label="事故類型" value={acc.type || "不明"} />
                    <Detail
                      label="当事者A"
                      value={`${acc.party_a_type || "不明"} (${ageLabel(acc.party_a_age)}) ${acc.injury_a ? `[${acc.injury_a}]` : ""}`}
                    />
                    <Detail
                      label="当事者B"
                      value={`${acc.party_b_type || "不明"} (${ageLabel(acc.party_b_age)}) ${acc.injury_b ? `[${acc.injury_b}]` : ""}`}
                    />
                  </div>
                  {/* タグ */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {acc.involved_pedestrian && (
                      <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[9px] font-medium">
                        🚶 歩行者関与
                      </span>
                    )}
                    {acc.involved_child && (
                      <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-[9px] font-medium">
                        🎒 子ども関与
                      </span>
                    )}
                    {isFatal && (
                      <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-medium">
                        💀 死亡事故
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <span className="text-gray-400">{label}: </span>
      <span className={highlight ? "text-red-600 font-semibold" : "text-gray-700"}>
        {value}
      </span>
    </div>
  );
}

// ============================================================
// 事故概要タブ（旧fullモードの集約）
// ============================================================
function OverviewPanel({
  stats,
  risk,
}: {
  stats: AccidentStats;
  risk: RiskLevelInfo;
}) {
  const fatalAccidentCount = deriveFatalAccidentCount(stats);
  const severitySummaryText = deriveSeveritySummaryText(stats);
  const yearEntries = Object.entries(stats.by_year || {}).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const maxYear = Math.max(...yearEntries.map(([, v]) => v), 1);

  const typeEntries = Object.entries(stats.by_accident_type || {}).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="space-y-4 py-2">
      {/* 状況サマリー */}
      {stats.situation_summary && (
        <SituationSummaryCard
          summary={stats.situation_summary}
          risk={risk}
          severityText={severitySummaryText}
        />
      )}

      {/* 統計カード4列 */}
      <div className="grid grid-cols-4 gap-1.5">
        <StatCard label="事故件数" value={stats.total_accidents} icon="📊" />
        <StatCard
          label="歩行者"
          value={stats.pedestrian_involved}
          highlight={stats.pedestrian_involved > 0}
          icon="🚶"
        />
        <StatCard
          label="子ども"
          value={stats.child_involved}
          highlight={stats.child_involved > 0}
          icon="🎒"
        />
        <StatCard
          label="死亡事故"
          value={fatalAccidentCount}
          highlight={fatalAccidentCount > 0}
          icon="💀"
        />
      </div>

      {/* 年度別推移 */}
      {yearEntries.length > 1 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700">📈 年度別推移</h4>
          <div className="flex items-end gap-1.5 h-14">
            {yearEntries.map(([year, count]) => {
              const height = (count / maxYear) * 100;
              return (
                <div
                  key={year}
                  className="flex-1 flex flex-col items-center gap-0.5"
                >
                  <span className="text-[9px] text-gray-500 font-medium">
                    {count}
                  </span>
                  <div
                    className="w-full rounded-t transition-all duration-500"
                    style={{
                      height: `${Math.max(height, 5)}%`,
                      background: "linear-gradient(180deg, #3b82f6, #60a5fa)",
                    }}
                  />
                  <span className="text-[9px] text-gray-400">
                    {year.slice(2)}'
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 事故タイプ */}
      {typeEntries.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700">🚗 事故タイプ</h4>
          {typeEntries.map(([type, count]) => {
            const isPed = type.includes("人対車両");
            return (
              <div
                key={type}
                className={`flex justify-between items-center text-xs rounded px-2 py-1 ${
                  isPed
                    ? "bg-red-50 text-red-700"
                    : "bg-gray-50 text-gray-600"
                }`}
              >
                <span>
                  {isPed && "🚶 "}
                  {type}
                </span>
                <span className="font-semibold">{count}件</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// コンパクトモード
// ============================================================
function CompactPanel({ stats }: { stats: AccidentStats }) {
  const risk = getAccidentRiskLevel(stats.risk_score);
  const severitySummaryText = deriveSeveritySummaryText(stats);
  return (
    <div className="p-4 space-y-3">
      <RiskScoreBar score={stats.risk_score} />
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="事故件数" value={stats.total_accidents} icon="📊" />
        <StatCard
          label="歩行者事故"
          value={stats.pedestrian_involved}
          highlight={stats.pedestrian_involved > 0}
          icon="🚶"
        />
      </div>
      {/* コンパクトでも状況サマリーの主要ポイントを表示 */}
      {stats.situation_summary && (
        <div className="text-[11px] text-gray-600 space-y-0.5 bg-gray-50 rounded-lg p-2">
          <p>{severitySummaryText}</p>
          <p>{stats.situation_summary.pedestrian_text}</p>
          {stats.situation_summary.elderly_text && (
            <p>{stats.situation_summary.elderly_text}</p>
          )}
        </div>
      )}
      <p className="text-[9px] text-gray-400 text-center">
        半径{stats.search_params.radius_meters}m / 過去
        {stats.search_params.years}年 ・出典: 警察庁オープンデータ
      </p>
    </div>
  );
}

// ============================================================
// ローディング / データなし
// ============================================================
export function AccidentStatsLoading() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-4 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-200" />
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100 mb-4" />
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

export function AccidentStatsEmpty({ radius }: { radius: number }) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
      <div className="text-2xl mb-1">✅</div>
      <p className="text-sm font-medium text-green-800">
        半径{radius}m以内に交通事故の記録はありません
      </p>
      <p className="text-xs text-green-600 mt-1">
        過去5年間の警察庁オープンデータに基づく
      </p>
    </div>
  );
}

// ============================================================
// AccidentStatsPanel - メインコンポーネント
// ============================================================
const TAB_LIST = [
  { id: "overview", label: "概要", icon: "📊" },
  { id: "road", label: "道路環境", icon: "🛣️" },
  { id: "party", label: "当事者", icon: "👥" },
  { id: "safety", label: "安全分析", icon: "🛡️" },
  { id: "time", label: "時間帯", icon: "⏰" },
  { id: "detail", label: "事故詳細", icon: "📋" },
];

export default function AccidentStatsPanel({
  stats,
  mode = "full",
}: {
  stats: AccidentStats;
  mode?: "full" | "compact";
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const risk = useMemo(
    () => getAccidentRiskLevel(stats.risk_score),
    [stats.risk_score]
  );

  if (stats.total_accidents === 0) {
    return <AccidentStatsEmpty radius={stats.search_params.radius_meters} />;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* ── ヘッダー ── */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: risk.bgColor }}
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke={risk.color}
            strokeWidth={2}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: risk.color }}>
            交通事故データ
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: risk.color + "20", color: risk.color }}
        >
          {risk.emoji} {risk.label}
        </span>
      </div>

      {/* ── コンパクトモード ── */}
      {mode === "compact" ? (
        <CompactPanel stats={stats} />
      ) : (
        <>
          {/* リスクスコアバー */}
          <div className="px-4 pt-3">
            <RiskScoreBar score={stats.risk_score} />
          </div>

          {/* タブ */}
          <div className="mt-3">
            <Tabs
              tabs={TAB_LIST}
              active={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {/* タブコンテンツ */}
          <div className="px-4 pb-4">
            {activeTab === "overview" && (
              <OverviewPanel stats={stats} risk={risk} />
            )}
            {activeTab === "road" && stats.road_environment && (
              <RoadEnvironmentPanel env={stats.road_environment} />
            )}
            {activeTab === "party" && stats.party_analysis && (
              <PartyAnalysisPanel party={stats.party_analysis} />
            )}
            {activeTab === "time" && stats.time_analysis && (
              <TimeAnalysisPanel
                time={stats.time_analysis}
                byWeather={stats.by_weather}
              />
            )}
            {activeTab === "safety" && (
              <SafetyAnalysisPanel stats={stats} />
            )}
            {activeTab === "detail" && (
              <AccidentDetailList accidents={stats.nearest_accidents} />
            )}
          </div>

          {/* フッター */}
          <div className="border-t px-4 py-2 text-[9px] text-gray-400 text-center space-y-0.5">
            <p>
              半径{stats.search_params.radius_meters}m以内 / 過去
              {stats.search_params.years}年間 / {stats.total_accidents}件
            </p>
            <p>出典: 警察庁「交通事故統計情報のオープンデータ」</p>
          </div>
        </>
      )}
    </div>
  );
}
