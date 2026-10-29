/**
 * 報告の日時の見せ方(UIUX改装 項目61)。ほかの人の報告は、日時を日単位(日本時間の日付 YYYY-MM-DD)で渡す。
 * 日付だけの値は、時刻を付けずに表示する(new Date('2026-10-29') は 09:00 になってしまうため)。
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const JAPAN_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value)
}

/** 保存してある時刻を読む。タイムゾーンの無い「YYYY-MM-DD HH:MM:SS」は D1 の既定どおり UTC として読む */
function parseStoredTimestamp(value: string): number {
  const withoutZone = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
  return Date.parse(withoutZone ? `${value.replace(' ', 'T')}Z` : value)
}

/** 日本時間の日付(YYYY-MM-DD)。読めない値は先頭の日付の部分だけを返す */
export function toJapanDate(value: string): string {
  if (isDateOnly(value)) return value
  const time = parseStoredTimestamp(value)
  if (!Number.isFinite(time)) return value.slice(0, 10)
  return new Date(time + JAPAN_OFFSET_MS).toISOString().slice(0, 10)
}

/** 日本時間の今日から見て、日付だけの値が何日前か */
export function daysAgoInJapan(dateOnly: string, now: number = Date.now()): number {
  const today = Date.parse(new Date(now + JAPAN_OFFSET_MS).toISOString().slice(0, 10))
  return Math.max(0, Math.round((today - Date.parse(dateOnly)) / DAY_MS))
}

/** 「○分前」「○時間前」「昨日」「○日前」。日付だけの値は「今日」「昨日」「○日前」 */
export function formatRelativeReportTime(value: string, now: number = Date.now()): string {
  if (isDateOnly(value)) {
    const days = daysAgoInJapan(value, now)
    return days === 0 ? '今日' : days === 1 ? '昨日' : `${days}日前`
  }
  const diff = now - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨日'
  return `${days}日前`
}
