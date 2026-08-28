import path from 'path';
import { test, expect } from '@playwright/test';
import {
  clearScorekeeperStorage,
  fileInputForExtension,
  gotoScorekeeper,
  navigateMenu,
  selectMatchTeam,
} from './helpers/scorekeeper-page';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

async function loadInteropBasic(page: import('@playwright/test').Page) {
  await gotoScorekeeper(page);
  await navigateMenu(page, 'Overview');
  await page.getByRole('button', { name: 'Load from file', exact: true }).click();
  await fileInputForExtension(page, '.scrkpr').setInputFiles(
    path.join(fixturesDir, 'interop-basic.scrkpr'),
  );
  await navigateMenu(page, 'Matches');
  await expect(
    page.getByRole('button', { name: 'Home Hawks vs. Away Owls', exact: true }),
  ).toBeVisible();
}

test.describe('Match statistics CSV import', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
  });

  test('imports CSV with game score form and opens stats page', async ({ page }) => {
    await loadInteropBasic(page);
    await page.getByRole('button', { name: 'Home Hawks vs. Away Owls', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Match' })).toBeVisible();

    await page.getByRole('button', { name: 'Import Match Statistics' }).click();
    await fileInputForExtension(page, '.csv').setInputFiles(
      path.join(fixturesDir, 'interop-with-throw.golden.csv'),
    );

    await expect(page.getByRole('dialog', { name: 'Import match statistics' })).toBeVisible();
    await page.getByLabel('Home Hawks game wins').fill('2');
    await page.getByLabel('Away Owls game wins').fill('1');
    await page.getByRole('button', { name: 'Import statistics' }).click();

    await expect(page).toHaveURL(/\/matches\/[^/]+\/stats$/);
    await expect(page.getByRole('heading', { name: /Match stats/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Track Match' })).toHaveCount(0);
  });

  test('redirects track match routes for imported matches', async ({ page }) => {
    await loadInteropBasic(page);
    await page.getByRole('button', { name: 'Home Hawks vs. Away Owls', exact: true }).click();
    await page.getByRole('button', { name: 'Import Match Statistics' }).click();
    await fileInputForExtension(page, '.csv').setInputFiles(
      path.join(fixturesDir, 'interop-basic.golden.csv'),
    );
    await page.getByLabel('Home Hawks game wins').fill('1');
    await page.getByLabel('Away Owls game wins').fill('0');
    await page.getByRole('button', { name: 'Import statistics' }).click();
    await expect(page).toHaveURL(/\/stats$/);

    const matchUrl = page.url();
    const matchId = matchUrl.replace(/.*\/matches\/([^/]+)\/stats$/, '$1');
    await page.evaluate((id) => {
      window.history.pushState({}, '', `/matches/${id}/events`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, matchId);
    await expect(page).toHaveURL(new RegExp(`/matches/${matchId}/stats$`));
  });

  test('creates match from CSV on Matches page', async ({ page }) => {
    await loadInteropBasic(page);
    await selectMatchTeam(page, 'Home Team', 'Home Hawks');
    await selectMatchTeam(page, 'Away Team', 'Away Owls');

    await page.getByRole('button', { name: 'Import from statistics CSV' }).click();
    await fileInputForExtension(page, '.csv').setInputFiles(
      path.join(fixturesDir, 'interop-basic.golden.csv'),
    );
    await page.getByLabel('Home Hawks game wins').fill('1');
    await page.getByLabel('Away Owls game wins').fill('0');
    await page.getByRole('button', { name: 'Import statistics' }).click();

    await expect(page).toHaveURL(/\/matches\/[^/]+\/stats$/);
    await navigateMenu(page, 'Matches');
    await expect(page.locator('.sk-match-progress').filter({ hasText: 'Finished' })).toBeVisible();
  });
});
