import { PUBLIC_DANGER_REPORT_STATUSES } from "@/lib/danger-report-status"

/**
 * GET で JSON を返す API の結果を、URL ごとにしばらく共有する小さなキャッシュ。
 *
 * 通学路まわりでは、一覧カードの「注意ポイント数」(useRouteDangerCounts) と
 * 通学3分チェック・きけんレポート (useRouteDangers) が同じ /api/reports?limit=2000 を
 * 別々に取りにいき、最大 2000 件の JSON を二重にダウンロード・解析していた。ここで 1 本にまとめる。
 *
 * - 同じ URL への同時リクエストは 1 本にまとめる（取得中の Promise を共有する）
 * - 成功した結果だけを ttlMs（既定 60 秒）のあいだ使い回す。失敗は残さず、次の呼び出しで取り直す
 * - 共有した値は全員が同じオブジェクトを見るので、受け取った側で書き換えない
 * - だれが取っても中身が同じ URL だけに使う。ログイン中のユーザーごとに中身が変わる API には使わない
 * - ブラウザ側（effect の中など）からだけ呼ぶ。サーバーで呼ぶとリクエストをまたいで共有されてしまう
 */

/** 成功した結果を使い回す既定の時間（ミリ秒） */
export const FETCH_CACHE_TTL_MS = 60_000

/** 2xx 以外の応答。呼び出し側が status で文言を出し分けられるよう、例外として返す */
export class FetchJsonError extends Error {
  readonly status: number

  constructor(url: string, status: number) {
    super(`GET ${url} failed with status ${status}`)
    this.name = "FetchJsonError"
    this.status = status
  }
}

interface CacheEntry {
  readonly promise: Promise<unknown>
  /** 取得に成功した時刻（Date.now()）。取得中は null */
  readonly settledAt: number | null
}

const entries = new Map<string, CacheEntry>()

export interface FetchJsonCachedOptions {
  /** 成功した結果を使い回す時間（ミリ秒）。既定は FETCH_CACHE_TTL_MS */
  ttlMs?: number
  /** true のとき、残っている結果も取得中のリクエストも使わずに取り直す（手動の再取得用） */
  force?: boolean
}

/**
 * url を GET して JSON を返す。同じ url の取得中リクエストと、ttlMs 以内に成功した結果を共有する。
 * 2xx 以外は FetchJsonError で、通信の失敗や JSON の解析失敗はその例外のまま reject する。
 */
export function fetchJsonCached<T>(url: string, options: FetchJsonCachedOptions = {}): Promise<T> {
  const ttlMs = options.ttlMs ?? FETCH_CACHE_TTL_MS
  const existing = entries.get(url)
  if (existing && !options.force) {
    if (existing.settledAt === null || Date.now() - existing.settledAt < ttlMs) {
      return existing.promise as Promise<T>
    }
  }

  const promise: Promise<unknown> = fetch(url, { credentials: "same-origin" })
    .then((response) => {
      if (!response.ok) {
        throw new FetchJsonError(url, response.status)
      }
      return response.json() as Promise<unknown>
    })
    .then(
      (value) => {
        // 取得中に invalidate や force で置き換えられていたら、新しい方を上書きしない
        if (entries.get(url)?.promise === promise) {
          entries.set(url, { promise, settledAt: Date.now() })
        }
        return value
      },
      (error: unknown) => {
        if (entries.get(url)?.promise === promise) {
          entries.delete(url)
        }
        throw error
      },
    )

  entries.set(url, { promise, settledAt: null })
  return promise as Promise<T>
}

/** url を省略すると全件を捨てる。テストや、ログアウトなど前提が変わったときに使う */
export function invalidateFetchCache(url?: string): void {
  if (url === undefined) {
    entries.clear()
    return
  }
  entries.delete(url)
}

/**
 * 公開ステータスの通報をまとめて取る URL。通学路まわりのフックはこの 1 本を共有する。
 * 文字列が 1 文字でも違うと別のキャッシュになるため、組み立てはここだけで行う。
 */
export function buildPublicReportsUrl(): string {
  const params = new URLSearchParams({ limit: "2000" })
  PUBLIC_DANGER_REPORT_STATUSES.forEach((status) => params.append("status", status))
  return `/api/reports?${params}`
}

export interface PublicReportsPayload<T> {
  reports?: T[] | null
}

/** 公開ステータスの通報（最大 2000 件）を、共有キャッシュを通して取得する */
export function fetchPublicReports<T>(
  options?: FetchJsonCachedOptions,
): Promise<PublicReportsPayload<T> | null> {
  return fetchJsonCached<PublicReportsPayload<T> | null>(buildPublicReportsUrl(), options)
}
