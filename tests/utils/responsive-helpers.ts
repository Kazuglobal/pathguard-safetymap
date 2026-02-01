import { Page, expect } from '@playwright/test';

/**
 * Safely wait for network idle with a timeout fallback.
 * This prevents test failures when networkidle takes too long.
 */
export async function safeWaitForNetworkIdle(page: Page, timeout = 10000) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {
    // networkidle timeout is acceptable - proceed with tests
  });
}

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet?: boolean;
}

export const VIEWPORTS: Record<string, ViewportConfig> = {
  mobile_se: { name: 'iPhone SE', width: 375, height: 667, isMobile: true },
  mobile_12: { name: 'iPhone 12', width: 390, height: 844, isMobile: true },
  mobile_galaxy: { name: 'Galaxy S8', width: 360, height: 740, isMobile: true },
  tablet_ipad: { name: 'iPad', width: 768, height: 1024, isMobile: false, isTablet: true },
  tablet_landscape: { name: 'iPad Landscape', width: 1024, height: 768, isMobile: false, isTablet: true },
  desktop_hd: { name: 'Desktop HD', width: 1920, height: 1080, isMobile: false },
  desktop_standard: { name: 'Desktop Standard', width: 1366, height: 768, isMobile: false },
};

export class ResponsiveTestHelper {
  constructor(private page: Page) {}

  async setViewport(viewport: ViewportConfig) {
    await this.page.setViewportSize({ 
      width: viewport.width, 
      height: viewport.height 
    });
  }

  async takeFullPageScreenshot(name: string, viewport: ViewportConfig) {
    const fileName = `${name}-${viewport.name.toLowerCase().replace(/\s+/g, '-')}.png`;

    // Locate the Next.js Dev Tools button to mask it
    const devToolsButton = this.page.locator('button:has-text("Next.js"), button:has-text("Compiling")');
    const masks: import('@playwright/test').Locator[] = [];
    if (await devToolsButton.count() > 0) {
      masks.push(devToolsButton);
    }

    await expect(this.page).toHaveScreenshot(fileName, {
      fullPage: true,
      animations: 'disabled',
      mask: masks.length > 0 ? masks : undefined
    });
  }

  async waitForPageLoad() {
    // Use a fallback approach for networkidle which can timeout on slow connections
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // networkidle timeout is acceptable - proceed with tests
    });
  }

  async dismissCookieBanners() {
    // Common selectors for cookie banners
    const cookieSelectors = [
      '[data-testid="cookie-banner"]',
      '.cookie-banner',
      '#cookie-consent',
      '[aria-label*="cookie"]',
      'button:has-text("同意")', // Japanese "Agree"
      'button:has-text("承諾")', // Japanese "Accept"
      'button:has-text("OK")',
    ];

    for (const selector of cookieSelectors) {
      try {
        const element = this.page.locator(selector);
        if (await element.isVisible({ timeout: 1000 })) {
          await element.click();
          await this.page.waitForTimeout(500);
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
  }

  async scrollToElement(selector: string) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500); // Allow smooth scrolling
  }

  async testNavigationResponsiveness(viewport: ViewportConfig) {
    if (viewport.isMobile) {
      // Check if hamburger menu exists and works
      const hamburgerMenu = this.page.locator('[data-testid="mobile-menu-trigger"], .mobile-menu-trigger, button[aria-label*="menu"]');
      if (await hamburgerMenu.isVisible()) {
        await hamburgerMenu.click();
        await this.page.waitForTimeout(300);
        
        // Check if mobile menu is visible
        const mobileMenu = this.page.locator('[data-testid="mobile-menu"], .mobile-menu, nav[aria-label*="mobile"]');
        await expect(mobileMenu).toBeVisible();
        
        // Close menu for clean screenshot
        await hamburgerMenu.click();
        await this.page.waitForTimeout(300);
      }
    }
  }

  async testFormResponsiveness(formSelector: string = 'form') {
    const forms = this.page.locator(formSelector);
    const formCount = await forms.count();
    
    for (let i = 0; i < formCount; i++) {
      const form = forms.nth(i);
      if (await form.isVisible()) {
        // Check if form fields are properly sized
        const inputs = form.locator('input, textarea, select');
        const inputCount = await inputs.count();
        
        for (let j = 0; j < inputCount; j++) {
          const input = inputs.nth(j);
          if (await input.isVisible()) {
            const box = await input.boundingBox();
            if (box) {
              // Ensure inputs have reasonable minimum width on mobile
              expect(box.width).toBeGreaterThan(100);
            }
          }
        }
      }
    }
  }

  async checkOverflowingElements() {
    // Check for horizontal overflow that could break mobile layout
    const bodyWidth = await this.page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await this.page.evaluate(() => window.innerWidth);
    
    if (bodyWidth > viewportWidth + 10) { // 10px tolerance
      console.warn(`Horizontal overflow detected: body width ${bodyWidth}px > viewport width ${viewportWidth}px`);
    }
  }

  async hideLoadingElements() {
    // Hide common loading elements that might cause flaky screenshots
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading',
      '.skeleton',
      '.spinner',
      '[role="progressbar"]'
    ];

    for (const selector of loadingSelectors) {
      try {
        await this.page.locator(selector).waitFor({ state: 'hidden', timeout: 5000 });
      } catch (error) {
        // Element might not exist or already hidden
      }
    }
  }

  async hideDevToolsOverlay() {
    // Hide Next.js Dev Tools indicator using CSS injection
    await this.page.addStyleTag({
      content: `
        /* Hide Next.js Dev Tools button (appears in development mode) */
        button[aria-label*="Next.js"],
        [data-nextjs-dialog-overlay],
        [data-nextjs-toast],
        nextjs-portal,
        /* Fixed position bottom button (Next.js Dev Tools) */
        body > div:last-of-type > button {
          display: none !important;
          visibility: hidden !important;
        }
      `
    });
  }

  async testInteractiveElements(viewport: ViewportConfig) {
    if (viewport.isMobile) {
      // Check that buttons and links have adequate touch targets (44x44px minimum)
      const interactiveElements = this.page.locator('button, a, [role="button"], [tabindex="0"]');
      const count = await interactiveElements.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) { // Test first 10 elements
        const element = interactiveElements.nth(i);
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          if (box) {
            const minSize = 44; // iOS/Android guideline
            if (box.width < minSize || box.height < minSize) {
              console.warn(`Touch target too small: ${box.width}x${box.height}px at element ${i}`);
            }
          }
        }
      }
    }
  }
}

export async function testPageResponsiveness(
  page: Page, 
  url: string, 
  pageName: string, 
  options: {
    viewports?: ViewportConfig[];
    skipAuth?: boolean;
    customChecks?: (helper: ResponsiveTestHelper, viewport: ViewportConfig) => Promise<void>;
  } = {}
) {
  const helper = new ResponsiveTestHelper(page);
  const viewports = options.viewports || Object.values(VIEWPORTS);

  for (const viewport of viewports) {
    await helper.setViewport(viewport);
    await page.goto(url);
    await helper.waitForPageLoad();
    await helper.dismissCookieBanners();
    await helper.hideLoadingElements();
    await helper.hideDevToolsOverlay();

    if (options.customChecks) {
      await options.customChecks(helper, viewport);
    }
    
    await helper.testNavigationResponsiveness(viewport);
    await helper.checkOverflowingElements();
    await helper.testInteractiveElements(viewport);
    
    await helper.takeFullPageScreenshot(pageName, viewport);
  }
}