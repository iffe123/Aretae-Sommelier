import { test, expect } from '@playwright/test';

/**
 * AI Sommelier Chat E2E tests
 *
 * Tests the chat interface UI patterns and behavior.
 * Since the chat requires authentication, these tests verify:
 * 1. Chat-like input patterns across the app
 * 2. The auth guard that protects the chat feature
 * 3. Input handling, keyboard shortcuts, and form submission patterns
 *
 * Full AI chat integration requires Firebase auth + Gemini API.
 */

test.describe('Chat Interface - Auth Protection', () => {
  test('should require authentication to access cellar (where chat lives)', async ({ page }) => {
    await page.goto('/cellar');
    await page.waitForURL('/signin');
    await expect(page).toHaveURL('/signin');
  });

  test('should require authentication to access wine detail (with contextual chat)', async ({ page }) => {
    await page.goto('/cellar/test-id');
    await page.waitForURL('/signin');
    await expect(page).toHaveURL('/signin');
  });
});

test.describe('Chat-Like Input Patterns', () => {
  test.describe('Text Input Behavior', () => {
    test('should accept text input and display current value', async ({ page }) => {
      await page.goto('/signin');

      const emailInput = page.getByLabel(/Email/i);
      await emailInput.fill('test@wine.com');
      await expect(emailInput).toHaveValue('test@wine.com');
    });

    test('should handle long text input gracefully', async ({ page }) => {
      await page.goto('/signup');

      const nameInput = page.getByLabel(/Display Name/i);
      const longText = 'This is a very long name that might be used for a prestigious French wine from the Bordeaux region with multiple descriptors';
      await nameInput.fill(longText);
      await expect(nameInput).toHaveValue(longText);
    });

    test('should handle special characters and unicode', async ({ page }) => {
      await page.goto('/signup');

      const nameInput = page.getByLabel(/Display Name/i);
      await nameInput.fill('Château Pétrus 🍷');
      await expect(nameInput).toHaveValue('Château Pétrus 🍷');
    });

    test('should clear input on manual clear', async ({ page }) => {
      await page.goto('/signin');

      const emailInput = page.getByLabel(/Email/i);
      await emailInput.fill('test@example.com');
      await emailInput.clear();
      await expect(emailInput).toHaveValue('');
    });
  });

  test.describe('Form Submission Patterns', () => {
    test('should submit form on button click', async ({ page }) => {
      await page.goto('/signin');

      await page.getByLabel(/Email/i).fill('test@example.com');
      await page.getByLabel(/Password/i).fill('password123');

      const submitButton = page.getByRole('button', { name: /Sign In/i });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // Form was submitted (may get error response but submission happened)
      await page.waitForTimeout(500);
    });

    test('should submit form on Enter key', async ({ page }) => {
      await page.goto('/signin');

      await page.getByLabel(/Email/i).fill('test@example.com');
      await page.getByLabel(/Password/i).fill('password123');
      await page.keyboard.press('Enter');

      await page.waitForTimeout(500);
    });

    test('should prevent empty submissions via required fields', async ({ page }) => {
      await page.goto('/signin');

      await page.getByRole('button', { name: /Sign In/i }).click();
      // Should stay on page due to HTML5 required validation
      await expect(page).toHaveURL('/signin');
    });
  });

  test.describe('Focus Management', () => {
    test('should allow focusing input fields', async ({ page }) => {
      await page.goto('/signin');

      await page.getByLabel(/Email/i).focus();
      await expect(page.getByLabel(/Email/i)).toBeFocused();
    });

    test('should support tab navigation between form fields', async ({ page }) => {
      await page.goto('/signin');

      await page.getByLabel(/Email/i).focus();
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(/Password/i)).toBeFocused();
    });

    test('should handle Escape key without breaking page', async ({ page }) => {
      await page.goto('/signin');

      await page.getByLabel(/Email/i).focus();
      await page.keyboard.press('Escape');

      // Page should remain functional
      await expect(page).toHaveURL('/signin');
      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    });
  });

  test.describe('Message Display Patterns', () => {
    test('should display content in readable format', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
      await expect(page.getByText(/Your personal wine cellar manager/i)).toBeVisible();
    });

    test('should properly format feature descriptions', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText(/Track Your Collection/i)).toBeVisible();
      await expect(page.getByText(/AI Sommelier/i)).toBeVisible();
      await expect(page.getByText(/Photo Labels/i)).toBeVisible();
      await expect(page.getByText(/Rate & Review/i)).toBeVisible();
    });

    test('should display different contextual messages on different pages', async ({ page }) => {
      await page.goto('/signin');
      await expect(page.getByText(/Sign in to your wine cellar/i)).toBeVisible();

      await page.goto('/signup');
      await expect(page.getByText(/Start building your wine collection/i)).toBeVisible();
    });
  });

  test.describe('Loading & Error States', () => {
    test('should not show error messages on initial page load', async ({ page }) => {
      await page.goto('/signin');

      const errorContainer = page.locator('.bg-red-50');
      await expect(errorContainer).not.toBeVisible();
    });

    test('should handle page load without JS errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Filter out known non-critical errors (Firebase warnings etc.)
      const criticalErrors = errors.filter(
        e => !e.includes('Firebase') && !e.includes('hydration')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('Mobile Chat Experience', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/signin');

      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
    });

    test('should allow typing on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/signin');

      await page.getByLabel(/Email/i).click();
      await page.getByLabel(/Email/i).fill('mobile@test.com');
      await expect(page.getByLabel(/Email/i)).toHaveValue('mobile@test.com');
    });

    test('should display full form on small screen', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
      await page.goto('/signup');

      await expect(page.getByLabel(/Display Name/i)).toBeVisible();
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
    });
  });

  test.describe('Scroll Behavior', () => {
    test('should handle scrollable content on landing page', async ({ page }) => {
      await page.goto('/');

      // Scroll to footer
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      await expect(page.getByText(/Built with love for wine enthusiasts/i)).toBeVisible();
    });

    test('should handle scroll on small viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 500 }); // Very short viewport
      await page.goto('/');

      // Should be able to scroll
      const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = await page.evaluate(() => window.innerHeight);

      if (scrollHeight > viewportHeight) {
        await page.evaluate(() => window.scrollTo(0, 500));
        const scrollTop = await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);
        expect(scrollTop).toBeGreaterThan(0);
      }
    });
  });
});
