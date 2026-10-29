import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  FETCH_CACHE_TTL_MS,
  FetchJsonError,
  buildPublicReportsUrl,
  fetchJsonCached,
  fetchPublicReports,
  invalidateFetchCache,
} from "@/lib/reports-fetch-cache"
import { PUBLIC_DANGER_REPORT_STATUSES } from "@/lib/danger-report-status"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("fetchJsonCached", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    invalidateFetchCache()
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("同じ URL への同時リクエストは 1 本にまとめ、同じ結果を返す", async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValueOnce(pending.promise)

    const first = fetchJsonCached<{ value: number }>("/api/sample")
    const second = fetchJsonCached<{ value: number }>("/api/sample")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/sample", { credentials: "same-origin" })

    pending.resolve(json({ value: 1 }))
    const [a, b] = await Promise.all([first, second])
    expect(a).toEqual({ value: 1 })
    expect(b).toBe(a)
  })

  it("URL が違えば別々に取りにいく", async () => {
    fetchMock.mockImplementation(async (url: string) => json({ url }))

    const [a, b] = await Promise.all([
      fetchJsonCached<{ url: string }>("/api/a"),
      fetchJsonCached<{ url: string }>("/api/b"),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(a.url).toBe("/api/a")
    expect(b.url).toBe("/api/b")
  })

  it("成功した結果は TTL のあいだ使い回し、TTL を過ぎたら取り直す", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    fetchMock
      .mockResolvedValueOnce(json({ version: 1 }))
      .mockResolvedValueOnce(json({ version: 2 }))

    await expect(fetchJsonCached("/api/sample")).resolves.toEqual({ version: 1 })

    now.mockReturnValue(1_000_000 + FETCH_CACHE_TTL_MS - 1)
    await expect(fetchJsonCached("/api/sample")).resolves.toEqual({ version: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    now.mockReturnValue(1_000_000 + FETCH_CACHE_TTL_MS)
    await expect(fetchJsonCached("/api/sample")).resolves.toEqual({ version: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("ttlMs を指定するとその時間で切り替わる", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(5_000)
    fetchMock
      .mockResolvedValueOnce(json({ version: 1 }))
      .mockResolvedValueOnce(json({ version: 2 }))

    await fetchJsonCached("/api/sample", { ttlMs: 10 })
    now.mockReturnValue(5_010)
    await expect(fetchJsonCached("/api/sample", { ttlMs: 10 })).resolves.toEqual({ version: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("2xx 以外は FetchJsonError で失敗し、失敗は残さず次の呼び出しで取り直す", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "boom" }, 500))
      .mockResolvedValueOnce(json({ ok: true }))

    const failure = await fetchJsonCached("/api/sample").catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(FetchJsonError)
    expect((failure as FetchJsonError).status).toBe(500)

    await expect(fetchJsonCached("/api/sample")).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("通信そのものの失敗もキャッシュせず、元の例外のまま返す", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json({ ok: true }))

    await expect(fetchJsonCached("/api/sample")).rejects.toThrow("Failed to fetch")
    await expect(fetchJsonCached("/api/sample")).resolves.toEqual({ ok: true })
  })

  it("force: true は残っている結果を使わずに取り直す", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ version: 1 }))
      .mockResolvedValueOnce(json({ version: 2 }))

    await fetchJsonCached("/api/sample")
    await expect(fetchJsonCached("/api/sample", { force: true })).resolves.toEqual({ version: 2 })
    // 取り直した結果が次からの共有値になる
    await expect(fetchJsonCached("/api/sample")).resolves.toEqual({ version: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("invalidateFetchCache は指定した URL だけ、または全件を捨てる", async () => {
    fetchMock.mockImplementation(async (url: string) => json({ url }))

    await fetchJsonCached("/api/a")
    await fetchJsonCached("/api/b")
    expect(fetchMock).toHaveBeenCalledTimes(2)

    invalidateFetchCache("/api/a")
    await fetchJsonCached("/api/a")
    await fetchJsonCached("/api/b")
    expect(fetchMock).toHaveBeenCalledTimes(3)

    invalidateFetchCache()
    await fetchJsonCached("/api/a")
    await fetchJsonCached("/api/b")
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it("取得中に捨てられた古いリクエストの応答で、新しい結果を上書きしない", async () => {
    const stale = deferred<Response>()
    fetchMock
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(json({ version: "fresh" }))

    const staleRequest = fetchJsonCached("/api/sample")
    invalidateFetchCache("/api/sample")
    await expect(fetchJsonCached("/api/sample")).resolves.toEqual({ version: "fresh" })

    stale.resolve(json({ version: "stale" }))
    await expect(staleRequest).resolves.toEqual({ version: "stale" })

    await expect(fetchJsonCached("/api/sample")).resolves.toEqual({ version: "fresh" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("fetchPublicReports", () => {
  beforeEach(() => {
    invalidateFetchCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("公開ステータスの通報を limit=2000 でまとめて取る URL を組み立てる", () => {
    const url = new URL(buildPublicReportsUrl(), "https://example.test")
    expect(url.pathname).toBe("/api/reports")
    expect(url.searchParams.get("limit")).toBe("2000")
    expect(url.searchParams.getAll("status")).toEqual([...PUBLIC_DANGER_REPORT_STATUSES])
  })

  it("同じ URL を使うので、別々の呼び出し元でも 1 回の取得を共有する", async () => {
    const fetchMock = vi.fn(async () => json({ reports: [{ id: "r1" }] }))
    vi.stubGlobal("fetch", fetchMock)

    const [a, b] = await Promise.all([fetchPublicReports(), fetchPublicReports()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(buildPublicReportsUrl(), { credentials: "same-origin" })
    expect(a).toEqual({ reports: [{ id: "r1" }] })
    expect(b).toBe(a)
  })
})
