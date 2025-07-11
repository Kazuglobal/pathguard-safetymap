import { Page, Browser, BrowserContext } from '@playwright/test';
import { FormsPageObject } from '../page-objects/forms';

export interface TestUser {
  email: string;
  password: string;
  name?: string;
}

export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    email: 'admin@test.com',
    password: 'testpassword123',
    name: 'Admin User'
  },
  regular: {
    email: 'user@test.com',
    password: 'testpassword123',
    name: 'Regular User'
  },
  student: {
    email: 'student@test.com',
    password: 'testpassword123',
    name: 'Student User'
  }
};

export class AuthHelper {
  constructor(private page: Page) {}

  async login(user: TestUser, skipIfLoggedIn: boolean = true) {
    // Check if already logged in
    if (skipIfLoggedIn && await this.isLoggedIn()) {
      return;
    }

    await this.page.goto('/login');
    const forms = new FormsPageObject(this.page);
    
    await forms.fillLoginForm(user.email, user.password);
    await forms.submitLoginForm();
    
    // Wait for redirect after successful login
    await this.page.waitForURL(/\/(dashboard|map|landing)/, { timeout: 10000 });
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