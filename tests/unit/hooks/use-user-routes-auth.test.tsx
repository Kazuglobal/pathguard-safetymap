import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void

// supabase クライアントは本番では provider の useMemo で 1 つに固定されるため、テストでも同じ参照を返す
const h = vi.hoisted(() => {
  const listeners = new Set<AuthCallback>()
  const auth = {
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn((callback: AuthCallback) => {
      listeners.add(callback)
      return { data: { subscription: { unsubscribe: vi.fn(() => listeners.delete(callback)) } } }
    }),
  }
  return { listeners, auth, supabase: { auth } }
})

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({ supabase: h.supabase }),
}))

import { useUserRoutes } from "@/hooks/use-user-routes"
import { buildPublicReportsUrl, fetchPublicReports, invalidateFetchCache } from "@/lib/reports-fetch-cache"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const session = (id: string) => ({ user: { id } })

const route = (id: string) => ({
  id,
  name: `ルート${id}`,
  child_id: null,
  child_name: null,
  is_favorite: false,
  route_geometry: null,
})

async function emit(event: string, value: { user: { id: string } } | null) {
  await act(async () => {
    for (const listener of h.listeners) listener(event, value)
  })
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

let fetchMock: ReturnType<typeof vi.fn>

const routeListRequests = () =>
  fetchMock.mock.calls.filter(
    ([url, init]) => url === "/api/routes" && (!init?.method || init.method === "GET")
  ).length

const publicReportRequests = () =>
  fetchMock.mock.calls.filter(([url]) => url === buildPublicReportsUrl()).length

beforeEach(() => {
  vi.clearAllMocks()
  h.listeners.clear()
  invalidateFetchCache()
  h.auth.getSession.mockResolvedValue({ data: { session: session("user-1") } })
  h.auth.getUser.mockResolvedValue({ data: { user: null } })
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useUserRoutes の認証まわり", () => {
  it("同じユーザーのままの認証イベント（TOKEN_REFRESHED など）では取り直さず、読み込み表示にも戻さない", async () => {
    fetchMock.mockImplementation(async () => json({ routes: [route("r1")] }))
    const loadingHistory: boolean[] = []

    const { result } = renderHook(() => {
      const value = useUserRoutes()
      loadingHistory.push(value.isLoading)
      return value
    })

    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    expect(result.current.isLoading).toBe(false)
    const settledRenderCount = loadingHistory.length

    await emit("INITIAL_SESSION", session("user-1"))
    await emit("SIGNED_IN", session("user-1"))
    await emit("TOKEN_REFRESHED", session("user-1"))
    await flush()

    expect(routeListRequests()).toBe(1)
    expect(h.auth.getSession).toHaveBeenCalledTimes(1)
    expect(h.auth.getUser).not.toHaveBeenCalled()
    expect(loadingHistory.slice(settledRenderCount)).not.toContain(true)
    expect(result.current.routes.map((item) => item.id)).toEqual(["r1"])
  })

  it("初回の認証確認より先に INITIAL_SESSION が届いても、一覧の取得は 1 回だけ", async () => {
    const lookup = deferred<{ data: { session: { user: { id: string } } } }>()
    h.auth.getSession.mockReturnValueOnce(lookup.promise)
    fetchMock.mockImplementation(async () => json({ routes: [route("r1")] }))

    const { result } = renderHook(() => useUserRoutes())

    await emit("INITIAL_SESSION", session("user-1"))
    await waitFor(() => expect(result.current.routes).toHaveLength(1))

    await act(async () => {
      lookup.resolve({ data: { session: session("user-1") } })
    })
    await flush()

    expect(routeListRequests()).toBe(1)
    expect(h.auth.getSession).toHaveBeenCalledTimes(1)
    expect(result.current.isLoading).toBe(false)
  })

  it("SIGNED_OUT で一覧を消し、取得中だった応答もあとから反映しない", async () => {
    const backgroundReload = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(json({ routes: [route("r1")] }))
      .mockReturnValueOnce(backgroundReload.promise)

    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.routes).toHaveLength(1))

    act(() => {
      result.current.refreshRoutes()
    })
    expect(result.current.routes).toHaveLength(1)
    expect(result.current.isLoading).toBe(false)

    await emit("SIGNED_OUT", null)
    expect(result.current.routes).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()

    await act(async () => {
      backgroundReload.resolve(json({ routes: [route("r1"), route("r2")] }))
    })
    await flush()
    expect(result.current.routes).toEqual([])
  })

  it("別のユーザーでログインし直したら、前のユーザーの一覧を消してから読み込み直す", async () => {
    const secondUserLoad = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(json({ routes: [route("r1")] }))
      .mockReturnValueOnce(secondUserLoad.promise)

    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.routes).toHaveLength(1))

    await emit("SIGNED_IN", session("user-2"))
    expect(result.current.routes).toEqual([])
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      secondUserLoad.resolve(json({ routes: [route("r2")] }))
    })
    await waitFor(() => expect(result.current.routes.map((item) => item.id)).toEqual(["r2"]))
    expect(result.current.isLoading).toBe(false)
    expect(routeListRequests()).toBe(2)
  })

  it("ユーザーが変わったら、共有していた通報の取得結果も捨てる", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/routes" ? json({ routes: [route("r1")] }) : json({ reports: [] })
    )

    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.routes).toHaveLength(1))

    await fetchPublicReports()
    await fetchPublicReports()
    expect(publicReportRequests()).toBe(1)

    await emit("SIGNED_OUT", null)
    await fetchPublicReports()
    expect(publicReportRequests()).toBe(2)
  })

  it("ルート追加のあとの取り直し中も表示中の一覧を残し、認証の確認を増やさない", async () => {
    const reloadAfterAdd = deferred<Response>()
    let listRequestCount = 0
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json({ route: route("r2") }, 201)
      listRequestCount += 1
      return listRequestCount === 1 ? json({ routes: [route("r1")] }) : reloadAfterAdd.promise
    })
    const loadingHistory: boolean[] = []

    const { result } = renderHook(() => {
      const value = useUserRoutes()
      loadingHistory.push(value.isLoading)
      return value
    })
    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    const settledRenderCount = loadingHistory.length

    let added: Promise<boolean> = Promise.resolve(false)
    act(() => {
      added = result.current.addRoute({ name: "新しい道" } as Parameters<typeof result.current.addRoute>[0])
    })
    await waitFor(() => expect(routeListRequests()).toBe(2))
    expect(result.current.routes.map((item) => item.id)).toEqual(["r1"])
    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      reloadAfterAdd.resolve(json({ routes: [route("r1"), route("r2")] }))
      await expect(added).resolves.toBe(true)
    })

    expect(result.current.routes.map((item) => item.id)).toEqual(["r1", "r2"])
    expect(loadingHistory.slice(settledRenderCount)).not.toContain(true)
    // マウント時の 1 回と、ルート追加そのものの確認 1 回だけ（取り直しでは確認しない）
    expect(h.auth.getSession).toHaveBeenCalledTimes(2)
  })

  it("ログアウトしたあとは、進行中だった追加の続きで一覧を取りにいかない", async () => {
    const pendingCreate = deferred<Response>()
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? pendingCreate.promise : json({ routes: [route("r1")] })
    )

    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.routes).toHaveLength(1))

    let added: Promise<boolean> = Promise.resolve(false)
    act(() => {
      added = result.current.addRoute({ name: "新しい道" } as Parameters<typeof result.current.addRoute>[0])
    })
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true)
    )

    await emit("SIGNED_OUT", null)
    await act(async () => {
      pendingCreate.resolve(json({ route: route("r2") }, 201))
      await added
    })
    await flush()

    expect(routeListRequests()).toBe(1)
    expect(result.current.routes).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it("初回の確認でログインが見つからなくても、操作のときに分かれば一覧を取り直す", async () => {
    h.auth.getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValue({ data: { session: session("user-1") } })
    h.auth.getUser.mockResolvedValue({ data: { user: null } })
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? json({ route: route("r1") }, 201) : json({ routes: [route("r1")] })
    )

    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.routes).toEqual([])

    await act(async () => {
      await expect(
        result.current.addRoute({ name: "新しい道" } as Parameters<typeof result.current.addRoute>[0])
      ).resolves.toBe(true)
    })

    expect(result.current.routes.map((item) => item.id)).toEqual(["r1"])
    expect(routeListRequests()).toBe(1)
  })

  it("最初の取得に失敗したあとの再試行では読み込み表示を出し、成功したら一覧を出す", async () => {
    const retry = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(json({ error: "boom" }, 500))
      .mockReturnValueOnce(retry.promise)

    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.error).toBe("通学路の取得に失敗しました (500)"))
    expect(result.current.isLoading).toBe(false)

    act(() => {
      result.current.refreshRoutes()
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()

    await act(async () => {
      retry.resolve(json({ routes: [route("r1")] }))
    })
    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    expect(result.current.isLoading).toBe(false)
    expect(h.auth.getSession).toHaveBeenCalledTimes(1)
  })

  it("未ログインなら一覧を取りにいかず、空のまま読み込みを終える", async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: null } })
    h.auth.getUser.mockResolvedValue({ data: { user: null } })

    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await emit("INITIAL_SESSION", null)
    await flush()

    expect(result.current.routes).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.auth.getUser).toHaveBeenCalledTimes(1)
  })
})
