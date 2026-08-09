import { test, expect } from '@playwright/test';
import {
  addGame,
  addPlayer,
  addTeam,
  clearScorekeeperStorage,
  createMatch,
  gotoScorekeeper,
  openTeam,
  selectMatchRoster,
  selectGameRoster,
} from './helpers/scorekeeper-page';

/** End-to-end roster and game tracking. */
test.describe('Game tracking (full roster)', () => {
  test('selects roster, adds game, opens game events', async ({ page }) => {
    await clearScorekeeperStorage(page);
    await gotoScorekeeper(page);
    await addTeam(page, 'Home Hawks');
    await openTeam(page, 'Home Hawks');
    await addPlayer(page, 'H1');
    await addTeam(page, 'Away Owls');
    await openTeam(page, 'Away Owls');
    await addPlayer(page, 'A1');
    await createMatch(page, 'Home Hawks', 'Away Owls');
    await selectMatchRoster(page, 'H1', 'A1');
    await addGame(page);
    await selectGameRoster(page, 'H1', 'A1');
    await page.getByRole('button', { name: 'Track Game' }).click();
    await expect(page.getByRole('button', { name: 'Throw', exact: true })).toBeVisible();

    await page.locator('.sk-menu-link').filter({ hasText: 'Overview' }).first().click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    const resume = page.locator('.sk-resume-scoring').first();
    await expect(resume).toContainText('Resume Game 1');
    await resume.click();
    await expect(page.getByRole('button', { name: 'Throw', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await page.getByRole('button', { name: 'Home Hawks', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Game Complete!')).toBeVisible();

    await page.getByRole('button', { name: 'Next game' }).click();
    await expect(page.getByRole('heading', { name: 'Game', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Track Game' })).toBeVisible();
    await page.getByRole('button', { name: 'Previous game' }).click();
    await expect(page.getByRole('heading', { name: 'Game', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Track Game' }).click();
    await expect(page.getByText('Game Complete!')).toBeVisible();
    await page.getByRole('button', { name: 'Back to match' }).click();
    await expect(page.getByRole('heading', { name: 'Track Match' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Game' })).toBeVisible();
  });
});
