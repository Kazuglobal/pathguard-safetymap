"use client"

import Link from "next/link"

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function ShieldClockSvg() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 1.5L3 4.8V10.5C3 15.15 6.5 19.45 11 20.5C15.5 19.45 19 15.15 19 10.5V4.8L11 1.5Z"
        fill="#EFF6FF"
        stroke="#3B82F6"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="11" r="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.2" />
      <path d="M11 8.5V11L12.5 12.5" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MapPinAlertSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {/* Pin shape */}
      <path
        d="M14 2C9.582 2 6 5.582 6 10C6 16.25 14 26 14 26C14 26 22 16.25 22 10C22 5.582 18.418 2 14 2Z"
        fill="#FEF3C7"
        stroke="#D97706"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Warning mark */}
      <path d="M14 6.5V11" stroke="#D97706" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="13.5" r="1.1" fill="#D97706" />
      {/* Small alert triangle overlay */}
      <g transform="translate(16, 16)">
        <circle cx="5" cy="5" r="5" fill="#EF4444" />
        <path d="M5 2.5V5.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="5" cy="7.2" r="0.7" fill="white" />
      </g>
    </svg>
  )
}

function RouteSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      {/* Start dot */}
      <circle cx="5" cy="7" r="3.5" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" />
      {/* End pin */}
      <path
        d="M22 15C22 19 19 23 19 23C19 23 16 19 16 15C16 13.343 17.343 12 19 12C20.657 12 22 13.343 22 15Z"
        fill="#FEE2E2"
        stroke="#EF4444"
        strokeWidth="1.3"
      />
      <circle cx="19" cy="15" r="1.5" fill="#EF4444" />
      {/* Dashed path */}
      <path
        d="M5 10.5C5 10.5 5 14 9 14H15"
        stroke="#94A3B8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
    </svg>
  )
}

function ClockUpdateSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="11" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.5" />
      <path d="M14 7.5V14L17.5 17" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Refresh arrows at bottom right */}
      <g transform="translate(17, 17)">
        <circle cx="4.5" cy="4.5" r="4.5" fill="#DCFCE7" />
        <path
          d="M3 4.5A1.5 1.5 0 016 3"
          stroke="#16A34A"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M6 4.5A1.5 1.5 0 013 6"
          stroke="#16A34A"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M6 2.5L6 4L7.5 3" stroke="#16A34A" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 6.5L3 5L1.5 6" stroke="#16A34A" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function ChevronRightSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyCommuteCheckCardProps {
  /** 今日の注意地点の件数 */
  cautionCount?: number
  /** 通学ルートが設定済みかどうか */
  routeConfigured?: boolean
  /** 直近の更新から何日経過したか (nullなら未更新) */
  lastUpdatedDaysAgo?: number | null
  /** 地図へのリンク先 */
  mapHref?: string
  /** 補足説明文 */
  description?: string
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

interface StatCellProps {
  value: string
  label: string
  icon: React.ReactNode
  highlight?: "caution" | "neutral" | "ok"
  href: string
}

function StatCell({ value, label, icon, highlight = "neutral", href }: StatCellProps) {
  const valueColor =
    highlight === "caution"
      ? "text-amber-700"
      : highlight === "ok"
        ? "text-emerald-700"
        : "text-slate-800"

  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-white px-2 py-3 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
    >
      <p className={`text-xl font-bold leading-none ${valueColor}`}>{value}</p>
      <div className="flex h-8 items-center justify-center">{icon}</div>
      <p className="text-center text-[11px] leading-tight text-slate-500">{label}</p>
    </Link>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DailyCommuteCheckCard({
  cautionCount = 0,
  routeConfigured = false,
  lastUpdatedDaysAgo = null,
  mapHref = "/map",
  description = "通学前に危険情報やルート設定状況を30秒で確認できます。",
}: DailyCommuteCheckCardProps) {
  const updatedLabel =
    lastUpdatedDaysAgo === null ? "未更新" : lastUpdatedDaysAgo === 0 ? "今日" : `${lastUpdatedDaysAgo}日前`

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 px-4 pb-4 pt-4 shadow-sm">
      {/* Decorative SVG background blobs */}
      <svg
        className="pointer-events-none absolute right-0 top-0 opacity-40"
        width="120"
        height="100"
        viewBox="0 0 120 100"
        fill="none"
        aria-hidden="true"
      >
        <ellipse cx="100" cy="20" rx="60" ry="50" fill="#DBEAFE" />
        <ellipse cx="115" cy="60" rx="40" ry="35" fill="#EFF6FF" />
      </svg>

      {/* Header row */}
      <div className="relative flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <ShieldClockSvg />
            <h2 className="text-base font-bold text-slate-900">今日の通学3分チェック</h2>
          </div>
          <p className="max-w-[14rem] text-xs leading-relaxed text-slate-500">{description}</p>
        </div>

        <Link
          href={mapHref}
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 active:bg-blue-700"
        >
          地図を見る
          <ChevronRightSvg />
        </Link>
      </div>

      {/* Stat grid */}
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <StatCell
          value={`${cautionCount}件`}
          label="今日の注意地点"
          icon={<MapPinAlertSvg />}
          highlight={cautionCount > 0 ? "caution" : "neutral"}
          href={mapHref}
        />
        <StatCell
          value={routeConfigured ? "設定済み" : "未設定"}
          label="通学ルート"
          icon={<RouteSvg />}
          highlight={routeConfigured ? "ok" : "neutral"}
          href="/routes"
        />
        <StatCell
          value={updatedLabel}
          label="直近の更新"
          icon={<ClockUpdateSvg />}
          highlight={lastUpdatedDaysAgo !== null && lastUpdatedDaysAgo <= 1 ? "ok" : "neutral"}
          href={mapHref}
        />
      </div>
    </div>
  )
}
