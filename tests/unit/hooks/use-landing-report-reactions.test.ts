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
})
