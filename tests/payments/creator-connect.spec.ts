import { test, expect } from '@playwright/test';
import { navigateTo, takeScreenshot } from '../helpers/page-helpers';

test.describe('Creator Stripe Connect (Payouts)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/settings?tab=billing');
  });

  test('C-CON-01: Should display Connect setup section', async ({ page }) => {
    // Look for payout setup section
    await expect(page.locator('text=/Payout|Connect|Receive.*Payment/i')).toBeVisible();

    await takeScreenshot(page, 'creator-connect-section');
  });

  test('C-CON-02: Should show Connect status indicator', async ({ page }) => {
    // Check for status - either "Set Up" or "Active/Connected"
    const setupNeeded = await page.locator('text=/Setup.*Payout|Connect.*Account|Get.*Paid/i').isVisible();
    const connected = await page.locator('text=/Connected|Active|Payouts.*Enabled/i').isVisible();

    expect(setupNeeded || connected).toBeTruthy();

    await takeScreenshot(page, 'creator-connect-status');
  });

  test('C-CON-03: Should initiate Connect onboarding', async ({ page }) => {
    const setupButton = page.locator('button:has-text("Setup"), button:has-text("Connect"), button:has-text("Start")').first();

    if (await setupButton.isVisible()) {
      await setupButton.click();

      // Should redirect to Stripe Connect onboarding
      await expect(page).toHaveURL(/connect\.stripe\.com|onboarding/, { timeout: 30000 });

      await takeScreenshot(page, 'creator-connect-onboarding');
    } else {
      // Already connected
      test.skip();
    }
  });

  test('C-CON-04: Should show dashboard link for connected accounts', async ({ page }) => {
    const dashboardLink = page.locator('a:has-text("Dashboard"), button:has-text("View Dashboard")');

    if (await dashboardLink.isVisible()) {
      // Verify it links to Stripe Express Dashboard
      const href = await dashboardLink.getAttribute('href');
      expect(href).toMatch(/stripe\.com|dashboard/);

      await takeScreenshot(page, 'creator-connect-dashboard-link');
    } else {
      test.skip();
    }
  });
});
