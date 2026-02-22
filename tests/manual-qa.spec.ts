import { test, expect } from '@playwright/test';

/**
 * Manual QA Test for AI Chat Enhancements
 * This test will navigate through the site and take screenshots
 * It requires manual login since we don't have test credentials
 */

const VERCEL_URL = 'https://creator-club.vercel.app';

test.describe('Manual QA - AI Chat Enhancements', () => {
  test('Navigate and screenshot the app', async ({ page }) => {
    // Navigate to landing page
    await page.goto(VERCEL_URL);
    await page.waitForLoadState('networkidle');

    // Screenshot landing page
    await page.screenshot({
      path: '.playwright-mcp/1-landing-page.png',
      fullPage: true
    });

    // Try to find and click "Get Started" or "Start Free Trial"
    const getStartedBtn = page.locator('button:has-text("Get Started")').or(
      page.locator('button:has-text("Start Free Trial")')
    );

    if (await getStartedBtn.count() > 0) {
      await getStartedBtn.first().click();
      await page.waitForLoadState('networkidle');

      // Screenshot signup/login page
      await page.screenshot({
        path: '.playwright-mcp/2-auth-page.png',
        fullPage: true
      });
    }

    // Check if there's a login link in header
    const loginLink = page.locator('text=Login').or(page.locator('text=Sign In'));
    if (await loginLink.count() > 0) {
      await loginLink.first().click();
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: '.playwright-mcp/3-login-page.png',
        fullPage: true
      });
    }

    // Pause for manual login
    console.log('\n📋 MANUAL STEP REQUIRED:');
    console.log('Please log in manually in the browser window that opened.');
    console.log('The test will continue after 60 seconds...\n');

    // Wait 60 seconds for manual login
    await page.waitForTimeout(60000);

    // Check if we're logged in (looking for dashboard or app elements)
    const isDashboard = await page.locator('text=Creator Dashboard').count();
    const isAppPage = await page.locator('text=AI Success Manager').count();

    if (isDashboard > 0 || isAppPage > 0) {
      console.log('✅ Login detected, continuing with tests...\n');

      // Screenshot dashboard
      await page.screenshot({
        path: '.playwright-mcp/4-dashboard.png',
        fullPage: true
      });

      // Test 1: Check for 5 KPI cards
      if (isDashboard > 0) {
        console.log('Testing Dashboard KPI cards...');

        const kpiCards = [
          'Total Students',
          'Active Students',
          'Completion Rate',
          'At Risk',
          'Inactive (7d+)'
        ];

        for (const title of kpiCards) {
          const card = await page.locator(`text=${title}`).count();
          console.log(`  ${card > 0 ? '✅' : '❌'} ${title}: ${card > 0 ? 'Found' : 'Not found'}`);
        }

        // Screenshot just the KPI section
        const kpiSection = page.locator('.grid').first();
        if (await kpiSection.count() > 0) {
          await kpiSection.screenshot({
            path: '.playwright-mcp/5-kpi-cards.png'
          });
        }
      }

      // Test 2: Navigate to AI Success Manager
      console.log('\nNavigating to AI Success Manager...');
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      ).first();

      if (await aiManagerLink.count() > 0) {
        await aiManagerLink.click();
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: '.playwright-mcp/6-ai-success-manager.png',
          fullPage: true
        });

        // Check for filter buttons
        console.log('Checking for student status filters...');
        const filters = ['At Risk', 'Stable', 'Top', 'All'];
        for (const filter of filters) {
          const filterBtn = await page.locator(`button:has-text("${filter}")`).count();
          console.log(`  ${filterBtn > 0 ? '✅' : '❌'} ${filter}: ${filterBtn > 0 ? 'Found' : 'Not found'}`);
        }

        // Screenshot filters section
        await page.screenshot({
          path: '.playwright-mcp/7-filters.png'
        });

        // Test each filter
        for (const filter of filters) {
          const filterBtn = page.locator(`button:has-text("${filter}")`).first();
          if (await filterBtn.count() > 0) {
            await filterBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({
              path: `.playwright-mcp/8-filter-${filter.toLowerCase().replace(' ', '-')}.png`,
              fullPage: true
            });
          }
        }

        // Test 3: Check for chat features
        console.log('\nChecking for chat features...');
        const newChatBtn = await page.locator('button:has-text("New Chat")').count();
        const historyBtn = await page.locator('button:has-text("History")').count();

        console.log(`  ${newChatBtn > 0 ? '✅' : '❌'} New Chat button: ${newChatBtn > 0 ? 'Found' : 'Not found'}`);
        console.log(`  ${historyBtn > 0 ? '✅' : '❌'} History button: ${historyBtn > 0 ? 'Found' : 'Not found'}`);

        // Click History to see dropdown
        if (historyBtn > 0) {
          await page.locator('button:has-text("History")').click();
          await page.waitForTimeout(500);
          await page.screenshot({
            path: '.playwright-mcp/9-history-dropdown.png',
            fullPage: true
          });
        }

        // Try to send a test message
        const chatInput = page.locator('input[placeholder*="Ask"]').or(
          page.locator('textarea[placeholder*="Ask"]')
        );

        if (await chatInput.count() > 0) {
          await chatInput.first().fill('Test message for QA');
          await page.screenshot({
            path: '.playwright-mcp/10-chat-typed-message.png',
            fullPage: true
          });

          // Click send button
          const sendBtn = page.locator('button:has([class*="lucide-send"])');
          if (await sendBtn.count() > 0) {
            await sendBtn.click();
            await page.waitForTimeout(3000);
            await page.screenshot({
              path: '.playwright-mcp/11-chat-message-sent.png',
              fullPage: true
            });
          }
        }
      }

      console.log('\n✅ Manual QA test completed!');
      console.log('Check the .playwright-mcp/ folder for screenshots.\n');
    } else {
      console.log('❌ Could not detect login. Please check manually.');
      await page.screenshot({
        path: '.playwright-mcp/error-not-logged-in.png',
        fullPage: true
      });
    }
  });
});
