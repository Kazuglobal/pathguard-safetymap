import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useDangerReports } from "@/hooks/use-danger-reports"

/** チェーン可能な Supabase クエリビルダーの最小モック。呼ばれたメソッドと引数を記録する。 */
function createQueryBuilder(data: unknown[]) {
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
      return Promise.resolve({ data, error: null })
    },
  }
  return builder
}

function makeSupabase(approvedData: unknown[], userId: string | null = null) {
  const approvedBuilder = createQueryBuilder(approvedData)
  const pendingBuilder = createQueryBuilder([])
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

  it("enabled=false の間は取得を開始しない", async () => {
    const { approvedBuilder } = renderUseDangerReports(baseFilterOptions, [], null, false)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(approvedBuilder.calls.order).toBeUndefined()
  })
})
