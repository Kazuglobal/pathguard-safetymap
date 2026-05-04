import { describe, expect, it } from "vitest"

import { buildRouteLearningSessionPayload } from "@/lib/route-learning-session-payload"
import { SessionPayloadSchema } from "@/lib/route-learning-session-schema"

describe("route-learning-session-schema", () => {
  it("v2学習セッションpayloadを検証できる", () => {
    const parsed = SessionPayloadSchema.parse({
      schemaVersion: 1,
      checklist: [{ id: "stop-position", label: "止まる場所を確認した", checked: true }],
      stopResults: [{ hazardId: "550e8400-e29b-41d4-a716-446655440000", status: "reviewed" }],
    })

    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.checklist).toHaveLength(1)
  })

  it("不正なschemaVersionと巨大payloadを拒否する", () => {
    expect(() =>
      SessionPayloadSchema.parse({
        schemaVersion: 2,
        checklist: [],
        stopResults: [],
      })
    ).toThrow()

    expect(() =>
      SessionPayloadSchema.parse({
        schemaVersion: 1,
        checklist: Array.from({ length: 21 }, (_, index) => ({
          id: `item-${index}`,
          label: "確認した",
          checked: false,
        })),
        stopResults: [],
      })
    ).toThrow()
  })

  it("DB保存payloadではUUIDでないhazardIdを除外する", () => {
    const payload = buildRouteLearningSessionPayload({
      checklist: [{ id: "stop-position", label: "止まる場所を確認した", checked: true }],
      progress: {
        "not-a-uuid": "reviewed",
        "550e8400-e29b-41d4-a716-446655440000": "saved",
      },
    })

    expect(payload.stopResults).toEqual([
      { hazardId: "550e8400-e29b-41d4-a716-446655440000", status: "saved" },
    ])
  })
})
