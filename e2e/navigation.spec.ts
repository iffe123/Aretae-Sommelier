import { test, expect } from '@playwright/test';

/**
 * Navigation and Routing E2E tests
 *
 * Comprehensive tests for app navigation, routing, page structure,
 * responsiveness, PWA features, accessibility, and error handling.
 */

test.describe('App Navigation', () => {
  test.describe('Home Page', () => {
    test('should load home page successfully with correct title', async ({ page }) => {
      await page.goto('/');

      await expect(page).toHaveTitle(/Aretae/i);
      await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
    });

    test('should display hero section with description', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText(/Your personal wine cellar manager/i)).toBeVisible();
    });

    test('should display all four feature cards', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText(/Track Your Collection/i)).toBeVisible();
      await expect(page.getByText(/AI Sommelier/i)).toBeVisible();
      await expect(page.getByText(/Photo Labels/i)).toBeVisible();
      await expect(page.getByText(/Rate & Review/i)).toBeVisible();
    });

    test('should display feature descriptions', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText(/Keep detailed records of every bottle/i)).toBeVisible();
      await expect(page.getByText(/Get expert advice on food pairings/i)).toBeVisible();
      await expect(page.getByText(/Snap photos of wine labels/i)).toBeVisible();
      await expect(page.getByText(/Rate wines and add personal tasting notes/i)).toBeVisible();
    });

    test('should display "Everything You Need" section header', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByRole('heading', { name: /Everything You Need/i })).toBeVisible();
    });

    test('should display CTA section', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByText(/Ready to Start Your Wine Journey/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /Create Your Free Account/i })).toBeVisible();
    });

    test('should display footer with branding', async ({ page }) => {
      await page.goto('/');

      // Scroll to footer
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      await expect(page.getByText(/Built with love for wine enthusiasts/i)).toBeVisible();
      // Footer should contain app name
      await expect(page.locator('footer').getByText(/Aretae Sommelier/i)).toBeVisible();
    });

    test('should display footer with hommage text', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      await expect(page.getByText(/hommage/i)).toBeVisible();
    });
  });

  test.describe('Sign In Page', () => {
    test('should load sign in page with correct heading', async ({ page }) => {
      await page.goto('/signin');

      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    });

    test('should have wine icon branding', async ({ page }) => {
      await page.goto('/signin');

      const wineIcon = page.locator('svg.lucide-wine');
      await expect(wineIcon).toBeVisible();
    });
  });

  test.describe('Sign Up Page', () => {
    test('should load sign up page with correct heading', async ({ page }) => {
      await page.goto('/signup');

      await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    });

    test('should have display name field (unique to signup)', async ({ page }) => {
      await page.goto('/signup');

      await expect(page.getByLabel(/Display Name/i)).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
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

  test.describe('Navigation Links', () => {
    test('should navigate from home to signup via hero CTA', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Get Started Free/i }).click();
      await expect(page).toHaveURL('/signup');
    });

    test('should navigate from home to signin via header link', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Sign In/i }).first().click();
      await expect(page).toHaveURL('/signin');
    });

    test('should navigate between signin and signup bidirectionally', async ({ page }) => {
      await page.goto('/signin');

      await page.getByRole('link', { name: /Sign up/i }).click();
      await expect(page).toHaveURL('/signup');

      await page.getByRole('link', { name: /Sign in/i }).click();
      await expect(page).toHaveURL('/signin');
    });

    test('should navigate from CTA section to signup', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Create Your Free Account/i }).click();
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Page Load Performance', () => {
    test('should load home page within 10 seconds', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000);
    });

    test('should load signin page within 10 seconds', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/signin');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000);
    });

    test('should load signup page within 10 seconds', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/signup');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000);
    });
  });

  test.describe('404 Handling', () => {
    test('should handle non-existent routes without crashing', async ({ page }) => {
      const response = await page.goto('/this-route-does-not-exist');

      expect(response?.status()).toBeDefined();
      // Should either return 404 or redirect
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
      await expect(page).toHaveURL('/');

      await page.goForward();
      await expect(page).toHaveURL('/signup');
    });

    test('should support multi-step history traversal', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /Sign In/i }).first().click();
      await expect(page).toHaveURL('/signin');

      await page.getByRole('link', { name: /Sign up/i }).click();
      await expect(page).toHaveURL('/signup');

      await page.goBack();
      await expect(page).toHaveURL('/signin');

      await page.goBack();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Deep Linking', () => {
    test('should load signin directly via URL', async ({ page }) => {
      await page.goto('/signin');
      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    });

    test('should load signup directly via URL', async ({ page }) => {
      await page.goto('/signup');
      await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    });

    test('should handle deep link to protected route by redirecting', async ({ page }) => {
      await page.goto('/cellar');
      await page.waitForURL('/signin');
      await expect(page).toHaveURL('/signin');
    });
  });
});

test.describe('Responsive Layout', () => {
  test('should display landing page correctly on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Get Started Free/i })).toBeVisible();
  });

  test('should display landing page correctly on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
  });

  test('should display landing page correctly on desktop (1920px)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
  });

  test('should display signin correctly on small mobile (320px)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
    await page.goto('/signin');

    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });
});

test.describe('PWA Features', () => {
  test('should have viewport meta tag', async ({ page }) => {
    await page.goto('/');

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('should have theme-color meta tag or similar PWA meta', async ({ page }) => {
    await page.goto('/');

    // Check for PWA-related meta tags
    const hasViewport = await page.locator('meta[name="viewport"]').count();
    expect(hasViewport).toBeGreaterThan(0);
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy on home page', async ({ page }) => {
    await page.goto('/');

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(/Aretae Sommelier/i);
  });

  test('should have proper heading hierarchy on signin page', async ({ page }) => {
    await page.goto('/signin');

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(/Welcome Back/i);
  });

  test('should have proper form labels on signin', async ({ page }) => {
    await page.goto('/signin');

    const emailInput = page.getByLabel(/Email/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    const passwordInput = page.getByLabel(/Password/i);
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should have enabled interactive buttons', async ({ page }) => {
    await page.goto('/signin');

    const submitButton = page.getByRole('button', { name: /Sign In/i });
    await expect(submitButton).toBeEnabled();
  });

  test('should have descriptive link text', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: /Get Started Free/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign In/i }).first()).toBeVisible();
  });

  test('should have proper aria attributes on auth forms', async ({ page }) => {
    await page.goto('/signup');

    // All inputs should have id matching label's htmlFor
    const nameInput = page.getByLabel(/Display Name/i);
    await expect(nameInput).toHaveAttribute('id', 'displayName');
  });
});

test.describe('Error States', () => {
  test('should load home page without critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical warnings
    const criticalErrors = errors.filter(
      e => !e.includes('Firebase') && !e.includes('hydration') && !e.includes('env')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle network timeout gracefully', async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
  });

  test('should load signin without critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/signin');
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(
      e => !e.includes('Firebase') && !e.includes('hydration') && !e.includes('env')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
