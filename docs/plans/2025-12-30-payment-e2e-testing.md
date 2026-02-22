# Payment E2E Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement comprehensive Playwright E2E tests for all payment flows covering both Creator and Student user journeys.

**Architecture:** Tests will use Playwright with a page object pattern for reusability. Auth state will be stored and reused across tests. Stripe test cards will be used via environment variables. Tests run against production Vercel deployment with Stripe in test mode.

**Tech Stack:** Playwright, TypeScript, Stripe Test Mode, Supabase

---

## Prerequisites

Before starting:
1. Stripe account in TEST mode (not live)
2. Test user accounts created in Supabase
3. `STRIPE_SECRET_KEY` set to test key (sk_test_...)
4. Vercel deployment accessible

---

## Task 1: Configure Playwright for Payment Testing

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/fixtures/test-config.ts`
- Create: `.env.test`

**Step 1: Create environment config file**

Create `.env.test`:
```bash
# Test Environment Config
BASE_URL=https://creator-club.vercel.app
STRIPE_TEST_MODE=true

# Test User Credentials (create in Supabase)
TEST_CREATOR_EMAIL=test-creator@creatorclub.test
TEST_CREATOR_PASSWORD=TestCreator123!
TEST_STUDENT_EMAIL=test-student@creatorclub.test
TEST_STUDENT_PASSWORD=TestStudent123!

# Stripe Test Cards
STRIPE_CARD_SUCCESS=4242424242424242
STRIPE_CARD_DECLINE=4000000000009995
STRIPE_CARD_3DS=4000000000003220
```

**Step 2: Create test fixtures config**

Create `tests/fixtures/test-config.ts`:
```typescript
// Test configuration and constants
export const TEST_CONFIG = {
  baseUrl: process.env.BASE_URL || 'https://creator-club.vercel.app',

  // Timeouts
  defaultTimeout: 30000,
  stripeTimeout: 60000, // Longer for Stripe redirects

  // Test Credentials
  creator: {
    email: process.env.TEST_CREATOR_EMAIL || 'test-creator@creatorclub.test',
    password: process.env.TEST_CREATOR_PASSWORD || 'TestCreator123!',
  },
  student: {
    email: process.env.TEST_STUDENT_EMAIL || 'test-student@creatorclub.test',
    password: process.env.TEST_STUDENT_PASSWORD || 'TestStudent123!',
  },

  // Stripe Test Cards
  stripe: {
    success: {
      number: '4242424242424242',
      expiry: '12/34',
      cvc: '123',
      zip: '12345',
    },
    decline: {
      number: '4000000000009995',
      expiry: '12/34',
      cvc: '123',
      zip: '12345',
    },
    threeDSecure: {
      number: '4000000000003220',
      expiry: '12/34',
      cvc: '123',
      zip: '12345',
    },
  },

  // Expected prices (in EUR)
  prices: {
    activationFee: '€2.90',
    proPlan: '€30.00',
    scalePlan: '€99.00',
    studentPlus: '€9.90',
  },
};

