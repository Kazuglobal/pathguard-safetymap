import { Page, Locator } from '@playwright/test';

export class NavigationPageObject {
  readonly page: Page;
  readonly mobileMenuTrigger: Locator;
  readonly mobileMenu: Locator;
  readonly navigationLinks: Locator;
  readonly userMenu: Locator;
  readonly logoLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mobileMenuTrigger = page.locator('[data-testid="mobile-menu-trigger"], .mobile-menu-trigger, button[aria-label*="menu"], button[aria-label*="メニュー"]');
    this.mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-menu, nav[aria-label*="mobile"]');
    this.navigationLinks = page.locator('nav a, [data-testid="nav-link"]');
    this.userMenu = page.locator('[data-testid="user-menu"], .user-menu');
    this.logoLink = page.locator('[data-testid="logo"], .logo, a[href="/"]').first();
  }

  async openMobileMenu() {
    if (await this.mobileMenuTrigger.isVisible()) {
      await this.mobileMenuTrigger.click();
      await this.page.waitForTimeout(300);
    }
  }

  async closeMobileMenu() {
    if (await this.mobileMenuTrigger.isVisible()) {
      await this.mobileMenuTrigger.click();
      await this.page.waitForTimeout(300);
    }
  }

  async navigateToPage(pageName: string) {
    const pageMap: Record<string, string> = {
      'landing': '/landing',
      'dashboard': '/dashboard',
      'map': '/map',
      'missions': '/missions',
      'badges': '/badges',
      'leaderboard': '/leaderboard',
      'hazard-game': '/hazard-game',
      'route-quiz': '/route-quiz',
      'login': '/login',
      'register': '/register',
      'xroad': '/xroad'
    };

    const url = pageMap[pageName];
    if (url) {
      await this.page.goto(url);
    } else {
      throw new Error(`Unknown page: ${pageName}`);
    }
  }

  async clickNavigationLink(linkText: string) {
    const link = this.navigationLinks.filter({ hasText: linkText });
    await link.click();
  }
}