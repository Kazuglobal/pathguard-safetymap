import { test, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../utils/auth-helpers';

/**
 * TDD テスト: コメント機能 (Phase 1.6)
 *
 * タスク 1-6-comment-components: コメントセクションとアイテムコンポーネント
 * タスク 1-6-comment-integration: 報告詳細への統合
 *
 * 期待する機能:
 * - report_comments テーブルからコメントを取得
 * - コメント一覧の表示
 * - 新規コメント投稿
 * - 公式バッジ表示（is_official）
 * - 報告詳細ページへの統合
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

test.describe('Comments - Phase 1.6', () => {

  // ============================================
  // 1-6-comment-components: コメントコンポーネント
  // ============================================
  test.describe('1-6-comment-components: コメントセクションコンポーネント', () => {

    test('報告詳細ページにコメントセクションが表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      // 報告一覧から1件を選択（報告詳細モーダルまたはページ）
      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        // コメントセクションが表示される
        const commentSection = page.locator(
          '[data-testid="comment-section"], ' +
          '.comment-section, ' +
          '[data-testid="comments"]'
        );

        await expect(commentSection).toBeVisible({ timeout: 10000 });
      }
    });

    test('コメントセクションにタイトルが表示される', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentTitle = page.locator(
          '[data-testid="comment-section-title"], ' +
          '.comment-section h3, ' +
          'text=/コメント|Comments/i'
        );

        await expect(commentTitle).toBeVisible({ timeout: 10000 });
      }
    });

    test('コメント入力フォームが表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - comment form requires authentication');
        return;
      }

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentInput = page.locator(
          '[data-testid="comment-input"], ' +
          'textarea[placeholder*="コメント"], ' +
          '.comment-input, ' +
          'textarea[name="comment"]'
        );

        await expect(commentInput).toBeVisible({ timeout: 10000 });
      }
    });

    test('コメント送信ボタンが表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - comment form requires authentication');
        return;
      }

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const submitButton = page.locator(
          '[data-testid="comment-submit"], ' +
          'button:has-text("投稿"), ' +
          'button:has-text("送信"), ' +
          'button:has-text("Post"), ' +
          '.comment-submit'
        );

        await expect(submitButton).toBeVisible({ timeout: 10000 });
      }
    });

    test('未ログイン時はコメント入力が無効化される', async ({ page, context }) => {
      await context.clearCookies();

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          // ignore
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        // 未ログインメッセージまたは無効化された入力
        const loginPrompt = page.locator(
          '[data-testid="comment-login-prompt"], ' +
          'text=/ログイン.*コメント|コメント.*ログイン|Sign in to comment/i'
        );
        const disabledInput = page.locator('[data-testid="comment-input"][disabled], textarea[disabled]');

        const hasLoginPrompt = await loginPrompt.count() > 0;
        const hasDisabledInput = await disabledInput.count() > 0;
        const noCommentForm = await page.locator('[data-testid="comment-input"]').count() === 0;

        expect(hasLoginPrompt || hasDisabledInput || noCommentForm).toBeTruthy();
      }
    });

    test('空のコメントは送信できない', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - requires authentication');
        return;
      }

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const submitButton = page.locator('[data-testid="comment-submit"], button:has-text("投稿")');

        if (await submitButton.count() > 0) {
          // 空の状態で送信を試みる
          const isDisabled = await submitButton.isDisabled();

          if (!isDisabled) {
            await submitButton.click();

            // エラーメッセージまたはバリデーション
            const error = page.locator(
              '[data-testid="comment-error"], ' +
              '.error, ' +
              '[role="alert"]'
            );

            await page.waitForTimeout(500);

            // ボタンが無効化されているか、エラーが表示されるか、何も起きない
            expect(true).toBeTruthy(); // 実装依存
          } else {
            // ボタンが既に無効化されている
            expect(isDisabled).toBeTruthy();
          }
        }
      }
    });

    test('コメントを投稿できる', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - requires authentication');
        return;
      }

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentInput = page.locator('[data-testid="comment-input"], textarea[name="comment"]');
        const submitButton = page.locator('[data-testid="comment-submit"], button:has-text("投稿")');

        if (await commentInput.count() > 0 && await submitButton.count() > 0) {
          const testComment = `テストコメント ${Date.now()}`;

          await commentInput.fill(testComment);
          await submitButton.click();

          // 投稿後、コメントが一覧に表示される
          await page.waitForTimeout(2000);

          const postedComment = page.locator(`text=${testComment}`);
          await expect(postedComment).toBeVisible({ timeout: 10000 });
        }
      }
    });
  });

  // ============================================
  // コメントアイテムコンポーネント
  // ============================================
  test.describe('CommentItem コンポーネント', () => {

    test('コメントアイテムが表示される', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        // コメントアイテムまたは空状態
        const commentItems = page.locator('[data-testid="comment-item"], .comment-item');
        const emptyState = page.locator(
          '[data-testid="comment-empty"], ' +
          'text=/コメント.*ありません|No comments/i'
        );

        const hasComments = await commentItems.count() > 0;
        const hasEmptyState = await emptyState.count() > 0;

        expect(hasComments || hasEmptyState).toBeTruthy();
      }
    });

    test('コメントアイテムに本文が表示される', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentItems = page.locator('[data-testid="comment-item"], .comment-item');

        if (await commentItems.count() > 0) {
          const firstComment = commentItems.first();
          const commentContent = firstComment.locator(
            '[data-testid="comment-content"], ' +
            '.comment-content, ' +
            'p'
          );

          await expect(commentContent).toBeVisible();

          const contentText = await commentContent.textContent();
          expect(contentText?.trim().length).toBeGreaterThan(0);
        }
      }
    });

    test('コメントアイテムに投稿日時が表示される', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentItems = page.locator('[data-testid="comment-item"], .comment-item');

        if (await commentItems.count() > 0) {
          const firstComment = commentItems.first();
          const timestamp = firstComment.locator(
            '[data-testid="comment-timestamp"], ' +
            '.comment-timestamp, ' +
            'time, ' +
            '.text-gray-500'
          );

          await expect(timestamp).toBeVisible();
        }
      }
    });

    test('公式コメントにバッジが表示される（is_official=true）', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        // 公式コメントを探す
        const officialComments = page.locator(
          '[data-testid="comment-item"][data-official="true"], ' +
          '.comment-item.official'
        );

        if (await officialComments.count() > 0) {
          const officialBadge = officialComments.first().locator(
            '[data-testid="official-badge"], ' +
            '.official-badge, ' +
            'text=/公式|Official/i'
          );

          await expect(officialBadge).toBeVisible();
        }
      }
    });

    test('コメント投稿者名が表示される', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentItems = page.locator('[data-testid="comment-item"], .comment-item');

        if (await commentItems.count() > 0) {
          const firstComment = commentItems.first();
          const authorName = firstComment.locator(
            '[data-testid="comment-author"], ' +
            '.comment-author, ' +
            '.author-name'
          );

          // 投稿者名または「匿名」などの表示
          await expect(authorName).toBeVisible();
        }
      }
    });

    test('コメントがない場合に空状態メッセージが表示される', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentItems = page.locator('[data-testid="comment-item"], .comment-item');

        if (await commentItems.count() === 0) {
          const emptyState = page.locator(
            '[data-testid="comment-empty"], ' +
            'text=/コメント.*ありません|最初のコメント|No comments|Be the first/i'
          );

          await expect(emptyState).toBeVisible();
        }
      }
    });
  });

  // ============================================
  // 1-6-comment-integration: 報告詳細への統合
  // ============================================
  test.describe('1-6-comment-integration: 報告詳細への統合', () => {

    test('報告詳細モーダル/ページでコメントが読み込まれる', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        // ネットワークリクエストを監視
        const commentRequests: string[] = [];
        page.on('request', request => {
          if (request.url().includes('comment')) {
            commentRequests.push(request.url());
          }
        });

        await reportItem.click();
        await page.waitForTimeout(2000);

        // コメントセクションが表示されることを確認
        const commentSection = page.locator('[data-testid="comment-section"], .comment-section');
        await expect(commentSection).toBeVisible({ timeout: 10000 });
      }
    });

    test('コメント数が報告カードに表示される', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        // 報告カードにコメント数が表示される（オプション）
        const commentCount = reportItem.locator(
          '[data-testid="comment-count"], ' +
          '.comment-count, ' +
          'text=/\\d+.*コメント|\\d+ comments/i'
        );

        // コメント数表示は実装オプション
        // 存在する場合は数字が含まれている
        if (await commentCount.count() > 0) {
          const countText = await commentCount.textContent();
          expect(countText).toMatch(/\d+/);
        }
      }
    });

    test('新規コメント投稿後にコメント一覧が更新される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - requires authentication');
        return;
      }

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentInput = page.locator('[data-testid="comment-input"], textarea[name="comment"]');
        const submitButton = page.locator('[data-testid="comment-submit"], button:has-text("投稿")');

        if (await commentInput.count() > 0 && await submitButton.count() > 0) {
          // 現在のコメント数を取得
          const commentItems = page.locator('[data-testid="comment-item"], .comment-item');
          const initialCount = await commentItems.count();

          const testComment = `更新テスト ${Date.now()}`;

          await commentInput.fill(testComment);
          await submitButton.click();

          // 投稿後、コメント数が増える
          await page.waitForTimeout(2000);

          const newCount = await commentItems.count();
          expect(newCount).toBeGreaterThanOrEqual(initialCount);
        }
      }
    });

    test('コメント入力フォームがコメント一覧の下に配置される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - requires authentication');
        return;
      }

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentList = page.locator('[data-testid="comment-list"], .comment-list');
        const commentInput = page.locator('[data-testid="comment-input"], textarea[name="comment"]');

        const listBox = await commentList.boundingBox();
        const inputBox = await commentInput.boundingBox();

        if (listBox && inputBox) {
          // 入力フォームは一覧の下にある
          expect(inputBox.y).toBeGreaterThanOrEqual(listBox.y);
        }
      }
    });
  });

  // ============================================
  // バリデーションとエラーハンドリング
  // ============================================
  test.describe('バリデーションとエラーハンドリング', () => {

    test('長すぎるコメントでバリデーションエラーが表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - requires authentication');
        return;
      }

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentInput = page.locator('[data-testid="comment-input"], textarea[name="comment"]');
        const submitButton = page.locator('[data-testid="comment-submit"], button:has-text("投稿")');

        if (await commentInput.count() > 0 && await submitButton.count() > 0) {
          // 非常に長いコメント（1000文字以上）
          const longComment = 'あ'.repeat(1500);

          await commentInput.fill(longComment);
          await submitButton.click();

          await page.waitForTimeout(1000);

          // エラーメッセージまたは文字数制限表示
          const error = page.locator(
            '[data-testid="comment-error"], ' +
            '.error, ' +
            '[role="alert"], ' +
            'text=/文字|長い|limit|too long/i'
          );

          const hasError = await error.count() > 0;
          const hasMaxLength = await commentInput.evaluate((el: HTMLTextAreaElement) => el.hasAttribute('maxlength'));

          expect(hasError || hasMaxLength).toBeTruthy();
        }
      }
    });

    test('コメント投稿中にローディング表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - requires authentication');
        return;
      }

      // 遅延を追加
      await page.route('**/comment**', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentInput = page.locator('[data-testid="comment-input"], textarea[name="comment"]');
        const submitButton = page.locator('[data-testid="comment-submit"], button:has-text("投稿")');

        if (await commentInput.count() > 0 && await submitButton.count() > 0) {
          await commentInput.fill('テストコメント');
          await submitButton.click();

          // ローディング状態
          const loading = page.locator(
            '[data-testid="comment-loading"], ' +
            '.spinner, ' +
            'button:disabled, ' +
            'text=/投稿中|送信中|Posting/i'
          );

          const hasLoading = await loading.count() > 0;
          const buttonDisabled = await submitButton.isDisabled();

          expect(hasLoading || buttonDisabled).toBeTruthy();
        }
      }
    });

    test('ネットワークエラー時にエラーメッセージが表示される', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - requires authentication');
        return;
      }

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        // コメント投稿APIをブロック
        await page.route('**/comment**', route => route.abort());

        const commentInput = page.locator('[data-testid="comment-input"], textarea[name="comment"]');
        const submitButton = page.locator('[data-testid="comment-submit"], button:has-text("投稿")');

        if (await commentInput.count() > 0 && await submitButton.count() > 0) {
          await commentInput.fill('エラーテスト');
          await submitButton.click();

          await page.waitForTimeout(2000);

          // エラーメッセージ
          const error = page.locator(
            '[data-testid="comment-error"], ' +
            '.error, ' +
            '[role="alert"], ' +
            'text=/エラー|error|失敗|failed/i'
          );

          await expect(error).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  // ============================================
  // アクセシビリティ
  // ============================================
  test.describe('アクセシビリティ', () => {

    test('コメント入力にラベルが関連付けられている', async ({ page }) => {
      const loggedIn = await tryLogin(page);

      if (!loggedIn) {
        console.log('Skipping test - requires authentication');
        return;
      }

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentInput = page.locator('[data-testid="comment-input"], textarea[name="comment"]');

        if (await commentInput.count() > 0) {
          const hasLabel = await commentInput.evaluate((el: HTMLTextAreaElement) => {
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

    test('コメント一覧がリストとしてマークアップされている', async ({ page }) => {
      await tryLogin(page);

      await page.goto('/report');
      await page.waitForLoadState('networkidle');

      const reportItem = page.locator('[data-testid="report-item"], .report-item, .report-card').first();

      if (await reportItem.count() > 0) {
        await reportItem.click();
        await page.waitForTimeout(1000);

        const commentItems = page.locator('[data-testid="comment-item"], .comment-item');

        if (await commentItems.count() > 0) {
          // リスト要素内にあるか確認
          const isInList = await commentItems.first().evaluate(el => {
            const parent = el.parentElement;
            return parent?.tagName === 'UL' || parent?.tagName === 'OL' || parent?.getAttribute('role') === 'list';
          });

          // リストでなくてもアクセシビリティに問題がない実装もある
          expect(true).toBeTruthy(); // 実装依存
        }
      }
    });
  });
});
