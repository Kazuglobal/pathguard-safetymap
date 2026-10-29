// 地域選択UIの選択肢取得(市区町村・小学校区・報告のある市町村)
//
// コールドスタートの Worker が応答しないと、select が「読み込み中…」のまま
// 固まってしまう。取得には必ず時間切れを設け、失敗の理由を日本語で返す。
// 呼び出し側は失敗時に理由と「もう一度読み込む」を出し、読み込み中のまま放置しない。

export const REGION_REQUEST_TIMEOUT_MS = 12_000

/** select 1つ分の選択肢の読み込み状態 */
export type RegionLoadStatus = "idle" | "loading" | "ready" | "error"

export type RegionRequestFailure = "timeout" | "network" | "server" | "rejected" | "invalid"

const FAILURE_MESSAGES: Record<RegionRequestFailure, string> = {
  timeout: "時間内に応答がありませんでした。通信状況を確かめて、もう一度お試しください。",
  network: "通信できませんでした。インターネット接続を確かめてください。",
  server: "サーバーが一時的に応答できません。少し時間をおいてお試しください。",
  rejected: "読み込みの条件が受け付けられませんでした。",
  invalid: "受け取ったデータを読み取れませんでした。",
}

const UNEXPECTED_FAILURE_MESSAGE = "予期しない問題が起きました。もう一度お試しください。"

export class RegionRequestError extends Error {
  readonly failure: RegionRequestFailure
  readonly status: number | null

  constructor(failure: RegionRequestFailure, status: number | null = null) {
    super(FAILURE_MESSAGES[failure])
    this.name = "RegionRequestError"
    this.failure = failure
    this.status = status
  }
}

/** 失敗の理由を利用者向けの日本語で返す(想定外のエラーは汎用の文言にする) */
export function describeRegionRequestError(error: unknown): string {
  return error instanceof RegionRequestError ? error.message : UNEXPECTED_FAILURE_MESSAGE
}

export interface RegionRequestOptions {
  /** 呼び出し側の中止(県の切り替え・アンマウント)。中止時は AbortError で失敗する */
  signal?: AbortSignal
  timeoutMs?: number
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError")
}

/**
 * 同一オリジンの JSON を時間切れ付きで取得する。
 * fetch が中止に応じない環境でも、時間切れになれば必ず失敗として返る。
 */
export function fetchRegionJson(url: string, options: RegionRequestOptions = {}): Promise<unknown> {
  const { signal, timeoutMs = REGION_REQUEST_TIMEOUT_MS } = options

  return new Promise<unknown>((resolve, reject) => {
    const controller = new AbortController()
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const onCallerAbort = () => {
      settle(() => reject(abortError()))
      controller.abort()
    }

    function settle(complete: () => void) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener("abort", onCallerAbort)
      complete()
    }

    if (signal?.aborted) {
      reject(abortError())
      return
    }
    signal?.addEventListener("abort", onCallerAbort, { once: true })
    timer = setTimeout(() => {
      settle(() => reject(new RegionRequestError("timeout")))
      controller.abort()
    }, timeoutMs)

    async function request(): Promise<unknown> {
      let response: Response
      try {
        response = await fetch(url, { credentials: "same-origin", signal: controller.signal })
      } catch {
        throw new RegionRequestError("network")
      }
      if (!response.ok) {
        throw new RegionRequestError(response.status >= 500 ? "server" : "rejected", response.status)
      }
      try {
        return (await response.json()) as unknown
      } catch {
        throw new RegionRequestError("invalid", response.status)
      }
    }

    request().then(
      (payload) => settle(() => resolve(payload)),
      (error: unknown) => settle(() => reject(error)),
    )
  })
}
