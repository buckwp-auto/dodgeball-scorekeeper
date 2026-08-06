import { describe, expect, it } from 'vitest';
import { createEmptyDatabase } from './database';
import { addMatch, addPlayer, addTeam } from './database';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from './matchGame';
import {
  GameEventFinishResult,
  ThrowResult,
} from './statistics/constants';
import { getStatisticsSummaryCsvText } from './statistics/statisticsFormatService';
import {
  saveFinishGameEvent,
  saveThrowGameEvent,
} from './gameEvents';

function setupOneGameMatch() {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home Hawks');
  const away = addTeam(data, 'Away Owls');
  const h1 = addPlayer(data, home.Id, 'H1');
  const a1 = addPlayer(data, away.Id, 'A1');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  const gameId = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, gameId, h1.Id);
  toggleGamePlayer(data, match.Id, gameId, a1.Id);

  const gamePlayers = data.Tables.GamePlayer as {
    Id: string;
    MatchPlayerId: string;
  }[];
  const matchPlayers = data.Tables.MatchPlayer as {
    Id: string;
    PlayerId: string;
    TeamHome: boolean;
  }[];
  const homeGp = gamePlayers.find(
    (row) =>
      matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === h1.Id,
  )!;
  const awayGp = gamePlayers.find(
    (row) =>
      matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === a1.Id,
  )!;

  return { data, match, gameId, homeGp, awayGp };
}

describe('game event recording', () => {
  it('records throw and finish for statistics', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();

    saveThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
      },
    ]);
    saveFinishGameEvent(data, gameId, GameEventFinishResult.WinHome);

    const csv = getStatisticsSummaryCsvText(data, [match.Id]);
    expect(csv).toContain('"Home Hawks","H1"');
    expect(csv).toContain('"1","1","0","0","0"');
    expect(csv).toContain('"1","0","0"');
  });
});
