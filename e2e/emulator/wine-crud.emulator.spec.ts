import { test, expect } from '@playwright/test';

test.describe('Firebase Emulator - Auth + Wine CRUD', () => {
  test.skip(!process.env.E2E_WITH_FIREBASE_EMULATOR, 'Requires Firebase emulators');

  test('sign up, add wine, edit wine, delete wine', async ({ page }) => {
    const unique = Date.now();
    const email = `e2e-${unique}@test.local`;
    const password = 'password123';
    const displayName = 'E2E User';

    const wineName = `E2E Wine ${unique}`;

    // Sign up
    await page.goto('/signup');
    await page.getByLabel(/Display Name/i).fill(displayName);
    await page.getByLabel(/Email/i).fill(email);
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole('button', { name: /Create Account/i }).click();

    await expect(page).toHaveURL(/\/cellar/);
    await expect(page.getByRole('heading', { name: /My Cellar/i })).toBeVisible();

    // Add wine
    await page.getByRole('button', { name: /Add new wine/i }).click();
    await expect(page.getByRole('heading', { name: /Add New Wine/i })).toBeVisible();

    await page.getByLabel(/Wine Name/i).fill(wineName);
    await page.getByLabel(/^Winery/i).fill('Test Winery');
    await page.getByLabel(/Vintage/i).fill('2019');
    await page.getByLabel(/Grape Variety/i).fill('Pinot Noir');
    await page.getByLabel(/Region/i).fill('Burgundy');
    await page.getByLabel(/Country/i).fill('France');
    await page.getByLabel(/Price/i).fill('199');
    await page.getByLabel(/Bottles Owned/i).fill('2');
    await page.getByLabel(/Storage Location/i).fill('Rack A1');
    await page.getByLabel(/Tasting Notes/i).fill('Cherry and spice.');

    await page.getByRole('button', { name: /^Add Wine$/i }).click();

    // Verify wine appears in list
    await expect(page.getByRole('heading', { name: wineName })).toBeVisible();

    // Go to detail page
    await page.getByRole('heading', { name: wineName }).click();
    await expect(page.getByRole('heading', { name: wineName })).toBeVisible();

    // Edit
    await page.getByRole('button', { name: /^Edit$/i }).click();
    await expect(page.getByRole('heading', { name: /Edit Wine/i })).toBeVisible();

    await page.getByLabel(/Price/i).fill('250');
    await page.getByRole('button', { name: /Save Changes/i }).click();

    await expect(page.getByText('250 kr')).toBeVisible();

    // Delete
    await page.getByRole('button', { name: /^Delete$/i }).click();
    await expect(page.getByRole('heading', { name: /Delete Wine/i })).toBeVisible();
    const deleteModal = page
      .getByRole('heading', { name: /Delete Wine/i })
      .locator('..')
      .locator('..');
    await deleteModal.getByRole('button', { name: /^Delete$/i }).click();

    await expect(page).toHaveURL(/\/cellar/);
    await expect(page.getByRole('heading', { name: wineName })).toHaveCount(0);
  });
});

