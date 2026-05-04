import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ARPrimaryHazardCard } from "@/components/map/ar-hazard-card"
import type { ARHazardData } from "@/lib/ar-utils"
import { createMockDangerReport } from "@/tests/fixtures/dangers"

vi.mock("@/components/map/ar-image-gallery", () => ({
  ARImageGallery: () => <div data-testid="ar-image-gallery" />,
}))

function createHazard(overrides: Partial<ARHazardData> = {}): ARHazardData {
  return {
    report: createMockDangerReport({
      id: "danger-kids-card",
      title: "見通しの悪い交差点",
      danger_type: "traffic",
      danger_level: 4,
    }),
    distance: 42,
    bearing: 90,
    relativeAngle: 0,
    x: 0,
    y: 0,
    z: 0.1,
    ...overrides,
  }
}

describe("ARPrimaryHazardCard parent-child learning UI", () => {
  it("接近中の子ども向け注意をalertとして表示する", () => {
    render(
      <ARPrimaryHazardCard
        hazard={createHazard()}
        estimatedTimeMinutes={1}
        childCue={{
          shortMessage: "ここでは止まって、みぎ・ひだりを見よう",
          action: "車が止まったことを見てからわたろう",
          dangerKind: "交通",
        }}
        isApproaching={true}
      />,
    )

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("ここでは止まって、みぎ・ひだりを見よう")
    expect(alert).toHaveTextContent("車が止まったことを見てからわたろう")
    expect(screen.getByText("いま確認するポイント")).toBeInTheDocument()
  })

  it("確認ボタンは44px以上のタップ領域を持つ", () => {
    render(
      <ARPrimaryHazardCard
        hazard={createHazard()}
        estimatedTimeMinutes={1}
        childCue={{
          shortMessage: "歩道がせまいから、車道に近づきすぎないようにしよう",
          action: "車道からはなれて歩こう",
          dangerKind: "歩道",
        }}
        isApproaching={true}
        onMarkReviewed={vi.fn()}
        onSaveForLater={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "確認した" })).toHaveClass("min-h-11")
    expect(screen.getByRole("button", { name: "あとで見返す" })).toHaveClass("min-h-11")
  })
})
