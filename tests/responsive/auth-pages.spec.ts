import { test, expect } from '@playwright/test';
import { testPageResponsiveness, VIEWPORTS, ResponsiveTestHelper } from '../utils/responsive-helpers';
import { FormsPageObject } from '../page-objects/forms';
import { AuthHelper } from '../utils/auth-helpers';

test.describe('Authentication Pages Responsive Tests', () => {
  test('Login page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/login', 'login-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        const forms = new FormsPageObject(page);
        
        // Test form layout and accessibility
        if (await forms.loginForm.isVisible()) {
          await expect(forms.loginForm).toBeVisible();
          
          // Check form inputs are properly sized
          const inputs = await forms.formInputs.all();
          for (const input of inputs) {
            if (await input.isVisible()) {
              const box = await input.boundingBox();
              if (box) {
                if (viewport.isMobile) {
                  // On mobile, inputs should be large enough for touch
                  expect(box.height).toBeGreaterThanOrEqual(44);
                  // Should take most of available width
                  expect(box.width).toBeGreaterThan(viewport.width * 0.7);
                } else {
                  // On desktop, inputs should have reasonable minimum width
                  expect(box.width).toBeGreaterThan(200);
                }
              }
            }
          }
          
          // Test form button size and positioning
          if (await forms.loginSubmitButton.isVisible()) {
            const buttonBox = await forms.loginSubmitButton.boundingBox();
            if (buttonBox && viewport.isMobile) {
              expect(buttonBox.height).toBeGreaterThanOrEqual(44);
              expect(buttonBox.width).toBeGreaterThan(viewport.width * 0.5);
            }
          }
        }

        // Test password visibility toggle if present
        const passwordToggle = page.locator('[data-testid="password-toggle"], button[aria-label*="password"], .password-toggle');
        if (await passwordToggle.isVisible()) {
          const toggleBox = await passwordToggle.boundingBox();
          if (toggleBox && viewport.isMobile) {
            expect(toggleBox.width).toBeGreaterThanOrEqual(44);
            expect(toggleBox.height).toBeGreaterThanOrEqual(44);
          }
        }

        // Test "Remember me" checkbox if present
        const rememberCheckbox = page.locator('input[type="checkbox"], [role="checkbox"]');
        if (await rememberCheckbox.isVisible()) {
          const checkboxBox = await rememberCheckbox.boundingBox();
          if (checkboxBox && viewport.isMobile) {
            expect(checkboxBox.width).toBeGreaterThanOrEqual(24);
            expect(checkboxBox.height).toBeGreaterThanOrEqual(24);
          }
        }
      }
    });
  });

  test('Register page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/register', 'register-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        const forms = new FormsPageObject(page);
        
        // Test registration form layout
        if (await forms.registerForm.isVisible()) {
          await expect(forms.registerForm).toBeVisible();
          
          // Check that all form fields are accessible and properly sized
          const formInputs = [
            forms.nameInput,
            forms.emailInput,
            forms.passwordInput,
            forms.confirmPasswordInput
          ];
          
          for (const input of formInputs) {
            if (await input.isVisible()) {
              const box = await input.boundingBox();
              if (box) {
                if (viewport.isMobile) {
                  expect(box.height).toBeGreaterThanOrEqual(44);
                  expect(box.width).toBeGreaterThan(viewport.width * 0.7);
                } else {
                  expect(box.width).toBeGreaterThan(200);
                }
              }
            }
          }
          
          // Test form validation accessibility
          await forms.checkFormValidation();
        }

        // Test terms and conditions links/checkboxes
        const termsElements = page.locator('input[name*="terms"], input[name*="agree"], a:has-text("利用規約"), a:has-text("Terms")');
        const termsCount = await termsElements.count();
        
        for (let i = 0; i < termsCount; i++) {
          const element = termsElements.nth(i);
          if (await element.isVisible()) {
            const box = await element.boundingBox();
            if (box && viewport.isMobile) {
              // Ensure clickable elements are large enough
              expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
            }
          }
        }
      }
    });
  });

  test('Form validation should work across viewports', async ({ page }) => {
    for (const viewport of [VIEWPORTS.mobile_12, VIEWPORTS.tablet_ipad, VIEWPORTS.desktop_hd]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Test login form validation
      await page.goto('/login');
      const forms = new FormsPageObject(page);
      
      if (await forms.loginSubmitButton.isVisible()) {
        // Try to submit empty form
        await forms.loginSubmitButton.click();
        await page.waitForTimeout(1000);
        
        // Check for validation messages
        const errorMessages = await forms.errorMessages.count();
        if (errorMessages > 0) {
          // Ensure error messages are visible and readable
          for (let i = 0; i < errorMessages; i++) {
            const error = forms.errorMessages.nth(i);
            if (await error.isVisible()) {
              const errorBox = await error.boundingBox();
              if (errorBox) {
                expect(errorBox.width).toBeLessThanOrEqual(viewport.width);
              }
            }
          }
        }
      }
    }
  });

  test('Social login buttons should be properly sized', async ({ page }) => {
    await page.goto('/login');
    
    const socialButtons = page.locator('button:has-text("Google"), button:has-text("Facebook"), button:has-text("GitHub"), [data-testid*="social-login"]');
    const socialCount = await socialButtons.count();
    
    for (const viewport of [VIEWPORTS.mobile_12, VIEWPORTS.tablet_ipad, VIEWPORTS.desktop_hd]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      for (let i = 0; i < socialCount; i++) {
        const button = socialButtons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            if (viewport.isMobile) {
              expect(box.height).toBeGreaterThanOrEqual(44);
              expect(box.width).toBeGreaterThan(viewport.width * 0.4);
            } else {
              expect(box.height).toBeGreaterThanOrEqual(36);
              expect(box.width).toBeGreaterThan(150);
            }
          }
        }
      }
    }
  });

  test('Auth page transitions and redirects work on mobile', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    
    // Test navigation between login and register
    await page.goto('/login');
    
    const registerLink = page.locator('a:has-text("登録"), a:has-text("Register"), a:has-text("Sign up")');
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await page.waitForURL(/\/register/, { timeout: 5000 });
      expect(page.url()).toContain('/register');
    }
    
    await page.goto('/register');
    const loginLink = page.locator('a:has-text("ログイン"), a:has-text("Login"), a:has-text("Sign in")');
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await page.waitForURL(/\/login/, { timeout: 5000 });
      expect(page.url()).toContain('/login');
    }
  });

  test('Password field functionality on mobile', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    await page.goto('/login');
    
    const forms = new FormsPageObject(page);
    
    if (await forms.passwordInput.isVisible()) {
      // Test password input
      await forms.passwordInput.fill('testpassword123');
      
      // Check if password is masked
      const inputType = await forms.passwordInput.getAttribute('type');
      expect(inputType).toBe('password');
      
      // Test password visibility toggle if present
      const passwordToggle = page.locator('[data-testid="password-toggle"], button[aria-label*="password"], .password-toggle');
      if (await passwordToggle.isVisible()) {
        await passwordToggle.click();
        await page.waitForTimeout(300);
        
        const newInputType = await forms.passwordInput.getAttribute('type');
        expect(newInputType).toBe('text');
        
        // Toggle back
        await passwordToggle.click();
        await page.waitForTimeout(300);
        
        const finalInputType = await forms.passwordInput.getAttribute('type');
        expect(finalInputType).toBe('password');
      }
    }
  });

  test('Auto-fill and keyboard navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    await page.goto('/login');
    
    const forms = new FormsPageObject(page);
    
    // Test tab navigation through form
    if (await forms.emailInput.isVisible()) {
      await forms.emailInput.focus();
      await page.keyboard.press('Tab');
      
      // Should focus on password input
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
      expect(focusedElement).toBe('input');
    }
    
    // Test autocomplete attributes
    if (await forms.emailInput.isVisible()) {
      const emailAutocomplete = await forms.emailInput.getAttribute('autocomplete');
      expect(emailAutocomplete).toContain('email');
    }
    
    if (await forms.passwordInput.isVisible()) {
      const passwordAutocomplete = await forms.passwordInput.getAttribute('autocomplete');
      expect(passwordAutocomplete).toBeTruthy();
    }
  });
});