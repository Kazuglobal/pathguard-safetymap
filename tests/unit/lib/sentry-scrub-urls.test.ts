// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  scrubBreadcrumbUrls,
  scrubEventUrls,
  scrubReplayFrameUrls,
  scrubSpanUrls,
  stripUrlQuery,
} from '@/lib/sentry/scrub-urls'

const GEOCODE = 'https://path-guardian.com/api/mapbox/geocode?query=東京都新宿区西新宿2-8-1&country=jp'

describe('Sentry に送る URL からクエリを落とす(UIUX改装 項目60)', () => {
  it('? と # 以降を落とす(住所の検索語・地図の表示範囲を送らない)', () => {
    expect(stripUrlQuery(GEOCODE)).toBe('https://path-guardian.com/api/mapbox/geocode')
    expect(stripUrlQuery('/api/reports?minLat=35.68&maxLat=35.69#x')).toBe('/api/reports')
    expect(stripUrlQuery('/map')).toBe('/map')
  })

  it('通信・ページの移動のパンくず', () => {
    expect(scrubBreadcrumbUrls({ category: 'fetch', data: { method: 'GET', url: GEOCODE, status_code: 200 } }))
      .toEqual({ category: 'fetch', data: { method: 'GET', url: 'https://path-guardian.com/api/mapbox/geocode', status_code: 200 } })
    expect(scrubBreadcrumbUrls({ category: 'navigation', data: { from: '/map?lat=35.68', to: '/routes?id=1' } }).data)
      .toEqual({ from: '/map', to: '/routes' })
  })

  it('処理時間の記録(span)の説明と data', () => {
    const span = scrubSpanUrls({ description: `GET ${GEOCODE}`, data: { url: GEOCODE, 'http.query': 'query=東京都', 'http.method': 'GET' } })
    expect(span).toEqual({ description: 'GET https://path-guardian.com/api/mapbox/geocode', data: { url: 'https://path-guardian.com/api/mapbox/geocode', 'http.method': 'GET' } })
  })

  it('エラーのイベント(ページの URL・クエリ・パンくず・span・録画の URL の一覧)', () => {
    const event = scrubEventUrls({
      request: { url: 'https://path-guardian.com/map?lat=35.68&lng=139.76', query_string: 'lat=35.68&lng=139.76' },
      breadcrumbs: [{ category: 'xhr', data: { url: GEOCODE } }],
      spans: [{ description: `GET ${GEOCODE}`, data: {}, span_id: 's', trace_id: 't', start_timestamp: 0 }],
      urls: ['https://path-guardian.com/map?lat=35.68'],
    } as Parameters<typeof scrubEventUrls>[0])

    expect(event.request).toEqual({ url: 'https://path-guardian.com/map' })
    expect(event.breadcrumbs?.[0]?.data?.url).toBe('https://path-guardian.com/api/mapbox/geocode')
    expect(event.spans?.[0]?.description).toBe('GET https://path-guardian.com/api/mapbox/geocode')
    expect((event as { urls?: string[] }).urls).toEqual(['https://path-guardian.com/map'])
  })

  it('エラー時の録画の、通信の記録', () => {
    const frame = scrubReplayFrameUrls({
      type: 5, timestamp: 0,
      data: { tag: 'performanceSpan', payload: { op: 'resource.fetch', description: GEOCODE, data: { method: 'GET' } } },
    })
    expect(frame.data.payload).toEqual({ op: 'resource.fetch', description: 'https://path-guardian.com/api/mapbox/geocode', data: { method: 'GET' } })
  })
})
