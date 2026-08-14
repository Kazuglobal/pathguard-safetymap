import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useDangerReports } from "@/hooks/use-danger-reports"

type QueryResult = { data: unknown[] | null; error: unknown }

/** チェーン可能な Supabase クエリビルダーの最小モック。呼ばれたメソッドと引数を記録する。 */
function createQueryBuilder(resolveOrder: () => Promise<QueryResult>) {
  const calls: Record<string, unknown[][]> = {}
  const record = (name: string, args: unknown[]) => {
    ;(calls[name] ??= []).push(args)
  }

  const builder: any = {
    calls,
    select: (...args: unknown[]) => (record("select", args), builder),
    in: (...args: unknown[]) => (record("in", args), builder),
    eq: (...args: unknown[]) => (record("eq", args), builder),
    gte: (...args: unknown[]) => (record("gte", args), builder),
    lte: (...args: unknown[]) => (record("lte", args), builder),
    abortSignal: (...args: unknown[]) => (record("abortSignal", args), builder),
    order: (...args: unknown[]) => {
      record("order", args)
      return resolveOrder()
    },
  }
  return builder
}

/**
 * from() が呼ばれた順に別々のビルダーを返す supabase モック。
 * 取得ごとに結果と解決タイミングを変えられるので、「初回取得 → 地図移動での再取得」を
 * 区別して検証できる（既定の makeSupabase は 1回目=公開/2回目以降=pending 固定）。
 */
function makeSequencedSupabase(
  resolvers: Array<() => Promise<QueryResult>>,
  userId: string | null = null,
) {
  const builders = resolvers.map((resolve) => createQueryBuilder(resolve))
  let index = 0
  const from = vi.fn(() => builders[Math.min(index++, builders.length - 1)])
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: userId ? { user: { id: userId } } : null },
        }),
      },
      from,
    },
    builders,
  }
}

function makeSupabase(approvedData: unknown[], userId: string | null = null) {
  const approvedBuilder = createQueryBuilder(() => Promise.resolve({ data: approvedData, error: null }))
  const pendingBuilder = createQueryBuilder(() => Promise.resolve({ data: [], error: null }))
  let fromCallCount = 0
  const from = vi.fn(() => {
    fromCallCount += 1
    return fromCallCount === 1 ? approvedBuilder : pendingBuilder
  })
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: userId ? { user: { id: userId } } : null },
        }),
      },
      from,
    },
    approvedBuilder,
    pendingBuilder,
  }
}

const baseFilterOptions = {
  dangerType: "all",
  dangerLevel: "all",
  dateRange: "all",
  showPending: true,
}

// renderHook はフック内の setState で再レンダーされるたびに props 引数を作り直すコールバックを
// 呼ぶ。filterOptions/toast/setIsLoading をその都度リテラルで作ると参照が変わり続け、
// useEffect の依存配列 [filterOptions, toast, setIsLoading] が毎回変化してフェッチが
// 無限に再実行されてしまう。テスト側で一度だけ生成した安定参照を渡す。
function renderUseDangerReports(
  filterOptions: Parameters<typeof useDangerReports>[0]["filterOptions"],
  approvedData: unknown[] = [],
  userId: string | null = null,
  enabled = true,
) {
  const { supabase, approvedBuilder, pendingBuilder } = makeSupabase(approvedData, userId)
  const toast = vi.fn()
  const setIsLoading = vi.fn()
  const rendered = renderHook(() =>
    useDangerReports({ supabase, filterOptions, toast, setIsLoading, enabled }),
  )
  return { ...rendered, approvedBuilder, pendingBuilder }
}

