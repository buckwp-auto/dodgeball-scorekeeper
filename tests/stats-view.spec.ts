import { test, expect } from '@playwright/test';
import {
  clearScorekeeperStorage,
  loadSampleLeague,
  navigateMenu,
} from './helpers/scorekeeper-page';

test.describe('In-app stats', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
  });

  test('opens league stats from the drawer after loading the sample', async ({
    page,
  }) => {
    await loadSampleLeague(page);
    await navigateMenu(page, 'Stats');
    await expect(page.getByRole('heading', { name: /stats/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Standings' })).toBeVisible();
    await expect(page.locator('.sk-stats-standings')).toContainText('The Fellowship');
    await page.getByRole('tab', { name: 'Players' }).click();
    await expect(page.locator('.sk-stats-table')).toContainText('Frodo Baggins');
  });

  test('opens match stats from the matches list', async ({ page }) => {
    await loadSampleLeague(page);
    await navigateMenu(page, 'Matches');
    await page.getByRole('button', { name: 'See stats' }).first().click();
    await expect(page.getByRole('heading', { name: /Match stats/ })).toBeVisible();
    await expect(page.locator('.sk-stats-series')).toBeVisible();
    await page.getByRole('tab', { name: 'Players' }).click();
    await expect(page.locator('.sk-stats-table')).toBeVisible();
    await expect(page.locator('.sk-stats-table tbody tr').first()).toBeVisible();
  });

  test('opens game stats from track match', async ({ page }) => {
    await loadSampleLeague(page);
    await navigateMenu(page, 'Matches');
    await page.getByRole('button', { name: / vs\. / }).first().click();
    await expect(page.getByRole('heading', { name: 'Match' })).toBeVisible();
    await page.getByRole('button', { name: 'Track Match' }).click();
    await expect(page.getByRole('heading', { name: 'Track Match' })).toBeVisible();
    await page.getByRole('button', { name: 'See stats' }).first().click();
    await expect(page.getByRole('heading', { name: /Game 1 stats/ })).toBeVisible();
    await expect(page.locator('.sk-stats-table')).toBeVisible();
    await page.getByRole('tab', { name: 'Charts' }).click();
    await expect(page.locator('.sk-stats-charts')).toBeVisible();
  });
});
