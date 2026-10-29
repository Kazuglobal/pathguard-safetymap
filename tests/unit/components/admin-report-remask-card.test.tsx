import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const masking = vi.hoisted(() => ({ requestMaskedPhoto: vi.fn() }))

vi.mock("@/components/media/use-masked-photo-picker", () => ({
  useMaskedPhotoPicker: () => ({ requestMaskedPhoto: masking.requestMaskedPhoto, photoMaskerDialog: null }),
}))

import { ReportModerationCard } from "@/components/admin/report-moderation-card"
import type { AdminModerationReport } from "@/lib/admin-report-moderation-queue"

const IMAGE_URL = "/api/media/private/danger-reports/owner-1/report-1/original.webp"

function report(overrides: Partial<AdminModerationReport> = {}): AdminModerationReport {
  return {
    id: "report-1", title: "見通しの悪い交差点", description: null, danger_type: "traffic", danger_level: 3,
    status: "approved", latitude: 35.68, longitude: 139.76, created_at: "2026-10-29T00:00:00.000Z",
    profiles: null, ai_moderation_status: "approved", ai_moderation_reason: null, ai_moderation_score: null,
    ai_moderation_checked_at: null, image_url: IMAGE_URL, image_masked: false, ...overrides,
  }
}

let uploads: FormData[] = []

beforeEach(() => {
  vi.clearAllMocks()
  uploads = []
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === IMAGE_URL) return new Response(new Blob(["original"], { type: "image/webp" }))
    if (url === "/api/admin/reports/remask") {
      uploads.push(init?.body as FormData)
      return new Response(JSON.stringify({ imageUrl: "x" }), { status: 200 })
    }
    return new Response("{}", { status: 404 })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("審査カードの写真のぼかし直し(UIUX改装 項目57)", () => {
  it("ぼかし待ちの写真は、管理者の端末でぼかしてから置き換える", async () => {
    const masked = new File(["masked"], "masked.webp", { type: "image/webp" })
    masking.requestMaskedPhoto.mockResolvedValue({ file: masked, faces: 1, manual: 0 })
    const onRemasked = vi.fn()
    render(<ReportModerationCard report={report()} updating={false} onStatusChange={vi.fn()} onRemasked={onRemasked} />)

    expect(screen.getByText("ぼかし待ち(ほかの人には写真を出していません)")).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole("button", { name: "ぼかして公開する" }))

    await waitFor(() => expect(onRemasked).toHaveBeenCalledWith("report-1"))
    expect(masking.requestMaskedPhoto).toHaveBeenCalledWith(expect.any(File))
    expect(uploads[0]!.get("file")).toBe(masked)
    expect(uploads[0]!.get("masked")).toBe("1")
    expect(uploads[0]!.get("reportId")).toBe("report-1")
  })

  it("ぼかすのをやめたら置き換えない。ぼかし済みの写真にはボタンを出さない", async () => {
    masking.requestMaskedPhoto.mockResolvedValue(null)
    const { rerender } = render(<ReportModerationCard report={report()} updating={false} onStatusChange={vi.fn()} />)
    await userEvent.setup().click(screen.getByRole("button", { name: "ぼかして公開する" }))
    await waitFor(() => expect(masking.requestMaskedPhoto).toHaveBeenCalled())
    expect(uploads).toEqual([])

    rerender(<ReportModerationCard report={report({ image_masked: true })} updating={false} onStatusChange={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "ぼかして公開する" })).not.toBeInTheDocument()
    expect(screen.getByAltText("報告の写真(管理者だけに表示)")).toBeInTheDocument()
  })
})
