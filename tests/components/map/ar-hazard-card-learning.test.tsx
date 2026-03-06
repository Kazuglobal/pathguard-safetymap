import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ARPrimaryHazardCard } from "@/components/map/ar-hazard-card"
import type { ARHazardData } from "@/lib/ar-utils"
import type { DangerReport } from "@/lib/types"

function createMockReport(overrides?: Partial<DangerReport>): DangerReport {
  return {
    id: "report-1",
    user_id: "user-1",
    title: "見通しの悪い交差点",
    description: "車の右左折が多い場所です。",
    latitude: 35.6812,
    longitude: 139.7671,
    danger_type: "traffic",
    danger_level: 4,
    status: "published",
    image_url: null,
    processed_image_url: null,
    processed_image_urls: null,
    prefecture: null,
    prefecture_code: null,
    city: null,
    municipality_code: null,
    town: null,
    postal_code: null,
    geocode_source: null,
    geocoded_at: null,
    geocode_confidence: null,
    address_hash: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

function createHazard(): ARHazardData {
  return {
    report: createMockReport(),
    distance: 85,
    bearing: 15,
    relativeAngle: 8,
    x: 0,
    y: 0,
    z: 0.1,
  }
}

describe("ARPrimaryHazardCard learning mode", () => {
  it("renders learning summary, checkpoints, tags, and progress", () => {
    render(
      <ARPrimaryHazardCard
        hazard={createHazard()}
        estimatedTimeMinutes={2}
        learningContent={{
          summary: "交差点に進入する車の動きを先に確認します。",
          checkpoints: ["子どもの目線で死角を確認する", "停止線の位置を確認する"],
          attentionTags: ["高リスク", "登校時間帯"],
        }}
        progressLabel="1 / 3"
      />
    )

    expect(screen.getByText("1 / 3")).toBeInTheDocument()
    expect(screen.getByText("学習ポイント")).toBeInTheDocument()
    expect(screen.getByText("交差点に進入する車の動きを先に確認します。")).toBeInTheDocument()
    expect(screen.getByText("子どもの目線で死角を確認する")).toBeInTheDocument()
    expect(screen.getByText("高リスク")).toBeInTheDocument()
    expect(screen.getByText("登校時間帯")).toBeInTheDocument()
  })

  it("calls action handlers when review actions are pressed", () => {
    const onMarkReviewed = vi.fn()
    const onSaveForLater = vi.fn()

    render(
      <ARPrimaryHazardCard
        hazard={createHazard()}
        estimatedTimeMinutes={2}
        learningContent={{
          summary: "確認ポイントです。",
          checkpoints: ["周囲を見る", "車の流れを見る"],
          attentionTags: ["高リスク"],
        }}
        onMarkReviewed={onMarkReviewed}
        onSaveForLater={onSaveForLater}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "確認した" }))
    fireEvent.click(screen.getByRole("button", { name: "あとで見返す" }))

    expect(onMarkReviewed).toHaveBeenCalledTimes(1)
    expect(onSaveForLater).toHaveBeenCalledTimes(1)
  })
})
