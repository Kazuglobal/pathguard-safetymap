import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

  it("手動確認モードでは到着ボタンと手動ラベルを表示する", () => {
    render(
      <ARPrimaryHazardCard
        hazard={createHazard()}
        estimatedTimeMinutes={0}
        distanceLabel="手動確認"
        estimatedTimeLabel="現地で確認"
        markReviewedLabel="ここに着いた"
        onMarkReviewed={vi.fn()}
      />,
    )

    expect(screen.getByText("手動確認")).toBeInTheDocument()
    expect(screen.getByText("現地で確認")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ここに着いた" })).toBeInTheDocument()
  })
})

// カードが画面をほぼ全部覆ってカメラの景色が見えなかったので、下のシートにして要点だけ先に出す
describe("ARPrimaryHazardCard bottom sheet", () => {
  const learningContent = {
    summary: "車の出入りが多い場所です",
    checkpoints: ["止まって左右を見る"],
    attentionTags: ["見通し"],
  }

  it("写真が無い報告では、ひらいても画像の箱を出さない", async () => {
    const user = userEvent.setup()
    render(
      <ARPrimaryHazardCard
        hazard={createHazard({
          report: createMockDangerReport({ id: "no-photo", title: "写真なし", image_url: null, processed_image_urls: null }),
        })}
        estimatedTimeMinutes={1}
        learningContent={learningContent}
      />,
    )

    await user.click(screen.getByRole("button", { name: /くわしく見る/ }))
    expect(screen.queryByTestId("ar-image-gallery")).not.toBeInTheDocument()
  })

  it("最初はたたんであり、「くわしく見る」で写真と学習ポイントが出る", async () => {
    const user = userEvent.setup()
    render(
      <ARPrimaryHazardCard
        hazard={createHazard({
          report: createMockDangerReport({
            id: "with-photo",
            title: "写真あり",
            image_url: "https://example.supabase.co/storage/v1/object/public/a.jpg",
          }),
        })}
        estimatedTimeMinutes={1}
        learningContent={learningContent}
      />,
    )

    const toggle = screen.getByRole("button", { name: /くわしく見る/ })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("車の出入りが多い場所です")).not.toBeInTheDocument()
    expect(screen.queryByTestId("ar-image-gallery")).not.toBeInTheDocument()

    await user.click(toggle)

    expect(screen.getByRole("button", { name: /とじる/ })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("車の出入りが多い場所です")).toBeInTheDocument()
    expect(screen.getByTestId("ar-image-gallery")).toBeInTheDocument()
  })

  it("写真も学習ポイントも無いときは「くわしく見る」を出さない", () => {
    render(
      <ARPrimaryHazardCard
        hazard={createHazard({
          report: createMockDangerReport({ id: "bare", title: "要点だけ", image_url: null, processed_image_urls: null }),
        })}
        estimatedTimeMinutes={1}
      />,
    )

    expect(screen.queryByRole("button", { name: /くわしく見る/ })).not.toBeInTheDocument()
  })

  it("向きがそれているときは方向を、つぎの地点があればその1行を出す", () => {
    render(
      <ARPrimaryHazardCard
        hazard={createHazard({ relativeAngle: -40 })}
        estimatedTimeMinutes={6}
        nextHazard={createHazard({
          report: createMockDangerReport({ id: "next", title: "つぎの交差点" }),
          distance: 120,
        })}
      />,
    )

    expect(screen.getByText("左方向")).toBeInTheDocument()
    expect(screen.getByText("徒歩 約6分")).toBeInTheDocument()
    expect(screen.getByLabelText("次の危険個所")).toHaveTextContent("つぎの交差点")
  })

  // 親子モード: 注意の箱を毎回ぜんぶ出すと、たたんでも画面の6割を覆う
  it("近づいていないときの子ども向けの注意は、たたむとひとことだけ。ひらくと行動まで出る", async () => {
    const user = userEvent.setup()
    render(
      <ARPrimaryHazardCard
        hazard={createHazard()}
        estimatedTimeMinutes={1}
        childCue={{ shortMessage: "ここでは止まろう", action: "車が止まったのを見てからわたろう", dangerKind: "交通" }}
      />,
    )

    expect(screen.getByText("ここでは止まろう")).toBeInTheDocument()
    expect(screen.queryByText("車が止まったのを見てからわたろう")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /くわしく見る/ }))
    expect(screen.getByText("車が止まったのを見てからわたろう")).toBeInTheDocument()
  })

  it("手動確認のときは、つぎの地点の距離と方角を出さない(0m・北と出さない)", () => {
    render(
      <ARPrimaryHazardCard
        hazard={createHazard()}
        estimatedTimeMinutes={0}
        distanceLabel="手動確認"
        estimatedTimeLabel="現地で確認"
        nextHazard={createHazard({ report: createMockDangerReport({ id: "next", title: "つぎの交差点" }), distance: 0, bearing: 0 })}
      />,
    )

    const next = screen.getByLabelText("次の危険個所")
    expect(next).toHaveTextContent("つぎの交差点")
    expect(next).not.toHaveTextContent("0m")
    expect(next).not.toHaveTextContent("北")
  })

  it("振り返りから開き直したときだけ、振り返りへ戻るボタンを出す", async () => {
    const user = userEvent.setup()
    const onBackToReview = vi.fn()
    const { rerender } = render(<ARPrimaryHazardCard hazard={createHazard()} estimatedTimeMinutes={1} />)
    expect(screen.queryByRole("button", { name: "ふりかえりにもどる" })).not.toBeInTheDocument()

    rerender(<ARPrimaryHazardCard hazard={createHazard()} estimatedTimeMinutes={1} onBackToReview={onBackToReview} />)
    const back = screen.getByRole("button", { name: "ふりかえりにもどる" })
    expect(back).toHaveClass("min-h-11")
    await user.click(back)

    expect(onBackToReview).toHaveBeenCalledTimes(1)
  })

  it("別の報告に切りかわったら、たたんだ状態に戻す", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <ARPrimaryHazardCard hazard={createHazard()} estimatedTimeMinutes={1} learningContent={learningContent} />,
    )
    await user.click(screen.getByRole("button", { name: /くわしく見る/ }))

    rerender(
      <ARPrimaryHazardCard
        hazard={createHazard({ report: createMockDangerReport({ id: "other", title: "べつの報告" }) })}
        estimatedTimeMinutes={1}
        learningContent={learningContent}
      />,
    )

    expect(screen.getByRole("button", { name: /くわしく見る/ })).toHaveAttribute("aria-expanded", "false")
  })
})
