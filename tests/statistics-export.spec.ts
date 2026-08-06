import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  addPlayer,
  addTeam,
  clearScorekeeperStorage,
  createMatch,
  gotoScorekeeper,
  openTeam,
} from './helpers/scorekeeper-page';

test.describe('Match statistics CSV', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
  });

  test('downloads CSV with statistics column headers', async ({ page }) => {
    await gotoScorekeeper(page);
    await addTeam(page, 'Stat Home');
    await openTeam(page, 'Stat Home');
    await addPlayer(page, 'Pat');
    await addTeam(page, 'Stat Away');
    await openTeam(page, 'Stat Away');
    await addPlayer(page, 'Quinn');

    await createMatch(page, 'Stat Home', 'Stat Away');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Match Statistics' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/Statistics\.csv$/);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stats-'));
    const filePath = path.join(tempDir, 'stats.csv');
    await download.saveAs(filePath);
    const csv = await fs.readFile(filePath, 'utf-8');

    expect(csv).toContain('"Team"');
    expect(csv).toContain('"Player"');
    expect(csv).toContain('********** Matches');
    expect(csv).toContain('********** Kills (Direct) (Individual)');
  });
});
