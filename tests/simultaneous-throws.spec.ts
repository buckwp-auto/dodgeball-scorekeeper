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
import {
  buildPermanentPlayerHotkeys,
  hotkeyForResult,
} from '../react-app/src/domain/hotkeys';
import { ThrowResult } from '../react-app/src/domain/statistics/constants';

/** A1 hits H1, so H1 is out while the ball he already released is still live. */
function seedGameWithOutHomePlayer() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home Hawks');
  const away = addTeam(data, 'Away Owls');
  const homePlayers = ['H1', 'H2'].map((name) => addPlayer(data, home.Id, name));
  const awayPlayers = ['A1', 'A2', 'A3'].map((name) => addPlayer(data, away.Id, name));
  const match = addMatch(data, home.Id, away.Id);
  for (const player of homePlayers) toggleMatchPlayer(data, match.Id, player.Id, true);
  for (const player of awayPlayers) toggleMatchPlayer(data, match.Id, player.Id, false);
  const gameId = addGame(data, match.Id);
  for (const player of [...homePlayers, ...awayPlayers]) {
    toggleGamePlayer(data, match.Id, gameId, player.Id);
  }

  const infos = getGamePlayerInfos(data, match.Id, gameId);
  const gamePlayerId = (name: string) =>
    infos.find((row) => row.playerName === name)!.gamePlayerId;

  persistThrowGameEvent(
    data,
    gameId,
    match.Id,
    [
      {
        throwerGamePlayerId: gamePlayerId('A1'),
        targetGamePlayerId: gamePlayerId('H1'),
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ],
    { videoOffsetSeconds: 10 },
  );

  const hotkeys = buildPermanentPlayerHotkeys(infos);
  return {
    data,
    matchId: match.Id,
    gameId,
    hotkeyFor: (name: string) => hotkeys.get(gamePlayerId(name))!,
  };
}

test.describe('Simultaneous throws', () => {
  test('groups a second throw onto the throwing team, even from a player who is out', async ({
    page,
  }) => {
    const { data, matchId, gameId, hotkeyFor } = seedGameWithOutHomePlayer();
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.addInitScript(
      ({ key, value }) => sessionStorage.setItem(key, value),
      { key: STORAGE_KEY, value: serializeDatabase(data) },
    );
    await page.goto(`/matches/${matchId}/games/${gameId}/events`);
    await expect(page.locator('.sk-editor-grid').first()).toBeVisible();

    // H1 is out but still throwing the ball he released as he was hit
    await expect(page.getByRole('button', { name: /H1 \(out\)/ })).toBeVisible();
    await page.keyboard.press(hotkeyFor('H1'));
    await page.keyboard.press(hotkeyFor('A2'));
    await page.keyboard.press(hotkeyForResult(ThrowResult.Hit)!);

    await expect(page.getByRole('button', { name: 'Add Team Throw' })).toBeVisible();
    await page.keyboard.press('c');
    // Away is defending, so A3's key targets him instead of making him a thrower
    await page.keyboard.press(hotkeyFor('A3'));
    await page.keyboard.press(hotkeyFor('H2'));
    await page.keyboard.press(hotkeyForResult(ThrowResult.Hit)!);

    const timeline = page.locator('.sk-game-timeline');
    await expect(timeline).toContainText('H1');
    await expect(timeline).toContainText('H2');
    await expect(timeline).toContainText('A3');
    await expect(
      page.getByText('Group throwers must be on the same team'),
    ).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });
});
