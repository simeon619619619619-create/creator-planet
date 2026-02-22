import { test, expect } from '@playwright/test';

/**
 * Quick QA Test - Explore the public site and document what we find
 */

const VERCEL_URL = 'https://creator-club.vercel.app';

test.describe('Quick Site Exploration', () => {
  test('Explore public pages and capture screenshots', async ({ page }) => {
    // 1. Landing page
    console.log('1. Loading landing page...');
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: '.playwright-mcp/landing-page.png',
      fullPage: true
    });

    // Check for navigation links
    const features = await page.locator('text=Features').count();
    const pricing = await page.locator('text=Pricing').count();
    const testimonials = await page.locator('text=Testimonials').count();

    console.log(`   Features link: ${features > 0 ? '✅' : '❌'}`);
    console.log(`   Pricing link: ${pricing > 0 ? '✅' : '❌'}`);
    console.log(`   Testimonials link: ${testimonials > 0 ? '✅' : '❌'}`);

    // 2. Try to navigate to login
    console.log('\n2. Looking for login/auth pages...');

    // Try direct URL
    await page.goto(`${VERCEL_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: '.playwright-mcp/login-page.png',
      fullPage: true
    });

    // Check if it's actually a login page
    const hasLoginForm = await page.locator('input[type="email"]').count();
    const hasPasswordField = await page.locator('input[type="password"]').count();
    console.log(`   Login form found: ${hasLoginForm > 0 && hasPasswordField > 0 ? '✅' : '❌'}`);

    // 3. Try signup page
    console.log('\n3. Checking signup page...');
    await page.goto(`${VERCEL_URL}/signup`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: '.playwright-mcp/signup-page.png',
      fullPage: true
    });

    // 4. Try app page (might redirect to login)
    console.log('\n4. Attempting to access /app (should redirect)...');
    await page.goto(`${VERCEL_URL}/app`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: '.playwright-mcp/app-redirect.png',
      fullPage: true
    });

    // Check current URL
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);
    console.log(`   Redirected to login: ${currentUrl.includes('/login') ? '✅' : '❌'}`);

    console.log('\n✅ Site exploration complete!');
    console.log('📸 Screenshots saved to .playwright-mcp/');
    console.log('\n📝 Next step: Manual login required to test protected features.');
  });

  test('Test with demo credentials if available', async ({ page }) => {
    await page.goto(`${VERCEL_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Try common demo credentials
    const demoCredentials = [
      { email: 'demo@creator-club.com', password: 'demo123' },
      { email: 'test@creator-club.com', password: 'test123' },
      { email: 'creator@example.com', password: 'creator123' },
    ];

    console.log('Attempting login with demo credentials...');

    for (const cred of demoCredentials) {
      console.log(`\nTrying: ${cred.email}`);

      // Fill email
      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill(cred.email);

      // Fill password
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill(cred.password);

      // Take screenshot before submit
      await page.screenshot({
        path: `.playwright-mcp/login-attempt-${cred.email.split('@')[0]}.png`,
        fullPage: true
      });

      // Click submit
      const submitBtn = page.locator('button[type="submit"]').or(
        page.locator('button:has-text("Sign In")')
      );

      if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
        await page.waitForTimeout(3000);

        // Check if login was successful
        const currentUrl = page.url();
        const hasError = await page.locator('text=/error|invalid|incorrect/i').count();

        if (currentUrl.includes('/app') || currentUrl.includes('/dashboard')) {
          console.log(`✅ Login successful with ${cred.email}!`);
          await page.screenshot({
            path: '.playwright-mcp/logged-in-dashboard.png',
            fullPage: true
          });

          // Continue with feature tests
          await runFeatureTests(page);
          return;
        } else if (hasError > 0) {
          console.log(`❌ Login failed - credentials rejected`);
        } else {
          console.log(`⏸️  Login status unclear`);
        }
      }

      // Reset for next attempt
      await page.goto(`${VERCEL_URL}/login`);
      await page.waitForLoadState('networkidle');
    }

    console.log('\n❌ No demo credentials worked. Manual login required.');
  });
});

async function runFeatureTests(page: any) {
  console.log('\n🧪 Running feature tests...\n');

  // Test 1: Dashboard KPI Cards
  console.log('Test 1: Dashboard - Inactive Students KPI');
  const kpiCards = [
    'Total Students',
    'Active Students',
    'Completion Rate',
    'At Risk',
    'Inactive (7d+)'
  ];

  for (const title of kpiCards) {
    const found = await page.locator(`text=${title}`).count();
    console.log(`  ${found > 0 ? '✅' : '❌'} ${title}`);
  }

  await page.screenshot({
    path: '.playwright-mcp/feature-1-dashboard-kpis.png',
    fullPage: true
  });

  // Test 2: AI Success Manager Filters
  console.log('\nTest 2: AI Success Manager - Student Status Filter');

  // Try to navigate to AI Success Manager
  const aiLink = page.locator('text=AI Success Manager').or(
    page.locator('text=AI Manager')
  ).first();

  if (await aiLink.count() > 0) {
    await aiLink.click();
    await page.waitForTimeout(2000);

    const filters = ['At Risk', 'Stable', 'Top', 'All'];
    for (const filter of filters) {
      const found = await page.locator(`button:has-text("${filter}")`).count();
      console.log(`  ${found > 0 ? '✅' : '❌'} ${filter} filter`);
    }

    await page.screenshot({
      path: '.playwright-mcp/feature-2-ai-manager-filters.png',
      fullPage: true
    });

    // Test 3: Chat Features
    console.log('\nTest 3: AI Success Manager - Chat Features');

    const newChat = await page.locator('button:has-text("New Chat")').count();
    const history = await page.locator('button:has-text("History")').count();

    console.log(`  ${newChat > 0 ? '✅' : '❌'} New Chat button`);
    console.log(`  ${history > 0 ? '✅' : '❌'} History button`);

    await page.screenshot({
      path: '.playwright-mcp/feature-3-chat-features.png',
      fullPage: true
    });
  } else {
    console.log('  ❌ Could not find AI Success Manager navigation');
  }

  console.log('\n✅ Feature tests completed!');
}
