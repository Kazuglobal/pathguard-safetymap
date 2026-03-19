/**
 * accident-stats-panel.tsx
 * 交通事故統計 拡張表示パネル v4
 * PathGuardian - 通学路安全マップ
 *
 * 153万件の警察庁オープンデータから、事故の詳細状況・
 * 道路環境・当事者分析・時間帯分析をリッチUIで表示
 *
 * shadcn/ui + Tailwind CSS
 */

"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart2,
  Clock,
  List,
  ShieldAlert,
  PersonStanding,
  Baby,
  AlertOctagon,
  UserRound,
  Calendar,
  TriangleAlert,
  CircleAlert,
  Users,
  Car,
  MapPin,
  TrendingUp,
  Activity,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import type {
  NearbyAccident,
  TimeAnalysis,
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

// 天候カラー（絵文字の代替）
const WEATHER_COLOR: Record<string, string> = {
  晴: "#F59E0B",
  曇: "#94A3B8",
  雨: "#3B82F6",
  雪: "#93C5FD",
  霧: "#D1D5DB",
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

  return severity === "fatal" || severity === "1";
}

export function deriveFatalAccidentCount(
  stats: Pick<AccidentStats, "fatal_accidents" | "total_fatalities" | "nearest_accidents">
): number {
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

  const fatalAccidentCount = deriveFatalAccidentCount(stats);
  if (fatalAccidentCount > 0) {
    return `死亡事故${fatalAccidentCount}件が確認されています`;
  }
  return "この地点の死亡事故なし";
}

// ============================================================
// タブコンポーネント（ピルスタイル）
// ============================================================
function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 px-3 py-2 bg-gray-50 border-b overflow-x-auto scrollbar-hide">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
            active === t.id
              ? "bg-white shadow-sm border border-gray-200 text-blue-600"
              : "text-gray-500 hover:bg-white hover:text-gray-700"
          }`}
        >
          <span className="shrink-0">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// リスクスコアバー（ゾーンカラー）T-07
// ============================================================
function RiskScoreBar({ score }: { score: number }) {
  const risk = getAccidentRiskLevel(score);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">事故リスクスコア</span>
        <span className="text-2xl font-bold leading-none" style={{ color: risk.color }}>
          {score}
          <span className="text-xs text-gray-400 font-normal ml-0.5">/100</span>
        </span>
      </div>
      {/* ゾーンカラー背景 + ポインター */}
      <div className="relative h-2 w-full rounded-full overflow-hidden bg-gradient-to-r from-green-300 via-yellow-300 to-red-400">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-white/30"
          style={{ width: `${Math.min(100, score)}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
          style={{
            left: `calc(${Math.min(100, score)}% - 6px)`,
            backgroundColor: risk.color,
          }}
        />
      </div>
      <p className="text-xs text-gray-600">{risk.description}</p>
    </div>
  );
}

