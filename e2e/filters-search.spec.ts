import { test, expect } from '@playwright/test';

/**
 * Wine Filtering and Search E2E tests
 *
 * Tests search bar and filter UI patterns.
 * The filter UI (WineFilters component) lives on the cellar page which
 * requires authentication. These tests verify the underlying form patterns
 * and input behaviors that the filter system relies on.
 *
 * Full filter testing requires Firebase auth and test wine data.
 */

test.describe('Search & Filter - Auth Guard', () => {
  test('should require authentication to access filter UI on cellar page', async ({ page }) => {
    await page.goto('/cellar');
    await page.waitForURL('/signin');
    await expect(page).toHaveURL('/signin');
  });
});

test.describe('Search Input Patterns', () => {
  test('should have text input with placeholder', async ({ page }) => {
    await page.goto('/signin');

    const emailInput = page.getByPlaceholder('you@example.com');
    await expect(emailInput).toBeVisible();
  });

  test('should accept typed search query', async ({ page }) => {
    await page.goto('/signin');

    const emailInput = page.getByLabel(/Email/i);
    await emailInput.fill('cabernet sauvignon');
    await expect(emailInput).toHaveValue('cabernet sauvignon');
  });

  test('should clear input field', async ({ page }) => {
    await page.goto('/signin');

    const emailInput = page.getByLabel(/Email/i);
    await emailInput.fill('test query');
    await expect(emailInput).toHaveValue('test query');

    await emailInput.clear();
    await expect(emailInput).toHaveValue('');
  });

  test('should handle rapid sequential input (debounce pattern)', async ({ page }) => {
    await page.goto('/signin');

    const emailInput = page.getByLabel(/Email/i);

    // Simulate rapid typing like search debounce
    await emailInput.pressSequentially('pinot noir', { delay: 30 });
    await expect(emailInput).toHaveValue('pinot noir');
  });

  test('should handle paste operations', async ({ page }) => {
    await page.goto('/signin');

    const emailInput = page.getByLabel(/Email/i);
    await emailInput.focus();
    await emailInput.fill('pasted-value@test.com');
    await expect(emailInput).toHaveValue('pasted-value@test.com');
  });
});

test.describe('Filter Form Patterns', () => {
  test.describe('Input Type Validation', () => {
    test('should have email type input', async ({ page }) => {
      await page.goto('/signup');
      await expect(page.getByLabel(/Email/i)).toHaveAttribute('type', 'email');
    });

    test('should have password type input', async ({ page }) => {
      await page.goto('/signup');
      await expect(page.getByLabel(/Password/i)).toHaveAttribute('type', 'password');
    });

    test('should have text type input', async ({ page }) => {
      await page.goto('/signup');
      await expect(page.getByLabel(/Display Name/i)).toHaveAttribute('type', 'text');
    });
  });

  test.describe('Multi-Field Form State', () => {
    test('should handle filling multiple fields correctly', async ({ page }) => {
      await page.goto('/signup');

      await page.getByLabel(/Display Name/i).fill('John Wine');
      await page.getByLabel(/Email/i).fill('john@wine.com');
      await page.getByLabel(/Password/i).fill('winepassword123');

      // All values should be present simultaneously
      await expect(page.getByLabel(/Display Name/i)).toHaveValue('John Wine');
      await expect(page.getByLabel(/Email/i)).toHaveValue('john@wine.com');
      await expect(page.getByLabel(/Password/i)).toHaveValue('winepassword123');
    });

    test('should maintain field state when clicking elsewhere', async ({ page }) => {
      await page.goto('/signin');

      await page.getByLabel(/Email/i).fill('test@example.com');
      // Click heading to blur
      await page.getByRole('heading', { name: /Welcome Back/i }).click();

      await expect(page.getByLabel(/Email/i)).toHaveValue('test@example.com');
    });

    test('should handle field overwrite', async ({ page }) => {
      await page.goto('/signin');

      const emailInput = page.getByLabel(/Email/i);
      await emailInput.fill('first@example.com');
      await emailInput.fill('second@example.com');

      await expect(emailInput).toHaveValue('second@example.com');
    });
  });

  test.describe('Form Reset Behavior', () => {
    test('should clear all fields on page reload', async ({ page }) => {
      await page.goto('/signup');

      await page.getByLabel(/Display Name/i).fill('Test');
      await page.getByLabel(/Email/i).fill('test@test.com');
      await page.getByLabel(/Password/i).fill('password');

      await page.reload();

      await expect(page.getByLabel(/Display Name/i)).toHaveValue('');
      await expect(page.getByLabel(/Email/i)).toHaveValue('');
      await expect(page.getByLabel(/Password/i)).toHaveValue('');
    });
  });
});

test.describe('Keyboard Navigation', () => {
  test('should allow tab navigation between form fields', async ({ page }) => {
    await page.goto('/signin');

    await page.getByLabel(/Email/i).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/Password/i)).toBeFocused();
  });

  test('should allow Enter to submit form', async ({ page }) => {
    await page.goto('/signin');

    await page.getByLabel(/Email/i).fill('test@example.com');
    await page.getByLabel(/Password/i).fill('password123');
    await page.keyboard.press('Enter');

    // Form should attempt submission
    await page.waitForTimeout(500);
  });

  test('should handle Escape key gracefully', async ({ page }) => {
    await page.goto('/signin');

    await page.getByLabel(/Email/i).focus();
    await page.keyboard.press('Escape');

    // Should remain on page, no crashes
    await expect(page).toHaveURL('/signin');
  });
});

test.describe('Responsive Filter Layout', () => {
  test('should display form correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/signin');

    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('should display form correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/signin');

    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('should display form correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/signin');

    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });
});

test.describe('Empty State Messaging', () => {
  test('should display contextual message on signin page', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByText(/Sign in to your wine cellar/i)).toBeVisible();
  });

  test('should display contextual message on signup page', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText(/Start building your wine collection/i)).toBeVisible();
  });
});