describe("useDangerReports", () => {
  it("prefecture・bounds 未指定なら eq/gte/lte で絞り込まない", async () => {
    const { result, approvedBuilder } = renderUseDangerReports(baseFilterOptions)

    await waitFor(() => expect(approvedBuilder.calls.order).toBeTruthy())

    expect(approvedBuilder.calls.eq).toBeUndefined()
    expect(approvedBuilder.calls.gte).toBeUndefined()
    expect(approvedBuilder.calls.lte).toBeUndefined()
    expect(result.current.dangerReports).toEqual([])
  })

  it("prefecture(全国以外)を指定すると .eq('prefecture', ...) で絞り込む", async () => {
    const { approvedBuilder } = renderUseDangerReports({
      ...baseFilterOptions,
      prefecture: "東京都",
    })

    await waitFor(() => expect(approvedBuilder.calls.order).toBeTruthy())

    expect(approvedBuilder.calls.eq).toEqual([["prefecture", "東京都"]])
  })

  it("prefecture が「全国」なら絞り込まない", async () => {
    const { approvedBuilder } = renderUseDangerReports({
      ...baseFilterOptions,
      prefecture: "全国",
    })

    await waitFor(() => expect(approvedBuilder.calls.order).toBeTruthy())

    expect(approvedBuilder.calls.eq).toBeUndefined()
  })

  it("bounds を指定すると緯度経度の範囲で絞り込む", async () => {
    const bounds = { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 }
    const { approvedBuilder } = renderUseDangerReports({ ...baseFilterOptions, bounds })

    await waitFor(() => expect(approvedBuilder.calls.order).toBeTruthy())

    expect(approvedBuilder.calls.gte).toEqual([
      ["latitude", 35],
      ["longitude", 139],
    ])
    expect(approvedBuilder.calls.lte).toEqual([
      ["latitude", 36],
      ["longitude", 140],
    ])
  })

  it("ログインユーザーの pending 報告にも prefecture と bounds を適用する", async () => {
    const bounds = { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 }
    const { pendingBuilder } = renderUseDangerReports(
      { ...baseFilterOptions, prefecture: "東京都", bounds },
      [],
      "user-1",
    )

    await waitFor(() => expect(pendingBuilder.calls.order).toBeTruthy())

    expect(pendingBuilder.calls.eq).toEqual([
      ["status", "pending"],
      ["user_id", "user-1"],
      ["prefecture", "東京都"],
    ])
    expect(pendingBuilder.calls.gte).toEqual([
      ["latitude", 35],
      ["longitude", 139],
    ])
    expect(pendingBuilder.calls.lte).toEqual([
      ["latitude", 36],
      ["longitude", 140],
    ])
  })

  it("dangerLevel 1〜3 は .eq('danger_level', N) で絞り込む", async () => {
    const { approvedBuilder } = renderUseDangerReports({
      ...baseFilterOptions,
      dangerLevel: "3",
    })

    await waitFor(() => expect(approvedBuilder.calls.order).toBeTruthy())

    expect(approvedBuilder.calls.eq).toEqual([["danger_level", 3]])
    expect(approvedBuilder.calls.gte).toBeUndefined()
  })

  it("dangerLevel 4(表示上の最上位)は gte で生データの4と5の両方にマッチさせる", async () => {
    // 表示は1〜4にクランプするが、投稿フォームは5を生成しうる。
    // レベル4フィルタで5が漏れると最危険の報告が絞り込みから消える。
    const { approvedBuilder } = renderUseDangerReports({
      ...baseFilterOptions,
      dangerLevel: "4",
    })

    await waitFor(() => expect(approvedBuilder.calls.order).toBeTruthy())

    expect(approvedBuilder.calls.gte).toEqual([["danger_level", 4]])
    expect(approvedBuilder.calls.eq).toBeUndefined()
  })

  it("dangerType に suspicious を指定すると .eq('danger_type', 'suspicious') で絞り込む", async () => {
    const { approvedBuilder } = renderUseDangerReports({
      ...baseFilterOptions,
      dangerType: "suspicious",
    })

    await waitFor(() => expect(approvedBuilder.calls.order).toBeTruthy())

    expect(approvedBuilder.calls.eq).toEqual([["danger_type", "suspicious"]])
  })

  it("自分の pending 報告クエリにもタイプ・危険度フィルタを適用する", async () => {
    // pending 側に適用し忘れると、絞り込み中も審査中リストに全件出続ける
    const { pendingBuilder } = renderUseDangerReports(
      { ...baseFilterOptions, dangerType: "traffic", dangerLevel: "4" },
      [],
      "user-1",
    )

    await waitFor(() => expect(pendingBuilder.calls.order).toBeTruthy())

    expect(pendingBuilder.calls.eq).toEqual([
      ["status", "pending"],
      ["user_id", "user-1"],
      ["danger_type", "traffic"],
    ])
    expect(pendingBuilder.calls.gte).toEqual([["danger_level", 4]])
  })

  const boundsA = { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 }
  const boundsB = { minLng: 139.5, minLat: 35.5, maxLng: 140.5, maxLat: 36.5 }

  it("初回取得だけ全画面ローディングを出し、bbox 変更による再取得では出さない", async () => {
    // 地図をパン/ズームすると bbox が変わって再取得が走る。毎回 setIsLoading すると
    // スクロールのたびに「地図を読み込み中」オーバーレイで地図が覆われてしまう。
    const { supabase, builders } = makeSequencedSupabase([
      () => Promise.resolve({ data: [{ id: "report-1" }], error: null }),
      () => Promise.resolve({ data: [{ id: "report-2" }], error: null }),
    ])
    const toast = vi.fn()
    const setIsLoading = vi.fn()

    const { result, rerender } = renderHook(
      ({ filterOptions }) =>
        useDangerReports({ supabase, filterOptions, toast, setIsLoading, enabled: true }),
      { initialProps: { filterOptions: { ...baseFilterOptions, bounds: boundsA } } },
    )

    await waitFor(() => expect(result.current.dangerReports).toEqual([{ id: "report-1" }]))
    expect(setIsLoading.mock.calls).toEqual([[true], [false]])

    setIsLoading.mockClear()
    // 地図を動かした想定で bbox だけ変える
    rerender({ filterOptions: { ...baseFilterOptions, bounds: boundsB } })

    await waitFor(() => expect(result.current.dangerReports).toEqual([{ id: "report-2" }]))
    // 2回目は「新しい bbox で正常に取得できた」こと自体も確かめる
    // (エラーで空になった場合と区別がつかないと、このテストは意味を失う)
    expect(builders[1].calls.gte).toEqual([
      ["latitude", 35.5],
      ["longitude", 139.5],
    ])
    expect(toast).not.toHaveBeenCalled()
    expect(setIsLoading).not.toHaveBeenCalled()
    expect(result.current.isFilterRefreshing).toBe(false)
  })

  it("絞り込み変更のときは一覧側の進行表示だけを出す（全画面は出さない）", async () => {
    // 地図を覆わないのは正しいが、ユーザーが操作した絞り込みまで無反応だと
    // 古い条件の一覧が残ったままに見える。一覧側だけで進行を伝える。
    const { supabase } = makeSequencedSupabase([
      () => Promise.resolve({ data: [{ id: "report-1" }], error: null }),
      () => Promise.resolve({ data: [{ id: "report-2" }], error: null }),
    ])
    const toast = vi.fn()
    const setIsLoading = vi.fn()

    const { result, rerender } = renderHook(
      ({ filterOptions }) =>
        useDangerReports({ supabase, filterOptions, toast, setIsLoading, enabled: true }),
      { initialProps: { filterOptions: { ...baseFilterOptions, bounds: boundsA } } },
    )

    await waitFor(() => expect(result.current.dangerReports).toEqual([{ id: "report-1" }]))
    setIsLoading.mockClear()

    // 地図は動かさず（bounds は同じ）、危険度フィルタだけ変える
    rerender({ filterOptions: { ...baseFilterOptions, dangerLevel: "4", bounds: boundsA } })

    // 進行表示は取得開始と同期して立つ（rerender で effect まで flush される）
    expect(result.current.isFilterRefreshing).toBe(true)

    await waitFor(() => expect(result.current.dangerReports).toEqual([{ id: "report-2" }]))
    expect(result.current.isFilterRefreshing).toBe(false)
    expect(setIsLoading).not.toHaveBeenCalled()
  })

  it("初回取得が地図の移動で中断されても、最後にローディングが解除される", async () => {
    // 初回取得中にパンされると 1回目は abort されて finally を早期 return する。
    // 2回目が初回扱いを引き継がないと、オーバーレイが出っぱなしになる。
    let resolveFirst: (value: QueryResult) => void = () => {}
    const firstResult = new Promise<QueryResult>((resolve) => {
      resolveFirst = resolve
    })
    const { supabase } = makeSequencedSupabase([
      () => firstResult,
      () => Promise.resolve({ data: [{ id: "report-2" }], error: null }),
    ])
    const toast = vi.fn()
    const setIsLoading = vi.fn()

    const { result, rerender } = renderHook(
      ({ filterOptions }) =>
        useDangerReports({ supabase, filterOptions, toast, setIsLoading, enabled: true }),
      { initialProps: { filterOptions: { ...baseFilterOptions, bounds: boundsA } } },
    )

    // 1回目はまだ解決していない = ローディング表示中
    expect(setIsLoading.mock.calls).toEqual([[true]])

    rerender({ filterOptions: { ...baseFilterOptions, bounds: boundsB } })
    await waitFor(() => expect(result.current.dangerReports).toEqual([{ id: "report-2" }]))

    // 中断された1回目が後から解決しても、古い結果で上書きしない
    resolveFirst({ data: [{ id: "report-1" }], error: null })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(setIsLoading.mock.calls.at(-1)).toEqual([false])
    expect(result.current.dangerReports).toEqual([{ id: "report-2" }])
  })

  it("背面での再取得が失敗しても、表示中のレポートを消さない", async () => {
    // 修正前はこの全消しの直前に全画面ローディングが出ていたため隠れていた。
    // オーバーレイをやめた以上、「パンしたら危険箇所が消えた」に見せてはいけない。
    const { supabase } = makeSequencedSupabase([
      () => Promise.resolve({ data: [{ id: "report-1" }], error: null }),
      () => Promise.reject(new Error("boom")), // transient 判定外なのでリトライしない
    ])
    const toast = vi.fn()
    const setIsLoading = vi.fn()

    const { result, rerender } = renderHook(
      ({ filterOptions }) =>
        useDangerReports({ supabase, filterOptions, toast, setIsLoading, enabled: true }),
      { initialProps: { filterOptions: { ...baseFilterOptions, bounds: boundsA } } },
    )

    await waitFor(() => expect(result.current.dangerReports).toEqual([{ id: "report-1" }]))
    setIsLoading.mockClear()

    rerender({ filterOptions: { ...baseFilterOptions, bounds: boundsB } })

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1))
    expect(result.current.dangerReports).toEqual([{ id: "report-1" }])
    expect(setIsLoading).not.toHaveBeenCalled()
  })

  it("絞り込み変更の取得が失敗したら、条件と矛盾する古い一覧を残さない", async () => {
    // パン失敗と違い、絞り込み変更の失敗で古い一覧を残すと
    // 「不審者で絞ったのに交通の報告が並んでいる」画面になる。
    const { supabase } = makeSequencedSupabase([
      () => Promise.resolve({ data: [{ id: "traffic-1" }], error: null }),
      () => Promise.reject(new Error("boom")),
    ])
    const toast = vi.fn()
    const setIsLoading = vi.fn()

    const { result, rerender } = renderHook(
      ({ filterOptions }) =>
        useDangerReports({ supabase, filterOptions, toast, setIsLoading, enabled: true }),
      { initialProps: { filterOptions: { ...baseFilterOptions, bounds: boundsA } } },
    )

    await waitFor(() => expect(result.current.dangerReports).toEqual([{ id: "traffic-1" }]))

    rerender({
      filterOptions: { ...baseFilterOptions, dangerType: "suspicious", bounds: boundsA },
    })

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1))
    expect(result.current.dangerReports).toEqual([])
    expect(result.current.isFilterRefreshing).toBe(false)
  })

  it("初回取得が失敗したら、次の取得でもう一度読み込み表示を出す", async () => {
    // 失敗した取得を「読み込み済み」にすると、一度もマーカーを出せていないのに
    // 以後の取得が無言になり、空の地図のまま何も知らせなくなる。
    const { supabase } = makeSequencedSupabase([
      () => Promise.reject(new Error("boom")),
      () => Promise.resolve({ data: [{ id: "report-1" }], error: null }),
    ])
    const toast = vi.fn()
    const setIsLoading = vi.fn()

    const { result, rerender } = renderHook(
      ({ filterOptions }) =>
        useDangerReports({ supabase, filterOptions, toast, setIsLoading, enabled: true }),
      { initialProps: { filterOptions: { ...baseFilterOptions, bounds: boundsA } } },
    )

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1))
    expect(setIsLoading.mock.calls).toEqual([[true], [false]])
    setIsLoading.mockClear()

    // 地図を動かしただけの再取得でも、まだ一度も出せていないので読み込み表示を出す
    rerender({ filterOptions: { ...baseFilterOptions, bounds: boundsB } })

    await waitFor(() => expect(result.current.dangerReports).toEqual([{ id: "report-1" }]))
    expect(setIsLoading.mock.calls).toEqual([[true], [false]])
  })

  it("enabled=false の間は取得を開始しない", async () => {
    const { approvedBuilder } = renderUseDangerReports(baseFilterOptions, [], null, false)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(approvedBuilder.calls.order).toBeUndefined()
  })
})
