// PathGuardian UI audit — captures mobile screenshots of every main screen.
// Usage: node ui-audit.mjs <outDir> [baseUrl]
import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const outDir = process.argv[2] || 'audit-out'
const baseUrl = process.argv[3] || 'http://localhost:3000'
mkdirSync(outDir, { recursive: true })

const iPhone = devices['iPhone 12']

async function main() {
  const browser = await chromium.launch({
    headless: process.env.HEADED ? false : true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  })
  const ctx = await browser.newContext({
    ...iPhone,
    locale: 'ja-JP',
    geolocation: { latitude: 39.6505, longitude: 141.1475 },
    permissions: ['geolocation'],
  })
  const page = await ctx.newPage()
  const shot = async (name, opts = {}) => {
    await page.screenshot({ path: join(outDir, `${name}.png`), ...opts })
    console.log('shot:', name)
  }

  // --- login ---
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await shot('00-login')
  try {
    await page.fill('input[type="email"]', 'demo@example.com')
    await page.fill('input[type="password"]', 'demopassword')
    await page.click('button[type="submit"]')
    await page.waitForURL(/landing|map|\/$/, { timeout: 20000 })
    console.log('login ok ->', page.url())
  } catch (e) {
    console.log('login failed or already logged in:', e.message)
  }

  // --- landing ---
  await page.goto(`${baseUrl}/landing`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await shot('01-landing-top')
  await page.evaluate(() => window.scrollBy(0, 800))
  await page.waitForTimeout(800)
  await shot('01-landing-mid')

  // --- map (first visit: tutorial may appear) ---
  await page.goto(`${baseUrl}/map`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000) // mapbox load
  await shot('02-map-initial')

  // onboarding (絵本) if any — page through it capturing each slide
  const onboarding = page.locator('[data-testid="app-onboarding"]')
  if (await onboarding.count()) {
    await shot('03-onboarding-1')
    for (let i = 2; i <= 4; i++) {
      const next = page.locator('[data-testid="onboarding-next"]')
      if (!(await next.count())) break
      await next.click()
      await page.waitForTimeout(700)
      await shot(`03-onboarding-${i}`)
    }
    // 最終ページのCTAは /map へ遷移する
    const cta = page.locator('[data-testid="onboarding-next"]')
    if (await cta.count()) {
      await cta.click()
      await page.waitForTimeout(4000)
    }
  }
  await shot('04-map-clean')

  // --- mobile report flow: おしらせ → tap map → wizard 3 steps ---
  const dockReport = page.locator('[data-testid="mobile-report-button"]')
  if (await dockReport.count()) {
    await dockReport.click()
    await page.waitForTimeout(1200)
    await shot('05m-select-location')
    const vpm = iPhone.viewport
    await page.mouse.click(vpm.width / 2, vpm.height / 2 - 80)
    await page.waitForTimeout(1500)
    await shot('06m-location-picked')
    const confirmBtn = page.locator('[data-testid="confirm-location-button"]')
    if (await confirmBtn.count()) {
      await confirmBtn.click()
      await page.waitForTimeout(1500)
      await shot('07m-wizard-step1')
      const next1 = page.locator('[data-testid="wizard-next"]')
      if (await next1.count()) {
        await next1.click()
        await page.waitForTimeout(800)
        await shot('08m-wizard-step2')
        await next1.click()
        await page.waitForTimeout(800)
        await shot('09m-wizard-step3')
      }
      // とじる
      const closeBtn = page.getByRole('button', { name: /とじる/ }).first()
      if (await closeBtn.count()) {
        await closeBtn.click()
        await page.waitForTimeout(800)
      }
    }
  } else {
    console.log('mobile report dock button not found')
  }

  // --- report flow: 危険を報告 ---
  const reportBtn = page.getByRole('button', { name: /危険箇所を報告する|危険を報告|おしらせ/ }).first()
  if (await reportBtn.count()) {
    await reportBtn.click()
    await page.waitForTimeout(1200)
    await shot('05-report-select-location')
    // tap map center
    const vp = iPhone.viewport
    await page.mouse.click(vp.width / 2, vp.height / 2 - 60)
    await page.waitForTimeout(1500)
    await shot('06-report-location-picked')
    const goBtn = page.getByRole('button', { name: /この地点で報告する/ }).first()
    if (await goBtn.count()) {
      await goBtn.click()
      await page.waitForTimeout(2000)
      await shot('07-report-form-top')
      await page.evaluate(() => {
        const el = document.querySelector('.mobile-fullscreen-form .overflow-y-auto')
        if (el) el.scrollBy(0, 700)
      })
      await page.waitForTimeout(500)
      await shot('08-report-form-mid')
      await page.evaluate(() => {
        const el = document.querySelector('.mobile-fullscreen-form .overflow-y-auto')
        if (el) el.scrollBy(0, 700)
      })
      await page.waitForTimeout(500)
      await shot('09-report-form-bottom')
      // close
      const close = page.getByRole('button', { name: /閉じる/ }).first()
      if (await close.count()) await close.click()
      await page.waitForTimeout(600)
    }
  } else {
    console.log('report button not found')
  }

  // --- other tabs ---
  for (const [name, path] of [
    ['10-routes', '/routes'],
    ['11-mypage', '/mypage'],
    ['12-report-list', '/report'],
    ['13-hunter', '/safety-quest/hunter'],
  ]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4000)
    await shot(name)
  }

  await browser.close()
  console.log('done ->', outDir)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
