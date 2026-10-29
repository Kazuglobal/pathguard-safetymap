// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { daysAgoInJapan, formatRelativeReportTime, isDateOnly, toJapanDate } from '@/lib/report-dates'
import { formatDate } from '@/lib/utils'

describe('報告の日時を日単位で見せる(UIUX改装 項目61)', () => {
  it('日本時間の日付にする(朝の登校時間の報告が前の日にならない)', () => {
    // 2026-10-29 07:40(日本時間)は UTC では前の日の 22:40
    expect(toJapanDate('2026-10-28T22:40:00.000Z')).toBe('2026-10-29')
    expect(toJapanDate('2026-10-29T07:41:12.345Z')).toBe('2026-10-29')
    expect(toJapanDate('2026-10-29T15:30:00.000Z')).toBe('2026-10-30')
    // タイムゾーンの無い D1 の既定の書き方は UTC として読む
    expect(toJapanDate('2026-10-28 22:40:00')).toBe('2026-10-29')
    expect(toJapanDate('2026-10-29')).toBe('2026-10-29')
  })

  it('日付だけの値は、時刻を付けずに表示する(09:00 と出さない)', () => {
    expect(isDateOnly('2026-10-29')).toBe(true)
    expect(isDateOnly('2026-10-29T07:41:12.345Z')).toBe(false)
    expect(formatDate('2026-10-29')).toBe('2026/10/29')
    expect(formatDate('2026-10-29')).not.toContain('09:00')
  })

  it('日付だけの値は「今日」「昨日」「○日前」で出す(日本時間で数える)', () => {
    // 2026-10-29 08:00(日本時間)
    const now = Date.parse('2026-10-28T23:00:00.000Z')
    expect(daysAgoInJapan('2026-10-29', now)).toBe(0)
    expect(formatRelativeReportTime('2026-10-29', now)).toBe('今日')
    expect(formatRelativeReportTime('2026-10-28', now)).toBe('昨日')
    expect(formatRelativeReportTime('2026-10-25', now)).toBe('4日前')
    // 時刻のある値(自分の報告)はこれまでどおり
    expect(formatRelativeReportTime('2026-10-28T22:40:00.000Z', now)).toBe('20分前')
  })
})
