import { describe, expect, it } from 'vitest';
import { createEmptyDatabase } from './database';
import { addMatch, addPlayer, addTeam } from './database';
import { addGame, toggleGamePlayer, toggleMatchPlayer } from './matchGame';
import {
  DeflectionResult,
  GameEventFinishResult,
  ThrowResult,
} from './statistics/constants';
import { getStatisticsSummaryCsvText } from './statistics/statisticsFormatService';
import {
  buildTimelineEntries,
  ensureGameStartEvent,
  getGameEventType,
  getGameStartEvent,
  persistThrowGameEvent,
  saveFinishGameEvent,
  saveThrowGameEvent,
  setGameEventVideoOffset,
} from './gameEvents';

function setupOneGameMatch(extraHome = false) {
  const data = createEmptyDatabase();
  const home = addTeam(data, 'Home Hawks');
  const away = addTeam(data, 'Away Owls');
  const h1 = addPlayer(data, home.Id, 'Alex');
  const h2 = extraHome ? addPlayer(data, home.Id, 'Blake') : null;
  const a1 = addPlayer(data, away.Id, 'Casey');
  const match = addMatch(data, home.Id, away.Id);
  toggleMatchPlayer(data, match.Id, h1.Id, true);
  if (h2) toggleMatchPlayer(data, match.Id, h2.Id, true);
  toggleMatchPlayer(data, match.Id, a1.Id, false);
  const gameId = addGame(data, match.Id);
  toggleGamePlayer(data, match.Id, gameId, h1.Id);
  if (h2) toggleGamePlayer(data, match.Id, gameId, h2.Id);
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
  const gpFor = (playerId: string) =>
    gamePlayers.find(
      (row) =>
        matchPlayers.find((mp) => mp.Id === row.MatchPlayerId)?.PlayerId === playerId,
    )!;

  return {
    data,
    match,
    gameId,
    homeGp: gpFor(h1.Id),
    homeGp2: h2 ? gpFor(h2.Id) : null,
    awayGp: gpFor(a1.Id),
  };
}

function flattenText(segments: { kind: string; text?: string; player?: { playerName: string } }[]) {
  return segments
    .map((segment) =>
      segment.kind === 'player' ? segment.player!.playerName : segment.text,
    )
    .join('');
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
    expect(csv).toContain('"Home Hawks","Alex"');
    expect(csv).toContain('"1","1","0","0","0"');
    expect(csv).toContain('"1","0","0"');
  });

  it('stores video offset seconds on game events', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    const eventId = persistThrowGameEvent(
      data,
      gameId,
      match.Id,
      [
        {
          throwerGamePlayerId: homeGp.Id,
          targetGamePlayerId: awayGp.Id,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { videoOffsetSeconds: 125.4 },
    );

    const row = (data.Tables.GameEvent as { Id: string; VideoOffsetSeconds?: number }[]).find(
      (entry) => entry.Id === eventId,
    );
    expect(row?.VideoOffsetSeconds).toBe(125.4);

    const [entry] = buildTimelineEntries(data, gameId, match.Id);
    expect(entry.videoOffsetSeconds).toBe(125.4);
  });

  it('seeds a game start event on addGame and keeps it editable', () => {
    const { data, gameId } = setupOneGameMatch();
    const start = getGameStartEvent(data, gameId);
    expect(start).not.toBeNull();
    expect(start!.Ordinal).toBe(1);
    expect(getGameEventType(data, start!.Id)).toBe('start');

    setGameEventVideoOffset(data, start!.Id, 42);
    expect(getGameStartEvent(data, gameId)?.VideoOffsetSeconds).toBe(42);
    const game = (data.Tables.Game as { Id: string; VideoStartSeconds?: number }[]).find(
      (row) => row.Id === gameId,
    );
    expect(game?.VideoStartSeconds).toBe(42);

    // Idempotent ensure
    const again = ensureGameStartEvent(data, gameId);
    expect(again).toBe(start!.Id);
  });

  it('does not overwrite video offset on throw edit when omitted', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    const eventId = persistThrowGameEvent(
      data,
      gameId,
      match.Id,
      [
        {
          throwerGamePlayerId: homeGp.Id,
          targetGamePlayerId: awayGp.Id,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { videoOffsetSeconds: 10 },
    );
    persistThrowGameEvent(
      data,
      gameId,
      match.Id,
      [
        {
          throwerGamePlayerId: homeGp.Id,
          targetGamePlayerId: awayGp.Id,
          resultId: ThrowResult.Miss,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { gameEventId: eventId },
    );
    const row = (data.Tables.GameEvent as { Id: string; VideoOffsetSeconds?: number }[]).find(
      (entry) => entry.Id === eventId,
    );
    expect(row?.VideoOffsetSeconds).toBe(10);
  });
});

describe('buildTimelineEntries', () => {
  it('formats a throw as a single sentence row', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Dodge,
        deflections: [],
        recoveredId: undefined,
      },
    ]);

    const [entry] = buildTimelineEntries(data, gameId, match.Id);
    expect(entry.rows).toHaveLength(1);
    expect(entry.rows[0].tone).toBe('dodge');
    expect(entry.rows[0].actions).toEqual([{ kind: 'throw', resultId: ThrowResult.Dodge }]);
    expect(flattenText(entry.rows[0].segments)).toBe(
      'Alex threw at Casey, resulting in a Dodge',
    );
  });

  it('keeps recovered inline and deflections on extra rows', () => {
    const { data, match, gameId, homeGp, homeGp2, awayGp } = setupOneGameMatch(true);
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Catch,
        deflections: [
          {
            receiverGamePlayerId: awayGp.Id,
            resultId: DeflectionResult.Block,
          },
        ],
        recoveredId: homeGp2!.Id,
      },
    ]);

    const [entry] = buildTimelineEntries(data, gameId, match.Id);
    expect(entry.rows).toHaveLength(2);
    expect(entry.rows[0].tone).toBe('catch');
    expect(flattenText(entry.rows[0].segments)).toBe(
      'Alex threw at Casey, resulting in a Catch · recovered Blake',
    );
    expect(entry.rows[1].role).toBe('deflection');
    expect(entry.rows[1].tone).toBe('block');
    expect(flattenText(entry.rows[1].segments)).toBe(
      'Casey deflected, resulting in a Block',
    );
  });

  it('uses hit tone for failed block/catch', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.BlockFailed,
        deflections: [],
        recoveredId: undefined,
      },
    ]);

    const [entry] = buildTimelineEntries(data, gameId, match.Id);
    expect(entry.rows[0].tone).toBe('hit');
    expect(flattenText(entry.rows[0].segments)).toContain('a Failed Block');
  });
});
