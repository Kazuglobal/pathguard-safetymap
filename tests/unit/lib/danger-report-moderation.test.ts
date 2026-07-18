import { describe, expect, it } from "vitest"

import {
  buildDangerModerationUpdate,
  moderateDangerReport,
  stricterStatus,
  type DangerModerationInput,
  type DangerModerationVerdict,
} from "@/lib/danger-report-moderation"

function validInput(
  overrides: Partial<DangerModerationInput> = {},
): DangerModerationInput {
  return {
    title: "見通しの悪い交差点",
    description: "塀で左右が見えにくく、車との接触が心配です。",
    dangerType: "traffic",
    dangerLevel: 3,
    latitude: 35.6812,
    longitude: 139.7671,
    geocodeConfidence: 0.9,
    prefecture: "東京都",
    city: "千代田区",
    hasImage: false,
    recentReportsByUserLastHour: 0,
    nearbyDuplicateCount: 0,
    userRejectedCountLast30d: 0,
    ...overrides,
  }
}

describe("moderateDangerReport", () => {
  it("H1: sends coordinates outside Japan's bounding box to review", () => {
    expect(
      moderateDangerReport(validInput({ latitude: 35.6762, longitude: 120 })).status,
    ).toBe("needs_review")
  })

  it("H1 boundary: accepts finite coordinates on the Japan bounding box edge", () => {
    expect(
      moderateDangerReport(validInput({ latitude: 20, longitude: 122 })).status,
    ).toBe("approved")
    expect(
      moderateDangerReport(validInput({ latitude: 46, longitude: 154 })).status,
    ).toBe("approved")
  })

  it("H2: flags geocode confidence below 0.3 but accepts the boundary", () => {
    expect(
      moderateDangerReport(validInput({ geocodeConfidence: 0.299 })).status,
    ).toBe("needs_review")
    expect(
      moderateDangerReport(validInput({ geocodeConfidence: 0.3 })).status,
    ).toBe("approved")
  })

  it("H3: never auto-approves an image attachment", () => {
    expect(moderateDangerReport(validInput({ hasImage: true })).status).toBe(
      "needs_review",
    )
  })

  it("H4: flags phone numbers and seven or more consecutive digits", () => {
    expect(
      moderateDangerReport(validInput({ description: "連絡先は090-1234-5678です" }))
        .status,
    ).toBe("needs_review")
    expect(
      moderateDangerReport(validInput({ description: "車両番号1234567を見た" }))
        .status,
    ).toBe("needs_review")
  })

  it("H5: flags accusatory and abusive wording in title or description", () => {
    expect(
      moderateDangerReport(validInput({ title: "あいつが犯人だ" })).status,
    ).toBe("needs_review")
    expect(
      moderateDangerReport(validInput({ description: "バカは消えろ" })).status,
    ).toBe("needs_review")
  })

  it("H6: flags two URLs or ten repeated characters but not a single URL", () => {
    expect(
      moderateDangerReport(
        validInput({
          description: "詳細 https://one.example と https://two.example",
        }),
      ).status,
    ).toBe("needs_review")
    expect(
      moderateDangerReport(validInput({ description: "危険！！！！！！！！！！" }))
        .status,
    ).toBe("needs_review")
    expect(
      moderateDangerReport(
        validInput({ description: "参考 https://one.example の情報です" }),
      ).status,
    ).toBe("approved")
  })

  it("H7: flags the fifth report in one hour", () => {
    expect(
      moderateDangerReport(validInput({ recentReportsByUserLastHour: 4 })).status,
    ).toBe("approved")
    expect(
      moderateDangerReport(validInput({ recentReportsByUserLastHour: 5 })).status,
    ).toBe("needs_review")
  })

  it("H8: flags one or more nearby duplicates", () => {
    expect(
      moderateDangerReport(validInput({ nearbyDuplicateCount: 1 })).status,
    ).toBe("needs_review")
  })

  it("H9: flags users with three rejections in the last 30 days", () => {
    expect(
      moderateDangerReport(validInput({ userRejectedCountLast30d: 2 })).status,
    ).toBe("approved")
    expect(
      moderateDangerReport(validInput({ userRejectedCountLast30d: 3 })).status,
    ).toBe("needs_review")
  })

  it("H10: approves clean text-only reports", () => {
    const verdict = moderateDangerReport(validInput())

    expect(verdict).toMatchObject({
      status: "approved",
      aiExecuted: false,
    })
    expect(verdict.score).toBeLessThan(0.5)
  })

  it("evaluates rules in order and preserves the first matching reason", () => {
    const verdict = moderateDangerReport(
      validInput({
        longitude: 120,
        hasImage: true,
        recentReportsByUserLastHour: 10,
      }),
    )

    expect(verdict.reason).toContain("日本国内")
  })
})

describe("stricterStatus", () => {
  it("returns the stricter status and never relaxes a heuristic decision", () => {
    expect(stricterStatus("approved", "needs_review")).toBe("needs_review")
    expect(stricterStatus("escalated", "approved")).toBe("escalated")
    expect(stricterStatus("needs_review", "escalated")).toBe("escalated")
  })
})

describe("buildDangerModerationUpdate", () => {
  const checkedAt = "2026-07-18T00:00:00.000Z"

  function verdict(
    overrides: Partial<DangerModerationVerdict>,
  ): DangerModerationVerdict {
    return {
      status: "approved",
      reason: "公開可能と判定しました。",
      score: 0.1,
      aiExecuted: true,
      ...overrides,
    }
  }

  it("promotes only a successful AI-approved verdict", () => {
    const update = buildDangerModerationUpdate(verdict({}), checkedAt)

    expect(update.status).toBe("approved")
    expect(update.ai_moderation_status).toBe("approved")
    expect(update.ai_moderation_checked_at).toBe(checkedAt)
  })

  it("does not promote an approved heuristic fallback when AI did not execute", () => {
    const update = buildDangerModerationUpdate(
      verdict({ aiExecuted: false }),
      checkedAt,
    )

    expect(update.status).toBeUndefined()
  })

  it.each(["needs_review", "escalated"] as const)(
    "keeps the report pending for %s",
    (status) => {
      const update = buildDangerModerationUpdate(verdict({ status }), checkedAt)

      expect(update.status).toBeUndefined()
      expect(update.ai_moderation_status).toBe(status)
      expect(Object.values(update)).not.toContain("rejected")
    },
  )
})
