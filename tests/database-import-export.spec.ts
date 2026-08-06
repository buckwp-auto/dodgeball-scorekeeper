import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  addPlayer,
  addTeam,
  clearScorekeeperStorage,
  createMatch,
  fileInputForExtension,
  gotoScorekeeper,
  navigateMenu,
  openTeam,
} from './helpers/scorekeeper-page';

test.describe('Database JSON (.scrkpr)', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
  });

  test('exports JSON and reload preserves teams, players, and matches', async ({
    page,
  }) => {
    await gotoScorekeeper(page);
    await addTeam(page, 'Big Dogs');
    await openTeam(page, 'Big Dogs');
    await addPlayer(page, 'Alice');
    await addTeam(page, 'Quick Cats');
    await openTeam(page, 'Quick Cats');
    await addPlayer(page, 'Bob');
    await createMatch(page, 'Big Dogs', 'Quick Cats');

    const downloadPromise = page.waitForEvent('download');
    await navigateMenu(page, 'Overview');
    await page.getByRole('button', { name: 'Download Database' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Dodgeball Database.scrkpr');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scrkpr-'));
    const filePath = path.join(tempDir, 'database.scrkpr');
    await download.saveAs(filePath);
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed).toBeTruthy();
    expect(JSON.stringify(parsed)).toContain('Big Dogs');
    expect(JSON.stringify(parsed)).toContain('Alice');

    await page.evaluate(() => sessionStorage.clear());
    await gotoScorekeeper(page);
    await navigateMenu(page, 'Teams');
    await expect(page.getByRole('button', { name: 'Big Dogs' })).toHaveCount(0);

    await navigateMenu(page, 'Overview');
    await page.getByRole('button', { name: 'Load Database', exact: true }).click();
    await fileInputForExtension(page, '.scrkpr').setInputFiles(filePath);

    await navigateMenu(page, 'Teams');
    await expect(page.getByRole('button', { name: 'Big Dogs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick Cats' })).toBeVisible();
    await openTeam(page, 'Big Dogs');
    await expect(page.getByRole('button', { name: 'Alice' })).toBeVisible();

    await navigateMenu(page, 'Matches');
    await expect(
      page.getByRole('button', { name: 'Big Dogs vs. Quick Cats' }),
    ).toBeVisible();
  });
});
