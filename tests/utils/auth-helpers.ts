import { Page, Browser, BrowserContext } from '@playwright/test';
import { FormsPageObject } from '../page-objects/forms';

export interface TestUser {
  email: string;
  password: string;
  name?: string;
}

export const hasE2ERegularCredentials =
  Boolean(process.env.E2E_REGULAR_EMAIL) &&
  Boolean(process.env.E2E_REGULAR_PASSWORD);

export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@test.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'testpassword123',
    name: 'Admin User'
  },
  regular: {
    email: process.env.E2E_REGULAR_EMAIL || 'user@test.com',
    password: process.env.E2E_REGULAR_PASSWORD || 'testpassword123',
    name: 'Regular User'
  },
  student: {
    email: process.env.E2E_STUDENT_EMAIL || 'student@test.com',
    password: process.env.E2E_STUDENT_PASSWORD || 'testpassword123',
    name: 'Student User'
  }
};

export class AuthHelper {
  constructor(private page: Page) {}

  async login(user: TestUser, skipIfLoggedIn: boolean = true): Promise<boolean> {
    // Check if already logged in
    if (skipIfLoggedIn && await this.isLoggedIn()) {
      return true;
    }

    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Wait for form to be available
    const emailInput = this.page.locator('input#email, input[type="email"]');
    const passwordInput = this.page.locator('input#password, input[type="password"]');

    try {
      await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // Form not found, might already be logged in or page issue
      return await this.isLoggedIn();
    }

    // Fill form fields
    await emailInput.fill(user.email);
    await passwordInput.fill(user.password);

    // Submit form
    const submitButton = this.page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for navigation to /map after successful login
    try {
      await this.page.waitForURL(/\/(map|dashboard|landing)/, { timeout: 15000 });
      return true;
    } catch {
      // Login might have failed
      console.warn('Login redirect timeout - user may not be authenticated');
      return false;
    }
  }

  async register(user: TestUser) {
    await this.page.goto('/register');
    const forms = new FormsPageObject(this.page);
    
    await forms.fillRegisterForm(user.email, user.password, user.name);
    await forms.submitRegisterForm();
    
    // Wait for redirect or success message
    await this.page.waitForTimeout(2000);
  }

  async logout() {
    // Look for logout button/link
    const logoutSelectors = [
      'button:has-text("ログアウト")',
      'button:has-text("Logout")',
      'a:has-text("ログアウト")',
      'a:has-text("Logout")',
      '[data-testid="logout"]',
      '.logout'
    ];

    for (const selector of logoutSelectors) {
      try {
        const element = this.page.locator(selector);
        if (await element.isVisible({ timeout: 1000 })) {
          await element.click();
          await this.page.waitForTimeout(1000);
          return;
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    // If no logout button found, clear storage and go to login
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await this.page.goto('/login');
  }

  async isLoggedIn(): Promise<boolean> {
    // Check for common indicators of being logged in
    const loggedInIndicators = [
      '[data-testid="user-menu"]',
      '.user-menu',
      'button:has-text("ログアウト")',
      'button:has-text("Logout")',
      '.dashboard',
      '[data-testid="authenticated"]'
    ];

    for (const selector of loggedInIndicators) {
      try {
        if (await this.page.locator(selector).isVisible({ timeout: 1000 })) {
          return true;
        }
      } catch (error) {
        // Continue checking other indicators
      }
    }

    // Check URL for protected routes
    const currentUrl = this.page.url();
    const protectedRoutes = ['/dashboard', '/map', '/missions', '/badges', '/leaderboard', '/admin'];
    
    for (const route of protectedRoutes) {
      if (currentUrl.includes(route)) {
        // If we're on a protected route and not redirected to login, we're probably logged in
        await this.page.waitForTimeout(2000);
        if (!this.page.url().includes('/login')) {
          return true;
        }
      }
    }

    return false;
  }

  async ensureAuthenticated(user: TestUser = TEST_USERS.regular) {
    if (!(await this.isLoggedIn())) {
      await this.login(user);
    }
  }

  async ensureLoggedOut() {
    if (await this.isLoggedIn()) {
      await this.logout();
    }
  }

  async setupAuthenticatedContext(browser: Browser, user: TestUser = TEST_USERS.regular): Promise<BrowserContext> {
    const context = await browser.newContext();
    const page = await context.newPage();
    const authHelper = new AuthHelper(page);
    
    await authHelper.login(user, false);
    await page.close();
    
    return context;
  }

  async checkAuthenticationState() {
    // Check various authentication indicators for debugging
    const indicators = {
      hasUserMenu: await this.page.locator('[data-testid="user-menu"]').isVisible().catch(() => false),
      hasLogoutButton: await this.page.locator('button:has-text("ログアウト"), button:has-text("Logout")').isVisible().catch(() => false),
      currentUrl: this.page.url(),
      hasCookies: (await this.page.context().cookies()).length > 0,
      hasLocalStorage: await this.page.evaluate(() => Object.keys(localStorage).length > 0),
    };

    return indicators;
  }

  async waitForAuthStateChange(expectedState: 'logged-in' | 'logged-out', timeout: number = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const isLoggedIn = await this.isLoggedIn();
      
      if (expectedState === 'logged-in' && isLoggedIn) {
        return true;
      } else if (expectedState === 'logged-out' && !isLoggedIn) {
        return true;
      }
      
      await this.page.waitForTimeout(500);
    }
    
    throw new Error(`Authentication state did not change to '${expectedState}' within ${timeout}ms`);
  }
}
