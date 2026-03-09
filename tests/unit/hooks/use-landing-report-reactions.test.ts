import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLandingReportReactions } from "@/hooks/use-landing-report-reactions"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  selectEq: vi.fn(),
  selectIn: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  deleteEqUser: vi.fn(),
  deleteEqReport: vi.fn(),
  deleteEqReactionType: vi.fn(),
  toast: vi.fn(),
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

mocks.supabase.auth.getUser = mocks.getUser
mocks.supabase.from = mocks.from

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({
    supabase: mocks.supabase,
  }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

describe("useLandingReportReactions", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.selectIn.mockResolvedValue({
      data: [],
      error: null,
    })
    mocks.selectEq.mockReturnValue({ in: mocks.selectIn })
    mocks.select.mockReturnValue({ eq: mocks.selectEq })

    mocks.deleteEqReactionType.mockResolvedValue({ error: null })
    mocks.deleteEqReport.mockReturnValue({ eq: mocks.deleteEqReactionType })
    mocks.deleteEqUser.mockReturnValue({ eq: mocks.deleteEqReport })
    mocks.delete.mockReturnValue({ eq: mocks.deleteEqUser })

    mocks.insert.mockResolvedValue({ error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table !== "danger_report_reactions") {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select: mocks.select,
        insert: mocks.insert,
        delete: mocks.delete,
      }
    })
  })

  it("ログイン済みユーザーの既存リアクションを読み込む", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.selectIn.mockResolvedValue({
      data: [
        { report_id: "report-1", reaction_type: "helpful" },
        { report_id: "report-1", reaction_type: "caution" },
      ],
      error: null,
    })

    const { result } = renderHook(() => useLandingReportReactions(["report-1"]))

    await waitFor(() => {
      expect(result.current.reactions["report-1"]).toEqual({
        helpful: true,
        caution: true,
      })
    })
  })

  it("未ログイン時のトグルでは保存せずトーストを出す", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })

    const { result } = renderHook(() => useLandingReportReactions(["report-1"]))

    await act(async () => {
      await result.current.toggleReaction("report-1", "helpful")
    })

    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "ログインが必要です",
    }))
  })

  it("初回ロード前のトグルが遅延ロードで上書きされない", async () => {
    const selectDeferred = deferred<{ data: Array<{ report_id: string; reaction_type: "helpful" | "caution" }>; error: null }>()
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.selectIn.mockReturnValue(selectDeferred.promise)

    const { result } = renderHook(() => useLandingReportReactions(["report-1"]))

    await waitFor(() => {
      expect(mocks.selectIn).toHaveBeenCalled()
    })

    await act(async () => {
      await result.current.toggleReaction("report-1", "helpful")
    })

    expect(result.current.reactions["report-1"]).toEqual({
      helpful: true,
      caution: false,
    })

    await act(async () => {
      selectDeferred.resolve({ data: [], error: null })
      await selectDeferred.promise
    })

    await waitFor(() => {
      expect(result.current.reactions["report-1"]).toEqual({
        helpful: true,
        caution: false,
      })
    })
  })

  it("同じリアクションの連打では重複書き込みしない", async () => {
    const insertDeferred = deferred<{ error: null }>()
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.insert.mockReturnValue(insertDeferred.promise)

    const { result } = renderHook(() => useLandingReportReactions(["report-1"]))

    await waitFor(() => {
      expect(result.current.reactions["report-1"]).toEqual({
        helpful: false,
        caution: false,
      })
    })

    await act(async () => {
      const first = result.current.toggleReaction("report-1", "helpful")
      const second = result.current.toggleReaction("report-1", "helpful")

      await Promise.resolve()
      expect(mocks.insert).toHaveBeenCalledTimes(1)

      insertDeferred.resolve({ error: null })
      await Promise.all([first, second])
    })

    expect(result.current.reactions["report-1"]).toEqual({
      helpful: true,
      caution: false,
    })
  })
})
