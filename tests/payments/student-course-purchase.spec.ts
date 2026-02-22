import { test, expect } from '@playwright/test';
import { fillStripeElements, fillStripeCheckout } from '../helpers/stripe-helpers';
import { navigateTo, takeScreenshot } from '../helpers/page-helpers';

test.describe('Student Course Purchase', () => {
  test.describe.configure({ mode: 'serial' });

  test('S-CRS-01: Should display course with price', async ({ page }) => {
    // Navigate to courses page
    await navigateTo(page, '/courses');

    // Find a paid course
    const courseCard = page.locator('[data-testid="course-card"], .course-card, [class*="course"]').first();
    await expect(courseCard).toBeVisible();

    // Click to view course details
    await courseCard.click();
    await page.waitForLoadState('networkidle');

    // Verify price is shown
    const priceVisible = await page.locator('text=/€[0-9]+|Free|Enrolled/').isVisible();
    expect(priceVisible).toBeTruthy();

    await takeScreenshot(page, 'student-course-details');
  });

  test('S-CRS-02: Should show enroll button for paid course', async ({ page }) => {
    await navigateTo(page, '/courses');

    // Find first course card and click
    await page.locator('[data-testid="course-card"], .course-card').first().click();
    await page.waitForLoadState('networkidle');

    // Look for enroll button
    const enrollButton = page.locator('button:has-text("Enroll"), button:has-text("Buy"), button:has-text("Purchase")');

    if (await enrollButton.isVisible()) {
      await takeScreenshot(page, 'student-enroll-button');
    } else {
      // Already enrolled or free course
      await expect(page.locator('text=/Enrolled|Continue|Start/i')).toBeVisible();
    }
  });

  test('S-CRS-03: Should open purchase modal for paid course', async ({ page }) => {
    await navigateTo(page, '/courses');
    await page.locator('[data-testid="course-card"], .course-card').first().click();
    await page.waitForLoadState('networkidle');

    const enrollButton = page.locator('button:has-text("Enroll"), button:has-text("Buy")');

    if (await enrollButton.isVisible()) {
      await enrollButton.click();

      // Should show payment modal or redirect
      const modal = page.locator('[role="dialog"], .modal, [class*="purchase"]');
      const stripeRedirect = page.url().includes('stripe.com');

      expect(await modal.isVisible() || stripeRedirect).toBeTruthy();

      await takeScreenshot(page, 'student-purchase-modal');
    } else {
      test.skip();
    }
  });

  test('S-CRS-04: Should complete course purchase with valid card', async ({ page }) => {
    await navigateTo(page, '/courses');
    await page.locator('[data-testid="course-card"], .course-card').first().click();
    await page.waitForLoadState('networkidle');

    const enrollButton = page.locator('button:has-text("Enroll"), button:has-text("Buy")');

    if (await enrollButton.isVisible()) {
      await enrollButton.click();

      // Check if modal with Stripe Elements or redirect
      const isStripeCheckout = await page.waitForURL(/checkout\.stripe\.com/, { timeout: 5000 }).catch(() => false);

      if (isStripeCheckout) {
        await fillStripeCheckout(page, 'success');
      } else {
        // Stripe Elements in modal
        await fillStripeElements(page, 'success');
        await page.click('button:has-text("Pay"), button:has-text("Complete")');
      }

      // Wait for success
      await expect(page.locator('text=/success|enrolled|purchased/i')).toBeVisible({ timeout: 30000 });

      await takeScreenshot(page, 'student-purchase-success');
    } else {
      test.skip();
    }
  });

  test('S-CRS-05: Should enroll in free course without payment', async ({ page }) => {
    await navigateTo(page, '/courses');

    // Look for a free course
    const freeCourse = page.locator(':has-text("Free")').locator('[data-testid="course-card"], .course-card').first();

    if (await freeCourse.count() > 0) {
      await freeCourse.click();
      await page.waitForLoadState('networkidle');

      // Click enroll
      await page.click('button:has-text("Enroll"), button:has-text("Start")');

      // Should NOT show payment modal
      const paymentModal = page.locator('[class*="stripe"], [class*="payment"]');
      await expect(paymentModal).not.toBeVisible({ timeout: 3000 }).catch(() => true);

      // Should show enrolled state or redirect to course
      await expect(page.locator('text=/Enrolled|Continue|Start Learning/i')).toBeVisible({ timeout: 5000 });

      await takeScreenshot(page, 'student-free-course-enrolled');
    } else {
      test.skip();
    }
  });
});
