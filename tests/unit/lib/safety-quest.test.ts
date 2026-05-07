import { describe, expect, it } from "vitest"

import {
  SAMPLE_SAFETY_QUEST_CHALLENGES,
  buildSafetyQuestChallengesFromReports,
  calculateSafetyQuestPoints,
  scoreSafetyQuestAttempt,
} from "@/lib/safety-quest"
import type { DetectionItem, UserMarker } from "@/lib/hazard-game-types"

const hazards: DetectionItem[] = [
  {
    category: "hazards",
    label: "見通しの悪い角",
    description: "角から車が見えにくい",
    count: 2,
    confidence: 0.9,
    coverageRatio: 0.2,
    positions: [
      { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      { x: 0.55, y: 0.55, width: 0.2, height: 0.2 },
    ],
  },
  {
    category: "traffic",
    label: "車のかげ",
    description: "車のかげから子どもが見えにくい",
    count: 1,
    confidence: 0.8,
    coverageRatio: 0.1,
    positions: [{ x: 0.35, y: 0.35, width: 0.15, height: 0.15 }],
  },
]

function marker(overrides: Partial<UserMarker>): UserMarker {
  return {
    id: "marker-1",
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.2,
    label: "hazard",
    category: "hazard",
    timestamp: 1,
    ...overrides,
  }
}

describe("safety-quest domain logic", () => {
  it("builds playable public challenges only from approved report photos without exposing coordinates", () => {
    const challenges = buildSafetyQuestChallengesFromReports([
      {
        id: "approved-report",
        title: "交差点",
        status: "approved",
        image_url: "https://example.com/original.jpg",
        processed_image_url: null,
        processed_image_urls: null,
        city: "福岡市",
        town: "中央区",
        prefecture: "福岡県",
        danger_type: "intersection",
        danger_level: 4,
      },
      {
        id: "pending-report",
        title: "未審査",
        status: "pending",
        image_url: "https://example.com/pending.jpg",
        processed_image_url: null,
        processed_image_urls: null,
        city: "福岡市",
        town: null,
        prefecture: "福岡県",
        danger_type: "road",
        danger_level: 2,
      },
      {
        id: "no-photo",
        title: "写真なし",
        status: "resolved",
        image_url: null,
        processed_image_url: null,
        processed_image_urls: null,
        city: "福岡市",
        town: null,
        prefecture: "福岡県",
        danger_type: "road",
        danger_level: 2,
      },
    ])

    expect(challenges).toHaveLength(1)
    expect(challenges[0]).toMatchObject({
      id: "report-approved-report",
      sourceType: "report",
      reportId: "approved-report",
      imageUrl: "https://example.com/original.jpg",
      areaLabel: "福岡市 中央区",
      difficulty: "hard",
    })
    expect(JSON.stringify(challenges[0])).not.toContain("latitude")
    expect(JSON.stringify(challenges[0])).not.toContain("longitude")
  })

  it("scores marker attempts by matching user boxes against AI detections", () => {
    const result = scoreSafetyQuestAttempt({
      challenge: {
        ...SAMPLE_SAFETY_QUEST_CHALLENGES[0],
        aiDetections: hazards,
      },
      mode: "hazard",
      userMarkers: [
        marker({ id: "m1", timestamp: 1 }),
        marker({ id: "m2", x: 0.55, y: 0.55, timestamp: 2 }),
      ],
      durationMs: 42_000,
    })

    expect(result.matches).toBe(2)
    expect(result.missed).toBe(1)
    expect(result.accuracy).toBe(67)
    expect(result.pointsAwarded).toBe(160)
    expect(result.rewardKeys).toContain("lookout-master")
  })

  it("caps private practice points so repeated uploads cannot farm full rewards", () => {
    expect(calculateSafetyQuestPoints({ rawPoints: 480, sourceType: "private" })).toBe(120)
    expect(calculateSafetyQuestPoints({ rawPoints: 480, sourceType: "report" })).toBe(480)
  })
})
