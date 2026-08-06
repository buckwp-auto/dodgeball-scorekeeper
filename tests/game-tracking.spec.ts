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
  });
});
