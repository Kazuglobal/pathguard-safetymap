import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useReportInteractionsBatch } from "@/hooks/use-report-interactions"

const mocks = vi.hoisted(() => ({
  useSWR: vi.fn(),
  globalMutate: vi.fn(),
  toast: vi.fn(),
  mutate: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  likesInsert: vi.fn(),
  likesDelete: vi.fn(),
  likesDeleteEqUser: vi.fn(),
  likesDeleteEqReport: vi.fn(),
  bookmarksInsert: vi.fn(),
  bookmarksDelete: vi.fn(),
  bookmarksDeleteEqUser: vi.fn(),
  bookmarksDeleteEqReport: vi.fn(),
}))

vi.mock("swr", () => ({
  default: mocks.useSWR,
  mutate: mocks.globalMutate,
}))

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({
    supabase: {
      auth: { getUser: mocks.getUser },
      rpc: mocks.rpc,
      from: mocks.from,
    },
  }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

describe("useReportInteractionsBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.likesInsert.mockResolvedValue({ error: null })
    mocks.likesDeleteEqReport.mockResolvedValue({ error: null })
    mocks.likesDeleteEqUser.mockReturnValue({ eq: mocks.likesDeleteEqReport })
    mocks.likesDelete.mockReturnValue({ eq: mocks.likesDeleteEqUser })

    mocks.bookmarksInsert.mockResolvedValue({ error: null })
    mocks.bookmarksDeleteEqReport.mockResolvedValue({ error: null })
    mocks.bookmarksDeleteEqUser.mockReturnValue({ eq: mocks.bookmarksDeleteEqReport })
    mocks.bookmarksDelete.mockReturnValue({ eq: mocks.bookmarksDeleteEqUser })

    mocks.from.mockImplementation((table: string) => {
      if (table === "report_likes") {
        return { insert: mocks.likesInsert, delete: mocks.likesDelete }
      }
      if (table === "report_bookmarks") {
        return { insert: mocks.bookmarksInsert, delete: mocks.bookmarksDelete }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.rpc.mockResolvedValue({ error: null })
  })

  it("falls back to direct INSERT when toggleLike RPC fails", async () => {
    mocks.useSWR.mockReturnValue({
      data: new Map([["report-1", { liked: false, likeCount: 0, saved: false, saveCount: 0 }]]),
      error: undefined,
      isLoading: false,
      mutate: mocks.mutate,
    })
    mocks.rpc.mockResolvedValue({ error: { message: "function toggle_report_like does not exist" } })

    const { result } = renderHook(() => useReportInteractionsBatch(["report-1"]))

    await act(async () => {
      await result.current.toggleLike("report-1")
    })

    expect(mocks.likesInsert).toHaveBeenCalledWith({ user_id: "user-1", report_id: "report-1" })
    expect(mocks.mutate).toHaveBeenCalledWith(expect.any(Map), false)
    const optimistic = mocks.mutate.mock.calls[0][0] as Map<string, { liked: boolean; likeCount: number }>
    expect(optimistic.get("report-1")).toMatchObject({ liked: true, likeCount: 1 })
  })

  it("falls back to direct DELETE for save toggle and keeps count non-negative", async () => {
    mocks.useSWR.mockReturnValue({
      data: new Map([["report-1", { liked: false, likeCount: 0, saved: true, saveCount: 0 }]]),
      error: undefined,
      isLoading: false,
      mutate: mocks.mutate,
    })
    mocks.rpc.mockResolvedValue({ error: { message: "function toggle_report_bookmark does not exist" } })

    const { result } = renderHook(() => useReportInteractionsBatch(["report-1"]))

    await act(async () => {
      await result.current.toggleSave("report-1")
    })

    expect(mocks.bookmarksDelete).toHaveBeenCalled()
    expect(mocks.mutate).toHaveBeenCalledWith(expect.any(Map), false)
    const optimistic = mocks.mutate.mock.calls[0][0] as Map<string, { saved: boolean; saveCount: number }>
    expect(optimistic.get("report-1")).toMatchObject({ saved: false, saveCount: 0 })
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "保存を解除しました" }))
  })
})
