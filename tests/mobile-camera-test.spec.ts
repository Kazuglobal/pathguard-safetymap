import { test, expect, devices } from '@playwright/test';

// iPhone 12でのテスト設定
test.use({
  ...devices['iPhone 12'],
  permissions: ['camera'],
});

test.describe('モバイルカメラ機能テスト', () => {
  test('危険箇所撮影とアップロード機能の確認', async ({ page }) => {
    // アプリケーションにアクセス
    await page.goto('http://localhost:3001');
    
    // ログインページが表示される場合はデモユーザーでログイン
    const demoLoginButton = page.locator('button:has-text("デモユーザーでログイン")');
    if (await demoLoginButton.isVisible({ timeout: 3000 })) {
      await demoLoginButton.click();
      await page.waitForURL('**/map', { timeout: 10000 });
    }
    
    // マップページに遷移
    await page.goto('http://localhost:3001/map');
    await page.waitForLoadState('networkidle');
    
    // 地図が読み込まれるまで待機
    const mapContainer = page.locator('.mapboxgl-map, #map, [data-testid="map-container"]');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
    
    // 地図上の任意の位置をクリック（報告フォームを開く）
    const mapBounds = await mapContainer.boundingBox();
    if (mapBounds) {
      // 地図の中心あたりをクリック
      await page.mouse.click(
        mapBounds.x + mapBounds.width / 2,
        mapBounds.y + mapBounds.height / 2
      );
      await page.waitForTimeout(1000);
    }
    
    // 報告ボタンがある場合はクリック
    const reportButton = page.locator('button:has-text("報告"), button:has-text("危険を報告")');
    if (await reportButton.isVisible({ timeout: 2000 })) {
      await reportButton.click();
      await page.waitForTimeout(500);
    }
    
    // カメラ撮影ボタンの確認
    const cameraButton = page.locator('button:has-text("📸 カメラ撮影")').first();
    await expect(cameraButton).toBeVisible({ timeout: 5000 });
    
    // ボタンのサイズがモバイルタッチに適しているか確認
    const buttonBox = await cameraButton.boundingBox();
    if (buttonBox) {
      // モバイルでのタッチターゲットは最低48px推奨
      expect(buttonBox.height).toBeGreaterThanOrEqual(48);
      console.log(`カメラボタンサイズ: ${buttonBox.width}x${buttonBox.height}px`);
    }
    
    // file inputのcapture属性を確認
    await cameraButton.click();
    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    const captureAttr = await fileInput.getAttribute('capture');
    expect(captureAttr).toBe('environment');
    console.log('capture属性が正しく設定されています:', captureAttr);
    
    // ギャラリーボタンの確認
    const galleryButton = page.locator('button:has-text("ギャラリー")').first();
    if (await galleryButton.isVisible()) {
      await galleryButton.click();
      const captureAfterGallery = await fileInput.getAttribute('capture');
      expect(captureAfterGallery).toBeFalsy();
      console.log('ギャラリー選択時はcapture属性が削除されています');
    }
    
    // 加工画像タブの確認
    const processedTab = page.locator('button:has-text("加工画像")');
    if (await processedTab.isVisible()) {
      await processedTab.click();
      await page.waitForTimeout(500);
      
      const processedCameraButton = page.locator('button:has-text("📸 カメラ撮影")').nth(1);
      if (await processedCameraButton.isVisible()) {
        const processedButtonBox = await processedCameraButton.boundingBox();
        if (processedButtonBox) {
          expect(processedButtonBox.height).toBeGreaterThanOrEqual(48);
          console.log(`加工画像カメラボタンサイズ: ${processedButtonBox.width}x${processedButtonBox.height}px`);
        }
      }
    }
    
    console.log('✅ モバイルカメラ機能のテストが成功しました');
  });
  
  test('横画面（ランドスケープ）でのレスポンシブ確認', async ({ page }) => {
    // 横画面に設定
    await page.setViewportSize({ width: 844, height: 390 }); // iPhone 12横向き
    
    await page.goto('http://localhost:3001');
    
    // デモユーザーでログイン
    const demoLoginButton = page.locator('button:has-text("デモユーザーでログイン")');
    if (await demoLoginButton.isVisible({ timeout: 3000 })) {
      await demoLoginButton.click();
      await page.waitForURL('**/map', { timeout: 10000 });
    }
    
    await page.goto('http://localhost:3001/map');
    await page.waitForLoadState('networkidle');
    
    // 地図をクリック
    const mapContainer = page.locator('.mapboxgl-map, #map');
    if (await mapContainer.isVisible()) {
      const mapBounds = await mapContainer.boundingBox();
      if (mapBounds) {
        await page.mouse.click(
          mapBounds.x + mapBounds.width / 2,
          mapBounds.y + mapBounds.height / 2
        );
      }
    }
    
    // 報告ボタンをクリック
    const reportButton = page.locator('button:has-text("報告"), button:has-text("危険を報告")');
    if (await reportButton.isVisible({ timeout: 2000 })) {
      await reportButton.click();
    }
    
    // 横画面でもカメラボタンが適切に表示されるか確認
    const cameraButton = page.locator('button:has-text("📸 カメラ撮影")').first();
    if (await cameraButton.isVisible({ timeout: 5000 })) {
      const buttonBox = await cameraButton.boundingBox();
      if (buttonBox) {
        expect(buttonBox.height).toBeGreaterThanOrEqual(44);
        // ボタンが画面内に収まっているか確認
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(844);
        expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(390);
        console.log(`✅ 横画面でのカメラボタン表示OK: ${buttonBox.width}x${buttonBox.height}px`);
      }
    }
  });
});