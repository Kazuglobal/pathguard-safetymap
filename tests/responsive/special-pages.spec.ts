import { test, expect } from '@playwright/test';
import { testPageResponsiveness, VIEWPORTS, ResponsiveTestHelper } from '../utils/responsive-helpers';
import { AuthHelper, TEST_USERS } from '../utils/auth-helpers';

test.describe('Special Pages Responsive Tests', () => {
  test('X-Road page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/xroad', 'xroad-page', {
      skipAuth: true,
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        // Test X-Road integration interface
        const xroadInterface = page.locator('[data-testid="xroad-interface"], .xroad-interface, .integration');
        if (await xroadInterface.isVisible()) {
          const interfaceBox = await xroadInterface.boundingBox();
          if (interfaceBox) {
            expect(interfaceBox.width).toBeLessThanOrEqual(viewport.width);
            if (viewport.isMobile) {
              expect(interfaceBox.width).toBeGreaterThan(viewport.width * 0.85);
            }
          }
        }

        // Test API documentation or examples
        const apiDocs = page.locator('[data-testid="api-docs"], .api-docs, .documentation');
        if (await apiDocs.isVisible()) {
          const docsBox = await apiDocs.boundingBox();
          if (docsBox) {
            expect(docsBox.width).toBeLessThanOrEqual(viewport.width);
            if (viewport.isMobile) {
              // Documentation should be readable on mobile
              expect(docsBox.width).toBeGreaterThan(viewport.width * 0.9);
            }
          }
        }

        // Test code examples or request/response displays
        const codeBlocks = page.locator('pre, code, .code-block, [data-testid="code-example"]');
        const codeCount = await codeBlocks.count();
        
        for (let i = 0; i < Math.min(codeCount, 3); i++) {
          const codeBlock = codeBlocks.nth(i);
          if (await codeBlock.isVisible()) {
            const codeBox = await codeBlock.boundingBox();
            if (codeBox) {
              expect(codeBox.width).toBeLessThanOrEqual(viewport.width);
              if (viewport.isMobile) {
                // Code should be horizontally scrollable on mobile if needed
                const hasHorizontalScroll = await codeBlock.evaluate((el) => 
                  el.scrollWidth > el.clientWidth
                );
                // This is acceptable for code blocks on mobile
              }
            }
          }
        }

        // Test X-Road service buttons or controls
        const serviceButtons = page.locator('button:has-text("テスト"), button:has-text("実行"), button:has-text("Test"), button:has-text("Execute")');
        const buttonCount = await serviceButtons.count();
        
        for (let i = 0; i < buttonCount; i++) {
          const button = serviceButtons.nth(i);
          if (await button.isVisible()) {
            const buttonBox = await button.boundingBox();
            if (buttonBox && viewport.isMobile) {
              expect(buttonBox.height).toBeGreaterThanOrEqual(44);
              expect(buttonBox.width).toBeGreaterThan(100);
            }
          }
        }

        // Test data tables or result displays
        const dataTables = page.locator('table, [data-testid="data-table"], .data-table');
        const tableCount = await dataTables.count();
        
        for (let i = 0; i < tableCount; i++) {
          const table = dataTables.nth(i);
          if (await table.isVisible()) {
            const tableBox = await table.boundingBox();
            if (tableBox) {
              if (viewport.isMobile) {
                // Tables should be scrollable or simplified on mobile
                expect(tableBox.width).toBeLessThanOrEqual(viewport.width + 20); // Small tolerance for scrolling
              }
            }
          }
        }
      }
    });
  });

  test('Admin Dashboard should display correctly across all viewports', async ({ page }) => {
    // Set up admin authentication
    const authHelper = new AuthHelper(page);
    await authHelper.login(TEST_USERS.admin);

    await testPageResponsiveness(page, '/admin/dashboard', 'admin-dashboard-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        // Test admin navigation/sidebar
        const adminSidebar = page.locator('[data-testid="admin-sidebar"], .admin-sidebar, .sidebar');
        if (await adminSidebar.isVisible()) {
          const sidebarBox = await adminSidebar.boundingBox();
          if (sidebarBox) {
            if (viewport.isMobile) {
              // Sidebar should be collapsible or overlay on mobile
              expect(sidebarBox.width).toBeLessThan(viewport.width * 0.8);
            } else {
              // Sidebar should be reasonably sized on desktop
              expect(sidebarBox.width).toBeLessThan(viewport.width * 0.3);
            }
          }
        }

        // Test admin statistics cards
        const statsCards = page.locator('[data-testid="stat-card"], .stat-card, .admin-stat');
        const cardCount = await statsCards.count();
        
        if (cardCount > 0) {
          if (viewport.isMobile) {
            // Stats cards should stack vertically on mobile
            for (let i = 0; i < Math.min(cardCount, 4); i++) {
              const card = statsCards.nth(i);
              if (await card.isVisible()) {
                const cardBox = await card.boundingBox();
                if (cardBox) {
                  expect(cardBox.width).toBeGreaterThan(viewport.width * 0.85);
                }
              }
            }
          }
        }

        // Test admin data tables
        const adminTables = page.locator('table, [data-testid="admin-table"], .admin-table');
        const tableCount = await adminTables.count();
        
        for (let i = 0; i < tableCount; i++) {
          const table = adminTables.nth(i);
          if (await table.isVisible()) {
            const tableBox = await table.boundingBox();
            if (tableBox) {
              if (viewport.isMobile) {
                // Admin tables should be responsive or scrollable
                expect(tableBox.width).toBeLessThanOrEqual(viewport.width + 50); // Tolerance for horizontal scroll
              }
            }
          }
        }

        // Test admin action buttons
        const actionButtons = page.locator('button:has-text("編集"), button:has-text("削除"), button:has-text("追加"), button:has-text("Edit"), button:has-text("Delete"), button:has-text("Add")');
        const actionCount = await actionButtons.count();
        
        for (let i = 0; i < Math.min(actionCount, 5); i++) {
          const button = actionButtons.nth(i);
          if (await button.isVisible()) {
            const buttonBox = await button.boundingBox();
            if (buttonBox && viewport.isMobile) {
              expect(buttonBox.height).toBeGreaterThanOrEqual(44);
              expect(buttonBox.width).toBeGreaterThan(80);
            }
          }
        }

        // Test admin charts/graphs
        const adminCharts = page.locator('[data-testid="admin-chart"], .admin-chart, canvas, svg');
        const chartCount = await adminCharts.count();
        
        for (let i = 0; i < chartCount; i++) {
          const chart = adminCharts.nth(i);
          if (await chart.isVisible()) {
            const chartBox = await chart.boundingBox();
            if (chartBox) {
              expect(chartBox.width).toBeLessThanOrEqual(viewport.width);
              if (viewport.isMobile) {
                expect(chartBox.width).toBeGreaterThan(viewport.width * 0.8);
                expect(chartBox.height).toBeGreaterThan(200);
              }
            }
          }
        }

        // Test admin modals/dialogs
        const adminModals = page.locator('[data-testid="admin-modal"], .admin-modal, .modal', { hasText: /編集|削除|追加|Edit|Delete|Add/ });
        const modalCount = await adminModals.count();
        
        for (let i = 0; i < modalCount; i++) {
          const modal = adminModals.nth(i);
          if (await modal.isVisible()) {
            const modalBox = await modal.boundingBox();
            if (modalBox) {
              if (viewport.isMobile) {
                expect(modalBox.width).toBeLessThan(viewport.width * 0.95);
                expect(modalBox.height).toBeLessThan(viewport.height * 0.9);
              }
            }
          }
        }
      }
    });
  });

  test('X-Road API integration should work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    await page.goto('/xroad');
    
    // Test API request forms
    const apiForm = page.locator('form, [data-testid="api-form"], .api-form');
    if (await apiForm.isVisible()) {
      const formBox = await apiForm.boundingBox();
      if (formBox) {
        expect(formBox.width).toBeGreaterThan(VIEWPORTS.mobile_12.width * 0.8);
      }
      
      // Test form inputs
      const formInputs = apiForm.locator('input, textarea, select');
      const inputCount = await formInputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = formInputs.nth(i);
        if (await input.isVisible()) {
          const inputBox = await input.boundingBox();
          if (inputBox) {
            expect(inputBox.height).toBeGreaterThanOrEqual(44);
            expect(inputBox.width).toBeGreaterThan(VIEWPORTS.mobile_12.width * 0.7);
          }
        }
      }
    }

    // Test response display areas
    const responseArea = page.locator('[data-testid="response"], .response, .api-response');
    if (await responseArea.isVisible()) {
      const responseBox = await responseArea.boundingBox();
      if (responseBox) {
        expect(responseBox.width).toBeLessThanOrEqual(VIEWPORTS.mobile_12.width);
        expect(responseBox.width).toBeGreaterThan(VIEWPORTS.mobile_12.width * 0.8);
      }
    }
  });

  test('Admin controls should be accessible on tablet', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.login(TEST_USERS.admin);
    
    await page.setViewportSize({ width: VIEWPORTS.tablet_ipad.width, height: VIEWPORTS.tablet_ipad.height });
    await page.goto('/admin/dashboard');
    
    // Test admin navigation on tablet
    const adminNav = page.locator('[data-testid="admin-nav"], .admin-nav, nav');
    if (await adminNav.isVisible()) {
      const navBox = await adminNav.boundingBox();
      if (navBox) {
        expect(navBox.width).toBeLessThan(VIEWPORTS.tablet_ipad.width * 0.4);
      }
    }

    // Test admin forms on tablet
    const adminForms = page.locator('form');
    const formCount = await adminForms.count();
    
    for (let i = 0; i < Math.min(formCount, 2); i++) {
      const form = adminForms.nth(i);
      if (await form.isVisible()) {
        const formInputs = form.locator('input, textarea, select');
        const inputCount = await formInputs.count();
        
        for (let j = 0; j < inputCount; j++) {
          const input = formInputs.nth(j);
          if (await input.isVisible()) {
            const inputBox = await input.boundingBox();
            if (inputBox) {
              expect(inputBox.height).toBeGreaterThanOrEqual(36);
              expect(inputBox.width).toBeGreaterThan(200);
            }
          }
        }
      }
    }
  });

  test('Special pages handle authentication properly', async ({ page }) => {
    // Test X-Road page (should be accessible without auth)
    await page.goto('/xroad');
    await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Should not redirect to login
    expect(page.url()).toContain('/xroad');
    
    // Test admin page (should require auth)
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Should redirect to login or show access denied
    const currentUrl = page.url();
    const isOnLoginPage = currentUrl.includes('/login');
    const hasAccessDenied = await page.locator('text=アクセス拒否, text=Access Denied, text=Unauthorized').isVisible();
    
    expect(isOnLoginPage || hasAccessDenied).toBeTruthy();
  });

  test('Special pages error handling on mobile', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    
    // Test 404 page if it exists
    await page.goto('/non-existent-page');
    await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    const errorMessage = page.locator('h1:has-text("404"), text=見つかりません, text=Not Found, text=Page not found');
    if (await errorMessage.isVisible()) {
      const errorBox = await errorMessage.boundingBox();
      if (errorBox) {
        expect(errorBox.width).toBeLessThanOrEqual(VIEWPORTS.mobile_12.width);
      }
    }

    // Test error recovery links
    const backToHomeLink = page.locator('a:has-text("ホーム"), a:has-text("Home"), a[href="/"], a[href="/landing"]');
    if (await backToHomeLink.isVisible()) {
      const linkBox = await backToHomeLink.boundingBox();
      if (linkBox) {
        expect(linkBox.height).toBeGreaterThanOrEqual(44);
        expect(linkBox.width).toBeGreaterThan(80);
      }
    }
  });

  test('Code examples and documentation readability', async ({ page }) => {
    await page.goto('/xroad');
    
    for (const viewport of [VIEWPORTS.mobile_12, VIEWPORTS.tablet_ipad, VIEWPORTS.desktop_hd]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Test code block formatting
      const codeBlocks = page.locator('pre, code');
      const codeCount = await codeBlocks.count();
      
      for (let i = 0; i < Math.min(codeCount, 3); i++) {
        const codeBlock = codeBlocks.nth(i);
        if (await codeBlock.isVisible()) {
          // Check font size is readable
          const fontSize = await codeBlock.evaluate((el) => 
            window.getComputedStyle(el).fontSize
          );
          const fontSizeNum = parseInt(fontSize);
          
          if (viewport.isMobile) {
            expect(fontSizeNum).toBeGreaterThanOrEqual(12);
          } else {
            expect(fontSizeNum).toBeGreaterThanOrEqual(14);
          }
        }
      }
      
      // Test documentation sections
      const docSections = page.locator('section, article, .documentation');
      const sectionCount = await docSections.count();
      
      for (let i = 0; i < Math.min(sectionCount, 3); i++) {
        const section = docSections.nth(i);
        if (await section.isVisible()) {
          const sectionBox = await section.boundingBox();
          if (sectionBox) {
            expect(sectionBox.width).toBeLessThanOrEqual(viewport.width);
          }
        }
      }
    }
  });
});