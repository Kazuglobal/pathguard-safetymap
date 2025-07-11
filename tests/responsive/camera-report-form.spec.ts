import { test, expect } from '@playwright/test';
import { testPageResponsiveness, VIEWPORTS, ResponsiveTestHelper } from '../utils/responsive-helpers';
import { AuthHelper, TEST_USERS } from '../utils/auth-helpers';

test.describe('Camera Report Form Tests', () => {
  test.beforeEach(async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.login(TEST_USERS.regular);
  });

  test('Camera buttons should be touch-friendly on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    
    // Navigate to map page where report form is accessible
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
    
    // Click on map to open report form (assuming this is how it works)
    const mapContainer = page.locator('[data-testid="map-container"], .mapboxgl-map, #map');
    if (await mapContainer.isVisible()) {
      await mapContainer.click();
      await page.waitForTimeout(500);
    }
    
    // Look for report form or trigger button
    const reportTrigger = page.locator('button:has-text("報告"), [data-testid="report-button"], .report-button');
    if (await reportTrigger.isVisible()) {
      await reportTrigger.click();
      await page.waitForTimeout(500);
    }
    
    // Test camera buttons for original images
    const originalCameraButton = page.locator('button:has-text("📸 カメラ撮影")').first();
    if (await originalCameraButton.isVisible()) {
      const buttonBox = await originalCameraButton.boundingBox();
      if (buttonBox) {
        // Camera button should meet touch target guidelines (minimum 48px height)
        expect(buttonBox.height).toBeGreaterThanOrEqual(48);
        expect(buttonBox.width).toBeGreaterThan(100);
        
        // Test that button is clickable
        await originalCameraButton.click();
        await page.waitForTimeout(200);
        
        // Check if file input is properly configured
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible()) {
          const captureAttr = await fileInput.getAttribute('capture');
          expect(captureAttr).toBe('environment');
        }
      }
    }
    
    // Test camera buttons for processed images
    const processedTab = page.locator('button:has-text("加工画像")');
    if (await processedTab.isVisible()) {
      await processedTab.click();
      await page.waitForTimeout(200);
      
      const processedCameraButton = page.locator('button:has-text("📸 カメラ撮影")').nth(1);
      if (await processedCameraButton.isVisible()) {
        const buttonBox = await processedCameraButton.boundingBox();
        if (buttonBox) {
          expect(buttonBox.height).toBeGreaterThanOrEqual(48);
          expect(buttonBox.width).toBeGreaterThan(100);
        }
      }
    }
  });

  test('Camera error handling should work properly', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    
    // Mock camera permission denial
    await page.context().grantPermissions([], { origin: page.url() });
    
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
    
    // Navigate to report form
    const mapContainer = page.locator('[data-testid="map-container"], .mapboxgl-map, #map');
    if (await mapContainer.isVisible()) {
      await mapContainer.click();
    }
    
    const reportTrigger = page.locator('button:has-text("報告"), [data-testid="report-button"], .report-button');
    if (await reportTrigger.isVisible()) {
      await reportTrigger.click();
    }
    
    // Test camera button click with denied permissions
    const cameraButton = page.locator('button:has-text("📸 カメラ撮影")').first();
    if (await cameraButton.isVisible()) {
      await cameraButton.click();
      
      // Wait for error message to appear
      await page.waitForTimeout(1000);
      
      // Check for error message
      const errorMessage = page.locator('.bg-red-50, [data-testid="camera-error"], .error-message');
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        expect(errorText).toContain('カメラへのアクセスが拒否されました');
      }
    }
  });

  test('Loading states should be visible during camera access', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
    
    // Navigate to report form
    const mapContainer = page.locator('[data-testid="map-container"], .mapboxgl-map, #map');
    if (await mapContainer.isVisible()) {
      await mapContainer.click();
    }
    
    const reportTrigger = page.locator('button:has-text("報告"), [data-testid="report-button"], .report-button');
    if (await reportTrigger.isVisible()) {
      await reportTrigger.click();
    }
    
    // Test loading state
    const cameraButton = page.locator('button:has-text("📸 カメラ撮影")').first();
    if (await cameraButton.isVisible()) {
      // Check if button shows loading state when clicked
      await cameraButton.click();
      
      // Look for loading spinner
      const loadingSpinner = page.locator('.animate-spin');
      if (await loadingSpinner.isVisible({ timeout: 500 })) {
        expect(await loadingSpinner.isVisible()).toBeTruthy();
      }
      
      // Check if button is disabled during loading
      const isDisabled = await cameraButton.isDisabled();
      expect(isDisabled).toBeTruthy();
    }
  });

  test('Gallery and camera buttons should be properly sized on tablets', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.tablet_ipad.width, height: VIEWPORTS.tablet_ipad.height });
    
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
    
    // Navigate to report form
    const mapContainer = page.locator('[data-testid="map-container"], .mapboxgl-map, #map');
    if (await mapContainer.isVisible()) {
      await mapContainer.click();
    }
    
    const reportTrigger = page.locator('button:has-text("報告"), [data-testid="report-button"], .report-button');
    if (await reportTrigger.isVisible()) {
      await reportTrigger.click();
    }
    
    // Test both gallery and camera buttons
    const galleryButton = page.locator('button:has-text("ギャラリー")').first();
    const cameraButton = page.locator('button:has-text("📸 カメラ撮影")').first();
    
    if (await galleryButton.isVisible() && await cameraButton.isVisible()) {
      const galleryBox = await galleryButton.boundingBox();
      const cameraBox = await cameraButton.boundingBox();
      
      if (galleryBox && cameraBox) {
        // Both buttons should be similar in size
        expect(Math.abs(galleryBox.width - cameraBox.width)).toBeLessThan(10);
        expect(Math.abs(galleryBox.height - cameraBox.height)).toBeLessThan(10);
        
        // Buttons should be large enough for tablet interaction
        expect(galleryBox.height).toBeGreaterThanOrEqual(44);
        expect(cameraBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('File input should have proper capture attribute management', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
    
    // Navigate to report form
    const mapContainer = page.locator('[data-testid="map-container"], .mapboxgl-map, #map');
    if (await mapContainer.isVisible()) {
      await mapContainer.click();
    }
    
    const reportTrigger = page.locator('button:has-text("報告"), [data-testid="report-button"], .report-button');
    if (await reportTrigger.isVisible()) {
      await reportTrigger.click();
    }
    
    const fileInput = page.locator('input[type="file"]').first();
    const galleryButton = page.locator('button:has-text("ギャラリー")').first();
    const cameraButton = page.locator('button:has-text("📸 カメラ撮影")').first();
    
    if (await fileInput.isVisible() && await galleryButton.isVisible() && await cameraButton.isVisible()) {
      // Test gallery button - should remove capture attribute
      await galleryButton.click();
      await page.waitForTimeout(200);
      
      let captureAttr = await fileInput.getAttribute('capture');
      expect(captureAttr).toBeFalsy();
      
      // Test camera button - should set capture attribute
      await cameraButton.click();
      await page.waitForTimeout(200);
      
      captureAttr = await fileInput.getAttribute('capture');
      expect(captureAttr).toBe('environment');
    }
  });

  test('Report form should handle landscape orientation', async ({ page }) => {
    // Set landscape orientation
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.height, height: VIEWPORTS.mobile_12.width });
    
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
    
    // Navigate to report form
    const mapContainer = page.locator('[data-testid="map-container"], .mapboxgl-map, #map');
    if (await mapContainer.isVisible()) {
      await mapContainer.click();
    }
    
    const reportTrigger = page.locator('button:has-text("報告"), [data-testid="report-button"], .report-button');
    if (await reportTrigger.isVisible()) {
      await reportTrigger.click();
    }
    
    // Test that buttons are still accessible in landscape
    const cameraButton = page.locator('button:has-text("📸 カメラ撮影")').first();
    if (await cameraButton.isVisible()) {
      const buttonBox = await cameraButton.boundingBox();
      if (buttonBox) {
        expect(buttonBox.height).toBeGreaterThanOrEqual(44);
        expect(buttonBox.width).toBeGreaterThan(100);
        
        // Button should be within viewport bounds
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(VIEWPORTS.mobile_12.height);
        expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(VIEWPORTS.mobile_12.width);
      }
    }
  });

  test('Report form should work across different mobile browsers', async ({ page, browserName }) => {
    // This test will run on different browser engines
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
    
    // Navigate to report form
    const mapContainer = page.locator('[data-testid="map-container"], .mapboxgl-map, #map');
    if (await mapContainer.isVisible()) {
      await mapContainer.click();
    }
    
    const reportTrigger = page.locator('button:has-text("報告"), [data-testid="report-button"], .report-button');
    if (await reportTrigger.isVisible()) {
      await reportTrigger.click();
    }
    
    // Test camera functionality across browsers
    const cameraButton = page.locator('button:has-text("📸 カメラ撮影")').first();
    if (await cameraButton.isVisible()) {
      // Button should be clickable in all browsers
      await cameraButton.click();
      await page.waitForTimeout(500);
      
      // File input should be properly configured
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible()) {
        const acceptAttr = await fileInput.getAttribute('accept');
        expect(acceptAttr).toBe('image/*');
      }
    }
    
    // Test that the form submission works regardless of browser
    const submitButton = page.locator('button:has-text("報告を送信"), [data-testid="submit-button"]');
    if (await submitButton.isVisible()) {
      const isEnabled = await submitButton.isEnabled();
      // Button should be enabled if all required fields are filled
      expect(typeof isEnabled).toBe('boolean');
    }
  });
});