import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { HiyariHatReport } from "@/components/landing/HiyariHatReport"

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
  limit: vi.fn(),
  order: vi.fn(),
  inFilter: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}))

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.createBrowserClient,
}))

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

describe("HiyariHatReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.limit.mockResolvedValue({
      data: [
        {
          id: "report-1",
          title: "座標ゼロのテスト",
          description: "赤道・本初子午線",
          danger_type: "other",
          latitude: 0,
          longitude: 0,
          image_url: null,
          processed_image_urls: null,
          created_at: "2026-02-20T00:00:00.000Z",
        },
      ],
      error: null,
    })
    mocks.order.mockReturnValue({ limit: mocks.limit })
    mocks.inFilter.mockReturnValue({ order: mocks.order })
    mocks.select.mockReturnValue({ in: mocks.inFilter })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.createBrowserClient.mockReturnValue({ from: mocks.from })
  })

  it("renders coordinates even when latitude and longitude are zero", async () => {
    render(<HiyariHatReport />)

    await waitFor(() => {
      expect(screen.getByText(/0\.0000,\s*0\.0000/)).toBeInTheDocument()
    })
  })
})
