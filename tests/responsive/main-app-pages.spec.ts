import { test, expect } from '@playwright/test';
import { testPageResponsiveness, VIEWPORTS, ResponsiveTestHelper } from '../utils/responsive-helpers';
import { AuthHelper, TEST_USERS } from '../utils/auth-helpers';
import { NavigationPageObject } from '../page-objects/navigation';
import { MapPageObject } from '../page-objects/map';

test.describe('Main App Pages Responsive Tests', () => {
  test.beforeEach(async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.login(TEST_USERS.regular);
  });

  test('Dashboard page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/dashboard', 'dashboard-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        // Test dashboard cards/widgets layout
        const dashboardCards = page.locator('[data-testid="dashboard-card"], .dashboard-card, .card, .widget');
        const cardCount = await dashboardCards.count();
        
        if (cardCount > 0) {
          if (viewport.isMobile) {
            // On mobile, cards should stack vertically
            for (let i = 0; i < Math.min(cardCount, 4); i++) {
              const card = dashboardCards.nth(i);
              if (await card.isVisible()) {
                const box = await card.boundingBox();
                if (box) {
                  // Cards should take full width on mobile
                  expect(box.width).toBeGreaterThan(viewport.width * 0.85);
                }
              }
            }
          } else if (viewport.isTablet) {
            // On tablet, check 2-column layout
            const visibleCards = [];
            for (let i = 0; i < Math.min(cardCount, 4); i++) {
              const card = dashboardCards.nth(i);
              if (await card.isVisible()) {
                const box = await card.boundingBox();
                if (box) visibleCards.push({ index: i, box });
              }
            }
            
            // Check if cards are arranged in rows
            if (visibleCards.length >= 2) {
              const firstCard = visibleCards[0];
              const secondCard = visibleCards[1];
              expect(secondCard.box.x).toBeGreaterThan(firstCard.box.x);
            }
          }
        }

        // Test charts responsiveness
        const charts = page.locator('[data-testid="chart"], .chart, canvas, svg');
        const chartCount = await charts.count();
        
        for (let i = 0; i < chartCount; i++) {
          const chart = charts.nth(i);
          if (await chart.isVisible()) {
            const box = await chart.boundingBox();
            if (box) {
              // Charts should fit within viewport
              expect(box.width).toBeLessThanOrEqual(viewport.width);
              if (viewport.isMobile) {
                // Charts should be readable on mobile
                expect(box.width).toBeGreaterThan(viewport.width * 0.8);
              }
            }
          }
        }

        // Test statistics/metrics display
        const metrics = page.locator('[data-testid="metric"], .metric, .stat, .statistic');
        const metricCount = await metrics.count();
        
        if (metricCount > 0 && viewport.isMobile) {
          // On mobile, metrics should stack or scroll horizontally
          for (let i = 0; i < Math.min(metricCount, 3); i++) {
            const metric = metrics.nth(i);
            if (await metric.isVisible()) {
              const box = await metric.boundingBox();
              if (box) {
                expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 10); // 10px tolerance
              }
            }
          }
        }
      }
    });
  });

  test('Map page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/map', 'map-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        const mapPage = new MapPageObject(page);
        
        // Wait for map to load
        await mapPage.waitForMapLoad();
        
        // Test map container responsiveness
        if (await mapPage.mapContainer.isVisible()) {
          const mapBox = await mapPage.mapContainer.boundingBox();
          if (mapBox) {
            expect(mapBox.width).toBeLessThanOrEqual(viewport.width);
            expect(mapBox.height).toBeGreaterThan(300); // Minimum usable height
            
            if (viewport.isMobile) {
              // Map should take most of the screen on mobile
              expect(mapBox.width).toBeGreaterThan(viewport.width * 0.95);
              expect(mapBox.height).toBeGreaterThan(viewport.height * 0.5);
            }
          }
        }

        // Test map controls positioning
        await mapPage.checkResponsiveMapControls(viewport.isMobile);
        
        // Test search functionality
        if (await mapPage.searchBox.isVisible()) {
          const searchBox = await mapPage.searchBox.boundingBox();
          if (searchBox) {
            if (viewport.isMobile) {
              expect(searchBox.width).toBeGreaterThan(viewport.width * 0.7);
              expect(searchBox.height).toBeGreaterThanOrEqual(44);
            }
          }
        }

        // Test sidebar responsiveness
        if (await mapPage.sidebar.isVisible()) {
          const sidebarBox = await mapPage.sidebar.boundingBox();
          if (sidebarBox) {
            if (viewport.isMobile) {
              // Sidebar should be collapsible or overlay on mobile
              expect(sidebarBox.width).toBeLessThan(viewport.width * 0.9);
            }
          }
        }

        // Test map interaction
        await mapPage.checkMapInteractivity();
      }
    });
  });

  test('Missions page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/missions', 'missions-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        // Test mission cards layout
        const missionCards = page.locator('[data-testid="mission-card"], .mission-card, .mission');
        const cardCount = await missionCards.count();
        
        if (cardCount > 0) {
          if (viewport.isMobile) {
            // Mission cards should stack vertically on mobile
            for (let i = 0; i < Math.min(cardCount, 3); i++) {
              const card = missionCards.nth(i);
              if (await card.isVisible()) {
                const box = await card.boundingBox();
                if (box) {
                  expect(box.width).toBeGreaterThan(viewport.width * 0.85);
                }
              }
            }
          }
        }

        // Test mission progress bars
        const progressBars = page.locator('[data-testid="progress"], .progress, .progress-bar');
        const progressCount = await progressBars.count();
        
        for (let i = 0; i < progressCount; i++) {
          const progress = progressBars.nth(i);
          if (await progress.isVisible()) {
            const box = await progress.boundingBox();
            if (box) {
              expect(box.width).toBeLessThanOrEqual(viewport.width);
              if (viewport.isMobile) {
                expect(box.width).toBeGreaterThan(viewport.width * 0.7);
              }
            }
          }
        }

        // Test action buttons
        const actionButtons = page.locator('button:has-text("開始"), button:has-text("完了"), button:has-text("Start"), button:has-text("Complete")');
        const buttonCount = await actionButtons.count();
        
        for (let i = 0; i < buttonCount; i++) {
          const button = actionButtons.nth(i);
          if (await button.isVisible()) {
            const box = await button.boundingBox();
            if (box && viewport.isMobile) {
              expect(box.height).toBeGreaterThanOrEqual(44);
              expect(box.width).toBeGreaterThan(100);
            }
          }
        }
      }
    });
  });

  test('Badges page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/badges', 'badges-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        // Test badge grid layout
        const badges = page.locator('[data-testid="badge"], .badge');
        const badgeCount = await badges.count();
        
        if (badgeCount > 0) {
          let previousBadgeY = 0;
          let badgesInRow = 0;
          
          for (let i = 0; i < Math.min(badgeCount, 8); i++) {
            const badge = badges.nth(i);
            if (await badge.isVisible()) {
              const box = await badge.boundingBox();
              if (box) {
                if (viewport.isMobile) {
                  // On mobile, check 2-3 badges per row max
                  if (Math.abs(box.y - previousBadgeY) < 10) {
                    badgesInRow++;
                  } else {
                    badgesInRow = 1;
                    previousBadgeY = box.y;
                  }
                  expect(badgesInRow).toBeLessThanOrEqual(3);
                } else {
                  // Badge should be large enough to be recognizable
                  expect(box.width).toBeGreaterThan(80);
                  expect(box.height).toBeGreaterThan(80);
                }
              }
            }
          }
        }

        // Test badge details modal if present
        const badgeModal = page.locator('[data-testid="badge-modal"], .modal, .dialog');
        if (await badgeModal.isVisible()) {
          const modalBox = await badgeModal.boundingBox();
          if (modalBox) {
            if (viewport.isMobile) {
              // Modal should fit screen with some padding
              expect(modalBox.width).toBeLessThan(viewport.width * 0.95);
              expect(modalBox.height).toBeLessThan(viewport.height * 0.9);
            }
          }
        }
      }
    });
  });

  test('Leaderboard page should display correctly across all viewports', async ({ page }) => {
    await testPageResponsiveness(page, '/leaderboard', 'leaderboard-page', {
      customChecks: async (helper: ResponsiveTestHelper, viewport) => {
        // Test leaderboard table responsiveness
        const leaderboardTable = page.locator('table, [data-testid="leaderboard"], .leaderboard');
        if (await leaderboardTable.isVisible()) {
          const tableBox = await leaderboardTable.boundingBox();
          if (tableBox) {
            expect(tableBox.width).toBeLessThanOrEqual(viewport.width);
            
            if (viewport.isMobile) {
              // On mobile, table should be scrollable horizontally or simplified
              const tableRows = page.locator('tr');
              const rowCount = await tableRows.count();
              
              for (let i = 0; i < Math.min(rowCount, 3); i++) {
                const row = tableRows.nth(i);
                if (await row.isVisible()) {
                  const rowBox = await row.boundingBox();
                  if (rowBox) {
                    // Row content should fit or be scrollable
                    expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(viewport.width + 50); // Some tolerance for scrolling
                  }
                }
              }
            }
          }
        }

        // Test ranking cards (alternative to table)
        const rankingCards = page.locator('[data-testid="ranking-card"], .ranking-card, .rank');
        const cardCount = await rankingCards.count();
        
        if (cardCount > 0 && viewport.isMobile) {
          for (let i = 0; i < Math.min(cardCount, 5); i++) {
            const card = rankingCards.nth(i);
            if (await card.isVisible()) {
              const box = await card.boundingBox();
              if (box) {
                expect(box.width).toBeGreaterThan(viewport.width * 0.85);
              }
            }
          }
        }

        // Test user profile pictures/avatars
        const avatars = page.locator('img[alt*="avatar"], img[alt*="profile"], .avatar');
        const avatarCount = await avatars.count();
        
        for (let i = 0; i < Math.min(avatarCount, 5); i++) {
          const avatar = avatars.nth(i);
          if (await avatar.isVisible()) {
            const box = await avatar.boundingBox();
            if (box) {
              // Avatars should be properly sized
              expect(box.width).toBeGreaterThan(24);
              expect(box.height).toBeGreaterThan(24);
              if (viewport.isMobile) {
                expect(box.width).toBeLessThan(100);
                expect(box.height).toBeLessThan(100);
              }
            }
          }
        }
      }
    });
  });

  test('Navigation between main pages works on mobile', async ({ page }) => {
    const navigation = new NavigationPageObject(page);
    
    await page.setViewportSize({ width: VIEWPORTS.mobile_12.width, height: VIEWPORTS.mobile_12.height });
    
    const pages = ['dashboard', 'map', 'missions', 'badges', 'leaderboard'];
    
    for (const pageName of pages) {
      await navigation.navigateToPage(pageName);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct page
      expect(page.url()).toContain(`/${pageName}`);
      
      // Check that mobile navigation works
      await navigation.openMobileMenu();
      await page.waitForTimeout(300);
      await navigation.closeMobileMenu();
    }
  });

  test('Main app pages handle loading states properly', async ({ page }) => {
    const helper = new ResponsiveTestHelper(page);
    
    for (const viewport of [VIEWPORTS.mobile_12, VIEWPORTS.tablet_ipad, VIEWPORTS.desktop_hd]) {
      await helper.setViewport(viewport);
      
      const pages = ['/dashboard', '/map', '/missions', '/badges', '/leaderboard'];
      
      for (const url of pages) {
        await page.goto(url);
        await helper.hideLoadingElements();
        await helper.waitForPageLoad();
        
        // Ensure no loading spinners are visible after page load
        const loadingElements = page.locator('[data-testid="loading"], .loading, .spinner');
        const loadingCount = await loadingElements.count();
        
        for (let i = 0; i < loadingCount; i++) {
          const loading = loadingElements.nth(i);
          expect(await loading.isVisible()).toBeFalsy();
        }
      }
    }
  });
});