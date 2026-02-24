import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../utils/auth-helpers';
import { MapPageObject } from '../page-objects/map';
import { ResponsiveTestHelper, ViewportConfig } from '../utils/responsive-helpers';

const SNAPSHOT_PROJECT = 'Desktop - Chrome 1366x768';

const MAP_UI_VIEWPORTS: ViewportConfig[] = [
  { name: 'iPhone 12', width: 390, height: 844, isMobile: true },
  { name: 'Pixel 7', width: 412, height: 915, isMobile: true },
  { name: 'Desktop 1366', width: 1366, height: 768, isMobile: false },
];

async function stabilizeMapForSnapshot(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `
      .mapboxgl-canvas {
        opacity: 0 !important;
      }
      .mapboxgl-map {
        background: linear-gradient(135deg, #e7f0ff 0%, #f4f7ff 100%) !important;
      }
      .danger-marker,
      .pending-marker,
      .submitted-marker,
      .selection-marker,
      .mapboxgl-popup,
      .map-image-popup {
        display: none !important;
      }
    `,
  });
}

async function dismissMobileMapHint(page: import('@playwright/test').Page) {
  const hint = page.locator('text=ここが地図エリアです');
  if (await hint.isVisible().catch(() => false)) {
    const mapCanvas = page.locator('.mapboxgl-canvas');
    if (await mapCanvas.count()) {
      await mapCanvas.first().click({ position: { x: 20, y: 20 } });
    }
  }
}

test.describe('Map UI Layout Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.login(TEST_USERS.regular);
  });

  test('should match fullscreen map overlay layout', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== SNAPSHOT_PROJECT,
      `Snapshots are recorded only in ${SNAPSHOT_PROJECT}`,
    );

    const helper = new ResponsiveTestHelper(page);
    const mapPage = new MapPageObject(page);

    for (const viewport of MAP_UI_VIEWPORTS) {
      await helper.setViewport(viewport);
      await page.goto('/map');
      await helper.waitForPageLoad();
      await helper.hideLoadingElements();
      await helper.hideDevToolsOverlay();

      await mapPage.waitForMapLoad();
      if (viewport.isMobile) {
        await dismissMobileMapHint(page);
      }
      await stabilizeMapForSnapshot(page);

      await expect(page).toHaveScreenshot(
        `map-ui-layout-${viewport.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        {
          fullPage: true,
          animations: 'disabled',
        },
      );
    }
  });
});
