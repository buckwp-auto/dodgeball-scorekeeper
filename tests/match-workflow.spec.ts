import { test, expect } from '@playwright/test';
import {
  addPlayer,
  addTeam,
  clearScorekeeperStorage,
  createMatch,
  gotoScorekeeper,
  loadSampleLeague,
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
    await expect(page.locator('.sk-scoreboard-home')).toContainText('Home Hawks');
    await expect(page.locator('.sk-scoreboard-home')).toContainText('0');
    await expect(page.locator('.sk-scoreboard-away')).toContainText('Away Owls');
    await expect(page.locator('.sk-scoreboard-away')).toContainText('0');

    const homeTeam = page.locator('.sk-match .sk-team').nth(0);
    await homeTeam.getByLabel('Add player').fill('Pat');
    await homeTeam.getByRole('checkbox', { name: 'Sub' }).check();
    await homeTeam.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(homeTeam.getByRole('button', { name: 'Pat', exact: true })).toBeVisible();
    await expect(homeTeam.locator('.sk-player').filter({ hasText: 'Pat' }).locator('.sk-player-sub')).toBeVisible();
    await expect(homeTeam.getByRole('button', { name: 'Remove H1' })).toHaveCount(0);
    await expect(homeTeam.getByRole('button', { name: 'Remove Pat' })).toBeVisible();

    await homeTeam.getByLabel('Add player').fill('Zoe');
    await homeTeam.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(homeTeam.getByRole('button', { name: 'Zoe', exact: true })).toBeVisible();
    await expect(
      homeTeam.locator('.sk-player').filter({ hasText: 'H1' }).locator('.sk-hotkey-badge'),
    ).toHaveText('A');
    await expect(
      homeTeam.locator('.sk-player').filter({ hasText: 'Zoe' }).locator('.sk-hotkey-badge'),
    ).toHaveText('S');
    await expect(
      homeTeam.locator('.sk-player').filter({ hasText: 'Pat' }).locator('.sk-hotkey-badge'),
    ).toHaveText('D');

    await homeTeam.locator('.sk-player').filter({ hasText: 'H1' }).locator('.sk-player-sub').click();
    await expect(
      homeTeam.locator('.sk-player').filter({ hasText: 'Zoe' }).locator('.sk-hotkey-badge'),
    ).toHaveText('A');
    await expect(
      homeTeam.locator('.sk-player').filter({ hasText: 'H1' }).locator('.sk-hotkey-badge'),
    ).toHaveText('S');
    await expect(
      homeTeam.locator('.sk-player').filter({ hasText: 'Pat' }).locator('.sk-hotkey-badge'),
    ).toHaveText('D');

    page.once('dialog', (dialog) => dialog.accept());
    await homeTeam
      .locator('.sk-player')
      .filter({ hasText: 'Pat' })
      .getByRole('button', { name: 'Remove Pat' })
      .click();
    await expect(homeTeam.getByRole('button', { name: 'Pat', exact: true })).toHaveCount(0);

    await homeTeam.locator('.sk-player').filter({ hasText: 'H1' }).locator('.sk-player-sub').click();

    await expect(
      homeTeam.locator('.sk-player').filter({ hasText: 'H1' }).locator('.sk-hotkey-badge'),
    ).toHaveText('A');
    await expect(
      homeTeam.locator('.sk-player').filter({ hasText: 'Zoe' }).locator('.sk-hotkey-badge'),
    ).toHaveText('S');
    await expect(
      page
        .locator('.sk-match .sk-team')
        .nth(1)
        .locator('.sk-player')
        .filter({ hasText: 'A1' })
        .locator('.sk-hotkey-badge'),
    ).toHaveText('J');

    await page.keyboard.press('s');
    await expect(page.getByRole('button', { name: 'Track Match' })).toBeEnabled();
    await page.keyboard.press('a');
    await expect(page.getByRole('button', { name: 'Track Match' })).toBeDisabled();
    await page.keyboard.press('a');
    await expect(page.getByRole('button', { name: 'Track Match' })).toBeEnabled();

    await page.getByRole('button', { name: 'Track Match' }).click();
    await page.getByRole('button', { name: 'Add Game' }).click();
    await expect(page.getByRole('heading', { name: /^Game \d+$/ })).toBeVisible();
    await expect(
      page
        .locator('.sk-game .sk-team')
        .nth(0)
        .locator('.sk-player')
        .filter({ hasText: 'H1' })
        .locator('.sk-hotkey-badge'),
    ).toHaveText('A');
    await expect(
      page
        .locator('.sk-game .sk-team')
        .nth(1)
        .locator('.sk-player')
        .filter({ hasText: 'A1' })
        .locator('.sk-hotkey-badge'),
    ).toHaveText('J');

    await navigateMenu(page, 'History');
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(page.locator('.history')).toContainText('Added team (Home Hawks)');
    await expect(page.locator('.history')).toContainText('Added team (Away Owls)');
    await expect(page.locator('.history')).toContainText('Added match');
  });

  test('ends a sample match and lists a timestamped match-ended event', async ({
    page,
  }) => {
    await loadSampleLeague(page);
    await navigateMenu(page, 'Matches');
    await page.getByRole('button', { name: / vs\. / }).first().click();
    await expect(page.getByRole('heading', { name: 'Match' })).toBeVisible();
    await page.getByRole('button', { name: 'Track Match' }).click();
    await expect(page.getByRole('heading', { name: 'Track Match' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'End Match' })).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'End Match' }).click();

    const ended = page.locator('.sk-match-ended');
    await expect(ended).toBeVisible();
    await expect(ended).toContainText(/Match ended — \d+:\d{2}/);
    await expect(page.getByRole('button', { name: 'Add Game' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'End Match' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.sk-match-ended')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add Game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'End Match' })).toBeVisible();

    await navigateMenu(page, 'History');
    await expect(page.locator('.history')).toContainText('Ended match');
    await expect(page.locator('.history')).toContainText('Undid match end');
  });
});

// Full roster + game event tracking: see selectMatchRoster helper (used when React parity lands).
