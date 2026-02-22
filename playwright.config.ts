import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * Playwright configuration for Creator Club™ Payment E2E Testing
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Sequential for payment tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker for payment state consistency
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://creator-club.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
  },

  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Creator payment tests
    {
      name: 'creator-payments',
      testMatch: /creator-.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/creator.json',
      },
    },

    // Student payment tests
    {
      name: 'student-payments',
      testMatch: /student-.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/student.json',
      },
    },

    // Default chromium for other tests
    {
      name: 'chromium',
      testMatch: /(?!creator-|student-).*\.spec\.ts/,
      testIgnore: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  outputDir: 'test-results/',
});
