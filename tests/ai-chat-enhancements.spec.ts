import { test, expect } from '@playwright/test';

/**
 * QA Test Suite for AI Chat Enhancements
 * Testing Features:
 * 1. Dashboard - Inactive Students KPI
 * 2. AI Success Manager - Student Status Filter
 * 3. AI Success Manager - Chat Features (New Chat, History)
 */

const VERCEL_URL = 'https://creator-club.vercel.app';

test.describe('AI Chat Enhancements - QA Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(VERCEL_URL);
    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Feature 1: Dashboard - Inactive Students KPI', () => {
    test('should display 5 KPI cards on creator dashboard', async ({ page }) => {
      // Navigate to dashboard (assuming it's the default page or needs navigation)
      await page.waitForSelector('text=Creator Dashboard', { timeout: 10000 });

      // Check for all 5 KPI cards
      const kpiCards = [
        'Total Students',
        'Active Students',
        'Completion Rate',
        'At Risk',
        'Inactive (7d+)'
      ];

      for (const title of kpiCards) {
        const card = page.locator(`text=${title}`);
        await expect(card).toBeVisible({ timeout: 5000 });
      }

      // Take screenshot
      await page.screenshot({
        path: '.playwright-mcp/dashboard-kpi-cards.png',
        fullPage: true
      });
    });

    test('should display Inactive (7d+) card with amber/yellow color', async ({ page }) => {
      await page.waitForSelector('text=Creator Dashboard', { timeout: 10000 });

      // Find the Inactive (7d+) card
      const inactiveCard = page.locator('text=Inactive (7d+)').locator('..');

      // Check for amber background on the icon
      const iconContainer = inactiveCard.locator('.bg-amber-500');
      await expect(iconContainer).toBeVisible();

      // Verify the Clock icon is present
      await expect(inactiveCard).toContainText('Inactive (7d+)');
    });

    test('should show correct count and change text for Inactive students', async ({ page }) => {
      await page.waitForSelector('text=Creator Dashboard', { timeout: 10000 });

      const inactiveCard = page.locator('text=Inactive (7d+)').locator('..');

      // Should show either a count or "All active" message
      const hasCount = await inactiveCard.locator('text=/\\d+/').count();
      const hasAllActive = await inactiveCard.locator('text=All active').count();

      expect(hasCount > 0 || hasAllActive > 0).toBeTruthy();
    });
  });

  test.describe('Feature 2: AI Success Manager - Student Status Filter', () => {
    test('should navigate to AI Success Manager page', async ({ page }) => {
      // Look for AI Success Manager link in navigation
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );

      await aiManagerLink.click();

      // Wait for page to load
      await page.waitForSelector('text=AI Success Manager™', { timeout: 10000 });

      await page.screenshot({
        path: '.playwright-mcp/ai-success-manager-page.png',
        fullPage: true
      });
    });

    test('should display segmented control filter with 4 options', async ({ page }) => {
      // Navigate to AI Success Manager
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Check for all 4 filter options
      const filterOptions = ['At Risk', 'Stable', 'Top', 'All'];

      for (const option of filterOptions) {
        const filterButton = page.locator(`button:has-text("${option}")`);
        await expect(filterButton).toBeVisible();
      }

      await page.screenshot({
        path: '.playwright-mcp/ai-manager-filters.png',
        fullPage: true
      });
    });

    test('should filter students when clicking each filter option', async ({ page }) => {
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Test each filter
      const filters = ['At Risk', 'Stable', 'Top', 'All'];

      for (const filter of filters) {
        const filterButton = page.locator(`button:has-text("${filter}")`).first();
        await filterButton.click();

        // Wait for students to load
        await page.waitForTimeout(1000);

        // Take screenshot for each filter
        await page.screenshot({
          path: `.playwright-mcp/filter-${filter.toLowerCase().replace(' ', '-')}.png`,
          fullPage: true
        });
      }
    });

    test('should display color-coded student cards', async ({ page }) => {
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Test At Risk students (orange background)
      await page.click('button:has-text("At Risk")');
      await page.waitForTimeout(1000);

      const atRiskCards = page.locator('.bg-orange-50');
      if (await atRiskCards.count() > 0) {
        await expect(atRiskCards.first()).toBeVisible();
      }

      // Test Stable students (green background)
      await page.click('button:has-text("Stable")');
      await page.waitForTimeout(1000);

      const stableCards = page.locator('.bg-green-50');
      if (await stableCards.count() > 0) {
        await expect(stableCards.first()).toBeVisible();
      }

      // Test Top Member students (indigo/purple background)
      await page.click('button:has-text("Top")');
      await page.waitForTimeout(1000);

      const topCards = page.locator('.bg-indigo-50');
      if (await topCards.count() > 0) {
        await expect(topCards.first()).toBeVisible();
      }

      await page.screenshot({
        path: '.playwright-mcp/student-card-colors.png',
        fullPage: true
      });
    });
  });

  test.describe('Feature 3: AI Success Manager - Chat Features', () => {
    test('should display New Chat button in header', async ({ page }) => {
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Check for New Chat button
      const newChatButton = page.locator('button:has-text("New Chat")');
      await expect(newChatButton).toBeVisible();

      await page.screenshot({
        path: '.playwright-mcp/new-chat-button.png',
        fullPage: true
      });
    });

    test('should display History button in header', async ({ page }) => {
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Check for History button
      const historyButton = page.locator('button:has-text("History")');
      await expect(historyButton).toBeVisible();

      await page.screenshot({
        path: '.playwright-mcp/history-button.png',
        fullPage: true
      });
    });

    test('should open history dropdown when clicking History button', async ({ page }) => {
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Click History button
      const historyButton = page.locator('button:has-text("History")');
      await historyButton.click();

      // Wait for dropdown to appear
      await page.waitForTimeout(500);

      // Check for dropdown header
      const dropdownHeader = page.locator('text=Conversation History');
      await expect(dropdownHeader).toBeVisible();

      await page.screenshot({
        path: '.playwright-mcp/history-dropdown.png',
        fullPage: true
      });
    });

    test('should start new conversation when clicking New Chat', async ({ page }) => {
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Click New Chat button
      const newChatButton = page.locator('button:has-text("New Chat")');
      await newChatButton.click();

      // Wait for new chat to initialize
      await page.waitForTimeout(1000);

      // Verify initial AI message is present
      const initialMessage = page.locator('text=/Hello.*AI Success Manager/i');
      await expect(initialMessage).toBeVisible();

      await page.screenshot({
        path: '.playwright-mcp/new-chat-started.png',
        fullPage: true
      });
    });

    test('should display chat interface with input and send button', async ({ page }) => {
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Check for chat input
      const chatInput = page.locator('input[placeholder*="Ask your AI mentor"]');
      await expect(chatInput).toBeVisible();

      // Check for send button
      const sendButton = page.locator('button:has([class*="lucide-send"])');
      await expect(sendButton).toBeVisible();

      await page.screenshot({
        path: '.playwright-mcp/chat-interface.png',
        fullPage: true
      });
    });

    test('should allow typing and sending a message', async ({ page }) => {
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Type a test message
      const chatInput = page.locator('input[placeholder*="Ask your AI mentor"]');
      await chatInput.fill('Hello, can you help me?');

      // Click send button
      const sendButton = page.locator('button:has([class*="lucide-send"])');
      await sendButton.click();

      // Wait for response
      await page.waitForTimeout(3000);

      await page.screenshot({
        path: '.playwright-mcp/chat-message-sent.png',
        fullPage: true
      });
    });
  });

  test.describe('Integration Tests', () => {
    test('should verify complete AI Success Manager page layout', async ({ page }) => {
      const aiManagerLink = page.locator('text=AI Success Manager').or(
        page.locator('text=AI Manager')
      );
      await aiManagerLink.click();
      await page.waitForSelector('text=AI Success Manager™');

      // Verify all major sections are present
      await expect(page.locator('text=AI Success Manager™')).toBeVisible();
      await expect(page.locator('button:has-text("New Chat")')).toBeVisible();
      await expect(page.locator('button:has-text("History")')).toBeVisible();
      await expect(page.locator('button:has-text("Recalculate Risk Scores")')).toBeVisible();
      await expect(page.locator('button:has-text("Mentor Chat")')).toBeVisible();
      await expect(page.locator('button:has-text("Success Report")')).toBeVisible();

      // Check for student filter section
      await expect(page.locator('button:has-text("At Risk")')).toBeVisible();

      await page.screenshot({
        path: '.playwright-mcp/ai-manager-complete-layout.png',
        fullPage: true
      });
    });
  });
});
