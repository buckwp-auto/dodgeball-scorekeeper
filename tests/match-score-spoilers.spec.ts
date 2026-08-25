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
  getGameStartEvent,
  persistFinishGameEvent,
  persistThrowGameEvent,
  setGameEventVideoOffset,
} from '../src/domain/gameEvents';
import { GameEventFinishResult, ThrowResult } from '../src/domain/statistics/constants';

test.describe('Match list score spoilers', () => {
  test.beforeEach(async ({ page }) => {
    await clearScorekeeperStorage(page);
  });

  test('hides sample-league scores until the eye is clicked', async ({ page }) => {
    await loadSampleLeague(page);
    await navigateMenu(page, 'Matches');
    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible();

    const row = page.locator('.sk-match-row').first();
    await expect(row.locator('.sk-match-progress')).toHaveText('Finished');
    await expect(row.locator('.sk-match-list-score')).toHaveCount(0);

    await row.getByRole('button', { name: /Show score for / }).click();
    await expect(row.locator('.sk-match-list-score')).toBeVisible();
    await expect(row.locator('.sk-match-list-score')).toContainText('–');

    await row.getByRole('button', { name: /Hide score for / }).click();
    await expect(row.locator('.sk-match-list-score')).toHaveCount(0);
  });

  test('new match is not started and reveals 0–0', async ({ page }) => {
    await gotoScorekeeper(page);
    await addTeam(page, 'Home Hawks');
    await openTeam(page, 'Home Hawks');
    await addPlayer(page, 'H1');
    await addTeam(page, 'Away Owls');
    await openTeam(page, 'Away Owls');
    await addPlayer(page, 'A1');
    await createMatch(page, 'Home Hawks', 'Away Owls');

    await navigateMenu(page, 'Matches');
    const row = page.locator('.sk-match-row').filter({
      has: page.getByRole('button', { name: 'Home Hawks vs. Away Owls', exact: true }),
    });
    await expect(row.locator('.sk-match-progress')).toHaveText('Not started');
    await expect(row.locator('.sk-match-list-score')).toHaveCount(0);

    await row.getByRole('button', { name: 'Show score for Home Hawks vs. Away Owls' }).click();
    await expect(row.locator('.sk-match-list-score')).toHaveText(
      'Home Hawks 0–0 Away Owls',
    );
  });

  test('in-progress match shows video-elapsed minute after reveal', async ({ page }) => {
    const data = createEmptyDatabase();
    const home = addTeamRow(data, 'Home Hawks');
    const away = addTeamRow(data, 'Away Owls');
    const h1 = addPlayerRow(data, home.Id, 'H1');
    const a1 = addPlayerRow(data, away.Id, 'A1');
    const finished = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, finished.Id, h1.Id, true);
    toggleMatchPlayer(data, finished.Id, a1.Id, false);
    const finishedGame = addGameRow(data, finished.Id);
    toggleGamePlayer(data, finished.Id, finishedGame, h1.Id);
    toggleGamePlayer(data, finished.Id, finishedGame, a1.Id);
    persistFinishGameEvent(data, finishedGame, {
      resultId: GameEventFinishResult.WinHome,
    });

    const road = addTeamRow(data, 'Road Ravens');
    const r1 = addPlayerRow(data, road.Id, 'R1');
    const live = addMatch(data, home.Id, road.Id);
    toggleMatchPlayer(data, live.Id, h1.Id, true);
    toggleMatchPlayer(data, live.Id, r1.Id, false);
    const liveGame = addGameRow(data, live.Id);
    toggleGamePlayer(data, live.Id, liveGame, h1.Id);
    toggleGamePlayer(data, live.Id, liveGame, r1.Id);
    const start = getGameStartEvent(data, liveGame)!;
    setGameEventVideoOffset(data, start.Id, 600);
    const infos = getGamePlayerInfos(data, live.Id, liveGame);
    persistThrowGameEvent(
      data,
      liveGame,
      live.Id,
      [
        {
          throwerGamePlayerId: infos.find((row) => row.playerName === 'H1')!.gamePlayerId,
          targetGamePlayerId: infos.find((row) => row.playerName === 'R1')!.gamePlayerId,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { videoOffsetSeconds: 845 },
    );

    await page.addInitScript(
      ({ key, value }) => sessionStorage.setItem(key, value),
      { key: STORAGE_KEY, value: serializeDatabase(data) },
    );
    await gotoScorekeeper(page, 'matches');

    const liveRow = page.locator('.sk-match-row').filter({
      has: page.getByRole('button', { name: 'Home Hawks vs. Road Ravens', exact: true }),
    });
    await expect(liveRow.locator('.sk-match-progress')).toHaveText('In progress');
    await expect(liveRow.locator('.sk-match-list-score')).toHaveCount(0);

    await liveRow
      .getByRole('button', { name: 'Show score for Home Hawks vs. Road Ravens' })
      .click();
    await expect(liveRow.locator('.sk-match-list-score')).toContainText(
      'Home Hawks 0–0 Road Ravens',
    );
    await expect(liveRow.locator('.sk-match-game-clock')).toHaveText(' · Game 1 · 4:05');

    const doneRow = page.locator('.sk-match-row').filter({
      has: page.getByRole('button', { name: 'Home Hawks vs. Away Owls', exact: true }),
    });
    await expect(doneRow.locator('.sk-match-progress')).toHaveText('Finished');
    await doneRow
      .getByRole('button', { name: 'Show score for Home Hawks vs. Away Owls' })
      .click();
    await expect(doneRow.locator('.sk-match-list-score')).toContainText(
      'Home Hawks 1–0 Away Owls',
    );
    await expect(doneRow.locator('.sk-match-game-clock')).toHaveCount(0);
  });
});
