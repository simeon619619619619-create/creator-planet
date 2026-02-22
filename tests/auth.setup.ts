import { test as setup, expect } from '@playwright/test';
import { TEST_CONFIG } from './fixtures/test-config';

const CREATOR_AUTH_FILE = 'tests/.auth/creator.json';
const STUDENT_AUTH_FILE = 'tests/.auth/student.json';

setup.describe('Authentication Setup', () => {
  setup('authenticate as creator', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Fill login form
    await page.fill('input[name="email"], input[type="email"]', TEST_CONFIG.creator.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_CONFIG.creator.password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard or app
    await expect(page).toHaveURL(/\/(dashboard|settings|communities)/, { timeout: 15000 });

    // Save auth state
    await page.context().storageState({ path: CREATOR_AUTH_FILE });

    console.log('✅ Creator authentication saved');
  });

  setup('authenticate as student', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Fill login form
    await page.fill('input[name="email"], input[type="email"]', TEST_CONFIG.student.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_CONFIG.student.password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect
    await expect(page).toHaveURL(/\/(dashboard|courses|communities|student)/, { timeout: 15000 });

    // Save auth state
    await page.context().storageState({ path: STUDENT_AUTH_FILE });

    console.log('✅ Student authentication saved');
  });
});
