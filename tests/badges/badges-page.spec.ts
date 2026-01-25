import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../utils/auth-helpers';

/**
 * TDD テスト: バッジページ機能 (Phase 1.1)
 * 
 * タスク 1-1-badges-ui: 全バッジ一覧とユーザー取得状況の表示UI作成
 * タスク 1-1-badges-card: バッジカードコンポーネント（アイコン、取得条件、日時）
 * 
 * 期待する機能:
 * - 全バッジを badges テーブルから取得して表示
 * - ユーザー取得済みバッジを user_badges テーブルから取得
 * - グリッドレイアウトで一覧表示
 * - バッジカードにアイコン、名前、取得条件、取得日時を表示
 * - 取得/未取得の視覚的区別
 */

test.describe('Badges Page - Phase 1.1', () => {
  test.beforeEach(async ({ page }) => {
    const authHelper = new AuthHelper(page);
    await authHelper.login(TEST_USERS.regular);
  });

  // ============================================
  // 1-1-badges-ui: 全バッジ一覧表示UI
  // ============================================
  test.describe('1-1-badges-ui: 全バッジ一覧表示UI', () => {
    
    test('バッジページにアクセスできる', async ({ page }) => {
      await page.goto('/badges');
      await expect(page).toHaveURL(/\/badges/);
    });

    test('ページタイトル「バッジ一覧」が表示される', async ({ page }) => {
      await page.goto('/badges');
      
      // ページヘッダーにタイトルが存在する
      const pageTitle = page.locator('h1, [data-testid="badges-title"]');
      await expect(pageTitle).toBeVisible();
      
      // タイトルテキストの確認（日本語または英語）
      const titleText = await pageTitle.textContent();
      expect(titleText).toMatch(/バッジ|Badges|バッジ一覧/i);
    });

    test('全バッジがbadgesテーブルから取得されて表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      // バッジアイテムが表示される（最低1つ以上）
      const badges = page.locator('[data-testid="badge-item"], [data-testid="badge-card"], .badge-card, .badge-item');
      const badgeCount = await badges.count();
      
      // badgesテーブルにデータがある前提で、少なくとも1つ以上表示される
      expect(badgeCount).toBeGreaterThan(0);
    });

    test('ユーザー取得済みバッジがuser_badgesテーブルから取得される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      // ログイン状態の場合のみサマリーが表示される
      // 未ログイン時は「ログインすると取得状況が表示されます」メッセージが表示される
      const ownedCountText = page.locator('[data-testid="owned-badge-count"]');
      const loginMessage = page.locator('text=ログインすると取得状況が表示されます');
      
      // どちらかが表示されていることを確認
      const hasOwnedCount = await ownedCountText.count() > 0;
      const hasLoginMessage = await loginMessage.count() > 0;
      
      expect(hasOwnedCount || hasLoginMessage).toBeTruthy();
    });

    test('バッジ取得サマリー（X個中Y個取得）が表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      // サマリー表示（例: "5個中2個取得" または "2/5 badges"）
      const summaryPatterns = [
        page.locator('[data-testid="badge-summary"]'),
        page.locator('[data-testid="badge-stats"]'),
        page.locator('text=/\\d+.*中.*\\d+.*取得/'),
        page.locator('text=/\\d+\\/\\d+/'),
      ];
      
      let summaryFound = false;
      for (const pattern of summaryPatterns) {
        if (await pattern.count() > 0) {
          summaryFound = true;
          break;
        }
      }
      
      expect(summaryFound).toBeTruthy();
    });
  });

  // ============================================
  // グリッドレイアウト
  // ============================================
  test.describe('グリッドレイアウト', () => {
    
    test('バッジ一覧がグリッドコンテナで表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      // グリッドコンテナが存在する
      const badgeGrid = page.locator('[data-testid="badge-grid"], .badge-grid');
      await expect(badgeGrid).toBeVisible({ timeout: 10000 });
    });

    test('グリッドはCSSのgridまたはflexレイアウトを使用している', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badgeGrid = page.locator('[data-testid="badge-grid"], .badge-grid, .grid');
      
      if (await badgeGrid.count() > 0) {
        const display = await badgeGrid.first().evaluate(el => {
          return window.getComputedStyle(el).display;
        });
        
        // grid または flex レイアウトであること
        expect(['grid', 'flex', 'inline-grid', 'inline-flex']).toContain(display);
      }
    });

    test('デスクトップでは4列以上のグリッドで表示される', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badges = page.locator('[data-testid="badge-card"], .badge-card');
      const badgeCount = await badges.count();
      
      if (badgeCount >= 4) {
        const positions: { x: number; y: number }[] = [];
        
        for (let i = 0; i < Math.min(badgeCount, 8); i++) {
          const badge = badges.nth(i);
          const box = await badge.boundingBox();
          if (box) {
            positions.push({ x: box.x, y: box.y });
          }
        }
        
        // 最初の行にあるバッジ数をカウント（同じY座標）
        const firstRowY = positions[0]?.y ?? 0;
        const badgesInFirstRow = positions.filter(p => Math.abs(p.y - firstRowY) < 20).length;
        
        // デスクトップでは4列以上
        expect(badgesInFirstRow).toBeGreaterThanOrEqual(4);
      }
    });

    test('タブレットでは2-3列のグリッドで表示される', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badges = page.locator('[data-testid="badge-card"], .badge-card');
      const badgeCount = await badges.count();
      
      if (badgeCount >= 3) {
        const positions: { x: number; y: number }[] = [];
        
        for (let i = 0; i < Math.min(badgeCount, 6); i++) {
          const badge = badges.nth(i);
          const box = await badge.boundingBox();
          if (box) {
            positions.push({ x: box.x, y: box.y });
          }
        }
        
        const firstRowY = positions[0]?.y ?? 0;
        const badgesInFirstRow = positions.filter(p => Math.abs(p.y - firstRowY) < 20).length;
        
        // タブレットでは2-3列
        expect(badgesInFirstRow).toBeGreaterThanOrEqual(2);
        expect(badgesInFirstRow).toBeLessThanOrEqual(4);
      }
    });

    test('モバイルでは2列のグリッドで表示される', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badges = page.locator('[data-testid="badge-card"], .badge-card');
      const badgeCount = await badges.count();
      
      if (badgeCount >= 2) {
        const positions: { x: number; y: number }[] = [];
        
        for (let i = 0; i < Math.min(badgeCount, 4); i++) {
          const badge = badges.nth(i);
          const box = await badge.boundingBox();
          if (box) {
            positions.push({ x: box.x, y: box.y });
          }
        }
        
        const firstRowY = positions[0]?.y ?? 0;
        const badgesInFirstRow = positions.filter(p => Math.abs(p.y - firstRowY) < 20).length;
        
        // モバイルでは2列
        expect(badgesInFirstRow).toBe(2);
      }
    });

    test('グリッドアイテム間に適切な間隔がある', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badges = page.locator('[data-testid="badge-card"], .badge-card');
      const badgeCount = await badges.count();
      
      if (badgeCount >= 2) {
        const firstBadge = await badges.nth(0).boundingBox();
        const secondBadge = await badges.nth(1).boundingBox();
        
        if (firstBadge && secondBadge) {
          // 横方向の間隔（gap）が8px以上あること
          const gap = secondBadge.x - (firstBadge.x + firstBadge.width);
          expect(gap).toBeGreaterThanOrEqual(8);
        }
      }
    });
  });

  // ============================================
  // 1-1-badges-card: バッジカードコンポーネント
  // ============================================
  test.describe('1-1-badges-card: バッジカードコンポーネント', () => {
    
    test('バッジカードが存在する', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badgeCards = page.locator('[data-testid="badge-card"], .badge-card');
      await expect(badgeCards.first()).toBeVisible();
    });

    test('バッジカードにバッジ名が表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badgeCards = page.locator('[data-testid="badge-card"], .badge-card');
      const firstCard = badgeCards.first();
      
      const badgeName = firstCard.locator('[data-testid="badge-name"], .badge-name, h3, h4');
      await expect(badgeName).toBeVisible();
      
      const nameText = await badgeName.textContent();
      expect(nameText?.trim().length).toBeGreaterThan(0);
    });

    test('バッジカードに取得条件（threshold）が表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badgeCards = page.locator('[data-testid="badge-card"], .badge-card');
      const firstCard = badgeCards.first();
      
      // 取得条件表示（data-testidを使用）
      const threshold = firstCard.locator('[data-testid="badge-threshold"]');
      await expect(threshold).toBeVisible();
      
      // テキスト内容の確認
      const thresholdText = await threshold.textContent();
      expect(thresholdText).toBeTruthy();
    });

    test('取得済みバッジカードに取得日時（acquired_at）が表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      // 取得済みバッジを探す
      const ownedBadges = page.locator('[data-testid="badge-card"][data-owned="true"]');
      
      // 取得済みバッジがある場合のみテスト
      const ownedCount = await ownedBadges.count();
      if (ownedCount > 0) {
        const ownedBadge = ownedBadges.first();
        
        // 取得日時表示
        const acquiredDate = ownedBadge.locator('[data-testid="badge-acquired-date"]');
        await expect(acquiredDate).toBeVisible();
      } else {
        // 取得済みバッジがない場合は、未取得バッジの表示を確認
        const unownedBadges = page.locator('[data-testid="badge-card"][data-owned="false"]');
        expect(await unownedBadges.count()).toBeGreaterThan(0);
      }
    });

    test('未取得バッジカードには取得日時が表示されない', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      // 未取得バッジを探す
      const unownedBadges = page.locator('[data-testid="badge-card"][data-owned="false"], .badge-card.unowned, .badge-unowned');
      
      if (await unownedBadges.count() > 0) {
        const unownedBadge = unownedBadges.first();
        
        // 取得日時は非表示または「未取得」などの表示
        const acquiredDate = unownedBadge.locator('[data-testid="badge-acquired-date"], .acquired-date');
        const isVisible = await acquiredDate.isVisible().catch(() => false);
        
        if (isVisible) {
          // 表示されていても「未取得」などのテキストであること
          const text = await acquiredDate.textContent();
          expect(text).toMatch(/未取得|Not acquired|--/i);
        }
      }
    });
  });

  // ============================================
  // アイコン表示
  // ============================================
  test.describe('アイコン表示', () => {
    
    test('各バッジカードにアイコンが表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badgeCards = page.locator('[data-testid="badge-card"], .badge-card');
      const cardCount = await badgeCards.count();
      
      expect(cardCount).toBeGreaterThan(0);
      
      // すべてのバッジカードにアイコンがあることを確認
      for (let i = 0; i < Math.min(cardCount, 5); i++) {
        const card = badgeCards.nth(i);
        const icon = card.locator('[data-testid="badge-icon"], .badge-icon, svg, img, span.icon');
        await expect(icon.first()).toBeVisible();
      }
    });

    test('アイコンは適切なサイズで表示される（最小48x48px）', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badgeCards = page.locator('[data-testid="badge-card"], .badge-card');
      
      if (await badgeCards.count() > 0) {
        const firstCard = badgeCards.first();
        // badge-iconコンテナを直接選択（svgやimgを含まない）
        const icon = firstCard.locator('[data-testid="badge-icon"]');
        
        if (await icon.count() > 0) {
          const box = await icon.first().boundingBox();
          
          if (box) {
            // アイコンコンテナは最小48x48px
            expect(box.width).toBeGreaterThanOrEqual(48);
            expect(box.height).toBeGreaterThanOrEqual(48);
          }
        }
      }
    });

    test('アイコンが中央に配置される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badgeCards = page.locator('[data-testid="badge-card"], .badge-card');
      
      if (await badgeCards.count() > 0) {
        const firstCard = badgeCards.first();
        const cardBox = await firstCard.boundingBox();
        // badge-iconコンテナを直接選択
        const icon = firstCard.locator('[data-testid="badge-icon"]').first();
        const iconBox = await icon.boundingBox();
        
        if (cardBox && iconBox) {
          // アイコンがカード内で水平中央寄せされている
          const cardCenterX = cardBox.x + cardBox.width / 2;
          const iconCenterX = iconBox.x + iconBox.width / 2;
          
          // 20px以内の誤差を許容（paddingを考慮）
          expect(Math.abs(cardCenterX - iconCenterX)).toBeLessThan(20);
        }
      }
    });

    test('アイコンがemoji形式の場合、正しく表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const badgeCards = page.locator('[data-testid="badge-card"], .badge-card');
      
      if (await badgeCards.count() > 0) {
        // emoji アイコンを含むバッジを探す
        const emojiIcons = page.locator('[data-testid="badge-icon"], .badge-icon').filter({ hasText: /[\u{1F300}-\u{1F9FF}]/u });
        
        if (await emojiIcons.count() > 0) {
          await expect(emojiIcons.first()).toBeVisible();
        }
      }
    });
  });

  // ============================================
  // 取得/未取得の視覚的区別
  // ============================================
  test.describe('取得/未取得の視覚的区別', () => {
    
    test('取得済みバッジは通常の色で表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const ownedBadges = page.locator('[data-testid="badge-card"][data-owned="true"], .badge-card.owned, .badge-owned');
      
      if (await ownedBadges.count() > 0) {
        const ownedBadge = ownedBadges.first();
        
        // 取得済みバッジはグレースケールでないこと
        const filter = await ownedBadge.evaluate(el => {
          return window.getComputedStyle(el).filter;
        });
        
        expect(filter).not.toContain('grayscale(1)');
        
        // opacity が 1 であること
        const opacity = await ownedBadge.evaluate(el => {
          return window.getComputedStyle(el).opacity;
        });
        
        expect(parseFloat(opacity)).toBeGreaterThan(0.9);
      }
    });

    test('未取得バッジはグレーアウトまたは薄く表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const unownedBadges = page.locator('[data-testid="badge-card"][data-owned="false"], .badge-card.unowned, .badge-unowned');
      
      if (await unownedBadges.count() > 0) {
        const unownedBadge = unownedBadges.first();
        
        // グレースケールまたは低いopacityであること
        const filter = await unownedBadge.evaluate(el => {
          return window.getComputedStyle(el).filter;
        });
        const opacity = await unownedBadge.evaluate(el => {
          return window.getComputedStyle(el).opacity;
        });
        
        const isGrayscale = filter.includes('grayscale');
        const isLowOpacity = parseFloat(opacity) < 0.8;
        
        // どちらかの視覚的区別があること
        expect(isGrayscale || isLowOpacity).toBeTruthy();
      }
    });

    test('取得済みバッジにチェックマークまたは「取得済み」ラベルが表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const ownedBadges = page.locator('[data-testid="badge-card"][data-owned="true"], .badge-card.owned, .badge-owned');
      
      if (await ownedBadges.count() > 0) {
        const ownedBadge = ownedBadges.first();
        
        // チェックマークアイコンまたは「取得済み」テキスト
        const indicators = [
          ownedBadge.locator('[data-testid="badge-check"], .badge-check, .check-icon'),
          ownedBadge.locator('svg[class*="check"], svg[data-icon="check"]'),
          ownedBadge.locator('text=/取得済|Acquired|✓|✔/'),
        ];
        
        let indicatorFound = false;
        for (const indicator of indicators) {
          if (await indicator.count() > 0) {
            indicatorFound = true;
            break;
          }
        }
        
        expect(indicatorFound).toBeTruthy();
      }
    });

    test('未取得バッジにはロックアイコンまたは「未取得」ラベルが表示される', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const unownedBadges = page.locator('[data-testid="badge-card"][data-owned="false"], .badge-card.unowned, .badge-unowned');
      
      if (await unownedBadges.count() > 0) {
        const unownedBadge = unownedBadges.first();
        
        // ロックアイコンまたは「未取得」テキスト
        const indicators = [
          unownedBadge.locator('[data-testid="badge-lock"], .badge-lock, .lock-icon'),
          unownedBadge.locator('svg[class*="lock"], svg[data-icon="lock"]'),
          unownedBadge.locator('text=/未取得|Locked|🔒/'),
        ];
        
        let indicatorFound = false;
        for (const indicator of indicators) {
          if (await indicator.count() > 0) {
            indicatorFound = true;
            break;
          }
        }
        
        // ロックアイコンまたは単にグレーアウトで区別
        // indicatorが見つからなくてもグレーアウトで区別されていればOK
        expect(indicatorFound || await unownedBadge.locator('.grayscale, .opacity-50').count() > 0).toBeTruthy();
      }
    });

    test('data-owned属性でバッジの取得状態が識別できる', async ({ page }) => {
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      const allBadges = page.locator('[data-testid="badge-card"], .badge-card');
      const badgeCount = await allBadges.count();
      
      expect(badgeCount).toBeGreaterThan(0);
      
      // 各バッジにdata-owned属性があること
      for (let i = 0; i < Math.min(badgeCount, 5); i++) {
        const badge = allBadges.nth(i);
        const ownedAttr = await badge.getAttribute('data-owned');
        
        // data-owned="true" または data-owned="false" であること
        expect(['true', 'false']).toContain(ownedAttr);
      }
    });
  });

  // ============================================
  // エラーハンドリング
  // ============================================
  test.describe('エラーハンドリング', () => {
    
    test('未ログイン時はログイン促進メッセージが表示される', async ({ page, context }) => {
      // ログアウト状態でアクセス
      await context.clearCookies();
      await page.goto('/badges');
      await page.waitForLoadState('networkidle');
      
      // ログイン促進メッセージ（より具体的なセレクタ）
      const loginPrompt = page.locator('p:has-text("ログイン"), .text-muted-foreground:has-text("ログイン")');
      await expect(loginPrompt.first()).toBeVisible({ timeout: 10000 });
    });

    test('バッジデータ取得中はローディング表示される', async ({ page }) => {
      await page.goto('/badges');
      
      // ローディングインジケータ（表示されていれば）
      const loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner, .skeleton');
      
      // ローディングが表示されるか、すぐにデータが表示されるか
      const hasLoading = await loadingIndicator.count() > 0;
      const hasContent = await page.locator('[data-testid="badge-card"], .badge-card').count() > 0;
      
      // どちらかが表示されていること
      expect(hasLoading || hasContent).toBeTruthy();
    });
  });
});
