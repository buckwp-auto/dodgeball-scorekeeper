import { test, expect } from '@playwright/test';
import { COLOR_MODE_KEY } from '../react-app/src/domain/colorMode';
import { clearScorekeeperStorage, gotoScorekeeper } from './helpers/scorekeeper-page';

test.describe('Color mode', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
  });

  test('defaults to system and can switch to dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await gotoScorekeeper(page);

    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');
    await page.getByRole('button', { name: 'Color mode: System' }).click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
    await expect
      .poll(async () => page.evaluate((key) => localStorage.getItem(key), COLOR_MODE_KEY))
      .toBe('dark');
    await expect(page.getByRole('button', { name: 'Color mode: Dark' })).toBeVisible();
  });

  test('system follows prefers-color-scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoScorekeeper(page);
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');
  });

  test('explicit dark ignores a light OS preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await gotoScorekeeper(page);
    await page.getByRole('button', { name: 'Color mode: System' }).click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  });
});
