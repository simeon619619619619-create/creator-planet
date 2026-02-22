import { test, expect } from '@playwright/test';
import { fillStripeCheckout, waitForStripeReturn } from '../helpers/stripe-helpers';
import { navigateTo, takeScreenshot } from '../helpers/page-helpers';

test.describe('Creator Activation Fee Payment', () => {
  test.describe.configure({ mode: 'serial' });

  test('C-ACT-01: Should display onboarding page for new creator', async ({ page }) => {
    await navigateTo(page, '/onboarding');

    // Verify page elements
    await expect(page.locator('h1, h2').first()).toContainText(/Activate|Welcome|Get Started/i);
    await expect(page.locator('text=€2.90').or(page.locator('text=€2,90'))).toBeVisible();

    // Verify activation button exists
    const activateButton = page.locator('button:has-text("Activate"), button:has-text("Pay")');
    await expect(activateButton).toBeVisible();

    await takeScreenshot(page, 'creator-onboarding-page');
  });

  test('C-ACT-02: Should redirect to Stripe checkout', async ({ page }) => {
    await navigateTo(page, '/onboarding');

    // Click activate button
    await page.click('button:has-text("Activate"), button:has-text("Pay")');

    // Should redirect to Stripe
    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30000 });

    await takeScreenshot(page, 'creator-stripe-checkout');
  });

  test('C-ACT-03: Should complete activation with valid card', async ({ page }) => {
    await navigateTo(page, '/onboarding');

    // Start checkout
    await page.click('button:has-text("Activate"), button:has-text("Pay")');

    // Fill Stripe checkout
    await fillStripeCheckout(page, 'success');

    // Wait for redirect back
    await waitForStripeReturn(page, /\/(settings|dashboard|onboarding)\?.*success=true/);

    // Verify success state
    await expect(page.locator('text=/activated|success|complete/i')).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, 'creator-activation-success');
  });

  test('C-ACT-04: Should show error for declined card', async ({ page }) => {
    // This test requires a fresh creator account
    // Skip if already activated
    await navigateTo(page, '/onboarding');

    const alreadyActivated = await page.locator('text=/already activated/i').isVisible();
    if (alreadyActivated) {
      test.skip();
      return;
    }

    // Start checkout
    await page.click('button:has-text("Activate"), button:has-text("Pay")');

    // Fill with declined card
    await fillStripeCheckout(page, 'decline');

    // Should show error on Stripe checkout
    await expect(page.locator('text=/declined|insufficient|failed/i')).toBeVisible({ timeout: 15000 });

    await takeScreenshot(page, 'creator-activation-declined');
  });

  test('C-ACT-05: Should handle checkout cancellation', async ({ page }) => {
    await navigateTo(page, '/onboarding');

    const alreadyActivated = await page.locator('text=/already activated/i').isVisible();
    if (alreadyActivated) {
      test.skip();
      return;
    }

    // Start checkout
    await page.click('button:has-text("Activate"), button:has-text("Pay")');

    // Wait for Stripe page
    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30000 });

    // Click back/close button
    await page.click('a:has-text("Back"), button[aria-label="Close"]');

    // Should return to onboarding
    await waitForStripeReturn(page, /\/onboarding\?.*canceled=true/);

    await takeScreenshot(page, 'creator-activation-canceled');
  });
});
