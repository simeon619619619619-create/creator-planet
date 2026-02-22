import { Page, expect } from '@playwright/test';

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Small buffer for React hydration
}

/**
 * Navigate and wait for load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await waitForPageLoad(page);
}

/**
 * Click button by text
 */
export async function clickButton(page: Page, text: string) {
  await page.click(`button:has-text("${text}")`);
}

/**
 * Wait for success message
 */
export async function expectSuccessMessage(page: Page, text?: string) {
  const successLocator = page.locator('[class*="bg-emerald"], [class*="bg-green"], [class*="success"]');
  await expect(successLocator).toBeVisible({ timeout: 10000 });

  if (text) {
    await expect(successLocator).toContainText(text);
  }
}

/**
 * Wait for error message
 */
export async function expectErrorMessage(page: Page, text?: string) {
  const errorLocator = page.locator('[class*="bg-red"], [class*="error"], [class*="bg-rose"]');
  await expect(errorLocator).toBeVisible({ timeout: 10000 });

  if (text) {
    await expect(errorLocator).toContainText(text);
  }
}

/**
 * Take named screenshot
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: true
  });
}
