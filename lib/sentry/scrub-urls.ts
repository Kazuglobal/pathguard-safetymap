import type { Breadcrumb, Event } from '@sentry/nextjs'

/**
 * Sentry に送る URL から、クエリ(? 以降)とハッシュ(# 以降)を落とす(UIUX改装 項目60・プライバシーポリシー 6.)。
 * 住所の検索語(/api/mapbox/geocode?query=…)や地図の表示範囲(/api/reports?minLat=…)はクエリに入るため。
 * エラー・パンくず・処理時間の記録・エラー時の録画(通信の一覧)のすべてで使う。
 */
export function stripUrlQuery(value: string): string {
  const cut = value.search(/[?#]/)
  return cut === -1 ? value : value.slice(0, cut)
}

/** URL が入る項目(パンくず・処理時間の記録の data) */
const URL_KEYS = ['url', 'from', 'to', 'http.url', 'url.full'] as const
/** クエリそのものが入る項目 */
const QUERY_KEYS = ['http.query', 'http.fragment', 'url.query'] as const

function scrubData<T extends Record<string, unknown>>(data: T): T {
  const next: Record<string, unknown> = { ...data }
  for (const key of URL_KEYS) {
    const value = next[key]
    if (typeof value === 'string') next[key] = stripUrlQuery(value)
  }
  for (const key of QUERY_KEYS) delete next[key]
  return next as T
}

export function scrubBreadcrumbUrls(breadcrumb: Breadcrumb): Breadcrumb {
  return breadcrumb.data ? { ...breadcrumb, data: scrubData(breadcrumb.data) } : breadcrumb
}

/** 処理時間の記録(span)。型は @sentry/nextjs が出していないので、使う項目だけで受ける */
interface SpanLike {
  description?: string
  data?: Record<string, unknown>
}

export function scrubSpanUrls<T extends SpanLike>(span: T): T {
  return {
    ...span,
    ...(span.description ? { description: stripUrlQuery(span.description) } : {}),
    ...(span.data ? { data: scrubData(span.data) } : {}),
  }
}

/** エラー・処理時間の記録・録画のイベント(ページの URL・パンくず・処理時間の記録・録画した URL の一覧) */
export function scrubEventUrls<T extends Event>(event: T): T {
  const next: Event = { ...event }
  if (next.request) {
    const { query_string: _queryString, ...request } = next.request
    next.request = { ...request, ...(request.url ? { url: stripUrlQuery(request.url) } : {}) }
  }
  if (next.breadcrumbs) next.breadcrumbs = next.breadcrumbs.map(scrubBreadcrumbUrls)
  if (next.spans) next.spans = next.spans.map(scrubSpanUrls)
  // 録画のイベント(replay_event)は、見たページの URL の一覧を持つ
  const withUrls = next as Event & { urls?: unknown }
  if (Array.isArray(withUrls.urls)) {
    withUrls.urls = withUrls.urls.map((url) => (typeof url === 'string' ? stripUrlQuery(url) : url))
  }
  return next as T
}

interface RecordingFrameEvent {
  data: { tag: string; payload: unknown }
}

/** エラー時の録画に入る、通信・ページの移動の記録(Sentry.replayIntegration の beforeAddRecordingEvent) */
export function scrubReplayFrameUrls<T extends RecordingFrameEvent>(event: T): T {
  const payload = event.data.payload
  if (!payload || typeof payload !== 'object') return event
  const frame = payload as { description?: unknown; data?: unknown }
  const scrubbed = {
    ...frame,
    ...(typeof frame.description === 'string' ? { description: stripUrlQuery(frame.description) } : {}),
    ...(frame.data && typeof frame.data === 'object' ? { data: scrubData(frame.data as Record<string, unknown>) } : {}),
  }
  return { ...event, data: { ...event.data, payload: scrubbed } }
}
