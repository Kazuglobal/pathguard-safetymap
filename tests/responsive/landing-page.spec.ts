import { test, expect } from '@playwright/test';
import { testPageResponsiveness, VIEWPORTS, ResponsiveTestHelper } from '../utils/responsive-helpers';
import { NavigationPageObject } from '../page-objects/navigation';

test.describe('Landing Page Responsive Tests', () => {
  test('should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/landing', 'landing-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        const navigation = new NavigationPageObject(page);
        
        // Test hero section responsiveness
        const heroSection = page.locator('[data-testid="hero-section"], .hero, section:first-child');
        if (await heroSection.isVisible()) {
          await expect(heroSection).toBeVisible();
          
          if (viewport.isMobile) {
            // Check that hero content stacks vertically on mobile
            const heroTitle = page.locator('h1, [data-testid="hero-title"]');
            const heroImage = page.locator('[data-testid="hero-image"], .hero-image, img');
            
            if (await heroTitle.isVisible() && await heroImage.isVisible()) {
              const titleBox = await heroTitle.boundingBox();
              const imageBox = await heroImage.boundingBox();
              
              if (titleBox && imageBox) {
                // On mobile, title should be above image (smaller Y coordinate)
                expect(titleBox.y).toBeLessThan(imageBox.y);
              }
            }
          }
        }

        // Test call-to-action buttons
        const ctaButtons = page.locator('button:has-text("始める"), button:has-text("開始"), button:has-text("Start"), a:has-text("始める")');
        const ctaCount = await ctaButtons.count();
        
        for (let i = 0; i < ctaCount; i++) {
          const button = ctaButtons.nth(i);
          if (await button.isVisible()) {
            const box = await button.boundingBox();
            if (box && viewport.isMobile) {
              // Ensure touch targets are large enough on mobile
              expect(box.height).toBeGreaterThanOrEqual(44);
              expect(box.width).toBeGreaterThanOrEqual(44);
            }
          }
        }

        // Test feature cards/sections
        const featureCards = page.locator('[data-testid="feature-card"], .feature-card, .feature');
        const cardCount = await featureCards.count();
        
        if (cardCount > 0) {
          if (viewport.isMobile) {
            // On mobile, feature cards should stack vertically
            for (let i = 0; i < Math.min(cardCount, 3); i++) {
              const card = featureCards.nth(i);
              if (await card.isVisible()) {
                const box = await card.boundingBox();
                if (box) {
                  // Card should take most of the screen width on mobile
                  const screenWidth = viewport.width;
                  expect(box.width).toBeGreaterThan(screenWidth * 0.8);
                }
              }
            }
          } else {
            // On desktop, check if cards are arranged horizontally
            let previousCardX = 0;
            for (let i = 0; i < Math.min(cardCount, 3); i++) {
              const card = featureCards.nth(i);
              if (await card.isVisible()) {
                const box = await card.boundingBox();
                if (box && i > 0) {
                  // Each card should be to the right of the previous one
                  expect(box.x).toBeGreaterThan(previousCardX);
                  previousCardX = box.x;
                }
              }
            }
          }
        }

        // Test navigation on mobile
        if (viewport.isMobile) {
          await navigation.openMobileMenu();
          await page.waitForTimeout(300);
          await navigation.closeMobileMenu();
        }

        // Check for horizontal scroll (should not exist)
        await helper.checkOverflowingElements();
      }
    });
  });

  test('should handle different viewport transitions smoothly', async ({ page }) => {
    await page.goto('/landing');
    const helper = new ResponsiveTestHelper(page);
    await helper.hideDevToolsOverlay();

    // Start with desktop
    await helper.setViewport(VIEWPORTS.desktop_hd);
    await helper.waitForPageLoad();
    
    // Take screenshot at desktop
    await helper.takeFullPageScreenshot('landing-desktop-to-mobile', VIEWPORTS.desktop_hd);
    
    // Transition to tablet
    await helper.setViewport(VIEWPORTS.tablet_ipad);
    await page.waitForTimeout(1000); // Allow layout to settle
    await helper.takeFullPageScreenshot('landing-desktop-to-mobile', VIEWPORTS.tablet_ipad);
    
    // Transition to mobile
    await helper.setViewport(VIEWPORTS.mobile_12);
    await page.waitForTimeout(1000); // Allow layout to settle
    await helper.takeFullPageScreenshot('landing-desktop-to-mobile', VIEWPORTS.mobile_12);
  });

  test('should display Japanese text correctly across viewports', async ({ page }) => {
    await page.goto('/landing');
    
    // Test Japanese text rendering and wrapping
    const textElements = page.locator('h1, h2, h3, p, span');
    const textCount = await textElements.count();
    
    for (const viewport of [VIEWPORTS.mobile_se, VIEWPORTS.tablet_ipad, VIEWPORTS.desktop_hd]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Check for text overflow
      for (let i = 0; i < Math.min(textCount, 10); i++) {
        const element = textElements.nth(i);
        if (await element.isVisible()) {
          const text = await element.textContent();
          if (text && text.trim().length > 0) {
            // Check if element has proper text wrapping
            const box = await element.boundingBox();
            if (box) {
              expect(box.width).toBeLessThanOrEqual(viewport.width);
            }
          }
        }
      }
    }
  });

  test('should load and display images responsively', async ({ page }) => {
    await page.goto('/landing');
    
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (const viewport of Object.values(VIEWPORTS)) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);
      
      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i);
        if (await image.isVisible()) {
          // Check if image is loaded
          const naturalWidth = await image.evaluate((img: HTMLImageElement) => img.naturalWidth);
          expect(naturalWidth).toBeGreaterThan(0);
          
          // Check if image fits within viewport
          const box = await image.boundingBox();
          if (box) {
            expect(box.width).toBeLessThanOrEqual(viewport.width);
            expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
          }
        }
      }
    }
  });
});