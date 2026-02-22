import { test, expect } from '@playwright/test';
import { fillStripeCheckout, waitForStripeReturn } from '../helpers/stripe-helpers';
import { navigateTo, takeScreenshot } from '../helpers/page-helpers';

test.describe('Student Plus Subscription', () => {
  test.describe.configure({ mode: 'serial' });

  test('S-PLUS-01: Should display Student Plus page with pricing', async ({ page }) => {
    await navigateTo(page, '/student-plus');

    // Verify page loaded
    await expect(page.locator('h1, h2').first()).toContainText(/Student Plus|Premium|Membership/i);

    // Verify price is shown (€9.90)
    await expect(page.locator('text=€9.90').or(page.locator('text=€9,90'))).toBeVisible();

    await takeScreenshot(page, 'student-plus-page');
  });

  test('S-PLUS-02: Should display subscription benefits', async ({ page }) => {
    await navigateTo(page, '/student-plus');

    // Check for benefit descriptions
    const benefits = ['newsletter', 'perks', 'rewards', 'loyalty'];
    let foundBenefits = 0;

    for (const benefit of benefits) {
      const found = await page.locator(`text=/${benefit}/i`).count();
      if (found > 0) foundBenefits++;
    }

    expect(foundBenefits).toBeGreaterThan(0);

    await takeScreenshot(page, 'student-plus-benefits');
  });

  test('S-PLUS-03: Should show Subscribe button for non-subscribers', async ({ page }) => {
    await navigateTo(page, '/student-plus');

    const subscribeButton = page.locator('button:has-text("Subscribe"), button:has-text("Join"), button:has-text("Get")');

    if (await subscribeButton.isVisible()) {
      await expect(subscribeButton).toBeEnabled();
      await takeScreenshot(page, 'student-plus-subscribe-button');
    } else {
      // Already subscribed - should show dashboard
      await expect(page.locator('text=/Active|Subscribed|Member/i')).toBeVisible();
    }
  });

  test('S-PLUS-04: Should redirect to Stripe checkout', async ({ page }) => {
    await navigateTo(page, '/student-plus');

    const subscribeButton = page.locator('button:has-text("Subscribe"), button:has-text("Join")');

    if (await subscribeButton.isVisible()) {
      await subscribeButton.click();

      // Should redirect to Stripe Checkout
      await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30000 });

      await takeScreenshot(page, 'student-plus-stripe-checkout');
    } else {
      test.skip();
    }
  });

  test('S-PLUS-05: Should complete subscription successfully', async ({ page }) => {
    await navigateTo(page, '/student-plus');

    const subscribeButton = page.locator('button:has-text("Subscribe"), button:has-text("Join")');

    if (await subscribeButton.isVisible()) {
      await subscribeButton.click();

      // Fill Stripe checkout
      await fillStripeCheckout(page, 'success');

      // Wait for redirect back with success
      await waitForStripeReturn(page, /\/student-plus\?.*success=true/);

      // Verify success message
      await expect(page.locator('text=/Welcome.*Plus|Success|Subscription.*Active/i')).toBeVisible({ timeout: 10000 });

      await takeScreenshot(page, 'student-plus-subscription-success');
    } else {
      test.skip();
    }
  });

  test('S-PLUS-06: Should show loyalty dashboard for subscribers', async ({ page }) => {
    await navigateTo(page, '/student-plus');

    // Check if subscriber view (has loyalty info)
    const loyaltySection = page.locator('text=/Loyalty|Points|Rewards|Months/i');

    if (await loyaltySection.count() > 0) {
      await expect(loyaltySection).toBeVisible();

      // Check for milestone indicators
      const milestones = page.locator('text=/3 months|6 months|12 months/i');
      await expect(milestones.first()).toBeVisible();

      await takeScreenshot(page, 'student-plus-loyalty-dashboard');
    } else {
      test.skip();
    }
  });

  test('S-PLUS-07: Should handle checkout cancellation', async ({ page }) => {
    await navigateTo(page, '/student-plus');

    const subscribeButton = page.locator('button:has-text("Subscribe"), button:has-text("Join")');

    if (await subscribeButton.isVisible()) {
      await subscribeButton.click();

      // Wait for Stripe
      await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 30000 });

      // Cancel/go back
      await page.click('a:has-text("Back"), button[aria-label="Close"]');

      // Should return with canceled param
      await waitForStripeReturn(page, /\/student-plus\?.*canceled=true/);

      // Should show cancel message
      await expect(page.locator('text=/canceled|cancelled/i')).toBeVisible();

      await takeScreenshot(page, 'student-plus-checkout-canceled');
    } else {
      test.skip();
    }
  });
});