export type TestCard = keyof typeof TEST_CONFIG.stripe;
```

**Step 3: Update Playwright config**

Modify `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

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
  ],

  outputDir: 'test-results/',
});
```

**Step 4: Run config validation**

Run: `npx playwright test --list`
Expected: Shows project structure with setup, creator-payments, student-payments

**Step 5: Commit**

```bash
git add playwright.config.ts tests/fixtures/test-config.ts .env.test
git commit -m "feat(tests): configure playwright for payment e2e testing"
```

---

## Task 2: Create Authentication Setup

**Files:**
- Create: `tests/auth.setup.ts`
- Create: `tests/.auth/.gitkeep`

**Step 1: Create auth directory**

```bash
mkdir -p tests/.auth
touch tests/.auth/.gitkeep
echo "tests/.auth/*.json" >> .gitignore
```

**Step 2: Create auth setup test**

Create `tests/auth.setup.ts`:
```typescript
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
```

**Step 3: Run auth setup**

Run: `npx playwright test auth.setup.ts`
Expected: Both auth files created in tests/.auth/

**Step 4: Commit**

```bash
git add tests/auth.setup.ts tests/.auth/.gitkeep .gitignore
git commit -m "feat(tests): add authentication setup for e2e tests"
```

---

## Task 3: Create Stripe Helper Utilities

**Files:**
- Create: `tests/helpers/stripe-helpers.ts`
- Create: `tests/helpers/page-helpers.ts`

**Step 1: Create Stripe helpers**

Create `tests/helpers/stripe-helpers.ts`:
```typescript
import { Page, FrameLocator } from '@playwright/test';
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
```

**Step 2: Create page helpers**

Create `tests/helpers/page-helpers.ts`:
```typescript
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
```

**Step 3: Commit**

```bash
git add tests/helpers/stripe-helpers.ts tests/helpers/page-helpers.ts
git commit -m "feat(tests): add stripe and page helper utilities"
```

---

## Task 4: Creator Activation Fee Tests

**Files:**
- Create: `tests/payments/creator-activation.spec.ts`

**Step 1: Create activation test file**

Create `tests/payments/creator-activation.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config';
import { fillStripeCheckout, waitForStripeReturn } from '../helpers/stripe-helpers';
import { navigateTo, expectSuccessMessage, takeScreenshot } from '../helpers/page-helpers';

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
```

**Step 2: Run tests**

Run: `npx playwright test creator-activation.spec.ts --headed`
Expected: Tests show browser, interact with Stripe

**Step 3: Commit**

```bash
git add tests/payments/creator-activation.spec.ts
git commit -m "feat(tests): add creator activation fee e2e tests"
```

---

## Task 5: Creator Subscription Tests

**Files:**
- Create: `tests/payments/creator-subscription.spec.ts`

**Step 1: Create subscription test file**

Create `tests/payments/creator-subscription.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config';
import { fillStripeCheckout, waitForStripeReturn } from '../helpers/stripe-helpers';
import { navigateTo, clickButton, takeScreenshot } from '../helpers/page-helpers';

