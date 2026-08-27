import { test, expect } from '@playwright/test';
import { ONBOARDING_COMPLETE_KEY } from '../src/domain/onboarding';
import {
  clearScorekeeperStorage,
  gotoScorekeeper,
  navigateMenu,
} from './helpers/scorekeeper-page';

test.describe('Help and onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
  });

  test('shows first-visit tour and can finish it', async ({ page }) => {
    await gotoScorekeeper(page);

    await expect(page.locator('.sk-onboarding-tour')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Welcome to Scorekeeper')).toBeVisible();

    await page.getByRole('button', { name: 'Skip tour' }).click();
    await expect(page.locator('.sk-onboarding-tour')).toHaveCount(0);
    await expect
      .poll(async () => page.evaluate((key) => localStorage.getItem(key), ONBOARDING_COMPLETE_KEY))
      .toBe('1');
  });

  test('help page lists FAQ and can restart the tour', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, '1');
    }, ONBOARDING_COMPLETE_KEY);
    await gotoScorekeeper(page);

    await navigateMenu(page, 'Help');
    await expect(page.getByRole('heading', { name: 'Help' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start guided tour' })).toBeVisible();
    await expect(page.getByText('Do I need an account?')).toBeVisible();

    await page.getByRole('button', { name: 'Start guided tour' }).click();
    await expect(page.getByText('Welcome to Scorekeeper')).toBeVisible({ timeout: 10_000 });
  });
});
