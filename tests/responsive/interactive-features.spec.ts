import { test, expect } from '@playwright/test';
import { testPageResponsiveness, VIEWPORTS, ResponsiveTestHelper } from '../utils/responsive-helpers';
import { AuthHelper, TEST_USERS } from '../utils/auth-helpers';

test.describe('Interactive Features Responsive Tests', () => {
  test.beforeEach(async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.login(TEST_USERS.regular);
  });

  test('Hazard Game page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/hazard-game', 'hazard-game-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        // Test image upload area
        const uploadArea = page.locator('[data-testid="image-upload"], .image-upload, .upload-area');
        if (await uploadArea.isVisible()) {
          const uploadBox = await uploadArea.boundingBox();
          if (uploadBox) {
            if (viewport.isMobile) {
              // Upload area should be large enough for touch on mobile
              expect(uploadBox.width).toBeGreaterThan(viewport.width * 0.8);
              expect(uploadBox.height).toBeGreaterThan(150);
            } else {
              expect(uploadBox.width).toBeGreaterThan(300);
              expect(uploadBox.height).toBeGreaterThan(200);
            }
          }
        }

        // Test upload button
        const uploadButton = page.locator('button:has-text("アップロード"), button:has-text("Upload"), input[type="file"] + button');
        if (await uploadButton.isVisible()) {
          const buttonBox = await uploadButton.boundingBox();
          if (buttonBox && viewport.isMobile) {
            expect(buttonBox.height).toBeGreaterThanOrEqual(44);
            expect(buttonBox.width).toBeGreaterThan(120);
          }
        }

        // Test game instructions/rules
        const instructions = page.locator('[data-testid="instructions"], .instructions, .rules');
        if (await instructions.isVisible()) {
          const instructionsBox = await instructions.boundingBox();
          if (instructionsBox) {
            expect(instructionsBox.width).toBeLessThanOrEqual(viewport.width);
            if (viewport.isMobile) {
              // Instructions should be readable on mobile
              expect(instructionsBox.width).toBeGreaterThan(viewport.width * 0.9);
            }
          }
        }

        // Test analysis results display
        const analysisResults = page.locator('[data-testid="analysis-results"], .analysis-results, .results');
        if (await analysisResults.isVisible()) {
          const resultsBox = await analysisResults.boundingBox();
          if (resultsBox) {
            expect(resultsBox.width).toBeLessThanOrEqual(viewport.width);
            if (viewport.isMobile) {
              expect(resultsBox.width).toBeGreaterThan(viewport.width * 0.85);
            }
          }
        }

        // Test score display
        const scoreDisplay = page.locator('[data-testid="score"], .score, .points');
        if (await scoreDisplay.isVisible()) {
          const scoreBox = await scoreDisplay.boundingBox();
          if (scoreBox) {
            // Score should be visible and readable
            expect(scoreBox.width).toBeGreaterThan(50);
            expect(scoreBox.height).toBeGreaterThan(20);
          }
        }

        // Test game controls
        const gameControls = page.locator('[data-testid="game-controls"], .game-controls, .controls');
        if (await gameControls.isVisible()) {
          const controlsBox = await gameControls.boundingBox();
          if (controlsBox && viewport.isMobile) {
            // Controls should be easily accessible on mobile
            expect(controlsBox.width).toBeGreaterThan(viewport.width * 0.7);
          }
        }
      }
    });
  });

  test('Route Quiz page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/route-quiz', 'route-quiz-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        // Test quiz question display
        const questionArea = page.locator('[data-testid="quiz-question"], .quiz-question, .question');
        if (await questionArea.isVisible()) {
          const questionBox = await questionArea.boundingBox();
          if (questionBox) {
            expect(questionBox.width).toBeLessThanOrEqual(viewport.width);
            if (viewport.isMobile) {
              expect(questionBox.width).toBeGreaterThan(viewport.width * 0.85);
            }
          }
        }

        // Test answer options
        const answerOptions = page.locator('[data-testid="answer-option"], .answer-option, .option, input[type="radio"] + label');
        const optionCount = await answerOptions.count();
        
        for (let i = 0; i < optionCount; i++) {
          const option = answerOptions.nth(i);
          if (await option.isVisible()) {
            const optionBox = await option.boundingBox();
            if (optionBox) {
              if (viewport.isMobile) {
                // Answer options should be touch-friendly on mobile
                expect(optionBox.height).toBeGreaterThanOrEqual(44);
                expect(optionBox.width).toBeGreaterThan(viewport.width * 0.7);
              }
            }
          }
        }

        // Test quiz navigation buttons
        const navButtons = page.locator('button:has-text("次"), button:has-text("前"), button:has-text("Next"), button:has-text("Previous")');
        const navButtonCount = await navButtons.count();
        
        for (let i = 0; i < navButtonCount; i++) {
          const button = navButtons.nth(i);
          if (await button.isVisible()) {
            const buttonBox = await button.boundingBox();
            if (buttonBox && viewport.isMobile) {
              expect(buttonBox.height).toBeGreaterThanOrEqual(44);
              expect(buttonBox.width).toBeGreaterThan(80);
            }
          }
        }

        // Test progress indicator
        const progressIndicator = page.locator('[data-testid="quiz-progress"], .quiz-progress, .progress');
        if (await progressIndicator.isVisible()) {
          const progressBox = await progressIndicator.boundingBox();
          if (progressBox) {
            expect(progressBox.width).toBeLessThanOrEqual(viewport.width);
            if (viewport.isMobile) {
              expect(progressBox.width).toBeGreaterThan(viewport.width * 0.8);
            }
          }
        }

        // Test quiz timer if present
        const timer = page.locator('[data-testid="timer"], .timer, .countdown');
        if (await timer.isVisible()) {
          const timerBox = await timer.boundingBox();
          if (timerBox) {
            // Timer should be visible but not take too much space
            expect(timerBox.width).toBeLessThan(viewport.width * 0.3);
            expect(timerBox.height).toBeLessThan(80);
          }
        }

        // Test map integration if present in quiz
        const quizMap = page.locator('[data-testid="quiz-map"], .quiz-map, .map');
        if (await quizMap.isVisible()) {
          const mapBox = await quizMap.boundingBox();
          if (mapBox) {
            expect(mapBox.width).toBeLessThanOrEqual(viewport.width);
            if (viewport.isMobile) {
              // Map should be usable on mobile
              expect(mapBox.height).toBeGreaterThan(200);
              expect(mapBox.width).toBeGreaterThan(viewport.width * 0.8);
            }
          }
        }
      }
    });
  });

  test('Hazard Game image upload functionality on mobile', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    await page.goto('/hazard-game');
    
    // Test file input accessibility on mobile
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // File input should be accessible
      const inputBox = await fileInput.boundingBox();
      if (inputBox) {
        expect(inputBox.height).toBeGreaterThanOrEqual(44);
      }
    }

    // Test drag and drop area
    const dropArea = page.locator('[data-testid="drop-area"], .drop-area, .dropzone');
    if (await dropArea.isVisible()) {
      const dropBox = await dropArea.boundingBox();
      if (dropBox) {
        expect(dropBox.width).toBeGreaterThan(VIEWPORTS.mobile_12.width * 0.8);
        expect(dropBox.height).toBeGreaterThan(150);
      }
    }

    // Test camera access button if present
    const cameraButton = page.locator('button:has-text("カメラ"), button:has-text("Camera"), [data-testid="camera-button"]');
    if (await cameraButton.isVisible()) {
      const cameraBox = await cameraButton.boundingBox();
      if (cameraBox) {
        expect(cameraBox.height).toBeGreaterThanOrEqual(44);
        expect(cameraBox.width).toBeGreaterThan(100);
      }
    }
  });

  test('Route Quiz interaction on touch devices', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    await page.goto('/route-quiz');
    
    // Test touch interaction with quiz options
    const radioButtons = page.locator('input[type="radio"]');
    const radioCount = await radioButtons.count();
    
    for (let i = 0; i < Math.min(radioCount, 4); i++) {
      const radio = radioButtons.nth(i);
      if (await radio.isVisible()) {
        // Test that radio buttons can be selected via touch
        await radio.click();
        await page.waitForTimeout(200);
        
        const isChecked = await radio.isChecked();
        expect(isChecked).toBeTruthy();
      }
    }

    // Test swipe gesture for navigation if implemented
    const quizContainer = page.locator('[data-testid="quiz-container"], .quiz-container, main');
    if (await quizContainer.isVisible()) {
      const containerBox = await quizContainer.boundingBox();
      if (containerBox) {
        // Simulate swipe gesture (touch start, move, end)
        await page.touchscreen.tap(containerBox.x + containerBox.width / 2, containerBox.y + containerBox.height / 2);
        await page.waitForTimeout(100);
        
        // Test that the interface responds to touch
        // This is a basic test - actual swipe implementation would require more complex gesture simulation
      }
    }
  });

  test('Interactive features handle landscape orientation', async ({ page }) => {
    // Test landscape orientation on mobile
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.height, height: VIEWPORTS.mobile_12.width });
    
    const pages = ['/hazard-game', '/route-quiz'];
    
    for (const url of pages) {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Check that content adapts to landscape
      const mainContent = page.locator('main, [data-testid="main-content"], .main-content');
      if (await mainContent.isVisible()) {
        const contentBox = await mainContent.boundingBox();
        if (contentBox) {
          expect(contentBox.width).toBeLessThanOrEqual(VIEWPORTS.mobile_12.height); // Note: swapped dimensions
          expect(contentBox.height).toBeLessThanOrEqual(VIEWPORTS.mobile_12.width);
        }
      }
      
      // Check that interactive elements are still accessible
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const buttonBox = await button.boundingBox();
          if (buttonBox) {
            expect(buttonBox.height).toBeGreaterThanOrEqual(32); // Slightly smaller in landscape
            expect(buttonBox.width).toBeGreaterThan(60);
          }
        }
      }
    }
  });

  test('Interactive features loading and error states', async ({ page }) => {
    const helper = new ResponsiveTestHelper(page);
    
    for (const viewport of [VIEWPORTS.mobile_12, VIEWPORTS.tablet_ipad]) {
      await helper.setViewport(viewport);
      
      // Test hazard game loading states
      await page.goto('/hazard-game');
      await helper.hideLoadingElements();
      
      // Test route quiz loading states
      await page.goto('/route-quiz');
      await helper.hideLoadingElements();
      
      // Check for error message displays
      const errorMessages = page.locator('[data-testid="error"], .error, .error-message');
      const errorCount = await errorMessages.count();
      
      for (let i = 0; i < errorCount; i++) {
        const error = errorMessages.nth(i);
        if (await error.isVisible()) {
          const errorBox = await error.boundingBox();
          if (errorBox) {
            expect(errorBox.width).toBeLessThanOrEqual(viewport.width);
            if (viewport.isMobile) {
              expect(errorBox.width).toBeGreaterThan(viewport.width * 0.8);
            }
          }
        }
      }
    }
  });

  test('Game state persistence across viewport changes', async ({ page }) => {
    await page.goto('/hazard-game');
    const helper = new ResponsiveTestHelper(page);
    
    // Start with desktop
    await helper.setViewport(VIEWPORTS.desktop_hd);
    
    // Look for any game state (score, progress, etc.)
    const stateElements = page.locator('[data-testid="score"], [data-testid="progress"], .score, .progress');
    const initialStateText = await stateElements.first().textContent().catch(() => null);
    
    // Switch to mobile
    await helper.setViewport(VIEWPORTS.mobile_12);
    await page.waitForTimeout(1000);
    
    // Check that state is preserved
    if (initialStateText) {
      const mobileStateText = await stateElements.first().textContent().catch(() => null);
      expect(mobileStateText).toBe(initialStateText);
    }
    
    // Switch back to desktop
    await helper.setViewport(VIEWPORTS.desktop_hd);
    await page.waitForTimeout(1000);
    
    // Verify state is still preserved
    if (initialStateText) {
      const finalStateText = await stateElements.first().textContent().catch(() => null);
      expect(finalStateText).toBe(initialStateText);
    }
  });
});