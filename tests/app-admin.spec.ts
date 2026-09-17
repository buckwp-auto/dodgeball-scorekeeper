import { test, expect } from '@playwright/test';
import { ONBOARDING_COMPLETE_KEY } from '../src/domain/onboarding';
import {
  clearScorekeeperStorage,
  gotoScorekeeper,
} from './helpers/scorekeeper-page';

test.describe('App admin (local-only)', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
    await page.addInitScript((key) => {
      localStorage.setItem(key, '1');
    }, ONBOARDING_COMPLETE_KEY);
  });

  test('hides App admin in the drawer when Firebase is off', async ({ page }) => {
    await gotoScorekeeper(page);
    await expect(page.locator('.sk-app-admin-nav')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'App admin' })).toHaveCount(0);
  });

  test('shows not-authorized on /admin when signed out', async ({ page }) => {
    await gotoScorekeeper(page, 'admin');
    await expect(page.getByRole('heading', { name: 'App admin' })).toBeVisible();
    await expect(page.locator('.sk-app-admin-unauthorized')).toBeVisible();
    await expect(
      page.getByText(/Firebase is not configured|Sign in with Google|app admin/i),
    ).toBeVisible();
  });
});
