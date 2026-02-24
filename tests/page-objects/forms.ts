import { Page, Locator } from '@playwright/test';

export class FormsPageObject {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Login form elements
  get loginForm() {
    return this.page.locator('form[data-testid="login-form"], form:has(input[type="email"]):has(input[type="password"])');
  }

  get emailInput() {
    return this.page.locator('input[type="email"], input[name="email"]');
  }

  get passwordInput() {
    return this.page.locator('input[type="password"], input[name="password"]');
  }

  get loginSubmitButton() {
    return this.page.locator('button[type="submit"]:has-text("ログイン"), button[type="submit"]:has-text("Login"), button:has-text("ログイン")');
  }

  // Register form elements
  get registerForm() {
    return this.page.locator('form[data-testid="register-form"], form:has(input[name="email"]):has(input[name="password"]):has(input[name="confirmPassword"])');
  }

  get confirmPasswordInput() {
    return this.page.locator('input[name="confirmPassword"], input[name="confirm_password"]');
  }

  get nameInput() {
    return this.page.locator('input[name="name"], input[name="username"], input[name="fullName"]');
  }

  get registerSubmitButton() {
    return this.page.locator('button[type="submit"]:has-text("登録"), button[type="submit"]:has-text("Register"), button:has-text("登録")');
  }

  // Generic form elements
  get formInputs() {
    return this.page.locator('input, textarea, select');
  }

  get formButtons() {
    return this.page.locator('button, input[type="submit"]');
  }

  get errorMessages() {
    return this.page.locator('.error, [data-testid="error"], .text-red-500, .text-destructive');
  }

  get successMessages() {
    return this.page.locator('.success, [data-testid="success"], .text-green-500, .text-success');
  }

  async fillLoginForm(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submitLoginForm() {
    await this.loginSubmitButton.click();
  }

  async fillRegisterForm(email: string, password: string, name?: string) {
    if (name && await this.nameInput.isVisible()) {
      await this.nameInput.fill(name);
    }
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    if (await this.confirmPasswordInput.isVisible()) {
      await this.confirmPasswordInput.fill(password);
    }
  }

  async submitRegisterForm() {
    await this.registerSubmitButton.click();
  }

  async checkFormValidation() {
    // Check if form fields have proper validation attributes
    const requiredFields = this.page.locator('input[required], textarea[required], select[required]');
    const requiredFieldsCount = await requiredFields.count();
    
    for (let i = 0; i < requiredFieldsCount; i++) {
      const field = requiredFields.nth(i);
      const isVisible = await field.isVisible();
      if (isVisible) {
        // Check if field has proper aria-labels or labels
        const hasLabel = await field.getAttribute('aria-label') || 
                         await this.page.locator(`label[for="${await field.getAttribute('id')}"]`).count() > 0;
        
        if (!hasLabel) {
          console.warn(`Required field at index ${i} missing accessibility label`);
        }
      }
    }
  }
}