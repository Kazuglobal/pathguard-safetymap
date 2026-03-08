import { expect, test, type Page, type Request } from '@playwright/test'
import { MapPageObject } from '../page-objects/map'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010'

function isHeatmapRpc(request: Request): boolean {
  return (
    request.method() === 'POST' &&
    request.url().includes('/rest/v1/rpc/get_accidents_in_bbox')
  )
}

function readRpcBody(request: Request): Record<string, unknown> | null {
  try {
    return request.postDataJSON() as Record<string, unknown>
  } catch {
    return null
  }
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.locator('input#email, input[type="email"]').fill(process.env.E2E_REGULAR_EMAIL ?? 'user@test.com')
  await page.locator('input#password, input[type="password"]').fill(process.env.E2E_REGULAR_PASSWORD ?? 'testpassword123')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/(map|dashboard|landing)/, { timeout: 20000 })
}

async function dismissWelcomeDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'PathGuardianへようこそ' })
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: 'チュートリアルをスキップ' }).click()
    await expect(dialog).toBeHidden({ timeout: 10000 })
  }
}

test.describe('Accident heatmap filters', () => {
  test.setTimeout(120000)

  test('shows separated child and young filters and sends both RPC params', async ({ page }) => {
    const mapPage = new MapPageObject(page)

    await login(page)
    await page.goto(`${BASE_URL}/map`)
    await mapPage.waitForMapLoad()
    await dismissWelcomeDialog(page)

    await expect(page.getByText('事故ヒートマップ')).toBeVisible()

    const visibilityToggle = page.getByRole('switch', { name: '事故ヒートマップ表示切替' })
    const initialRequest = page.waitForRequest((request) => {
      if (!isHeatmapRpc(request)) return false
      const body = readRpcBody(request)
      return body?.p_child_filter == null && body?.p_young_filter == null
    })

    await visibilityToggle.click()
    await initialRequest

    await expect(page.getByText('子ども関与（補充票確認分）のみ')).toBeVisible()
    await expect(page.getByText('若年者関与（24歳以下コード）のみ')).toBeVisible()
    await expect(page.getByText('※ 同時選択時は両方の条件に一致する事故のみ表示')).toBeVisible()

    const youngRequest = page.waitForRequest((request) => {
      if (!isHeatmapRpc(request)) return false
      const body = readRpcBody(request)
      return body?.p_child_filter == null && body?.p_young_filter === true
    })

    await page.locator('#young-filter').click()
    await youngRequest

    const combinedRequest = page.waitForRequest((request) => {
      if (!isHeatmapRpc(request)) return false
      const body = readRpcBody(request)
      return body?.p_child_filter === true && body?.p_young_filter === true
    })

    await page.locator('#child-filter').click()
    await combinedRequest
  })
})