// ============================================================
// 状況サマリーカード
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
    { icon: <ClipboardList size={13} className="shrink-0 mt-0.5" />, text: summary.total_text },
    { icon: <AlertOctagon size={13} className="shrink-0 mt-0.5 text-red-500" />, text: severityText },
    { icon: <PersonStanding size={13} className="shrink-0 mt-0.5" />, text: summary.pedestrian_text },
    { icon: <Activity size={13} className="shrink-0 mt-0.5" />, text: summary.weather_risk_text },
    { icon: <MapPin size={13} className="shrink-0 mt-0.5" />, text: summary.road_text },
  ];
  if (summary.elderly_text) {
    items.push({ icon: <UserRound size={13} className="shrink-0 mt-0.5" />, text: summary.elderly_text });
  }

  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      style={{ borderColor: risk.color + "40", backgroundColor: risk.bgColor + "60" }}
    >
      <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
        <ClipboardList size={13} />
        この地点の事故状況
      </h4>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
            {item.icon}
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 統計カード（横並びレイアウト）T-03
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
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg flex items-center gap-2 px-3 py-2.5 ${
        highlight
          ? "border border-red-100 border-l-4 border-l-red-400 bg-red-50"
          : "border border-gray-200 bg-white"
      }`}
    >
      {icon && (
        <span className={`shrink-0 ${highlight ? "text-red-400" : "text-gray-400"}`}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div
          className={`text-xl font-bold leading-none ${
            highlight ? "text-red-600" : "text-gray-900"
          }`}
        >
          {value}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">{label}</div>
        {sub && (
          <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// アラートバナー（左ボーダースタイル）T-05
// ============================================================
function AlertBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-amber-400 bg-amber-50 rounded-r-lg px-3 py-2 space-y-1">
      {children}
    </div>
  );
}

function AlertBannerItem({ text }: { text: React.ReactNode }) {
  return (
    <p className="text-xs text-amber-800 flex items-start gap-1.5">
      <TriangleAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
      <span>{text}</span>
    </p>
  );
}

// ============================================================
// 危険要因パネル（道路・当事者・安全分析の統合）T-04
// ============================================================
function DangerFactorsPanel({
  stats,
}: {
  stats: AccidentStats;
}) {
  const env = stats.road_environment;
  const party = stats.party_analysis;
  const partyTypes = stats.by_party_type || {};
  const roadSurface = stats.by_road_surface || {};

  const shapeEntries = Object.entries(env?.by_road_shape || {}).sort((a, b) => b[1] - a[1]);
  const shapeTotal = shapeEntries.reduce((s, [, v]) => s + v, 0);
  const sidewalkEntries = Object.entries(env?.by_sidewalk || {}).sort((a, b) => b[1] - a[1]);
  const sidewalkTotal = sidewalkEntries.reduce((s, [, v]) => s + v, 0);

  const ageEntries = Object.entries(party?.by_age_group || {}).sort((a, b) => {
    const order = ["24歳以下", "25-34歳", "35-44歳", "45-54歳", "55-64歳", "65-74歳", "75歳以上"];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  });
  const maxAge = Math.max(...ageEntries.map(([, v]) => v), 1);

  const maxParty = Math.max(...Object.values(partyTypes), 1);
  const maxSurface = Math.max(...Object.values(roadSurface), 1);

  return (
    <div className="divide-y divide-gray-100 py-1">
      {/* 道路環境セクション */}
      {env && (
        <div className="space-y-3 py-3">
          <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <MapPin size={13} />
            道路環境
          </h4>

          {(env.intersection_ratio >= 60 || env.no_sidewalk_ratio >= 30) && (
            <AlertBanner>
              {env.intersection_ratio >= 60 && (
                <AlertBannerItem
                  text={<>事故の <strong>{env.intersection_ratio}%</strong> が交差点で発生しています</>}
                />
              )}
              {env.no_sidewalk_ratio >= 30 && (
                <AlertBannerItem
                  text={<>歩車道の区分がない場所での事故が <strong>{env.no_sidewalk_ratio}%</strong></>}
                />
              )}
            </AlertBanner>
          )}

          {shapeEntries.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">道路形状別</p>
              {shapeEntries.map(([label, count]) => {
                const pct = shapeTotal > 0 ? Math.round((count / shapeTotal) * 100) : 0;
                const isIntersection = label.includes("交差点");
                return (
                  <div key={label} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className={`flex items-center gap-1 ${isIntersection ? "text-orange-700 font-medium" : "text-gray-600"}`}>
                        {isIntersection && <CircleAlert size={11} className="text-orange-500" />}
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

          {sidewalkEntries.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">歩車道区分別</p>
              {sidewalkEntries.map(([label, count]) => {
                const pct = sidewalkTotal > 0 ? Math.round((count / sidewalkTotal) * 100) : 0;
                const noSidewalk = label.includes("区分なし") || label.includes("区別なし");
                return (
                  <div key={label} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className={`flex items-center gap-1 ${noSidewalk ? "text-red-600 font-medium" : "text-gray-600"}`}>
                        {noSidewalk && <CircleAlert size={11} className="text-red-500" />}
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
      )}

      {/* 当事者セクション */}
      {party && (
        <div className="space-y-3 py-3">
          <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Users size={13} />
            当事者
          </h4>

          {(party.elderly_ratio >= 30 || party.young_ratio >= 20) && (
            <AlertBanner>
              {party.elderly_ratio >= 30 && (
                <AlertBannerItem
                  text={<>高齢者（65歳以上）が当事者の <strong>{party.elderly_ratio}%</strong> に関与</>}
                />
              )}
              {party.young_ratio >= 20 && (
                <AlertBannerItem
                  text={<>若年者（24歳以下）が当事者の <strong>{party.young_ratio}%</strong> に関与</>}
                />
              )}
            </AlertBanner>
          )}

          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="高齢者関与率"
              value={`${party.elderly_ratio}%`}
              icon={<UserRound size={15} />}
              highlight={party.elderly_ratio >= 30}
            />
            <StatCard
              label="若年者関与率"
              value={`${party.young_ratio}%`}
              icon={<UserRound size={15} />}
              highlight={party.young_ratio >= 25}
            />
          </div>

          {ageEntries.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">年齢層分布</p>
              {ageEntries.map(([label, count]) => {
                const pct = Math.round((count / maxAge) * 100);
                const isElderly = label.includes("65") || label.includes("75");
                const isYoung = label.includes("24");
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className={`text-xs w-16 shrink-0 text-right ${
                        isElderly ? "text-orange-700 font-medium" : isYoung ? "text-blue-700 font-medium" : "text-gray-500"
                      }`}
                    >
                      {label}
                    </span>
                    <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isElderly ? "#ea580c" : isYoung ? "#2563eb" : "#64748b",
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 安全分析セクション */}
      <div className="space-y-3 py-3">
        <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <ShieldAlert size={13} />
          安全分析
        </h4>

        {Object.keys(partyTypes).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">当事者種別（TOP5）</p>
            {Object.entries(partyTypes)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([label, count]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-28 truncate text-right">{label}</span>
                  <div className="flex-1 h-3 bg-gray-50 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded transition-all"
                      style={{ width: `${(count / maxParty) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-8 text-right">{count}</span>
                </div>
              ))}
          </div>
        )}

        {Object.keys(roadSurface).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">路面状態</p>
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
                    <span className="text-xs text-gray-600 w-24 truncate text-right">{label}</span>
                    <div className="flex-1 h-3 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${(count / maxSurface) * 100}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-8 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        )}

        {stats.situation_summary?.surface_text && (
          <AlertBanner>
            <AlertBannerItem text={stats.situation_summary.surface_text} />
          </AlertBanner>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 時間帯分析タブ
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
          icon={<Clock size={15} />}
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
          icon={<Calendar size={15} />}
        />
      </div>

      {/* 24時間分布 */}
      {hourEntries.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Clock size={13} />
            24時間分布
          </h4>
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
          <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
            <span>0</span>
            <span>6</span>
            <span className="text-orange-500 font-bold">7-8</span>
            <span>12</span>
            <span className="text-orange-500 font-bold">14-16</span>
            <span>18</span>
            <span>23</span>
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <span className="w-3 h-3 rounded-sm bg-orange-400 shrink-0" />
            <span className="text-[10px] text-gray-400">通学・下校時間帯</span>
          </div>
        </div>
      )}

      {/* 月別分布 */}
      {monthEntries.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Calendar size={13} />
            月別分布
          </h4>
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
                  <span className="text-[10px] text-gray-400">
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
                  <span className="text-[10px] text-gray-400">{m + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 天候別（カラードットバッジ）T-06 */}
      {byWeather && Object.keys(byWeather).length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Activity size={13} />
            天候別
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(byWeather)
              .sort((a, b) => b[1] - a[1])
              .map(([w, c]) => {
                const isBad = w === "雨" || w === "雪" || w === "霧";
                const color = WEATHER_COLOR[w] || "#94A3B8";
                return (
                  <span
                    key={w}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                      isBad
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-gray-200 bg-white text-gray-600"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {w} {c}件
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
// 事故詳細リスト
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
      <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
        <MapPin size={13} />
        近隣事故 {accidents.length}件（距離順）
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
                <span className="text-xs text-gray-700 flex-1 truncate flex items-center gap-1">
                  {isFatal && <AlertOctagon size={11} className="text-red-500 shrink-0" />}
                  {isPed && !isFatal && <PersonStanding size={11} className="text-orange-500 shrink-0" />}
                  {acc.type || "不明"}
                </span>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {acc.occurred_at?.slice(0, 10) || `${acc.year}年`}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
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
                      value={acc.weather || "不明"}
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-medium">
                        <PersonStanding size={10} />
                        歩行者関与
                      </span>
                    )}
                    {acc.involved_child && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-[10px] font-medium">
                        <Baby size={10} />
                        子ども関与
                      </span>
                    )}
                    {isFatal && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-medium">
                        <AlertOctagon size={10} />
                        死亡事故
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
// 登下校ピークアラート計算
// ============================================================
function computeCommutePeak(
  timeAnalysis: TimeAnalysis | undefined,
  totalAccidents: number
): { type: "morning" | "afternoon"; count: number; pct: number } | null {
  if (!timeAnalysis || totalAccidents === 0) return null;
  const byHour = timeAnalysis.by_hour || {};
  const morningCount = (byHour["7"] || 0) + (byHour["8"] || 0);
  const afternoonCount =
    (byHour["14"] || 0) + (byHour["15"] || 0) + (byHour["16"] || 0);
  const ph = timeAnalysis.peak_hour;

  if (ph !== null && ph >= 7 && ph <= 8 && morningCount / totalAccidents >= 0.25) {
    return {
      type: "morning",
      count: morningCount,
      pct: Math.round((morningCount / totalAccidents) * 100),
    };
  }
  if (ph !== null && ph >= 14 && ph <= 16 && afternoonCount / totalAccidents >= 0.25) {
    return {
      type: "afternoon",
      count: afternoonCount,
      pct: Math.round((afternoonCount / totalAccidents) * 100),
    };
  }
  return null;
}

// ============================================================
// 事故概要タブ
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

  const commutePeak = computeCommutePeak(stats.time_analysis, stats.total_accidents);

  return (
    <div className="space-y-4 py-2">
      {/* 登下校ピークアラート T-05 */}
      {commutePeak && (
        <AlertBanner>
          <AlertBannerItem
            text={
              commutePeak.type === "morning"
                ? <>登校時間帯（7〜8時）に集中: {commutePeak.count}件（全体の{commutePeak.pct}%）</>
                : <>下校時間帯（14〜16時）に集中: {commutePeak.count}件（全体の{commutePeak.pct}%）</>
            }
          />
        </AlertBanner>
      )}

      {/* 状況サマリー */}
      {stats.situation_summary && (
        <SituationSummaryCard
          summary={stats.situation_summary}
          risk={risk}
          severityText={severitySummaryText}
        />
      )}

      {/* 統計カード（レスポンシブ2列→4列）T-03 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <StatCard label="事故件数" value={stats.total_accidents} icon={<BarChart2 size={15} />} />
        <StatCard
          label="歩行者"
          value={stats.pedestrian_involved}
          highlight={stats.pedestrian_involved > 0}
          icon={<PersonStanding size={15} />}
        />
        <StatCard
          label="子ども"
          value={stats.child_involved}
          highlight={stats.child_involved > 0}
          icon={<Baby size={15} />}
        />
        <StatCard
          label="死亡事故"
          value={fatalAccidentCount}
          highlight={fatalAccidentCount > 0}
          icon={<AlertOctagon size={15} />}
        />
      </div>

      {/* 年度別推移 */}
      {yearEntries.length > 1 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <TrendingUp size={13} />
            年度別推移
          </h4>
          <div className="flex items-end gap-1.5 h-14">
            {yearEntries.map(([year, count]) => {
              const height = (count / maxYear) * 100;
              return (
                <div
                  key={year}
                  className="flex-1 flex flex-col items-center gap-0.5"
                >
                  <span className="text-[10px] text-gray-500 font-medium">
                    {count}
                  </span>
                  <div
                    className="w-full rounded-t transition-all duration-500"
                    style={{
                      height: `${Math.max(height, 5)}%`,
                      background: "linear-gradient(180deg, #3b82f6, #60a5fa)",
                    }}
                  />
                  <span className="text-[10px] text-gray-400">
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
          <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Car size={13} />
            事故タイプ
          </h4>
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
                <span className="flex items-center gap-1">
                  {isPed && <PersonStanding size={11} />}
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
  const severitySummaryText = deriveSeveritySummaryText(stats);
  return (
    <div className="p-4 space-y-3">
      <RiskScoreBar score={stats.risk_score} />
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="事故件数" value={stats.total_accidents} icon={<BarChart2 size={15} />} />
        <StatCard
          label="歩行者事故"
          value={stats.pedestrian_involved}
          highlight={stats.pedestrian_involved > 0}
          icon={<PersonStanding size={15} />}
        />
      </div>
      {stats.situation_summary && (
        <div className="text-xs text-gray-600 space-y-0.5 bg-gray-50 rounded-lg p-2">
          <p>{severitySummaryText}</p>
          <p>{stats.situation_summary.pedestrian_text}</p>
          {stats.situation_summary.elderly_text && (
            <p>{stats.situation_summary.elderly_text}</p>
          )}
        </div>
      )}
      <p className="text-xs text-gray-400 text-center">
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
      <div className="flex justify-center mb-1">
        <CheckCircle2 size={28} className="text-green-500" />
      </div>
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
const TAB_LIST: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "概要", icon: <BarChart2 size={12} /> },
  { id: "factors", label: "危険要因", icon: <ShieldAlert size={12} /> },
  { id: "time", label: "時間帯", icon: <Clock size={12} /> },
  { id: "detail", label: "事故詳細", icon: <List size={12} /> },
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
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: risk.color + "20", color: risk.color }}
        >
          {risk.label}
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
            {activeTab === "factors" && (
              <DangerFactorsPanel stats={stats} />
            )}
            {activeTab === "time" && stats.time_analysis && (
              <TimeAnalysisPanel
                time={stats.time_analysis}
                byWeather={stats.by_weather}
              />
            )}
            {activeTab === "detail" && (
              <AccidentDetailList accidents={stats.nearest_accidents} />
            )}
          </div>

          {/* フッター */}
          <div className="border-t px-4 py-2 text-xs text-gray-400 text-center space-y-0.5">
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
