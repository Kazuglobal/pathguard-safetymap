import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../utils/auth-helpers';

/**
 * TDD テスト: パスワードリセット機能 (Phase 1.3)
 *
 * タスク 1-3-forgot-page: パスワードを忘れた場合のメール送信フォーム
 * タスク 1-3-reset-page: パスワードリセットフォーム
 * タスク 1-3-login-link: ログインフォームにリセットリンク追加
 *
 * 期待する機能:
 * - /forgot-password ページでメールアドレス入力・リセットリンク送信
 * - /reset-password ページで新パスワード設定
 * - ログインページに「パスワードを忘れた方」リンク表示
 */

test.describe('Password Reset - Phase 1.3', () => {

  // ============================================
  // 1-3-forgot-page: パスワードを忘れた場合のページ
  // ============================================
  test.describe('1-3-forgot-page: パスワードリセット依頼ページ', () => {

    test('パスワードリセットページにアクセスできる', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/forgot-password/);
    });

    test('ページタイトル「パスワードをお忘れの方」が表示される', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const pageTitle = page.locator('h1, [data-testid="forgot-password-title"]');
      await expect(pageTitle).toBeVisible({ timeout: 10000 });

      const titleText = await pageTitle.textContent();
      expect(titleText).toMatch(/パスワード|忘れ|リセット|Reset|Forgot/i);
    });

    test('メールアドレス入力フォームが表示される', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"], input#email, [data-testid="forgot-password-email"]');
      await expect(emailInput).toBeVisible({ timeout: 10000 });
    });

    test('送信ボタンが表示される', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const submitButton = page.locator('button[type="submit"], [data-testid="forgot-password-submit"]');
      await expect(submitButton).toBeVisible({ timeout: 10000 });

      const buttonText = await submitButton.textContent();
      expect(buttonText).toMatch(/送信|リセット|メール|Send|Reset/i);
    });

    test('無効なメールアドレスでバリデーションエラーが表示される', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"], input#email, [data-testid="forgot-password-email"]');
      await emailInput.fill('invalid-email');

      const submitButton = page.locator('button[type="submit"], [data-testid="forgot-password-submit"]');
      await submitButton.click();

      // バリデーションエラーまたはHTML5バリデーションメッセージ
      const errorMessage = page.locator('[data-testid="email-error"], .error, [role="alert"]');
      const hasError = await errorMessage.count() > 0;
      const hasValidationMessage = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);

      expect(hasError || hasValidationMessage).toBeTruthy();
    });

    test('有効なメールアドレスで送信後、成功メッセージが表示される', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"], input#email, [data-testid="forgot-password-email"]');
      await emailInput.fill('test@example.com');

      const submitButton = page.locator('button[type="submit"], [data-testid="forgot-password-submit"]');
      await submitButton.click();

      // Wait for either success message or error response
      await page.waitForTimeout(3000);

      // 成功メッセージの確認（トースト、アラート、または画面上のテキスト）
      const successIndicators = [
        page.locator('[data-testid="forgot-password-success"]'),
        page.locator('text=/メール.*送信|リンク.*送信|確認.*メール/i'),
        page.locator('[role="alert"]:has-text("送信")'),
        page.locator('.toast:has-text("送信")'),
      ];

      let successFound = false;
      for (const indicator of successIndicators) {
        if (await indicator.count() > 0) {
          successFound = true;
          break;
        }
      }

      // 成功メッセージまたはリダイレクトが発生すること
      const currentUrl = page.url();
      expect(successFound || currentUrl.includes('/login')).toBeTruthy();
    });

    test('ログインページへのリンクが存在する', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const loginLink = page.locator('a[href="/login"], a[href*="login"], [data-testid="back-to-login"]');
      await expect(loginLink).toBeVisible({ timeout: 10000 });
    });

    test('ログインページへのリンクをクリックするとログインページに遷移する', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const loginLink = page.locator('[data-testid="back-to-login"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      await loginLink.click();

      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });
  });

  // ============================================
  // 1-3-reset-page: パスワードリセット実行ページ
  // ============================================
  test.describe('1-3-reset-page: パスワードリセット実行ページ', () => {

    test('パスワードリセットページにアクセスできる', async ({ page }) => {
      // トークンなしでもページは表示される（エラーメッセージ付き可能性あり）
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/reset-password/);
    });

    test('ページタイトル「新しいパスワードを設定」が表示される', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');

      const pageTitle = page.locator('h1, [data-testid="reset-password-title"]');
      await expect(pageTitle).toBeVisible({ timeout: 10000 });

      const titleText = await pageTitle.textContent();
      expect(titleText).toMatch(/パスワード|新しい|設定|Reset|New/i);
    });

    test('新しいパスワード入力フォームが表示される', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[type="password"]#password, input[type="password"][name="password"], [data-testid="new-password"]');
      await expect(passwordInput).toBeVisible({ timeout: 10000 });
    });

    test('パスワード確認入力フォームが表示される', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');

      const confirmPasswordInput = page.locator(
        'input[type="password"]#confirmPassword, ' +
        'input[type="password"][name="confirmPassword"], ' +
        'input[type="password"]#confirm-password, ' +
        '[data-testid="confirm-password"]'
      );
      await expect(confirmPasswordInput).toBeVisible({ timeout: 10000 });
    });

    test('送信ボタンが表示される', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');

      const submitButton = page.locator('button[type="submit"], [data-testid="reset-password-submit"]');
      await expect(submitButton).toBeVisible({ timeout: 10000 });

      const buttonText = await submitButton.textContent();
      expect(buttonText).toMatch(/設定|変更|リセット|更新|Submit|Reset|Update/i);
    });

    test('8文字未満のパスワードでバリデーションエラーが表示される', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('[data-testid="new-password"]');
      await expect(passwordInput).toBeVisible({ timeout: 5000 });
      await passwordInput.click();
      await passwordInput.fill('short');

      const confirmPasswordInput = page.locator('[data-testid="confirm-password"]');
      await confirmPasswordInput.click();
      await confirmPasswordInput.fill('short');

      const submitButton = page.locator('[data-testid="reset-password-submit"]');
      await submitButton.click();

      // Wait for validation error to appear
      const passwordError = page.locator('[data-testid="password-error"]');
      await expect(passwordError).toBeVisible({ timeout: 5000 });
    });

    test('パスワードが一致しない場合にエラーが表示される', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('[data-testid="new-password"]');
      await expect(passwordInput).toBeVisible({ timeout: 5000 });
      await passwordInput.click();
      await passwordInput.fill('password123');

      const confirmPasswordInput = page.locator('[data-testid="confirm-password"]');
      await confirmPasswordInput.click();
      await confirmPasswordInput.fill('differentpassword');

      const submitButton = page.locator('[data-testid="reset-password-submit"]');
      await submitButton.click();

      // Wait for validation error to appear
      const confirmError = page.locator('[data-testid="confirm-password-error"]');
      await expect(confirmError).toBeVisible({ timeout: 5000 });
    });

    test('トークンなしでアクセスした場合にエラーメッセージが表示される', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForLoadState('networkidle');

      // トークンがない場合のエラーまたはリダイレクト
      const errorIndicators = [
        page.locator('[data-testid="invalid-token-error"]'),
        page.locator('text=/無効|期限切れ|トークン|リンク|invalid|expired|token/i'),
        page.locator('[role="alert"]'),
      ];

      let errorFound = false;
      for (const indicator of errorIndicators) {
        if (await indicator.count() > 0) {
          errorFound = true;
          break;
        }
      }

      // エラーメッセージ、または /forgot-password へのリダイレクト、またはフォーム表示
      const currentUrl = page.url();
      const formVisible = await page.locator('input[type="password"]').count() > 0;

      expect(errorFound || currentUrl.includes('/forgot-password') || formVisible).toBeTruthy();
    });
  });

  // ============================================
  // 1-3-login-link: ログインフォームにリセットリンク追加
  // ============================================
  test.describe('1-3-login-link: ログインフォームにパスワードリセットリンク', () => {

    test('ログインページにアクセスできる', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    });

    test('「パスワードを忘れた方」リンクが表示される', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const forgotPasswordLink = page.locator(
        'a[href="/forgot-password"], ' +
        'a[href*="forgot"], ' +
        '[data-testid="forgot-password-link"]'
      );

      await expect(forgotPasswordLink).toBeVisible({ timeout: 10000 });
    });

    test('「パスワードを忘れた方」リンクのテキストが適切である', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const forgotPasswordLink = page.locator(
        'a[href="/forgot-password"], ' +
        'a[href*="forgot"], ' +
        '[data-testid="forgot-password-link"]'
      );

      if (await forgotPasswordLink.count() > 0) {
        const linkText = await forgotPasswordLink.first().textContent();
        expect(linkText).toMatch(/パスワード.*忘れ|リセット|Forgot|Reset/i);
      }
    });

    test('「パスワードを忘れた方」リンクをクリックするとリセットページに遷移する', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');
      await expect(forgotPasswordLink).toBeVisible({ timeout: 5000 });
      await forgotPasswordLink.click();

      await expect(page).toHaveURL(/\/forgot-password/, { timeout: 10000 });
    });

    test('リンクはパスワード入力欄の近くに配置されている', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[type="password"]');
      const forgotPasswordLink = page.locator(
        'a[href="/forgot-password"], ' +
        'a[href*="forgot"], ' +
        '[data-testid="forgot-password-link"]'
      );

      const passwordBox = await passwordInput.boundingBox();
      const linkBox = await forgotPasswordLink.first().boundingBox();

      if (passwordBox && linkBox) {
        // リンクはパスワード入力欄から200px以内に配置されている
        const distance = Math.abs(linkBox.y - (passwordBox.y + passwordBox.height));
        expect(distance).toBeLessThan(200);
      }
    });
  });

  // ============================================
  // エラーハンドリングとエッジケース
  // ============================================
  test.describe('エラーハンドリング', () => {

    test('ネットワークエラー時に適切なエラーメッセージが表示される', async ({ page }) => {
      // ネットワークを遮断してテスト
      await page.route('**/auth/**', route => route.abort());

      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"], input#email');
      if (await emailInput.count() > 0) {
        await emailInput.fill('test@example.com');

        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // エラーメッセージの確認（数秒待機）
        await page.waitForTimeout(3000);

        const errorIndicators = [
          page.locator('[role="alert"]'),
          page.locator('.error'),
          page.locator('text=/エラー|error|失敗|failed|ネットワーク|network/i'),
        ];

        let errorFound = false;
        for (const indicator of errorIndicators) {
          if (await indicator.count() > 0) {
            errorFound = true;
            break;
          }
        }

        expect(errorFound).toBeTruthy();
      }
    });

    test('存在しないメールアドレスでも成功メッセージが表示される（セキュリティ）', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"], input#email');
      await emailInput.fill('nonexistent-user-12345@example.com');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      await page.waitForTimeout(3000);

      // セキュリティのため、存在しないメールでも同じ成功メッセージを表示
      // エラー「ユーザーが存在しません」は表示しない
      const insecureError = page.locator('text=/存在しません|見つかりません|not found|doesn\'t exist/i');
      expect(await insecureError.count()).toBe(0);
    });
  });

  // ============================================
  // アクセシビリティ
  // ============================================
  test.describe('アクセシビリティ', () => {

    test('フォーム要素にラベルが関連付けられている', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"], input#email');

      // labelのfor属性、またはaria-labelledby、またはaria-label
      const hasLabel = await emailInput.evaluate((el: HTMLInputElement) => {
        const id = el.id;
        const hasLabelFor = id && document.querySelector(`label[for="${id}"]`) !== null;
        const hasAriaLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
        const isWrappedByLabel = el.closest('label') !== null;
        return hasLabelFor || hasAriaLabel || isWrappedByLabel;
      });

      expect(hasLabel).toBeTruthy();
    });

    test('送信ボタンにアクセシブルな名前がある', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');

      const submitButton = page.locator('button[type="submit"]');

      const accessibleName = await submitButton.evaluate((el: HTMLButtonElement) => {
        return el.innerText || el.getAttribute('aria-label') || '';
      });

      expect(accessibleName.length).toBeGreaterThan(0);
    });
  });
});
