"use client"

import { MapPin } from 'lucide-react'
import { isValidCoordinates } from '@/lib/coordinates'
import { getAccidentRiskLevel, type AccidentStats } from '@/lib/traffic-accident-data'

/** Component props */
interface AccidentStatsPanelProps {
  stats: AccidentStats
  mode?: 'full' | 'compact'
  onAccidentClick?: (accident: AccidentStats['nearest_accidents'][number]) => void
}

/**
 * Main AccidentStatsPanel Component
 *
 * Displays traffic accident statistics with two display modes:
 * - Full mode: All statistics including trends, breakdowns, nearest accidents
 * - Compact mode: Only essential stats (risk badge + score bar + 2 cards)
 */
export function AccidentStatsPanel({ stats, mode = 'full', onAccidentClick }: AccidentStatsPanelProps) {
  const riskInfo = getAccidentRiskLevel(stats.risk_score)
  const isCompact = mode === 'compact'
  const hasBucketedTimeDistribution = Boolean(stats.time_buckets?.length)
  const timeDistribution = stats.time_buckets?.length
    ? stats.time_buckets.map((bucket) => ({
        key: bucket.label,
        label: bucket.label,
        count: bucket.count,
        isSchoolTime: bucket.is_school_time,
      }))
    : stats.accidents_by_hour.map((hour) => ({
        key: String(hour.hour),
        label: `${hour.hour}時`,
        count: hour.count,
        isSchoolTime: hour.is_school_time,
      }))
  const timeDistributionMaxCount = Math.max(...timeDistribution.map((item) => item.count), 1)

  // Empty state - zero accidents
  if (stats.total_accidents === 0) {
    return <AccidentStatsEmpty />
  }

  return (
    <div className="space-y-4">
      {/* Risk Badge and Score */}
      <div className="space-y-2">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2"
          style={{
            backgroundColor: riskInfo.bgColor,
            borderColor: riskInfo.color,
            color: riskInfo.color
          }}
          data-risk-level={riskInfo.level}
        >
          <span className="text-lg">{riskInfo.emoji}</span>
          <span className="font-semibold">{riskInfo.label}</span>
          <span className="text-sm">({stats.risk_score}/100)</span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600">{riskInfo.description}</p>

        {/* Risk Score Progress Bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${Math.min(stats.risk_score, 100)}%`,
              backgroundColor: riskInfo.color
            }}
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="総事故数" value={stats.total_accidents} />
        <StatCard label="死亡事故" value={stats.fatal_accidents} />
        {!isCompact && (
          <>
            <StatCard label="歩行者事故" value={stats.pedestrian_accidents} />
            <StatCard label="子供関与" value={stats.child_involved} />
          </>
        )}
      </div>

      {/* Full mode only - detailed breakdowns */}
      {!isCompact && (
        <>
          {/* Time Distribution */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">時間帯別事故</h4>
            <div
              className={
                hasBucketedTimeDistribution
                  ? 'grid grid-cols-1 sm:grid-cols-2 gap-2'
                  : 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5'
              }
            >
              {timeDistribution.map((item) => (
                <div
                  key={item.key}
                  className={`rounded-md border p-2 ${
                    item.isSchoolTime ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                  }`}
                  data-testid={item.isSchoolTime ? 'school-time' : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] leading-tight text-gray-700 break-words">{item.label}</span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{item.count}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.isSchoolTime ? 'bg-orange-500' : 'bg-gray-500'}`}
                      style={{ width: `${Math.max((item.count / timeDistributionMaxCount) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="sr-only">{`${item.label}: ${item.count}`}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Accident Types */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">事故種別</h4>
            <div className="space-y-1">
              {stats.accident_types.slice(0, 5).map((type, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between text-sm p-2 rounded ${
                    type.is_pedestrian_related ? 'bg-red-50' : 'bg-gray-50'
                  }`}
                  data-testid={type.is_pedestrian_related ? 'pedestrian-related' : undefined}
                >
                  <span>{type.type}</span>
                  <span className="font-semibold">{type.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weather Conditions */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">天候別事故</h4>
            <div className="flex gap-2 flex-wrap">
              {stats.weather_conditions.map((weather, idx) => (
                <div key={idx} className="px-3 py-1 bg-blue-50 rounded-full text-sm">
                  {weather.condition}: {weather.count}
                </div>
              ))}
            </div>
          </div>

          {/* Year Trend */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">年次推移</h4>
            <div className="flex gap-2">
              {stats.accidents_by_year.map((year) => (
                <div key={year.year} className="flex-1 text-center">
                  <div className="text-xs text-gray-600">{year.year}</div>
                  <div className="font-semibold">{year.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Nearest Accidents */}
          {stats.nearest_accidents.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">近隣の事故</h4>
              <div className="space-y-2">
                {stats.nearest_accidents.slice(0, 5).map((accident, idx) => {
                  const hasNavigableCoordinates =
                    typeof accident.latitude === 'number' &&
                    typeof accident.longitude === 'number' &&
                    isValidCoordinates(accident.latitude, accident.longitude)
                  const isClickable =
                    hasNavigableCoordinates &&
                    onAccidentClick != null

                  const content = (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        {accident.severity === 'fatal' && (
                          <span className="w-2 h-2 bg-red-500 rounded-full" />
                        )}
                        <span className="font-medium">{accident.distance_meters}m</span>
                        {accident.has_child && <span>🎒</span>}
                        {accident.has_pedestrian && <span>🚶</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-gray-600">{accident.type}</span>
                        {isClickable && (
                          <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
                        )}
                      </span>
                    </div>
                  )

                  return isClickable ? (
                    <button
                      key={accident.id ?? idx}
                      type="button"
                      className="w-full text-left p-2 bg-gray-50 rounded text-sm cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors border border-transparent"
                      aria-label={`近隣事故 ${accident.distance_meters}m (${accident.type}) を地図で表示`}
                      data-severity={accident.severity}
                      onClick={() => onAccidentClick(accident)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      key={accident.id ?? idx}
                      className="p-2 bg-gray-50 rounded text-sm"
                      data-severity={accident.severity}
                    >
                      {content}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Data Source Footer (full mode only) */}
      {!isCompact && (
        <div className="text-xs text-gray-500 text-center mt-4 pt-4 border-t">
          半径{stats.radius_meters}m以内 / 過去{stats.years_analyzed}年間
          <br />
          出典: 警察庁「交通事故統計情報のオープンデータ」
        </div>
      )}
    </div>
  )
}

/**
 * Stat Card Component
 */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg" data-testid="stat-card">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

/**
 * Loading State Component
 */
export function AccidentStatsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/2" data-loading="true" />
      <div className="h-2 bg-gray-200 rounded" data-loading="true" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-20 bg-gray-200 rounded" data-loading="true" />
        <div className="h-20 bg-gray-200 rounded" data-loading="true" />
      </div>
    </div>
  )
}

/**
 * Empty State Component (Zero Accidents)
 */
export function AccidentStatsEmpty() {
  return (
    <div className="text-center py-8">
      <div className="text-green-600 text-4xl mb-2">✓</div>
      <div className="text-lg font-semibold text-green-800">安全</div>
      <div className="text-sm text-gray-600 mt-1">事故データなし</div>
      <div className="mt-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg inline-block">
        <div className="flex items-center gap-2">
          <span className="text-5xl font-bold text-green-600">0</span>
          <span className="text-sm text-gray-600">件の事故</span>
        </div>
      </div>
    </div>
  )
}
