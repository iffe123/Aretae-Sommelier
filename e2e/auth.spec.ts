import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Landing Page → Auth Navigation', () => {
    test('should display landing page with auth CTAs for unauthenticated users', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Get Started Free/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Sign In/i })).toBeVisible();
    });

    test('should navigate to signup from "Get Started Free"', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Get Started Free/i }).click();

      await expect(page).toHaveURL('/signup');
      await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    });

    test('should navigate to signin from "Sign In"', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Sign In/i }).first().click();

      await expect(page).toHaveURL('/signin');
      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    });

    test('should navigate to signup from CTA section', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Create Your Free Account/i }).click();

      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Sign Up Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signup');
    });

    test('should display complete signup form', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
      await expect(page.getByText(/Start building your wine collection/i)).toBeVisible();

      // All required fields
      await expect(page.getByLabel(/Display Name/i)).toBeVisible();
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();

      // Google OAuth
      await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();

      // Separator and navigation
      await expect(page.getByText(/Or continue with/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible();
    });

    test('should have correct input types and attributes', async ({ page }) => {
      const emailInput = page.getByLabel(/Email/i);
      await expect(emailInput).toHaveAttribute('type', 'email');
      await expect(emailInput).toHaveAttribute('required', '');

      const passwordInput = page.getByLabel(/Password/i);
      await expect(passwordInput).toHaveAttribute('type', 'password');
      await expect(passwordInput).toHaveAttribute('required', '');
      await expect(passwordInput).toHaveAttribute('minLength', '8');

      const nameInput = page.getByLabel(/Display Name/i);
      await expect(nameInput).toHaveAttribute('type', 'text');
      await expect(nameInput).toHaveAttribute('required', '');
    });

    test('should prevent submission with empty fields (HTML5 validation)', async ({ page }) => {
      await page.getByRole('button', { name: /Create Account/i }).click();
      await expect(page).toHaveURL('/signup');
    });

    test('should accept and retain typed values in all fields', async ({ page }) => {
      await page.getByLabel(/Display Name/i).fill('Test Wine Lover');
      await page.getByLabel(/Email/i).fill('wine@example.com');
      await page.getByLabel(/Password/i).fill('securepass123');

      await expect(page.getByLabel(/Display Name/i)).toHaveValue('Test Wine Lover');
      await expect(page.getByLabel(/Email/i)).toHaveValue('wine@example.com');
      await expect(page.getByLabel(/Password/i)).toHaveValue('securepass123');
    });

    test('should handle special characters in display name (accented wine names)', async ({ page }) => {
      const specialNames = [
        'Château Margaux',
        'Müller-Thurgau',
        'José García',
      ];

      for (const name of specialNames) {
        await page.getByLabel(/Display Name/i).fill(name);
        await expect(page.getByLabel(/Display Name/i)).toHaveValue(name);
      }
    });

    test('should maintain form state when switching focus between fields', async ({ page }) => {
      await page.getByLabel(/Display Name/i).fill('Test');
      await page.getByLabel(/Email/i).fill('test@example.com');
      await page.getByLabel(/Password/i).fill('password123');

      // Click heading to blur all fields
      await page.getByRole('heading', { name: /Create Account/i }).click();

      await expect(page.getByLabel(/Display Name/i)).toHaveValue('Test');
      await expect(page.getByLabel(/Email/i)).toHaveValue('test@example.com');
      await expect(page.getByLabel(/Password/i)).toHaveValue('password123');
    });

    test('should block invalid email format with browser validation', async ({ page }) => {
      await page.getByLabel(/Display Name/i).fill('Test User');
      await page.getByLabel(/Email/i).fill('not-an-email');
      await page.getByLabel(/Password/i).fill('password123');

      await page.getByRole('button', { name: /Create Account/i }).click();
      await expect(page).toHaveURL('/signup');
    });

    test('should navigate to signin page via link', async ({ page }) => {
      await page.getByRole('link', { name: /Sign in/i }).click();
      await expect(page).toHaveURL('/signin');
    });

    test('should display wine icon branding', async ({ page }) => {
      const wineIcon = page.locator('svg.lucide-wine');
      await expect(wineIcon).toBeVisible();
    });
  });

  test.describe('Sign In Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signin');
    });

    test('should display complete signin form', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
      await expect(page.getByText(/Sign in to your wine cellar/i)).toBeVisible();

      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
    });

    test('should NOT display display name field', async ({ page }) => {
      await expect(page.getByLabel(/Display Name/i)).not.toBeVisible();
    });

    test('should prevent submission with empty fields', async ({ page }) => {
      await page.getByRole('button', { name: /Sign In/i }).click();
      await expect(page).toHaveURL('/signin');
    });

    test('should submit form via Enter key', async ({ page }) => {
      await page.getByLabel(/Email/i).fill('test@example.com');
      await page.getByLabel(/Password/i).fill('password123');
      await page.keyboard.press('Enter');

      // Form attempts submission - brief wait for any response
      await page.waitForTimeout(500);
    });

    test('should preserve email value after form interaction', async ({ page }) => {
      await page.getByLabel(/Email/i).fill('test@example.com');
      await page.getByLabel(/Password/i).click();

      await expect(page.getByLabel(/Email/i)).toHaveValue('test@example.com');
    });

    test('should navigate to signup page via link', async ({ page }) => {
      await page.getByRole('link', { name: /Sign up/i }).click();
      await expect(page).toHaveURL('/signup');
    });

    test('should have "Forgot password?" button', async ({ page }) => {
      const forgotBtn = page.getByRole('button', { name: /Forgot password/i });
      await expect(forgotBtn).toBeVisible();
    });

    test('should show forgot password form when clicking "Forgot password?"', async ({ page }) => {
      await page.getByRole('button', { name: /Forgot password/i }).click();

      await expect(page.getByRole('heading', { name: /Reset Password/i })).toBeVisible();
      await expect(page.getByText(/Enter your email to receive a password reset link/i)).toBeVisible();
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Send Reset Link/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Back to Sign In/i })).toBeVisible();
    });

    test('should return to signin form from forgot password view', async ({ page }) => {
      await page.getByRole('button', { name: /Forgot password/i }).click();
      await expect(page.getByRole('heading', { name: /Reset Password/i })).toBeVisible();

      await page.getByRole('button', { name: /Back to Sign In/i }).click();

      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
    });

    test('should preserve email when switching to forgot password', async ({ page }) => {
      await page.getByLabel(/Email/i).fill('user@wine.com');
      await page.getByRole('button', { name: /Forgot password/i }).click();

      await expect(page.getByLabel(/Email/i)).toHaveValue('user@wine.com');
    });

    test('should hide Google button and separator in forgot password view', async ({ page }) => {
      await page.getByRole('button', { name: /Forgot password/i }).click();

      await expect(page.getByRole('button', { name: /Google/i })).not.toBeVisible();
      await expect(page.getByText(/Or continue with/i)).not.toBeVisible();
    });

    test('should not show error container initially', async ({ page }) => {
      const errorContainer = page.locator('.bg-red-50');
      await expect(errorContainer).not.toBeVisible();
    });
  });

  test.describe('Cross-Navigation', () => {
    test('should navigate signin → signup → signin seamlessly', async ({ page }) => {
      await page.goto('/signin');

      await page.getByRole('link', { name: /Sign up/i }).click();
      await expect(page).toHaveURL('/signup');
      await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();

      await page.getByRole('link', { name: /Sign in/i }).click();
      await expect(page).toHaveURL('/signin');
      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    });

    test('should support browser back/forward between auth pages', async ({ page }) => {
      await page.goto('/signin');
      await page.getByRole('link', { name: /Sign up/i }).click();
      await expect(page).toHaveURL('/signup');

      await page.goBack();
      await expect(page).toHaveURL('/signin');

      await page.goForward();
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Protected Routes - Auth Guard', () => {
    test('should redirect /cellar to /signin when unauthenticated', async ({ page }) => {
      await page.goto('/cellar');
      await page.waitForURL('/signin');
      await expect(page).toHaveURL('/signin');
    });

    test('should redirect /cellar/:id to /signin when unauthenticated', async ({ page }) => {
      await page.goto('/cellar/some-wine-id');
      await page.waitForURL('/signin');
      await expect(page).toHaveURL('/signin');
    });

    test('should redirect /stats to /signin when unauthenticated', async ({ page }) => {
      await page.goto('/stats');
      await page.waitForURL('/signin');
      await expect(page).toHaveURL('/signin');
    });
  });

  test.describe('Auth Forms - Accessibility', () => {
    test('should have proper label-input associations on signin', async ({ page }) => {
      await page.goto('/signin');

      await expect(page.getByLabel(/Email/i)).toHaveAttribute('id', 'email');
      await expect(page.getByLabel(/Password/i)).toHaveAttribute('id', 'password');
    });

    test('should have proper label-input associations on signup', async ({ page }) => {
      await page.goto('/signup');

      await expect(page.getByLabel(/Display Name/i)).toHaveAttribute('id', 'displayName');
      await expect(page.getByLabel(/Email/i)).toHaveAttribute('id', 'email');
      await expect(page.getByLabel(/Password/i)).toHaveAttribute('id', 'password');
    });

    test('should support tab navigation through signin form', async ({ page }) => {
      await page.goto('/signin');

      await page.getByLabel(/Email/i).focus();
      await expect(page.getByLabel(/Email/i)).toBeFocused();

      await page.keyboard.press('Tab');
      // Password field should be next focusable
      await expect(page.getByLabel(/Password/i)).toBeFocused();
    });

    test('should have all buttons enabled by default', async ({ page }) => {
      await page.goto('/signin');

      await expect(page.getByRole('button', { name: /Sign In/i })).toBeEnabled();
      await expect(page.getByRole('button', { name: /Google/i })).toBeEnabled();
    });
  });

  test.describe('Auth Forms - Mobile', () => {
    test('should display signin form fully on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/signin');

      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
    });

    test('should display signup form fully on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/signup');

      await expect(page.getByLabel(/Display Name/i)).toBeVisible();
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();
    });

    test('should allow input on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/signin');

      await page.getByLabel(/Email/i).click();
      await page.getByLabel(/Email/i).fill('mobile@test.com');
      await expect(page.getByLabel(/Email/i)).toHaveValue('mobile@test.com');
    });
  });
});
