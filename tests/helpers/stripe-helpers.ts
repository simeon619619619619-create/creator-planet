import { Page } from '@playwright/test';
import { TEST_CONFIG, TestCard } from '../fixtures/test-config';

/**
 * Fill Stripe checkout form (hosted checkout page)
 */
export async function fillStripeCheckout(page: Page, cardType: TestCard = 'success') {
  const card = TEST_CONFIG.stripe[cardType];

  // Wait for Stripe checkout to load
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });

  // Fill card details
  await page.fill('input[name="cardNumber"]', card.number);
  await page.fill('input[name="cardExpiry"]', card.expiry);
  await page.fill('input[name="cardCvc"]', card.cvc);

  // Fill billing details if visible
  const billingName = page.locator('input[name="billingName"]');
  if (await billingName.isVisible()) {
    await billingName.fill('Test User');
  }

  const billingPostal = page.locator('input[name="billingPostalCode"]');
  if (await billingPostal.isVisible()) {
    await billingPostal.fill(card.zip);
  }

  // Submit payment
  await page.click('button[data-testid="hosted-payment-submit-button"]');
}

/**
 * Fill Stripe Elements form (embedded in page)
 */
export async function fillStripeElements(page: Page, cardType: TestCard = 'success') {
  const card = TEST_CONFIG.stripe[cardType];

  // Find Stripe iframe
  const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();

  // Fill card number
  await stripeFrame.locator('input[name="cardnumber"]').fill(card.number);

  // Fill expiry
  await stripeFrame.locator('input[name="exp-date"]').fill(card.expiry);

  // Fill CVC
  await stripeFrame.locator('input[name="cvc"]').fill(card.cvc);

  // Fill postal if present
  const postal = stripeFrame.locator('input[name="postal"]');
  if (await postal.count() > 0) {
    await postal.fill(card.zip);
  }
}

/**
 * Handle 3D Secure authentication
 */
export async function handle3DSecure(page: Page, authorize: boolean = true) {
  // Wait for 3DS iframe or popup
  const frame = page.frameLocator('iframe[name*="__stripe"]').or(
    page.frameLocator('iframe[src*="stripe.com/3ds"]')
  );

  if (authorize) {
    // Click "Complete" or "Authorize" button
    await frame.locator('button:has-text("Complete")').or(
      frame.locator('button:has-text("Authorize")')
    ).click();
  } else {
    // Click "Fail" button to simulate failed auth
    await frame.locator('button:has-text("Fail")').click();
  }
}

/**
 * Wait for Stripe redirect back to app
 */
export async function waitForStripeReturn(page: Page, expectedPath: string | RegExp) {
  await page.waitForURL(expectedPath, { timeout: 60000 });
}

/**
 * Get Stripe checkout session from URL
 */
export function getSessionIdFromUrl(url: string): string | null {
  const match = url.match(/session_id=([^&]+)/);
  return match ? match[1] : null;
}
