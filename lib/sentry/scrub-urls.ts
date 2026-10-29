import type { Breadcrumb, Event } from '@sentry/nextjs'

/**
 * Sentry に送る URL から、クエリ(? 以降)とハッシュ(# 以降)を落とす(UIUX改装 項目60・プライバシーポリシー 6.)。
 * 住所の検索語(/api/mapbox/geocode?query=…)や地図の表示範囲(/api/reports?minLat=…)はクエリに入るため。
 * エラー(メッセージ・例外・Referer)・パンくず・処理時間の記録・エラー時の録画(通信の一覧)のすべてで使う。
 * 項目の名前を決め打ちせず、文字列の中の「URL・パス + クエリ」をすべて落とす(新しい項目が増えても漏れないように)。
 */
export function stripUrlQuery(value: string): string {
  const cut = value.search(/[?#]/)
  return cut === -1 ? value : value.slice(0, cut)
}

/** 文字列の中の URL(http(s)://…)・パス(/…)に続くクエリとハッシュを落とす */
const URL_WITH_QUERY = /((?:https?:\/\/|\/)[^\s"'<>?#]*)[?#][^\s"'<>]*/g

export function stripQueriesInText(text: string): string {
  return text.replace(URL_WITH_QUERY, '$1')
}

/** クエリそのものが入る項目(値ごと消す) */
const QUERY_KEYS = new Set(['http.query', 'http.fragment', 'url.query', 'query_string'])

function scrubData<T extends Record<string, unknown>>(data: T): T {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (QUERY_KEYS.has(key)) continue
    next[key] = typeof value === 'string' ? stripQueriesInText(value) : value
  }
  return next as T
}

export function scrubBreadcrumbUrls(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    ...(breadcrumb.message ? { message: stripQueriesInText(breadcrumb.message) } : {}),
    ...(breadcrumb.data ? { data: scrubData(breadcrumb.data) } : {}),
  }
}

/** 処理時間の記録(span)。型は @sentry/nextjs が出していないので、使う項目だけで受ける */
interface SpanLike {
  description?: string
  data?: Record<string, unknown>
}

export function scrubSpanUrls<T extends SpanLike>(span: T): T {
  return {
    ...span,
    ...(span.description ? { description: stripQueriesInText(span.description) } : {}),
    ...(span.data ? { data: scrubData(span.data) } : {}),
  }
}

function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, stripQueriesInText(value)]))
}

/** エラー・処理時間の記録・録画のイベント(ページの URL・Referer・メッセージ・例外・パンくず・span・録画した URL の一覧) */
export function scrubEventUrls<T extends Event>(event: T): T {
  const next: Event = { ...event }
  if (next.request) {
    const { query_string: _queryString, ...request } = next.request
    next.request = {
      ...request,
      ...(request.url ? { url: stripUrlQuery(request.url) } : {}),
      ...(request.headers ? { headers: scrubHeaders(request.headers) } : {}),
    }
  }
  if (typeof next.message === 'string') next.message = stripQueriesInText(next.message)
  if (next.exception?.values) {
    next.exception = {
      ...next.exception,
      values: next.exception.values.map((value) => (value.value ? { ...value, value: stripQueriesInText(value.value) } : value)),
    }
  }
  if (next.breadcrumbs) next.breadcrumbs = next.breadcrumbs.map(scrubBreadcrumbUrls)
  if (next.spans) next.spans = next.spans.map(scrubSpanUrls)
  const trace = next.contexts?.trace
  if (trace?.data) next.contexts = { ...next.contexts, trace: { ...trace, data: scrubData(trace.data) } }
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

/** エラー時の録画に入る、通信・ページの移動・パンくずの記録(Sentry.replayIntegration の beforeAddRecordingEvent) */
export function scrubReplayFrameUrls<T extends RecordingFrameEvent>(event: T): T {
  const payload = event.data.payload
  if (!payload || typeof payload !== 'object') return event
  const frame = payload as { description?: unknown; message?: unknown; data?: unknown }
  const scrubbed = {
    ...frame,
    ...(typeof frame.description === 'string' ? { description: stripQueriesInText(frame.description) } : {}),
    ...(typeof frame.message === 'string' ? { message: stripQueriesInText(frame.message) } : {}),
    ...(frame.data && typeof frame.data === 'object' ? { data: scrubData(frame.data as Record<string, unknown>) } : {}),
  }
  return { ...event, data: { ...event.data, payload: scrubbed } }
}
