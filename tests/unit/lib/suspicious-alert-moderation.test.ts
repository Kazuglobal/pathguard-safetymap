import { describe, it, expect } from "vitest"
import {
  moderateSuspiciousAlert,
  buildModerationUpdate,
} from "@/lib/suspicious-alert-moderation"

describe("moderateSuspiciousAlert", () => {
  it("approves clean text-only alerts", () => {
    const verdict = moderateSuspiciousAlert({ text: "下校時間に声かけ事案がありました。", hasImage: false })
    expect(verdict.status).toBe("approved")
    expect(verdict.score).toBeLessThan(0.5)
  })

  it("flags alerts with an attached photo for review (cannot verify image content)", () => {
    const verdict = moderateSuspiciousAlert({ text: "声かけ事案", hasImage: true })
    expect(verdict.status).toBe("needs_review")
  })

  it("flags phone numbers / long digit sequences as personal info", () => {
    expect(moderateSuspiciousAlert({ text: "連絡先 090-1234-5678" }).status).toBe("needs_review")
    expect(moderateSuspiciousAlert({ text: "番号は12345678です" }).status).toBe("needs_review")
  })

  it("flags abusive / accusatory wording", () => {
    expect(moderateSuspiciousAlert({ text: "あいつが犯人だ、通報しろ" }).status).toBe("needs_review")
  })

  it("treats empty input conservatively as approved text-only", () => {
    // empty text, no image -> nothing to flag -> approved
    expect(moderateSuspiciousAlert({ text: "", hasImage: false }).status).toBe("approved")
  })
})

describe("buildModerationUpdate", () => {
  const iso = "2026-06-28T00:00:00.000Z"

  it("promotes status to approved for low-risk verdicts", () => {
    const verdict = moderateSuspiciousAlert({ text: "問題ない内容" })
    const update = buildModerationUpdate(verdict, iso)
    expect(update.status).toBe("approved")
    expect(update.ai_moderation_status).toBe("approved")
    expect(update.ai_moderation_checked_at).toBe(iso)
  })

  it("does NOT set status for needs_review verdicts (stays pending)", () => {
    const verdict = moderateSuspiciousAlert({ text: "090-1234-5678" })
    const update = buildModerationUpdate(verdict, iso)
    expect(update.status).toBeUndefined()
    expect(update.ai_moderation_status).toBe("needs_review")
  })
})
