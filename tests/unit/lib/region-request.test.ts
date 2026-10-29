import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  REGION_REQUEST_TIMEOUT_MS,
  RegionRequestError,
  describeRegionRequestError,
  fetchRegionJson,
} from "@/lib/region-request"

const fetchMock = vi.fn()
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("expected the request to fail")
}

describe("fetchRegionJson", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("既定の時間切れは約12秒", () => {
    expect(REGION_REQUEST_TIMEOUT_MS).toBe(12_000)
  })

  it("同一オリジンの JSON を返し、中止用の signal を渡す", async () => {
    fetchMock.mockResolvedValue(json({ cities: ["新宿区"] }))

    await expect(fetchRegionJson("/api/school-districts?prefecture=x")).resolves.toEqual({ cities: ["新宿区"] })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/school-districts?prefecture=x",
      expect.objectContaining({ credentials: "same-origin", signal: expect.any(AbortSignal) }),
    )
  })

  it("応答が無ければ時間切れで失敗し、fetch を中止する(fetch が中止に応じなくても止まらない)", async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined
      return new Promise(() => {})
    })

    const pending = failureOf(fetchRegionJson("/api/slow"))
    await vi.advanceTimersByTimeAsync(REGION_REQUEST_TIMEOUT_MS)
    const error = await pending

    expect(error).toBeInstanceOf(RegionRequestError)
    expect((error as RegionRequestError).failure).toBe("timeout")
    expect(describeRegionRequestError(error)).toBe(
      "時間内に応答がありませんでした。通信状況を確かめて、もう一度お試しください。",
    )
    expect(signal?.aborted).toBe(true)
  })

  it("本文の読み取りが止まっても時間切れで失敗する", async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) })

    const pending = failureOf(fetchRegionJson("/api/slow-body", { timeoutMs: 50 }))
    await vi.advanceTimersByTimeAsync(50)

    expect(((await pending) as RegionRequestError).failure).toBe("timeout")
  })

  it("サーバーエラー・通信失敗・読めない応答をそれぞれの理由にする", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "unavailable" }, 503))
    const server = await failureOf(fetchRegionJson("/api/x"))
    expect((server as RegionRequestError).failure).toBe("server")
    expect((server as RegionRequestError).status).toBe(503)
    expect(describeRegionRequestError(server)).toBe("サーバーが一時的に応答できません。少し時間をおいてお試しください。")

    fetchMock.mockResolvedValueOnce(json({ error: "Invalid region" }, 400))
    expect(((await failureOf(fetchRegionJson("/api/x"))) as RegionRequestError).failure).toBe("rejected")

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    const network = await failureOf(fetchRegionJson("/api/x"))
    expect((network as RegionRequestError).failure).toBe("network")
    expect(describeRegionRequestError(network)).toBe("通信できませんでした。インターネット接続を確かめてください。")

    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }))
    expect(((await failureOf(fetchRegionJson("/api/x"))) as RegionRequestError).failure).toBe("invalid")
  })

  it("呼び出し側が中止したら AbortError で失敗し、理由の表示対象にしない", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const controller = new AbortController()

    const pending = failureOf(fetchRegionJson("/api/x", { signal: controller.signal }))
    controller.abort()
    const error = await pending

    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe("AbortError")
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it("中止済みの signal なら fetch しない", async () => {
    const controller = new AbortController()
    controller.abort()

    const error = await failureOf(fetchRegionJson("/api/x", { signal: controller.signal }))

    expect((error as DOMException).name).toBe("AbortError")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("想定外のエラーにも日本語の理由を返す", () => {
    expect(describeRegionRequestError(new Error("boom"))).toBe("予期しない問題が起きました。もう一度お試しください。")
  })
})
