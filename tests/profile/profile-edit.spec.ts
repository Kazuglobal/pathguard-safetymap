import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS, hasE2ERegularCredentials } from '../utils/auth-helpers';

/**
 * TDD テスト: プロフィール編集機能 (Phase 1.2)
 *
 * タスク 1-2-profile-form: プロフィール編集フォームコンポーネント
 * タスク 1-2-profile-avatar: アバター画像アップロード
 * タスク 1-2-profile-integration: マイページへの統合
 *
 * 期待する機能:
 * - display_name / full_name 編集フォーム
 * - アバター画像アップロード (avatar_url)
 * - マイページへの統合
 *
 * RED Phase: これらのテストは全て失敗することが期待される
 */

// 認証を試みる（失敗しても続行）
async function tryLogin(page: any) {
  const authHelper = new AuthHelper(page);
  try {
    await authHelper.login(TEST_USERS.regular);
    return true;
  } catch {
    console.warn('Login failed, continuing without authentication');
    return false;
  }
}

test.describe('Profile Edit - Phase 1.2', () => {
  test.skip(
    !hasE2ERegularCredentials,
    'E2E_REGULAR_EMAIL と E2E_REGULAR_PASSWORD が未設定のため、認証必須テストをスキップします。'
  );

  // ============================================
  // 1-2-profile-form: 編集フォームコンポーネント
  // ============================================
  test.describe('1-2-profile-form: 編集フォームコンポーネント', () => {

    test('プロフィール編集フォームが表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      // 編集ボタンをクリック
      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集"), ' +
        '.profile-edit-button'
      );

      await expect(editButton).toBeVisible({ timeout: 10000 });
      await editButton.click();

      // 編集フォームが表示される
      const editForm = page.locator(
        '[data-testid="profile-edit-form"], ' +
        'form.profile-edit-form, ' +
        '[role="dialog"] form'
      );

      await expect(editForm).toBeVisible({ timeout: 10000 });
    });

    test('display_name入力フィールドが存在する', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const displayNameInput = page.locator(
        'input[name="display_name"], ' +
        'input[data-testid="display-name-input"], ' +
        '#display_name, ' +
        '#displayName'
      );

      await expect(displayNameInput).toBeVisible({ timeout: 10000 });
    });

    test('full_name入力フィールドが存在する', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const fullNameInput = page.locator(
        'input[name="full_name"], ' +
        'input[data-testid="full-name-input"], ' +
        '#full_name, ' +
        '#fullName'
      );

      await expect(fullNameInput).toBeVisible({ timeout: 10000 });
    });

    test('現在の値がフォームにプリフィルされる', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const displayNameInput = page.locator(
        'input[name="display_name"], ' +
        'input[data-testid="display-name-input"]'
      );

      await expect(displayNameInput).toBeVisible({ timeout: 10000 });
      const value = (await displayNameInput.inputValue()).trim();
      expect(value, 'display_name should be prefilled').not.toEqual('');
    });

    test('空のdisplay_nameでバリデーションエラー', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        // Wait for dialog to fully load profile data
        await page.waitForTimeout(2000);
      }

      const displayNameInput = page.locator(
        'input[name="display_name"], ' +
        'input[data-testid="display-name-input"]'
      );
      const submitButton = page.locator(
        '[data-testid="profile-save-button"], ' +
        'button:has-text("保存"), ' +
        'button[type="submit"]'
      );

      await expect(displayNameInput).toBeVisible({ timeout: 10000 });
      await expect(submitButton).toBeVisible({ timeout: 10000 });

      // First, fill with a non-empty value to trigger change detection
      await displayNameInput.fill('テスト');
      await page.waitForTimeout(200);

      // Now clear and leave a space (which should still fail validation as "whitespace only")
      // Or submit the form via Enter key to trigger validation
      await displayNameInput.fill('');
      await page.waitForTimeout(200);

      // Use keyboard to submit the form (press Enter in the input field)
      // This should attempt form submission and trigger validation
      await displayNameInput.press('Enter');

      // バリデーションエラーが表示される
      const errorMessage = page.locator('[role="alert"]').first();

      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('保存ボタンクリックでSupabase更新', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const displayNameInput = page.locator(
        'input[name="display_name"], ' +
        'input[data-testid="display-name-input"]'
      );
      const submitButton = page.locator(
        '[data-testid="profile-save-button"], ' +
        'button:has-text("保存"), ' +
        'button[type="submit"]'
      );

      if (await displayNameInput.count() > 0 && await submitButton.count() > 0) {
        // API リクエストを監視
        const apiRequests: string[] = [];
        page.on('request', request => {
          if (request.url().includes('profiles') || request.url().includes('supabase')) {
            apiRequests.push(request.url());
          }
        });

        const testName = `テストユーザー_${Date.now()}`;
        await displayNameInput.fill(testName);
        await submitButton.click();

        await page.waitForTimeout(2000);

        // Supabase APIへのリクエストがあったことを確認
        expect(apiRequests.length).toBeGreaterThan(0);
      }
    });

    test('保存成功でトースト通知', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const displayNameInput = page.locator(
        'input[name="display_name"], ' +
        'input[data-testid="display-name-input"]'
      );
      const submitButton = page.locator(
        '[data-testid="profile-save-button"], ' +
        'button:has-text("保存"), ' +
        'button[type="submit"]'
      );

      if (await displayNameInput.count() > 0 && await submitButton.count() > 0) {
        const testName = `成功テスト_${Date.now()}`;
        await displayNameInput.fill(testName);
        await submitButton.click();

        // トースト通知が表示される
        const toast = page.locator(
          '[data-testid="toast"], ' +
          '.toast, ' +
          '[role="status"], ' +
          'text=/保存しました|更新しました|成功|saved|updated/i'
        );

        await expect(toast).toBeVisible({ timeout: 10000 });
      }
    });

    test('保存失敗でエラー表示', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      // API をブロックしてエラーをシミュレート
      await page.route('**/profiles**', route => route.abort());

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const displayNameInput = page.locator(
        'input[name="display_name"], ' +
        'input[data-testid="display-name-input"]'
      );
      const submitButton = page.locator(
        '[data-testid="profile-save-button"], ' +
        'button:has-text("保存"), ' +
        'button[type="submit"]'
      );

      if (await displayNameInput.count() > 0 && await submitButton.count() > 0) {
        await displayNameInput.fill('エラーテスト');
        await submitButton.click();

        // エラーメッセージが表示される
        const errorMessage = page.locator(
          '[data-testid="profile-error"], ' +
          '.error, ' +
          '[role="alert"], ' +
          'text=/エラー|error|失敗|failed/i'
        );

        await expect(errorMessage).toBeVisible({ timeout: 10000 });
      }
    });
  });

  // ============================================
  // 1-2-profile-avatar: アバター画像アップロード
  // ============================================
  test.describe('1-2-profile-avatar: アバター画像アップロード', () => {

    test('アバターアップロードエリアが表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      // アバターアップロードエリア
      const avatarUpload = page.locator(
        '[data-testid="avatar-upload"], ' +
        '.avatar-upload, ' +
        'input[type="file"][accept*="image"], ' +
        '[data-testid="avatar-dropzone"]'
      );

      await expect(avatarUpload).toBeVisible({ timeout: 10000 });
    });

    test('現在のアバターが表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      // アバター画像またはプレースホルダー
      const avatar = page.locator(
        '[data-testid="user-avatar"], ' +
        '.avatar, ' +
        '.user-avatar, ' +
        'img[alt*="アバター"], ' +
        'img[alt*="avatar"]'
      );

      await expect(avatar).toBeVisible({ timeout: 10000 });
    });

    test('画像選択でプレビュー表示', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const fileInput = page.locator(
        'input[type="file"][accept*="image"], ' +
        '[data-testid="avatar-file-input"]'
      );

      if (await fileInput.count() > 0) {
        // テスト用のダミー画像を作成
        const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

        await fileInput.setInputFiles({
          name: 'test-avatar.gif',
          mimeType: 'image/gif',
          buffer: buffer,
        });

        // プレビュー画像が表示される
        const preview = page.locator(
          '[data-testid="avatar-preview"], ' +
          '.avatar-preview, ' +
          'img.preview'
        );

        await expect(preview).toBeVisible({ timeout: 10000 });
      }
    });

    test('無効なファイル形式でエラー', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const fileInput = page.locator(
        'input[type="file"][accept*="image"], ' +
        '[data-testid="avatar-file-input"]'
      );

      if (await fileInput.count() > 0) {
        // 無効なファイル形式
        await fileInput.setInputFiles({
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('invalid file'),
        });

        // エラーメッセージが表示される
        const errorMessage = page.locator(
          '[data-testid="avatar-error"], ' +
          '.error, ' +
          '[role="alert"], ' +
          'text=/形式|format|対応.*ない|invalid/i'
        );

        await expect(errorMessage).toBeVisible({ timeout: 5000 });
      }
    });

    test('大きすぎるファイルでエラー (5MB制限)', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const fileInput = page.locator(
        'input[type="file"][accept*="image"], ' +
        '[data-testid="avatar-file-input"]'
      );

      if (await fileInput.count() > 0) {
        // 6MB のダミーデータ
        const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');

        await fileInput.setInputFiles({
          name: 'large-image.png',
          mimeType: 'image/png',
          buffer: largeBuffer,
        });

        // サイズ制限エラーが表示される
        const errorMessage = page.locator(
          '[data-testid="avatar-error"], ' +
          '.error, ' +
          '[role="alert"], ' +
          'text=/サイズ|size|5MB|大きい|too large/i'
        );

        await expect(errorMessage).toBeVisible({ timeout: 5000 });
      }
    });

    test('画像保存でStorage更新', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      // Storage API へのリクエストを監視
      const storageRequests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('storage') || request.url().includes('avatars')) {
          storageRequests.push(request.url());
        }
      });

      const fileInput = page.locator(
        'input[type="file"][accept*="image"], ' +
        '[data-testid="avatar-file-input"]'
      );
      const submitButton = page.locator(
        '[data-testid="profile-save-button"], ' +
        'button:has-text("保存"), ' +
        'button[type="submit"]'
      );

      if (await fileInput.count() > 0 && await submitButton.count() > 0) {
        const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

        await fileInput.setInputFiles({
          name: 'test-avatar.gif',
          mimeType: 'image/gif',
          buffer: buffer,
        });

        await submitButton.click();
        await page.waitForTimeout(3000);

        // Storage API へのリクエストがあった
        expect(storageRequests.length).toBeGreaterThan(0);
      }
    });

    test('保存後にavatar_url更新', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      // profiles テーブルへの更新リクエストを監視
      let profileUpdateRequest: any = null;
      page.on('request', request => {
        if (request.url().includes('profiles') && request.method() === 'PATCH') {
          profileUpdateRequest = request;
        }
      });

      const fileInput = page.locator(
        'input[type="file"][accept*="image"], ' +
        '[data-testid="avatar-file-input"]'
      );
      const submitButton = page.locator(
        '[data-testid="profile-save-button"], ' +
        'button:has-text("保存"), ' +
        'button[type="submit"]'
      );

      if (await fileInput.count() > 0 && await submitButton.count() > 0) {
        const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

        await fileInput.setInputFiles({
          name: 'test-avatar.gif',
          mimeType: 'image/gif',
          buffer: buffer,
        });

        await submitButton.click();
        await page.waitForTimeout(3000);

        // profiles テーブルへの更新リクエストがあった
        expect(profileUpdateRequest).not.toBeNull();
      }
    });
  });

  // ============================================
  // 1-2-profile-integration: マイページ統合
  // ============================================
  test.describe('1-2-profile-integration: マイページ統合', () => {

    test('マイページに編集ボタンが表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集"), ' +
        '.profile-edit-button'
      );

      await expect(editButton).toBeVisible({ timeout: 10000 });
    });

    test('編集ボタンクリックでフォーム表示', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      await expect(editButton).toBeVisible({ timeout: 10000 });
      await editButton.click();

      // モーダル/シートが開く
      const modal = page.locator(
        '[role="dialog"], ' +
        '.modal, ' +
        '[data-testid="profile-edit-modal"], ' +
        '.sheet'
      );

      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('更新後にマイページの表示が更新される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);
      }

      const displayNameInput = page.locator(
        'input[name="display_name"], ' +
        'input[data-testid="display-name-input"]'
      );
      const submitButton = page.locator(
        '[data-testid="profile-save-button"], ' +
        'button:has-text("保存"), ' +
        'button[type="submit"]'
      );

      if (await displayNameInput.count() > 0 && await submitButton.count() > 0) {
        const testName = `更新テスト_${Date.now()}`;
        await displayNameInput.fill(testName);
        await submitButton.click();

        // モーダルが閉じる
        await page.waitForTimeout(2000);

        // マイページに新しい名前が反映される
        const userNameDisplay = page.locator(
          `text=${testName}, ` +
          `[data-testid="user-name"]:has-text("${testName}")`
        );

        await expect(userNameDisplay).toBeVisible({ timeout: 10000 });
      }
    });

    test('キャンセルボタンで編集モーダルが閉じる', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[role="dialog"], .modal, .sheet');
        await expect(modal).toBeVisible();

        // キャンセルボタンをクリック
        const cancelButton = page.locator(
          '[data-testid="profile-cancel-button"], ' +
          'button:has-text("キャンセル"), ' +
          'button:has-text("閉じる"), ' +
          '[aria-label="Close"]'
        );

        if (await cancelButton.count() > 0) {
          await cancelButton.click();
          await page.waitForTimeout(500);

          // モーダルが閉じる
          await expect(modal).not.toBeVisible();
        }
      }
    });

    test('編集中に変更がない場合は保存ボタンが無効化される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);

        const submitButton = page.locator(
          '[data-testid="profile-save-button"], ' +
          'button:has-text("保存"), ' +
          'button[type="submit"]'
        );

        if (await submitButton.count() > 0) {
          // 変更なしの場合、保存ボタンが無効化されている（オプション）
          const isDisabled = await submitButton.isDisabled();

          expect(isDisabled, 'save button should be disabled when no changes').toBeTruthy();
        }
      }
    });

    test('マイページからログアウトできる', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const mypageLogoutButton = page.locator(
        '[data-testid="mypage-logout-button"], ' +
        'button[aria-label="マイページからログアウト"]'
      );

      await expect(mypageLogoutButton).toBeVisible({ timeout: 10000 });
      await mypageLogoutButton.click();

      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });
  });

  // ============================================
  // アクセシビリティ
  // ============================================
  test.describe('アクセシビリティ', () => {

    test('フォームフィールドにラベルが関連付けられている', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);

        const displayNameInput = page.locator(
          'input[name="display_name"], ' +
          'input[data-testid="display-name-input"]'
        );

        if (await displayNameInput.count() > 0) {
          const hasLabel = await displayNameInput.evaluate((el: HTMLInputElement) => {
            const id = el.id;
            const hasLabelFor = id && document.querySelector(`label[for="${id}"]`) !== null;
            const hasAriaLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
            const hasPlaceholder = el.hasAttribute('placeholder');
            const isWrappedByLabel = el.closest('label') !== null;
            return hasLabelFor || hasAriaLabel || hasPlaceholder || isWrappedByLabel;
          });

          expect(hasLabel).toBeTruthy();
        }
      }
    });

    test('モーダルにフォーカストラップが設定されている', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[role="dialog"], .modal, .sheet');

        if (await modal.count() > 0) {
          // Tab キーでフォーカスがモーダル内に留まる
          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);

          const activeElement = await page.evaluate(() => {
            return document.activeElement?.closest('[role="dialog"], .modal, .sheet') !== null;
          });

          expect(activeElement).toBeTruthy();
        }
      }
    });

    test('エラーメッセージがスクリーンリーダーで読み上げられる', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      expect(loggedIn, 'Login failed for test user').toBeTruthy();

      await page.goto('/mypage');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const editButton = page.locator(
        '[data-testid="profile-edit-button"], ' +
        'button:has-text("プロフィール編集"), ' +
        'button:has-text("編集")'
      );

      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(500);

        const displayNameInput = page.locator(
          'input[name="display_name"], ' +
          'input[data-testid="display-name-input"]'
        );
        const submitButton = page.locator(
          '[data-testid="profile-save-button"], ' +
          'button:has-text("保存"), ' +
          'button[type="submit"]'
        );

        if (await displayNameInput.count() > 0 && await submitButton.count() > 0) {
          await displayNameInput.fill('');
          await page.waitForTimeout(100); // Wait for React state update
          await submitButton.click();

          await page.waitForTimeout(500);

          // エラーメッセージが role="alert" または aria-live を持つ
          const errorWithAriaLive = page.locator(
            '[role="alert"], ' +
            '[aria-live="polite"], ' +
            '[aria-live="assertive"]'
          );

          const hasAriaLive = await errorWithAriaLive.count() > 0;

          expect(hasAriaLive, 'error should be announced with aria-live or role="alert"').toBeTruthy();
        }
      }
    });
  });
});
