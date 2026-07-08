/**
 * Unit Tests: Moderation Result Push Payload
 *
 * 不審者情報のAI審査結果を投稿者へ知らせる通知ペイロード。
 * ロック画面に出るため審査理由(個人情報等)を本文に含めないことが要件。
 *
 * Target: lib/notifications/builders.ts (buildModerationResultPushPayload)
 */

import { describe, it, expect } from "vitest"
import { buildModerationResultPushPayload } from "@/lib/notifications/builders"

describe("buildModerationResultPushPayload", () => {
  it("approved は公開されたことを伝える", () => {
    const p = buildModerationResultPushPayload({
      reportId: "r-1",
      verdictStatus: "approved",
    })
    expect(p.title).toContain("公開されました")
    expect(p.tag).toBe("moderation-result-r-1")
    expect(p.data.url).toBe("/map?reportId=r-1")
    expect(p.data.type).toBe("danger_reports")
  })

  it("rejected は非公開の事実のみ伝え、詳細はアプリへ誘導する", () => {
    const p = buildModerationResultPushPayload({
      reportId: "r-2",
      verdictStatus: "rejected",
    })
    expect(p.title).toContain("公開されませんでした")
    expect(p.body).toContain("報告詳細で確認")
  })

  it("needs_review は確認中であることを伝える", () => {
    const p = buildModerationResultPushPayload({
      reportId: "r-3",
      verdictStatus: "needs_review",
    })
    expect(p.title).toContain("確認しています")
  })

  it("どの結果でも本文に審査理由の具体語(個人情報・中傷等)を含めない", () => {
    for (const verdictStatus of ["approved", "needs_review", "rejected"] as const) {
      const p = buildModerationResultPushPayload({ reportId: "r-4", verdictStatus })
      expect(`${p.title}${p.body}`).not.toMatch(/個人情報|中傷|リスクスコア/)
    }
  })
})
