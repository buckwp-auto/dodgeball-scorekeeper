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
  STORAGE_KEY,
} from './helpers/scorekeeper-page';
import {
  addMatch,
  addPlayer as addPlayerRow,
  addTeam as addTeamRow,
  createEmptyDatabase,
  serializeDatabase,
} from '../src/domain/database';
import {
  addGame as addGameRow,
  toggleGamePlayer,
  toggleMatchPlayer,
} from '../src/domain/matchGame';
import {
  getGamePlayerInfos,
  persistThrowGameEvent,
} from '../src/domain/gameEvents';
import { ThrowResult } from '../src/domain/statistics/constants';

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
    await page.keyboard.press('Enter');
    await expect(page.getByText('Game Complete!')).toBeVisible();

    await expect(page.locator('.sk-match-score')).toContainText('Home Hawks 1–0 Away Owls');

    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Game 2', exact: true })).toBeVisible();
    await expect(page.locator('.sk-match-score')).toContainText('Home Hawks 1–0 Away Owls');
    await expect(page.getByRole('button', { name: 'Track Game' })).toBeVisible();
    await page.getByRole('button', { name: 'Previous game' }).click();
    await expect(page.getByRole('heading', { name: 'Game 1', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Track Game' }).click();
    await expect(page.getByText('Game Complete!')).toBeVisible();
    await page.getByRole('button', { name: 'Back to match' }).click();
    await expect(page.getByRole('heading', { name: 'Track Match' })).toBeVisible();
    await expect(page.locator('.sk-match-score')).toContainText('Home Hawks 1–0 Away Owls');
    await expect(page.getByRole('button', { name: 'Add Game' })).toBeVisible();
  });

  test('edit roster from track game rolls back events after confirm', async ({ page }) => {
    const data = createEmptyDatabase();
    const home = addTeamRow(data, 'Home Hawks');
    const away = addTeamRow(data, 'Away Owls');
    const h1 = addPlayerRow(data, home.Id, 'H1');
    const h2 = addPlayerRow(data, home.Id, 'H2');
    const a1 = addPlayerRow(data, away.Id, 'A1');
    const match = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, match.Id, h1.Id, true);
    toggleMatchPlayer(data, match.Id, h2.Id, true);
    toggleMatchPlayer(data, match.Id, a1.Id, false);
    const gameId = addGameRow(data, match.Id);
    toggleGamePlayer(data, match.Id, gameId, h1.Id);
    toggleGamePlayer(data, match.Id, gameId, h2.Id);
    toggleGamePlayer(data, match.Id, gameId, a1.Id);

    const infos = getGamePlayerInfos(data, match.Id, gameId);
    const gp = (name: string) => infos.find((row) => row.playerName === name)!.gamePlayerId;
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: gp('H2'),
        targetGamePlayerId: gp('A1'),
        resultId: ThrowResult.Miss,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: gp('H1'),
        targetGamePlayerId: gp('A1'),
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);

    await page.addInitScript(
      ({ key, value }) => sessionStorage.setItem(key, value),
      { key: STORAGE_KEY, value: serializeDatabase(data) },
    );
    await page.goto(`/matches/${match.Id}/games/${gameId}/events`);
    await expect(page.getByRole('button', { name: 'Throw', exact: true })).toBeVisible();
    await expect(page.locator('.sk-game-timeline')).toContainText('H1');
    await expect(page.locator('.sk-game-timeline')).toContainText('H2');

    await page.getByRole('button', { name: 'Edit active players' }).click();
    await expect(page.getByRole('heading', { name: /^Game \d+$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Track Game' })).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.sk-game .sk-team').nth(0).getByRole('button', { name: 'H1', exact: true }).click();

    await page.getByRole('button', { name: 'Track Game' }).click();
    await expect(page.getByRole('button', { name: 'Throw', exact: true })).toBeVisible();
    await expect(page.locator('.sk-game-timeline')).toContainText('Game start');
    await expect(page.locator('.sk-game-timeline')).toContainText('H2');
    await expect(page.locator('.sk-game-timeline')).not.toContainText('H1');
  });
});
