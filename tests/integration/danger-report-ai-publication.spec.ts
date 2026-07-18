import { expect, test } from "@playwright/test"

const reportId = "ai-publication-e2e"
const reportTitle = "AI承認遷移テスト専用の交差点"

const report = {
  id: reportId,
  user_id: "user-e2e",
  title: reportTitle,
  description: "見通しが悪く、横断時に注意が必要です。",
  latitude: 35.6895,
  longitude: 139.6917,
  danger_type: "traffic",
  danger_level: 3,
  status: "pending",
  ai_moderation_status: "pending",
  image_url: null,
  processed_image_url: null,
  processed_image_urls: [],
  prefecture: null,
  prefecture_code: null,
  city: null,
  municipality_code: null,
  town: null,
  postal_code: null,
  created_at: "2026-07-18T00:00:00.000Z",
  updated_at: "2026-07-18T00:00:00.000Z",
}

test.describe("danger report AI publication", () => {
  test("keeps pending private and shows it after mocked AI approval", async ({
    page,
  }) => {
    let approved = false

    await page.route("**/rest/v1/danger_reports*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          approved ? [{ ...report, status: "approved", ai_moderation_status: "approved" }] : [],
        ),
      })
    })
    await page.route("**/api/danger-report/moderate", async (route) => {
      approved = true
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "live",
          verdict: {
            status: "approved",
            reason: "公開を妨げる内容は検出されませんでした。",
            score: 0.95,
            aiExecuted: true,
          },
          report: {
            ...report,
            status: "approved",
            ai_moderation_status: "approved",
          },
        }),
      })
    })
    await page.route("**/auth/v1/user*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      })
    })

    await page.goto("/landing")
    await expect(page.getByText(reportTitle)).toHaveCount(0)

    const response = await page.evaluate(async (id) => {
      const result = await fetch("/api/danger-report/moderate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId: id }),
      })
      return { ok: result.ok, body: await result.json() }
    }, reportId)
    expect(response.ok).toBe(true)
    expect(response.body.report.status).toBe("approved")

    await page.reload()
    await expect(page.getByText(reportTitle)).toBeVisible({
      timeout: 15_000,
    })
  })
})
