/**
 * Unit Tests: Report Status Presentation
 *
 * status(公開状態) × ai_moderation_status(AI一次審査)の組み合わせから
 * 投稿者向けの状態表示を導出するロジックの検証。
 *
 * 回帰防止: かつて approved 以外を一律「審査中」と表示していたため、
 * AI審査で rejected になった報告が投稿者には永遠に「審査中」に見えていた。
 *
 * Target: components/danger-report/detail/report-detail-utils.ts
 */

import { describe, it, expect } from "vitest"
import { getReportStatusPresentation } from "@/components/danger-report/detail/report-detail-utils"
import { PUBLIC_DANGER_REPORT_STATUSES } from "@/lib/danger-report-status"

function makeReport(overrides: {
  status: string
  ai_moderation_status?: string | null
  ai_moderation_reason?: string | null
}) {
  return {
    ai_moderation_status: null,
    ai_moderation_reason: null,
    ...overrides,
  }
}

describe("getReportStatusPresentation", () => {
  it("approved は 承認済み(緑) を返し理由は出さない", () => {
    const p = getReportStatusPresentation(makeReport({ status: "approved" }))
    expect(p.label).toBe("承認済み")
    expect(p.badgeClass).toContain("green")
    expect(p.moderationNote).toBeNull()
  })

  it("resolved は 解決済み を返す(審査中と誤表示しない)", () => {
    const p = getReportStatusPresentation(makeReport({ status: "resolved" }))
    expect(p.label).toBe("解決済み")
    expect(p.moderationNote).toBeNull()
  })

  it("published(標準投稿経路の公開状態)は 公開中(緑) — 審査中と誤表示しない", () => {
    const p = getReportStatusPresentation(makeReport({ status: "published" }))
    expect(p.label).toBe("公開中")
    expect(p.badgeClass).toContain("green")
    expect(p.moderationNote).toBeNull()
  })

  it("公開ステータス全種で moderationNote(AI審査理由)を絶対に出さない — 情報漏れ防止", () => {
    for (const status of PUBLIC_DANGER_REPORT_STATUSES) {
      const p = getReportStatusPresentation(
        makeReport({
          status,
          ai_moderation_status: "needs_review",
          ai_moderation_reason: "内部審査メモ(公開画面に出してはいけない)",
        }),
      )
      expect(p.moderationNote).toBeNull()
      expect(p.label).not.toContain("審査中")
    }
  })

  it("管理者による却下(status=rejected)は非公開表示。理由の記録がないため note は null", () => {
    const p = getReportStatusPresentation(makeReport({ status: "rejected" }))
    expect(p.label).toBe("非公開(承認されませんでした)")
    expect(p.badgeClass).toContain("red")
    expect(p.moderationNote).toBeNull()
  })

  it("AI審査 rejected は非公開である事実と理由を投稿者に伝える — 回帰防止の中核", () => {
    const p = getReportStatusPresentation(
      makeReport({
        status: "pending",
        ai_moderation_status: "rejected",
        ai_moderation_reason: "個人を特定できる情報が含まれています",
      }),
    )
    expect(p.label).toBe("非公開(承認されませんでした)")
    expect(p.badgeClass).toContain("red")
    expect(p.moderationNote).toBe("個人を特定できる情報が含まれています")
  })

  it("AI審査 needs_review は確認が必要である旨と理由を伝える", () => {
    const p = getReportStatusPresentation(
      makeReport({
        status: "pending",
        ai_moderation_status: "needs_review",
        ai_moderation_reason: "画像付きのため人手確認へ回しました",
      }),
    )
    expect(p.label).toBe("審査中(確認が必要です)")
    expect(p.badgeClass).toContain("yellow")
    expect(p.moderationNote).toBe("画像付きのため人手確認へ回しました")
  })

  it("AI審査結果がない pending は従来どおり 審査中", () => {
    const p = getReportStatusPresentation(makeReport({ status: "pending" }))
    expect(p.label).toBe("審査中")
    expect(p.moderationNote).toBeNull()
  })

  it("status が approved なら ai_moderation_status より公開状態を優先する", () => {
    // 人手で承認された後にAI記録が残っていても「承認済み」を出す
    const p = getReportStatusPresentation(
      makeReport({
        status: "approved",
        ai_moderation_status: "needs_review",
        ai_moderation_reason: "残留データ",
      }),
    )
    expect(p.label).toBe("承認済み")
    expect(p.moderationNote).toBeNull()
  })

  it("rejected でも理由が欠けていれば moderationNote は null", () => {
    const p = getReportStatusPresentation(
      makeReport({ status: "pending", ai_moderation_status: "rejected" }),
    )
    expect(p.label).toBe("非公開(承認されませんでした)")
    expect(p.moderationNote).toBeNull()
  })
})
