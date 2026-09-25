import { expect, test } from '@playwright/test';
import { ONBOARDING_COMPLETE_KEY } from '../src/domain/onboarding';
import {
  clearScorekeeperStorage,
  loadSampleLeague,
  navigateMenu,
} from './helpers/scorekeeper-page';

async function openFirstSampleMatch(page: import('@playwright/test').Page) {
  await navigateMenu(page, 'Matches');
  await page.getByRole('button', { name: / vs\. / }).first().click();
  await expect(page.getByRole('heading', { name: 'Match' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Track Match' })).toBeVisible();
}

test.describe('match navigation submenu', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
    await page.addInitScript((key) => {
      localStorage.setItem(key, '1');
    }, ONBOARDING_COMPLETE_KEY);
    await loadSampleLeague(page);
  });

  test('shows match shortcuts in the drawer while inside a match', async ({ page }) => {
    await openFirstSampleMatch(page);

    await expect(page.locator('.sk-match-nav-goToMatch')).toBeVisible();
    await expect(page.locator('.sk-match-nav-copy-stats')).toBeVisible();
    await expect(page.locator('.sk-match-nav-trackGame')).toBeVisible();
    await expect(page.locator('.sk-match-nav-continueGame')).toBeVisible();
  });

  test('go to match returns from track match to match roster', async ({ page }) => {
    await openFirstSampleMatch(page);
    await page.getByRole('button', { name: 'Track Match' }).click();
    await expect(page.getByRole('heading', { name: 'Track Match' })).toBeVisible();

    await page.getByRole('link', { name: 'Go to Match', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Match', exact: true })).toBeVisible();
  });

  test('copy stats writes match csv tsv to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openFirstSampleMatch(page);
    await page.locator('.sk-match-nav-copy-stats').click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('********** Matches');
  });
});