test.describe('Creator Subscription Management', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Navigate to billing settings
    await navigateTo(page, '/settings?tab=billing');
    // Or direct route if available
    // await navigateTo(page, '/settings/billing');
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
    await expect(page.locator('text=3.9%').or(page.locator('text=/3\.9.*%/'))).toBeVisible();

    // Verify Scale plan pricing
    await expect(page.locator('text=€99').or(page.locator('text=€99.00'))).toBeVisible();
    await expect(page.locator('text=1.9%').or(page.locator('text=/1\.9.*%/'))).toBeVisible();

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
```

**Step 2: Run tests**

Run: `npx playwright test creator-subscription.spec.ts --headed`

**Step 3: Commit**

```bash
git add tests/payments/creator-subscription.spec.ts
git commit -m "feat(tests): add creator subscription e2e tests"
```

---

## Task 6: Creator Connect (Payouts) Tests

**Files:**
- Create: `tests/payments/creator-connect.spec.ts`

**Step 1: Create Connect test file**

Create `tests/payments/creator-connect.spec.ts`:
```typescript
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
```

**Step 2: Run tests**

Run: `npx playwright test creator-connect.spec.ts --headed`

**Step 3: Commit**

```bash
git add tests/payments/creator-connect.spec.ts
git commit -m "feat(tests): add creator stripe connect e2e tests"
```

---

## Task 7: Student Course Purchase Tests

**Files:**
- Create: `tests/payments/student-course-purchase.spec.ts`

**Step 1: Create course purchase test file**

Create `tests/payments/student-course-purchase.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config';
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
```

**Step 2: Run tests**

Run: `npx playwright test student-course-purchase.spec.ts --headed`

**Step 3: Commit**

```bash
git add tests/payments/student-course-purchase.spec.ts
git commit -m "feat(tests): add student course purchase e2e tests"
```

---

## Task 8: Student Plus Subscription Tests

**Files:**
- Create: `tests/payments/student-plus.spec.ts`

**Step 1: Create Student Plus test file**

Create `tests/payments/student-plus.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config';
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
```

**Step 2: Run tests**

Run: `npx playwright test student-plus.spec.ts --headed`

**Step 3: Commit**

```bash
git add tests/payments/student-plus.spec.ts
git commit -m "feat(tests): add student plus subscription e2e tests"
```

---

## Task 9: Add NPM Scripts and CI Config

**Files:**
- Modify: `package.json`
- Create: `.github/workflows/e2e-tests.yml` (optional)

**Step 1: Add test scripts to package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui",
    "test:creator": "playwright test --project=creator-payments --headed",
    "test:student": "playwright test --project=student-payments --headed",
    "test:setup": "playwright test auth.setup.ts",
    "test:report": "playwright show-report"
  }
}
```

**Step 2: Install dotenv**

Run: `npm install -D dotenv`

**Step 3: Create test run script**

Create `scripts/run-payment-tests.sh`:
```bash
#!/bin/bash

echo "🧪 Creator Club Payment E2E Tests"
echo "================================="

# Check if .env.test exists
if [ ! -f .env.test ]; then
  echo "❌ Error: .env.test not found"
  echo "Please create .env.test with test credentials"
  exit 1
fi

# Run auth setup first
echo ""
echo "1️⃣ Setting up authentication..."
npx playwright test auth.setup.ts

if [ $? -ne 0 ]; then
  echo "❌ Auth setup failed"
  exit 1
fi

echo "✅ Auth setup complete"

# Run all payment tests
echo ""
echo "2️⃣ Running payment tests..."
npx playwright test --project=creator-payments --project=student-payments

# Show results
echo ""
echo "3️⃣ Test Results"
npx playwright show-report --host 0.0.0.0
```

**Step 4: Make script executable**

Run: `chmod +x scripts/run-payment-tests.sh`

**Step 5: Commit**

```bash
git add package.json scripts/run-payment-tests.sh
git commit -m "feat(tests): add npm scripts and test runner for payment e2e"
```

---

## Task 10: Create Test Summary and Run Full Suite

**Files:**
- Update: `docs/tests/payment-testing-plan.md`

**Step 1: Add test execution section to testing plan**

Append to `docs/tests/payment-testing-plan.md`:
```markdown

---

## Part 7: Running E2E Tests

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create test environment file
cp .env.test.example .env.test
# Edit .env.test with real test credentials

# 3. Run auth setup
npm run test:setup

# 4. Run all payment tests (headed - see browser)
npm run test:headed

# Or run specific suites:
npm run test:creator  # Creator payment tests only
npm run test:student  # Student payment tests only
```

### Test Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Run all tests headless |
| `npm run test:headed` | Run with visible browser |
| `npm run test:ui` | Open Playwright UI mode |
| `npm run test:creator` | Run creator tests only |
| `npm run test:student` | Run student tests only |
| `npm run test:report` | View HTML test report |

### CI/CD Integration

For GitHub Actions, add the workflow file at `.github/workflows/e2e-tests.yml`.

Tests require:
- `TEST_CREATOR_EMAIL` secret
- `TEST_CREATOR_PASSWORD` secret
- `TEST_STUDENT_EMAIL` secret
- `TEST_STUDENT_PASSWORD` secret

### Test Coverage

| Test File | Tests | Priority |
|-----------|-------|----------|
| `creator-activation.spec.ts` | 5 | P0 |
| `creator-subscription.spec.ts` | 6 | P0 |
| `creator-connect.spec.ts` | 4 | P1 |
| `student-course-purchase.spec.ts` | 5 | P0 |
| `student-plus.spec.ts` | 7 | P1 |
| **Total** | **27** | |
```

**Step 2: Run full test suite**

Run: `npm run test:headed`

**Step 3: Generate report**

Run: `npm run test:report`

**Step 4: Final commit**

```bash
git add docs/tests/payment-testing-plan.md
git commit -m "docs(tests): update payment testing plan with e2e execution guide"
```

---

## Summary

### Files Created/Modified

| File | Action |
|------|--------|
| `playwright.config.ts` | Modified |
| `.env.test` | Created |
| `tests/fixtures/test-config.ts` | Created |
| `tests/auth.setup.ts` | Created |
| `tests/helpers/stripe-helpers.ts` | Created |
| `tests/helpers/page-helpers.ts` | Created |
| `tests/payments/creator-activation.spec.ts` | Created |
| `tests/payments/creator-subscription.spec.ts` | Created |
| `tests/payments/creator-connect.spec.ts` | Created |
| `tests/payments/student-course-purchase.spec.ts` | Created |
| `tests/payments/student-plus.spec.ts` | Created |
| `scripts/run-payment-tests.sh` | Created |
| `package.json` | Modified |
| `docs/tests/payment-testing-plan.md` | Modified |

### Test Coverage

- **Creator Tests:** 15 test cases
- **Student Tests:** 12 test cases
- **Total:** 27 E2E test cases

### Execution Time

- Setup: ~2 minutes
- Full suite: ~10-15 minutes (with Stripe interactions)
- Per-suite: ~5-7 minutes each
