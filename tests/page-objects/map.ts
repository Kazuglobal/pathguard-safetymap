import { Page, Locator } from '@playwright/test';

export class MapPageObject {
  readonly page: Page;
  readonly mapContainer: Locator;
  readonly mapControls: Locator;
  readonly searchBox: Locator;
  readonly searchButton: Locator;
  readonly locationButton: Locator;
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly mapStyleSelector: Locator;
  readonly toggle3DButton: Locator;
  readonly sidebar: Locator;
  readonly sidebarToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mapContainer = page.locator('[data-testid="map-container"], .map-container, .mapboxgl-map');
    this.mapControls = page.locator('[data-testid="map-controls"], .map-controls, .mapboxgl-ctrl-group');
    this.searchBox = page.locator('input[placeholder*="検索"], input[placeholder*="search"], [data-testid="map-search"]');
    this.searchButton = page.locator('button:has-text("検索"), button:has-text("Search"), [data-testid="search-button"]');
    this.locationButton = page.locator('.mapboxgl-ctrl-geolocate, [data-testid="location-button"]');
    this.zoomInButton = page.locator('.mapboxgl-ctrl-zoom-in, [data-testid="zoom-in"]');
    this.zoomOutButton = page.locator('.mapboxgl-ctrl-zoom-out, [data-testid="zoom-out"]');
    this.mapStyleSelector = page.locator('[data-testid="map-style-selector"], .map-style-selector');
    this.toggle3DButton = page.locator('[data-testid="toggle-3d"], button:has-text("3D")');
    this.sidebar = page.locator('[data-testid="map-sidebar"], .map-sidebar');
    this.sidebarToggle = page.locator('[data-testid="sidebar-toggle"], .sidebar-toggle');
  }

  async waitForMapLoad() {
    // Wait for map container to be visible
    await this.mapContainer.waitFor({ state: 'visible' });
    
    // Wait for map to finish loading (common class added by Mapbox)
    await this.page.waitForFunction(() => {
      const mapElement = document.querySelector('.mapboxgl-map');
      return mapElement && !mapElement.classList.contains('mapboxgl-loading');
    }, { timeout: 10000 });

    // Additional wait for tiles to load
    await this.page.waitForTimeout(2000);
  }

  async searchLocation(query: string) {
    if (await this.searchBox.isVisible()) {
      await this.searchBox.fill(query);
      if (await this.searchButton.isVisible()) {
        await this.searchButton.click();
      } else {
        await this.searchBox.press('Enter');
      }
      await this.page.waitForTimeout(2000); // Wait for search results
    }
  }

  async zoomIn() {
    if (await this.zoomInButton.isVisible()) {
      await this.zoomInButton.click();
      await this.page.waitForTimeout(1000);
    }
  }

  async zoomOut() {
    if (await this.zoomOutButton.isVisible()) {
      await this.zoomOutButton.click();
      await this.page.waitForTimeout(1000);
    }
  }

  async toggleSidebar() {
    if (await this.sidebarToggle.isVisible()) {
      await this.sidebarToggle.click();
      await this.page.waitForTimeout(500);
    }
  }

  async toggle3DView() {
    if (await this.toggle3DButton.isVisible()) {
      await this.toggle3DButton.click();
      await this.page.waitForTimeout(2000); // 3D rendering takes time
    }
  }

  async changeMapStyle(styleName: string) {
    if (await this.mapStyleSelector.isVisible()) {
      await this.mapStyleSelector.click();
      const styleOption = this.page.locator(`[data-testid="style-${styleName}"], button:has-text("${styleName}")`);
      if (await styleOption.isVisible()) {
        await styleOption.click();
        await this.page.waitForTimeout(2000); // Wait for style to load
      }
    }
  }

  async checkResponsiveMapControls(isMobile: boolean) {
    if (isMobile) {
      // On mobile, some controls might be hidden or repositioned
      const controls = await this.mapControls.all();
      for (const control of controls) {
        if (await control.isVisible()) {
          const box = await control.boundingBox();
          if (box) {
            // Check if controls are not overlapping with content
            const isInViewport = box.x >= 0 && box.y >= 0 && 
                               box.x + box.width <= await this.page.viewportSize()?.width! &&
                               box.y + box.height <= await this.page.viewportSize()?.height!;
            
            if (!isInViewport) {
              console.warn('Map control positioned outside viewport on mobile');
            }
          }
        }
      }
    }
  }

  async checkMapInteractivity() {
    // Test basic map interactions
    const mapBox = await this.mapContainer.boundingBox();
    if (mapBox) {
      // Test pan gesture
      await this.page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
      await this.page.mouse.down();
      await this.page.mouse.move(mapBox.x + mapBox.width / 2 + 50, mapBox.y + mapBox.height / 2 + 50);
      await this.page.mouse.up();
      await this.page.waitForTimeout(500);
    }
  }
}