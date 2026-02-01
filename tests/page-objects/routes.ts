import { Page, Locator, expect } from '@playwright/test'

/**
 * Page Object for Routes Page - Phase 2.1
 *
 * Provides helper methods for E2E testing of the school route management feature.
 */
export class RoutesPageObject {
  readonly page: Page

  // Main container
  readonly routeManager: Locator
  readonly routeManagerLoading: Locator
  readonly routeManagerEmpty: Locator
  readonly routeManagerError: Locator

  // Route list
  readonly routeList: Locator
  readonly routeCards: Locator

  // Route card elements (use with .nth() or .first())
  readonly routeName: Locator
  readonly routeDescription: Locator
  readonly routeDistance: Locator
  readonly routeTime: Locator
  readonly primaryBadge: Locator

  // Action buttons
  readonly addRouteButton: Locator
  readonly editRouteButton: Locator
  readonly deleteRouteButton: Locator
  readonly setPrimaryButton: Locator

  // Creation/Edit panel
  readonly routeCreationPanel: Locator
  readonly routeEditPanel: Locator
  readonly routeNameInput: Locator
  readonly routeDescriptionInput: Locator
  readonly saveRouteButton: Locator
  readonly cancelRouteButton: Locator

  // Delete confirmation dialog
  readonly deleteConfirmationDialog: Locator
  readonly confirmDeleteButton: Locator
  readonly cancelDeleteButton: Locator

  // Map container
  readonly routeMapContainer: Locator
  readonly undoPointButton: Locator

  // Error/Retry
  readonly retryButton: Locator

  constructor(page: Page) {
    this.page = page

    // Main container
    this.routeManager = page.locator('[data-testid="route-manager"]')
    this.routeManagerLoading = page.locator('[data-testid="route-manager-loading"]')
    this.routeManagerEmpty = page.locator('[data-testid="route-manager-empty"]')
    this.routeManagerError = page.locator('[data-testid="route-manager-error"]')

    // Route list
    this.routeList = page.locator('[data-testid="route-list"]')
    this.routeCards = page.locator('[data-testid="route-card"]')

    // Route card elements
    this.routeName = page.locator('[data-testid="route-name"]')
    this.routeDescription = page.locator('[data-testid="route-description"]')
    this.routeDistance = page.locator('[data-testid="route-distance"]')
    this.routeTime = page.locator('[data-testid="route-time"]')
    this.primaryBadge = page.locator('[data-testid="primary-badge"]')

    // Action buttons
    this.addRouteButton = page.locator('[data-testid="add-route-button"]')
    this.editRouteButton = page.locator('[data-testid="edit-route-button"]')
    this.deleteRouteButton = page.locator('[data-testid="delete-route-button"]')
    this.setPrimaryButton = page.locator('[data-testid="set-primary-button"]')

    // Creation/Edit panel
    this.routeCreationPanel = page.locator('[data-testid="route-creation-panel"]')
    this.routeEditPanel = page.locator('[data-testid="route-edit-panel"]')
    this.routeNameInput = page.locator('[data-testid="route-name-input"]')
    this.routeDescriptionInput = page.locator('[data-testid="route-description-input"]')
    this.saveRouteButton = page.locator('[data-testid="save-route-button"]')
    this.cancelRouteButton = page.locator('[data-testid="cancel-route-button"]')

    // Delete confirmation dialog
    this.deleteConfirmationDialog = page.locator('[data-testid="delete-confirmation-dialog"]')
    this.confirmDeleteButton = page.locator('[data-testid="confirm-delete-button"]')
    this.cancelDeleteButton = page.locator('[data-testid="cancel-delete-button"]')

    // Map container
    this.routeMapContainer = page.locator('[data-testid="route-map-container"]')
    this.undoPointButton = page.locator('[data-testid="undo-point-button"]')

    // Error/Retry
    this.retryButton = page.locator('[data-testid="retry-button"]')
  }

  /**
   * Navigate to the routes page
   */
  async goto() {
    await this.page.goto('/routes')
    await this.page.waitForLoadState('domcontentloaded')
  }

