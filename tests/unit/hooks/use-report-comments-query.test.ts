import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useReportComments } from "@/hooks/use-report-comments"
import { useSupabase } from "@/components/providers/supabase-provider"

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: vi.fn(),
}))

describe("useReportComments query shape", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requests only display_name from profiles", async () => {
    const orderMock = vi.fn(() => Promise.resolve({ data: [], error: null }))
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))

    vi.mocked(useSupabase).mockReturnValue({
      supabase: {
        from: vi.fn(() => ({ select: selectMock })),
      },
    } as any)

    const { result } = renderHook(() => useReportComments("report-1"))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const selectArg = String(selectMock.mock.calls[0]?.[0] ?? "")
    expect(selectArg).toContain("profiles:user_id")
    expect(selectArg).toContain("display_name")
    expect(selectArg).not.toContain("email")
  })
})
