import { test, expect } from '@playwright/test';
import {
  addPlayer,
  addTeam,
  clearScorekeeperStorage,
  createMatch,
  gotoScorekeeper,
  navigateMenu,
  openTeam,
} from './helpers/scorekeeper-page';

test.describe('Match workflow', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
  });

  test('creates teams, match, and records history', async ({ page }) => {
    await gotoScorekeeper(page);

    await addTeam(page, 'Home Hawks');
    await openTeam(page, 'Home Hawks');
    await addPlayer(page, 'H1');

    await addTeam(page, 'Away Owls');
    await openTeam(page, 'Away Owls');
    await addPlayer(page, 'A1');

    await createMatch(page, 'Home Hawks', 'Away Owls');

    await navigateMenu(page, 'History');
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(page.locator('.history')).toContainText('Added team (Home Hawks)');
    await expect(page.locator('.history')).toContainText('Added team (Away Owls)');
    await expect(page.locator('.history')).toContainText('Added match');
  });
});

// Full roster + game event tracking: see selectMatchRoster helper (used when React parity lands).
