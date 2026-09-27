import path from 'path';
import { test, expect } from '@playwright/test';
import { ONBOARDING_COMPLETE_KEY } from '../src/domain/onboarding';
import {
  clearScorekeeperStorage,
  fileInputForExtension,
  gotoScorekeeper,
  navigateMenu,
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
    await page.addInitScript((key) => {
      localStorage.setItem(key, '1');
    }, ONBOARDING_COMPLETE_KEY);
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

  test('creates match from CSV on Matches page without picking teams', async ({ page }) => {
    await loadInteropBasic(page);

    await page.getByRole('button', { name: 'Import from statistics CSV' }).click();
    await fileInputForExtension(page, '.csv').setInputFiles(
      path.join(fixturesDir, 'interop-basic.golden.csv'),
    );
    const dialog = page.getByRole('dialog', { name: 'Import match statistics' });
    await expect(dialog.getByLabel('Home team')).toHaveText('Away Owls');
    await dialog.getByRole('button', { name: 'Swap home / away' }).click();
    await expect(dialog.getByLabel('Home team')).toHaveText('Home Hawks');
    await page.getByLabel('Home Hawks game wins').fill('1');
    await page.getByLabel('Away Owls game wins').fill('0');
    await dialog.getByRole('button', { name: 'Import statistics' }).click();

    await expect(page).toHaveURL(/\/matches\/[^/]+\/stats$/);
    await navigateMenu(page, 'Matches');
    await expect(page.locator('.sk-match-progress').filter({ hasText: 'Finished' })).toBeVisible();
  });

  test('labels an imported match and edits labels from its stats page', async ({ page }) => {
    await loadInteropBasic(page);

    await page.getByRole('button', { name: 'Import from statistics CSV' }).click();
    await fileInputForExtension(page, '.csv').setInputFiles(
      path.join(fixturesDir, 'interop-basic.golden.csv'),
    );
    const dialog = page.getByRole('dialog', { name: 'Import match statistics' });
    await dialog.getByRole('button', { name: 'Swap home / away' }).click();
    await page.getByLabel('Home Hawks game wins').fill('1');
    await page.getByLabel('Away Owls game wins').fill('0');
    const importLabels = dialog.locator('.sk-match-labels-field input');
    await importLabels.fill('Week 3');
    await page.getByRole('option', { name: 'Week 3' }).click();
    await importLabels.fill('Charity Night');
    await importLabels.press('Enter');
    await dialog.getByRole('button', { name: 'Import statistics' }).click();

    await expect(page).toHaveURL(/\/matches\/[^/]+\/stats$/);
    await page.getByRole('link', { name: 'Match details' }).click();
    await expect(page.getByRole('heading', { name: 'Match', exact: true })).toBeVisible();
    await expect(page.locator('.sk-match-label').filter({ hasText: 'Week 3' })).toBeVisible();
    const matchLabels = page.locator('.sk-match-labels-field input');
    await matchLabels.fill('Playoffs');
    await matchLabels.press('Enter');

    await navigateMenu(page, 'Matches');
    const row = page.locator('.sk-match-row').filter({ hasText: 'Charity Night' });
    await expect(row.locator('.sk-match-label')).toHaveText(['Week 3', 'Charity Night', 'Playoffs']);
  });

  test('flags unknown teams, players, and missing stats in a spreadsheet CSV', async ({ page }) => {
    await loadInteropBasic(page);

    await page.getByRole('button', { name: 'Import from statistics CSV' }).click();
    await fileInputForExtension(page, '.csv').setInputFiles({
      name: 'spreadsheet.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        ['Team,Player,GP,W-L,Kills', 'Home Hawks,H1,3,2-1,4', 'Night Owls,Newbie,3,1-2,1'].join(
          '\n',
        ),
      ),
    });

    const dialog = page.getByRole('dialog', { name: 'Import match statistics' });
    await expect(dialog.getByText('“Night Owls” doesn\'t match a league team')).toBeVisible();
    await expect(dialog.getByText("1 player didn't match anyone on their team")).toBeVisible();
    await expect(dialog.locator('.sk-import-missing-stats')).toContainText('Deaths');
    await expect(dialog.getByLabel('Away team')).toHaveText('Create new team “Night Owls”');

    await dialog.getByRole('combobox', { name: 'Import Newbie as' }).click();
    await page.getByRole('option', { name: 'Add “Newbie” as a substitute' }).click();
    await expect(dialog.getByText('This import adds 1 new team, 1 substitute.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Import anyway' }).click();
    await expect(page).toHaveURL(/\/matches\/[^/]+\/stats$/);
    await expect(
      page.getByRole('heading', { name: /^Match stats — Home Hawks vs\. Night Owls/ }),
    ).toBeVisible();
  });
});
