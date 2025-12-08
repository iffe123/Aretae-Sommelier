import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Landing Page', () => {
    test('should display landing page for unauthenticated users', async ({ page }) => {
      await page.goto('/');

      // Should see the landing page with app branding
      await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();

      // Should have sign in and sign up buttons
      await expect(page.getByRole('link', { name: /Get Started Free/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Sign In/i })).toBeVisible();
    });

    test('should navigate to sign up page from landing page', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /Get Started Free/i }).click();

      await expect(page).toHaveURL('/signup');
      await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    });

    test('should navigate to sign in page from landing page', async ({ page }) => {
      await page.goto('/');

      await page.getByRole('link', { name: /Sign In/i }).first().click();

      await expect(page).toHaveURL('/signin');
      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    });
  });

  test.describe('Sign Up Page', () => {
    test('should display sign up form with required fields', async ({ page }) => {
      await page.goto('/signup');

      // Should have the sign up form elements
      await expect(page.getByLabel(/Display Name/i)).toBeVisible();
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();

      // Should have Google sign in option
      await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();

      // Should have link to sign in page
      await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible();
    });

    test('should show validation for required fields', async ({ page }) => {
      await page.goto('/signup');

      // Try to submit empty form
      await page.getByRole('button', { name: /Create Account/i }).click();

      // Form should not submit (HTML5 validation)
      await expect(page).toHaveURL('/signup');
    });

    test('should navigate to sign in page', async ({ page }) => {
      await page.goto('/signup');

      await page.getByRole('link', { name: /Sign in/i }).click();

      await expect(page).toHaveURL('/signin');
    });

    test('should require minimum password length', async ({ page }) => {
      await page.goto('/signup');

      const passwordInput = page.getByLabel(/Password/i);

      // Check that password has minLength attribute
      await expect(passwordInput).toHaveAttribute('minLength', '6');
    });

    test('should display error for invalid credentials', async ({ page }) => {
      await page.goto('/signup');

      // Fill in form with test data
      await page.getByLabel(/Display Name/i).fill('Test User');
      await page.getByLabel(/Email/i).fill('invalid-email');
      await page.getByLabel(/Password/i).fill('password123');

      await page.getByRole('button', { name: /Create Account/i }).click();

      // Should still be on signup page (email validation should fail)
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Sign In Page', () => {
    test('should display sign in form with required fields', async ({ page }) => {
      await page.goto('/signin');

      // Should have the sign in form elements
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();

      // Should NOT have display name field for sign in
      await expect(page.getByLabel(/Display Name/i)).not.toBeVisible();

      // Should have Google sign in option
      await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();

      // Should have link to sign up page
      await expect(page.getByRole('link', { name: /Sign up/i })).toBeVisible();
    });

    test('should navigate to sign up page', async ({ page }) => {
      await page.goto('/signin');

      await page.getByRole('link', { name: /Sign up/i }).click();

      await expect(page).toHaveURL('/signup');
    });

    test('should show validation for required fields', async ({ page }) => {
      await page.goto('/signin');

      // Try to submit empty form
      await page.getByRole('button', { name: /Sign In/i }).click();

      // Form should not submit (HTML5 validation)
      await expect(page).toHaveURL('/signin');
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to signin when accessing cellar without auth', async ({ page }) => {
      await page.goto('/cellar');

      // Should be redirected to signin page
      await expect(page).toHaveURL('/signin');
    });
  });
});
