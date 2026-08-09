import { test, expect } from '@playwright/test';
import { STORAGE_KEY } from './helpers/scorekeeper-page';
import {
  addMatch,
  addPlayer,
  addTeam,
  createEmptyDatabase,
  serializeDatabase,
} from '../react-app/src/domain/database';
import {
  addGame,
  toggleGamePlayer,
  toggleMatchPlayer,
} from '../react-app/src/domain/matchGame';
import {
  getGamePlayerInfos,
  persistThrowGameEvent,
} from '../react-app/src/domain/gameEvents';
import { ThrowResult } from '../react-app/src/domain/statistics/constants';

function seedGameWithThrow() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home Hawks');
  const away = addTeam(data, 'Away Owls');
  const h1 = addPlayer(data, home.Id, 'Alex');
  const a1 = addPlayer(data, away.Id, 'Casey');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  const gameId = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, gameId, h1.Id);
  toggleGamePlayer(data, match.Id, gameId, a1.Id);

  const infos = getGamePlayerInfos(data, match.Id, gameId);
  persistThrowGameEvent(data, gameId, match.Id, [
    {
      throwerGamePlayerId: infos.find((row) => row.playerName === 'Alex')!.gamePlayerId,
      targetGamePlayerId: infos.find((row) => row.playerName === 'Casey')!.gamePlayerId,
      resultId: ThrowResult.Hit,
      deflections: [],
      recoveredId: undefined,
    },
  ]);

  return { data, matchId: match.Id, gameId };
}

test.describe('Timeline highlights', () => {
  test('stars an event and lists it on the Highlights page', async ({ page }) => {
    const { data, matchId, gameId } = seedGameWithThrow();
    await page.addInitScript(
      ({ key, value }) => sessionStorage.setItem(key, value),
      { key: STORAGE_KEY, value: serializeDatabase(data) },
    );
    await page.goto(`/matches/${matchId}/games/${gameId}/events`);
    await expect(page.locator('.sk-game-timeline')).toContainText('Alex threw at Casey');

    await page.getByRole('button', { name: 'Star highlight' }).first().click();
    await expect(page.getByRole('button', { name: 'Remove highlight' })).toBeVisible();

    await page.locator('.sk-menu-link').filter({ hasText: 'Highlights' }).first().click();
    await expect(page.getByRole('heading', { name: 'Highlights' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Home Hawks vs. Away Owls' })).toBeVisible();
    await expect(page.locator('.sk-game-timeline')).toContainText('Alex threw at Casey');

    await page.getByRole('button', { name: /Alex threw at Casey/ }).click();
    await expect(page).toHaveURL(new RegExp(`/matches/${matchId}/games/${gameId}/events\\?event=`));
    await expect(page.locator('.sk-game-timeline')).toContainText('Alex threw at Casey');
  });
});
