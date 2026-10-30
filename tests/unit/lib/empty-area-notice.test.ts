import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MAP_REPORT_FILTERS,
  isDefaultMapReportFilters,
  shouldShowEmptyAreaNotice,
  type EmptyAreaNoticeInput,
} from '@/lib/map/empty-area-notice'

const READY: EmptyAreaNoticeInput = {
  isMapReady: true,
  isRefreshing: false,
  hasMapError: false,
  reportsLoadState: 'loaded',
  filters: DEFAULT_MAP_REPORT_FILTERS,
  reportCount: 0,
  isDismissed: false,
  isBusy: false,
}

// 見えている範囲に報告が1件もないときの案内(UIUX改装 項目10)。「まだない」と言えるときだけ出す
describe('shouldShowEmptyAreaNotice', () => {
  it('取得に成功して、絞り込みもしておらず、0件のときだけ出す', () => {
    expect(shouldShowEmptyAreaNotice(READY)).toBe(true)
  })

  it.each([
    ['報告がある', { reportCount: 1 }],
    ['取得に失敗した', { reportsLoadState: 'error' as const }],
    ['まだ一度も取れていない', { reportsLoadState: 'idle' as const }],
    ['読み込み中・取り直し中', { isRefreshing: true }],
    ['地図の準備前', { isMapReady: false }],
    ['地図のエラー', { hasMapError: true }],
    ['閉じた', { isDismissed: true }],
    ['ほかのものを見ている', { isBusy: true }],
  ])('%s ときは出さない', (_label, patch) => {
    expect(shouldShowEmptyAreaNotice({ ...READY, ...patch })).toBe(false)
  })

  it.each([
    ['種類', { dangerType: 'traffic' }],
    ['あぶなさ', { dangerLevel: '3' }],
    ['期間', { dateRange: 'week' }],
    ['自分の審査中の報告を外した', { showPending: false }],
    ['都道府県', { prefecture: '千葉県' }],
  ])('%s で絞り込んでいるときは出さない', (_label, patch) => {
    const filters = { ...DEFAULT_MAP_REPORT_FILTERS, ...patch }
    expect(isDefaultMapReportFilters(filters)).toBe(false)
    expect(shouldShowEmptyAreaNotice({ ...READY, filters })).toBe(false)
  })
})
