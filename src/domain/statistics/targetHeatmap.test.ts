import { describe, expect, it } from 'vitest';
import { addMatch, addPlayer, addTeam, createEmptyDatabase } from '../database';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from '../matchGame';
import { persistThrowGameEvent } from '../gameEvents';
import { ThrowResult } from './constants';
import { buildTargetHeatmap, heatmapCellKey } from './targetHeatmap';

describe('target heatmap', () => {
  it('counts throws and hits from thrower to target', () => {
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

    const gamePlayers = data.Tables.GamePlayer as {
      Id: string;
      MatchPlayerId: string;
    }[];
    const matchPlayers = data.Tables.MatchPlayer as {
      Id: string;
      PlayerId: string;
    }[];
    const gp = (playerId: string) =>
      gamePlayers.find(
        (row) =>
          matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId ===
          playerId,
      )!;

    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: gp(h1.Id).Id,
        targetGamePlayerId: gp(a1.Id).Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: gp(h1.Id).Id,
        targetGamePlayerId: gp(a1.Id).Id,
        resultId: ThrowResult.Miss,
        deflections: [],
        recoveredId: undefined,
      },
    ]);

    const heatmap = buildTargetHeatmap(data, { kind: 'match', matchId: match.Id });
    expect(heatmap.throwers.map((row) => row.name)).toEqual(['Alex']);
    expect(heatmap.targets.map((row) => row.name)).toEqual(['Casey']);
    expect(heatmap.cells.get(heatmapCellKey(h1.Id, a1.Id))).toEqual({
      throws: 2,
      hits: 1,
    });
  });
});
