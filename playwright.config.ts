import { defineConfig, devices } from '@playwright/test';

const playwrightPort = process.env.PLAYWRIGHT_PORT || '3010';
const playwrightBaseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${playwrightPort}`;
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ||
  `cross-env NEXT_DIST_DIR=.next-playwright node node_modules/next/dist/bin/next dev --webpack -p ${playwrightPort}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: playwrightBaseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers and viewports */
  projects: [
    // Mobile viewports
    {
      name: 'Mobile Chrome - iPhone SE',
      use: { 
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 667 }
      },
    },
    {
      name: 'Mobile Chrome - iPhone 12',
      use: { 
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      },
    },
    {
      name: 'Mobile Chrome - Samsung Galaxy',
      use: { 
        ...devices['Galaxy S8'],
        viewport: { width: 360, height: 740 }
      },
    },

    // Tablet viewports
    {
      name: 'Tablet - iPad',
      use: { 
        ...devices['iPad'],
        viewport: { width: 768, height: 1024 }
      },
    },
    {
      name: 'Tablet - iPad Landscape',
      use: { 
        ...devices['iPad landscape'],
        viewport: { width: 1024, height: 768 }
      },
    },

    // Desktop viewports
    {
      name: 'Desktop - Chrome 1920x1080',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'Desktop - Chrome 1366x768',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 }
      },
    },
    {
      name: 'Desktop - Firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'Desktop - Safari',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: webServerCommand,
    url: playwrightBaseURL,
    reuseExistingServer:
      !process.env.CI && process.env.PLAYWRIGHT_REUSE_EXISTING !== 'false',
    timeout: 120 * 1000,
  },

  /* Global test timeout */
  timeout: 30 * 1000,
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 5000,
    /* Threshold for screenshot comparison */
    toHaveScreenshot: {
      threshold: 0.2
    },
    toMatchSnapshot: {
      threshold: 0.2
    }
  },
});
