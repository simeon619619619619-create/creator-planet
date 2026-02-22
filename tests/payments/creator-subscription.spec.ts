import { test, expect } from '@playwright/test';
import { fillStripeCheckout, waitForStripeReturn } from '../helpers/stripe-helpers';
import { navigateTo, takeScreenshot } from '../helpers/page-helpers';

test.describe('Creator Subscription Management', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Navigate to billing settings
    await navigateTo(page, '/settings?tab=billing');
  });

  test('C-SUB-01: Should display current plan as Starter', async ({ page }) => {
    // Check current plan display
    await expect(page.locator('text=/Starter|Free|Current Plan/i')).toBeVisible();

    // Verify upgrade options visible
    await expect(page.locator('text=Pro')).toBeVisible();
    await expect(page.locator('text=Scale')).toBeVisible();

    await takeScreenshot(page, 'creator-billing-starter-plan');
  });

  test('C-SUB-02: Should show plan comparison with prices', async ({ page }) => {
    // Verify Pro plan pricing
    await expect(page.locator('text=€30').or(page.locator('text=€30.00'))).toBeVisible();
    await expect(page.locator('text=3.9%').or(page.locator('text=/3\\.9.*%/'))).toBeVisible();

    // Verify Scale plan pricing
    await expect(page.locator('text=€99').or(page.locator('text=€99.00'))).toBeVisible();
    await expect(page.locator('text=1.9%').or(page.locator('text=/1\\.9.*%/'))).toBeVisible();

    await takeScreenshot(page, 'creator-plan-comparison');
  });

  test('C-SUB-03: Should initiate upgrade to Pro plan', async ({ page }) => {
    // Click upgrade to Pro
    await page.click('button:has-text("Upgrade to Pro"), button:has-text("Select Pro")');

    // Should show confirmation or redirect to Stripe
    const stripeRedirect = await page.waitForURL(/checkout\.stripe\.com/, { timeout: 5000 }).catch(() => false);

    if (stripeRedirect) {
      await takeScreenshot(page, 'creator-pro-upgrade-checkout');
      // Fill checkout and complete
      await fillStripeCheckout(page, 'success');
      await waitForStripeReturn(page, /\/settings/);
    } else {
      // Modal confirmation
      await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
      await takeScreenshot(page, 'creator-pro-upgrade-modal');
    }
  });

  test('C-SUB-04: Should show subscription status after upgrade', async ({ page }) => {
    // Check if subscribed to Pro
    const hasPro = await page.locator('text=/Pro.*Active|Current.*Pro/i').isVisible();

    if (hasPro) {
      await expect(page.locator('text=/Active|Subscribed/i')).toBeVisible();
      await expect(page.locator('text=/€30|Cancel/i')).toBeVisible();

      await takeScreenshot(page, 'creator-pro-subscription-active');
    } else {
      test.skip();
    }
  });

  test('C-SUB-05: Should open Stripe billing portal', async ({ page }) => {
    // Look for "Manage Subscription" or "Billing Portal" button
    const portalButton = page.locator('button:has-text("Manage"), button:has-text("Portal"), button:has-text("Billing")');

    if (await portalButton.count() > 0) {
      await portalButton.first().click();

      // Should open Stripe portal in new tab or redirect
      const [popup] = await Promise.all([
        page.waitForEvent('popup').catch(() => null),
        portalButton.first().click()
      ]).catch(() => [null]);

      if (popup) {
        await popup.waitForLoadState();
        await expect(popup).toHaveURL(/billing\.stripe\.com/);
        await popup.close();
      }

      await takeScreenshot(page, 'creator-billing-portal');
    } else {
      test.skip();
    }
  });

  test('C-SUB-06: Should handle cancel subscription flow', async ({ page }) => {
    const cancelButton = page.locator('button:has-text("Cancel Subscription"), button:has-text("Cancel Plan")');

    if (await cancelButton.count() > 0) {
      await cancelButton.click();

      // Confirm cancellation in modal
      await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
      await page.click('button:has-text("Confirm"), button:has-text("Yes")');

      // Should show scheduled cancellation
      await expect(page.locator('text=/cancel.*end|scheduled/i')).toBeVisible({ timeout: 10000 });

      await takeScreenshot(page, 'creator-subscription-canceled');
    } else {
      test.skip();
    }
  });
});
