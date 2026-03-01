import { expect, test } from "@playwright/test"

const mockReportId = "report-playwright-1"
const mockReportTitle = "交差点の危険"

const mockDangerReport = {
  id: mockReportId,
  user_id: "user-playwright",
  title: mockReportTitle,
  description: "見通しが悪く、車の飛び出しがある",
  latitude: 35.6895,
  longitude: 139.6917,
  danger_type: "traffic",
  danger_level: 3,
  status: "approved",
  image_url: null,
  processed_image_url: null,
  processed_image_urls: [],
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
  created_at: "2026-02-01T00:00:00.000Z",
  updated_at: "2026-02-01T00:00:00.000Z",
}

test.describe("Landing HiyariHat card to detail modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/rest/v1/danger_reports*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDangerReport]),
      })
    })

    await page.route("**/rest/v1/report_comments*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        })
        return
      }

      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      })
    })

    await page.route("**/auth/v1/user*", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      })
    })
  })

  test("card click opens detail modal with comment section", async ({ page }) => {
    await page.goto("/")

    const card = page.locator("article[role='button']").first()
    await expect(card).toBeVisible()

    await card.click()

    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.locator("[data-testid='comment-section']")).toBeVisible()
    await expect(page.locator("[data-testid='comment-section']")).toHaveAttribute(
      "data-report-id",
      mockReportId,
    )
  })

  test("pressing Enter on reaction button does not open modal", async ({ page }) => {
    await page.goto("/")

    const card = page.locator("article[role='button']").first()
    await expect(card).toBeVisible()

    const helpfulButton = card.getByRole("button", { name: "参考になった" })
    await helpfulButton.focus()
    await page.keyboard.press("Enter")

    await expect(page.getByRole("dialog")).toHaveCount(0)
  })
})
