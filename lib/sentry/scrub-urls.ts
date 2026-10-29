import type { Breadcrumb, Event } from '@sentry/nextjs'

/**
 * Sentry に送る URL から、クエリ(? 以降)とハッシュ(# 以降)を落とす(UIUX改装 項目60・プライバシーポリシー 6.)。
 * 住所の検索語(/api/mapbox/geocode?query=…)や地図の表示範囲(/api/reports?minLat=…)はクエリに入るため。
 * エラー(メッセージ・例外・Referer・extra・contexts)・パンくず・処理時間の記録・エラー時の録画(通信の一覧)のすべてで使う。
 * 項目の名前を決め打ちせず、入れ子の値もたどって、文字列の中の「URL・パス + クエリ」をすべて落とす。
 * 正規表現で文字列全体を何度も読み直さないよう、区切りで分けた語を一度ずつ見る(長すぎる文字列は先頭だけにする)。
 */
export function stripUrlQuery(value: string): string {
  const cut = value.search(/[?#]|%3f/i)
  return cut === -1 ? value : value.slice(0, cut)
}

/** これより長い文字列は、先頭だけを残す(記録の処理に時間をかけない) */
const MAX_SCRUB_LENGTH = 8_192
/** 入れ子をたどる深さ */
const MAX_DEPTH = 6
/** 語の区切り(空白・引用符・かっこ) */
const DELIMITERS = /([\s"'`<>()[\]{}]+)/
/** 位置・住所・連絡先が入る名前の「名前=値」は、パスが無くても値ごと落とす */
const SENSITIVE_PARAMETER = /(?:^|[?&;,])(?:query|q|search|address|lat|lng|lon|latitude|longitude|min_?lat|max_?lat|min_?lng|max_?lng|bbox|bounds|center|email|endpoint)=/i

function scrubToken(token: string): string {
  // URL(http://…)・パス(/… や api/…)に続くクエリを落とす
  const queryAt = token.search(/[?#]|%3f/i)
  if (queryAt > 0) {
    const head = token.slice(0, queryAt)
    if (/^(?:[a-z][a-z0-9+.-]*:\/\/|\/)/i.test(head) || head.includes('/')) return head
  }
  // パスの無い「query=…」なども、位置・住所の名前なら値ごと落とす
  return SENSITIVE_PARAMETER.test(token) ? '[filtered]' : token
}

export function stripQueriesInText(text: string): string {
  const limited = text.length > MAX_SCRUB_LENGTH ? `${text.slice(0, MAX_SCRUB_LENGTH)}…` : text
  return limited.split(DELIMITERS).map((part, index) => (index % 2 === 1 ? part : scrubToken(part))).join('')
}

/** クエリそのものが入る項目(値ごと消す) */
const QUERY_KEYS = new Set(['http.query', 'http.fragment', 'url.query', 'query_string'])

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return stripQueriesInText(value)
  if (depth >= MAX_DEPTH || !value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1))
  return scrubData(value as Record<string, unknown>, depth + 1)
}

function scrubData<T extends Record<string, unknown>>(data: T, depth = 0): T {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (QUERY_KEYS.has(key)) continue
    next[key] = scrubValue(value, depth)
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

/**
 * エラー・処理時間の記録・録画のイベント。ページの URL・Referer などのヘッダー・メッセージ・例外・extra・tags・
 * contexts・パンくず・span・録画した URL の一覧
 */
export function scrubEventUrls<T extends Event>(event: T): T {
  const next: Event = { ...event }
  if (next.request) {
    const { query_string: _queryString, ...request } = next.request
    next.request = {
      ...request,
      ...(request.url ? { url: stripUrlQuery(request.url) } : {}),
      ...(request.headers ? { headers: scrubData(request.headers) } : {}),
    }
  }
  if (typeof next.message === 'string') next.message = stripQueriesInText(next.message)
  if (next.exception?.values) {
    next.exception = {
      ...next.exception,
      values: next.exception.values.map((value) => ({
        ...value,
        ...(value.value ? { value: stripQueriesInText(value.value) } : {}),
        ...(value.mechanism?.data ? { mechanism: { ...value.mechanism, data: scrubData(value.mechanism.data) } } : {}),
      })),
    }
  }
  if (next.extra) next.extra = scrubData(next.extra)
  if (next.tags) next.tags = scrubData(next.tags)
  if (next.contexts) next.contexts = scrubData(next.contexts)
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

/** エラー時の録画に入る、通信・ページの移動・パンくずの記録(Sentry.replayIntegration の beforeAddRecordingEvent) */
export function scrubReplayFrameUrls<T extends RecordingFrameEvent>(event: T): T {
  const payload = event.data.payload
  if (!payload || typeof payload !== 'object') return event
  return { ...event, data: { ...event.data, payload: scrubData(payload as Record<string, unknown>) } }
}