  /**
   * Wait for the route manager to be loaded
   */
  async waitForLoaded() {
    await this.routeManager.waitFor({ state: 'visible', timeout: 10000 })
    // Wait for loading to finish
    await this.routeManagerLoading.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  }

  /**
   * Get the number of route cards
   */
  async getRouteCount(): Promise<number> {
    return this.routeCards.count()
  }

  /**
   * Click on a route card by index
   */
  async clickRoute(index: number) {
    await this.routeCards.nth(index).click()
  }

  /**
   * Click the add route button
   */
  async clickAddRoute() {
    await this.addRouteButton.click()
  }

  /**
   * Fill route name input
   */
  async fillRouteName(name: string) {
    await this.routeNameInput.fill(name)
  }

  /**
   * Fill route description input
   */
  async fillRouteDescription(description: string) {
    await this.routeDescriptionInput.fill(description)
  }

  /**
   * Save the current route (creation or edit)
   */
  async saveRoute() {
    await this.saveRouteButton.click()
  }

  /**
   * Cancel route creation or edit
   */
  async cancelRoute() {
    await this.cancelRouteButton.click()
  }

  /**
   * Click edit button on a route card
   */
  async clickEditOnRoute(index: number) {
    const card = this.routeCards.nth(index)
    await card.locator('[data-testid="edit-route-button"]').click()
  }

  /**
   * Click delete button on a route card
   */
  async clickDeleteOnRoute(index: number) {
    const card = this.routeCards.nth(index)
    await card.locator('[data-testid="delete-route-button"]').click()
  }

  /**
   * Confirm deletion in the dialog
   */
  async confirmDelete() {
    await this.confirmDeleteButton.click()
  }

  /**
   * Cancel deletion in the dialog
   */
  async cancelDelete() {
    await this.cancelDeleteButton.click()
  }

  /**
   * Set a route as primary
   */
  async setPrimaryOnRoute(index: number) {
    const card = this.routeCards.nth(index)
    await card.locator('[data-testid="set-primary-button"]').click()
  }

  /**
   * Click on the map at specific coordinates (relative to map container)
   */
  async clickOnMap(x: number, y: number) {
    const box = await this.routeMapContainer.boundingBox()
    if (box) {
      await this.page.mouse.click(box.x + x, box.y + y)
    }
  }

  /**
   * Undo the last point added to the route
   */
  async undoLastPoint() {
    await this.undoPointButton.click()
  }

  /**
   * Create a simple route with given name and points
   */
  async createRoute(name: string, description: string = '', pointCount: number = 3) {
    await this.clickAddRoute()
    await this.fillRouteName(name)
    if (description) {
      await this.fillRouteDescription(description)
    }

    // Click on map to add points
    const box = await this.routeMapContainer.boundingBox()
    if (box) {
      for (let i = 0; i < pointCount; i++) {
        await this.page.mouse.click(
          box.x + 50 + (i * 50),
          box.y + 50 + (i * 30)
        )
        await this.page.waitForTimeout(200)
      }
    }

    await this.saveRoute()
  }

  /**
   * Verify route card displays expected content
   */
  async expectRouteCardContent(index: number, expected: {
    name?: string
    description?: string
    distance?: string
    time?: string
    isPrimary?: boolean
  }) {
    const card = this.routeCards.nth(index)

    if (expected.name !== undefined) {
      await expect(card.locator('[data-testid="route-name"]')).toContainText(expected.name)
    }

    if (expected.description !== undefined) {
      await expect(card.locator('[data-testid="route-description"]')).toContainText(expected.description)
    }

    if (expected.distance !== undefined) {
      await expect(card.locator('[data-testid="route-distance"]')).toContainText(expected.distance)
    }

    if (expected.time !== undefined) {
      await expect(card.locator('[data-testid="route-time"]')).toContainText(expected.time)
    }

    if (expected.isPrimary !== undefined) {
      const badge = card.locator('[data-testid="primary-badge"]')
      if (expected.isPrimary) {
        await expect(badge).toBeVisible()
      } else {
        await expect(badge).not.toBeVisible()
      }
    }
  }

  /**
   * Check if the page is in mobile view
   */
  async isMobileView(): Promise<boolean> {
    const viewport = this.page.viewportSize()
    return viewport !== null && viewport.width < 768
  }
}
