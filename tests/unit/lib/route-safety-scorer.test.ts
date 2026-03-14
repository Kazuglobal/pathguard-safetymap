import { describe, expect, it } from "vitest"

import {
  buildRouteSafetyEvidenceItems,
  buildRouteSafetySummary,
} from "@/lib/safety-scoring/route-safety-scorer"

describe("buildRouteSafetySummary", () => {
  it("returns danger summary when high-risk hazards and severe danger reports exist", () => {
    const summary = buildRouteSafetySummary({
      routeName: "いつもの通学路",
      routeHazards: [
        {
          id: "hazard-1",
          hazard_type: "flood",
          risk_level: 4,
          title: "冠水しやすい交差点",
          summary: "大雨時に足元が見えづらくなります",
        },
      ],
      routeDangers: [
        {
          id: "danger-1",
          danger_level: 3,
          danger_type: "交通危険",
          title: "見通しの悪い交差点",
        },
      ],
    })

    expect(summary.status).toBe("danger")
    expect(summary.label).toBe("要確認")
    expect(summary.headline).toContain("いつもの通学路")
    expect(summary.reasons).toEqual(
      expect.arrayContaining(["洪水ハザードが1件あります", "危険報告が1件あります"]),
    )
  })

  it("returns safe summary when no hazards or danger reports are found", () => {
    const summary = buildRouteSafetySummary({
      routeName: "公園までの道",
      routeHazards: [],
      routeDangers: [],
    })

    expect(summary.status).toBe("safe")
    expect(summary.label).toBe("安全")
    expect(summary.detail).toContain("大きな危険情報は見つかっていません")
  })

  it("returns loading summary while evaluation is in progress", () => {
    const summary = buildRouteSafetySummary({
      routeName: "見守りルート",
      routeHazards: [],
      routeDangers: [],
      isLoading: true,
    })

    expect(summary.status).toBe("loading")
    expect(summary.label).toBe("判定中")
  })

  it("builds evidence items with reason, source, and updated time", () => {
    const evidenceItems = buildRouteSafetyEvidenceItems({
      routeHazards: [
        {
          id: "hazard-1",
          hazard_type: "flood",
          risk_level: 4,
          title: "冠水しやすい交差点",
          summary: "大雨時に足元が見えづらくなります",
        },
      ],
      routeDangers: [
        {
          id: "danger-1",
          danger_level: 3,
          danger_type: "交通危険",
          title: "見通しの悪い交差点",
          description: "右折車が見えにくい",
          updated_at: "2026-03-14T08:30:00.000Z",
          created_at: "2026-03-14T08:00:00.000Z",
        },
      ],
      hazardFetchedAt: "2026-03-14T09:30:00.000Z",
    })

    expect(evidenceItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "冠水しやすい交差点",
          reason: "大雨時に足元が見えづらくなります",
          source: "洪水浸水想定区域",
          updatedLabel: "2026-03-14 09:30",
        }),
        expect.objectContaining({
          title: "見通しの悪い交差点",
          reason: "右折車が見えにくい",
          source: "保護者の危険報告",
          updatedLabel: "2026-03-14 08:30",
        }),
      ]),
    )
  })
})
