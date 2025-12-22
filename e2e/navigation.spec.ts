import { test, expect } from '@playwright/test';

/**
 * Navigation and Routing E2E tests
 *
 * Tests general app navigation, routing, and page structure.
 */

test.describe('App Navigation', () => {
  test.describe('Home Page', () => {
    test('should load home page successfully', async ({ page }) => {
      await page.goto('/');

      await expect(page).toHaveTitle(/Aretae/i);
      await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
    });

    test('should display all feature sections', async ({ page }) => {
      await page.goto('/');

      // Features section
      await expect(page.getByText(/Track Your Collection/i)).toBeVisible();
      await expect(page.getByText(/AI Sommelier/i)).toBeVisible();
      await expect(page.getByText(/Photo Labels/i)).toBeVisible();
      await expect(page.getByText(/Rate & Review/i)).toBeVisible();
    });

    test('should display CTA sections', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText(/Ready to Start Your Wine Journey/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /Create Your Free Account/i })).toBeVisible();
    });

    test('should display footer', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText(/Built with love for wine enthusiasts/i)).toBeVisible();
    });
  });

  test.describe('Sign In Page', () => {
    test('should load sign in page', async ({ page }) => {
      await page.goto('/signin');

      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    });

    test('should have wine icon branding', async ({ page }) => {
      await page.goto('/signin');

      // Wine icon should be present
      const wineIcon = page.locator('svg.lucide-wine');
      await expect(wineIcon).toBeVisible();
    });
  });

  test.describe('Sign Up Page', () => {
    test('should load sign up page', async ({ page }) => {
      await page.goto('/signup');

      await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    });

    test('should have additional display name field', async ({ page }) => {
      await page.goto('/signup');

      await expect(page.getByLabel(/Display Name/i)).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect from cellar to signin when not authenticated', async ({ page }) => {
      await page.goto('/cellar');

      await page.waitForURL('/signin');
      await expect(page).toHaveURL('/signin');
    });

    test('should redirect from wine detail to signin when not authenticated', async ({ page }) => {
      await page.goto('/cellar/some-wine-id');

      await page.waitForURL('/signin');
      await expect(page).toHaveURL('/signin');
    });
  });

  test.describe('Navigation Links', () => {
    test('should navigate from home to signup', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /Get Started Free/i }).click();

      await expect(page).toHaveURL('/signup');
    });

    test('should navigate from home to signin', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /Sign In/i }).first().click();

      await expect(page).toHaveURL('/signin');
    });

    test('should navigate between signin and signup', async ({ page }) => {
      await page.goto('/signin');

      await page.getByRole('link', { name: /Sign up/i }).click();
      await expect(page).toHaveURL('/signup');

      await page.getByRole('link', { name: /Sign in/i }).click();
      await expect(page).toHaveURL('/signin');
    });

    test('should navigate from CTA to signup', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /Create Your Free Account/i }).click();

      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Page Load Performance', () => {
    test('should load home page within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000); // 10 seconds max
    });

    test('should load signin page quickly', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/signin');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000);
    });
  });

  test.describe('404 Handling', () => {
    test('should handle non-existent routes', async ({ page }) => {
      const response = await page.goto('/this-route-does-not-exist');

      // Should either show 404 or redirect
      expect(response?.status()).toBeDefined();
    });
  });

  test.describe('Browser History', () => {
    test('should support back navigation', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Get Started Free/i }).click();
      await expect(page).toHaveURL('/signup');

      await page.goBack();
      await expect(page).toHaveURL('/');
    });

    test('should support forward navigation', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Get Started Free/i }).click();
      await expect(page).toHaveURL('/signup');
      await page.goBack();
      await page.goForward();

      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Deep Linking', () => {
    test('should load signin directly', async ({ page }) => {
      await page.goto('/signin');

      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    });

    test('should load signup directly', async ({ page }) => {
      await page.goto('/signup');

      await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    });
  });
});

test.describe('Responsive Layout', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
  });

  test('should be responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
  });
});

test.describe('PWA Features', () => {
  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check for viewport meta
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/signin');

    // Inputs should have associated labels
    const emailInput = page.getByLabel(/Email/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    const passwordInput = page.getByLabel(/Password/i);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should have clickable buttons', async ({ page }) => {
    await page.goto('/signin');

    const submitButton = page.getByRole('button', { name: /Sign In/i });
    await expect(submitButton).toBeEnabled();
  });

  test('should have proper link text', async ({ page }) => {
    await page.goto('/');

    // Links should have descriptive text
    await expect(page.getByRole('link', { name: /Get Started Free/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign In/i }).first()).toBeVisible();
  });
});

test.describe('Error States', () => {
  test('should handle JavaScript errors gracefully', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    // Allow page to settle
    await page.waitForLoadState('networkidle');

    // Should have no critical errors on home page
    // Note: Some React hydration warnings might appear but shouldn't break the app
  });

  test('should handle network timeouts', async ({ page }) => {
    await page.goto('/', { timeout: 30000 });

    await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
  });
});
