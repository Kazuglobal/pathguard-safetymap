import { describe, expect, it } from "vitest"
import type { DangerReport } from "@/lib/types"
import type { ARHazardData } from "@/lib/ar-utils"
import {
  buildARLearningTourStops,
  createARLearningContent,
  summarizeARLearningTour,
} from "@/lib/ar-learning-tour"

function createMockReport(overrides?: Partial<DangerReport>): DangerReport {
  return {
    id: "report-1",
    user_id: "user-1",
    title: "見通しの悪い交差点",
    description: "朝は車通りが多く、雨の日は特に滑りやすいです。",
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

function createHazard(
  id: string,
  distance: number,
  overrides?: Partial<DangerReport>
): ARHazardData {
  return {
    report: createMockReport({ id, ...overrides }),
    distance,
    bearing: 30,
    relativeAngle: 5,
    x: 0,
    y: 0,
    z: 0.2,
  }
}

describe("createARLearningContent", () => {
  it("builds traffic-focused learning content with risk and weather tags", () => {
    const content = createARLearningContent(
      createMockReport({
        danger_type: "traffic",
        danger_level: 5,
        description: "雨の日は特に危険で、朝の登校時間に車が多いです。",
      })
    )

    expect(content.summary).toContain("車")
    expect(content.checkpoints).toEqual(
      expect.arrayContaining(["子どもの目線で見通しを確認する", "横断前に車の動線を確認する"])
    )
    expect(content.attentionTags).toEqual(
      expect.arrayContaining(["高リスク", "雨天注意", "登校時間帯"])
    )
  })

  it("falls back to generic guidance for unknown danger types", () => {
    const content = createARLearningContent(
      createMockReport({
        danger_type: "unknown",
        danger_level: 2,
        title: "注意が必要な場所",
        description: null,
      })
    )

    expect(content.summary).toContain("周囲の状況")
    expect(content.checkpoints).toHaveLength(2)
    expect(content.attentionTags).toContain("現地確認")
  })
})

describe("buildARLearningTourStops", () => {
  it("preserves hazard order and merges saved progress", () => {
    const stops = buildARLearningTourStops(
      [
        createHazard("report-1", 45),
        createHazard("report-2", 90, {
          title: "歩道が狭い地点",
          danger_type: "construction",
        }),
      ],
      {
        "report-1": "reviewed",
        "report-2": "saved",
      }
    )

    expect(stops.map((stop) => stop.report.id)).toEqual(["report-1", "report-2"])
    expect(stops[0].status).toBe("reviewed")
    expect(stops[1].status).toBe("saved")
    expect(stops[1].content.summary).toContain("工事")
  })
})

describe("summarizeARLearningTour", () => {
  it("counts reviewed and saved stops and surfaces revisit targets", () => {
    const stops = buildARLearningTourStops(
      [
        createHazard("report-1", 45, { danger_level: 4 }),
        createHazard("report-2", 90, { danger_level: 3 }),
        createHazard("report-3", 120, { danger_level: 5 }),
      ],
      {
        "report-1": "reviewed",
        "report-2": "saved",
        "report-3": "saved",
      }
    )

    const summary = summarizeARLearningTour(stops)

    expect(summary.totalCount).toBe(3)
    expect(summary.reviewedCount).toBe(1)
    expect(summary.savedCount).toBe(2)
    expect(summary.revisitStops.map((stop) => stop.report.id)).toEqual(["report-2", "report-3"])
    expect(summary.highestRiskStop?.report.id).toBe("report-3")
  })
})
