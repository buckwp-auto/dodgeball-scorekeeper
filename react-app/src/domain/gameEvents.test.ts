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
import { buildTimelineEntries } from './gameEventTimeline';
import {
  ensureGameStartEvent,
  gameHasFinishEvent,
  getGameEventType,
  getGameEvents,
  getGameStartEvent,
  initialVideoSeekSeconds,
  loadThrowDraftsFromEvent,
  persistFinishGameEvent,
  persistThrowGameEvent,
  restoreGameEventSnapshot,
  setGameEventVideoOffset,
  undoLastGameEvent,
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

    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        recoveredId: undefined,
        deflections: [],
      },
    ]);
    persistFinishGameEvent(data, gameId, {
      resultId: GameEventFinishResult.WinHome,
    });

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

  it('rejects a group whose throwers are on opposing teams', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    expect(() =>
      persistThrowGameEvent(data, gameId, match.Id, [
        {
          throwerGamePlayerId: homeGp.Id,
          targetGamePlayerId: awayGp.Id,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
        {
          throwerGamePlayerId: awayGp.Id,
          targetGamePlayerId: homeGp.Id,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ]),
    ).toThrow('Group throwers must be on the same team');
    expect(data.Tables.GameEvent).toHaveLength(1);
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

describe('initialVideoSeekSeconds', () => {
  it('seeks to the last stamped event for an unfinished game', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    setGameEventVideoOffset(data, getGameStartEvent(data, gameId)!.Id, 10);
    const first = persistThrowGameEvent(
      data,
      gameId,
      match.Id,
      [
        {
          throwerGamePlayerId: homeGp.Id,
          targetGamePlayerId: awayGp.Id,
          resultId: ThrowResult.Dodge,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { videoOffsetSeconds: 40 },
    );
    persistThrowGameEvent(
      data,
      gameId,
      match.Id,
      [
        {
          throwerGamePlayerId: awayGp.Id,
          targetGamePlayerId: homeGp.Id,
          resultId: ThrowResult.Miss,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { videoOffsetSeconds: 95 },
    );
    expect(first).toBeTruthy();
    expect(initialVideoSeekSeconds(data, gameId)).toBe(95);
  });

  it('seeks to game start for a finished game', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    setGameEventVideoOffset(data, getGameStartEvent(data, gameId)!.Id, 12);
    persistThrowGameEvent(
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
      { videoOffsetSeconds: 80 },
    );
    persistFinishGameEvent(
      data,
      gameId,
      { resultId: GameEventFinishResult.WinHome },
      { videoOffsetSeconds: 100 },
    );
    expect(initialVideoSeekSeconds(data, gameId)).toBe(12);
  });
});

describe('undo / redo game events', () => {
  it('undoes and restores the last throw with deflections', () => {
    const { data, match, gameId, homeGp, homeGp2, awayGp } = setupOneGameMatch(true);
    persistThrowGameEvent(
      data,
      gameId,
      match.Id,
      [
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
      ],
      { videoOffsetSeconds: 55 },
    );

    const snapshot = undoLastGameEvent(data, gameId);
    expect(snapshot?.type).toBe('throw');
    expect(getGameEvents(data, gameId)).toHaveLength(1); // start only

    const restoredId = restoreGameEventSnapshot(data, snapshot!);
    expect(restoredId).toBe(snapshot!.event.Id);
    const drafts = loadThrowDraftsFromEvent(data, restoredId);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].resultId).toBe(ThrowResult.Catch);
    expect(drafts[0].recoveredId).toBe(homeGp2!.Id);
    expect(drafts[0].deflections).toHaveLength(1);
    expect(
      (data.Tables.GameEvent as { Id: string; VideoOffsetSeconds?: number }[]).find(
        (row) => row.Id === restoredId,
      )?.VideoOffsetSeconds,
    ).toBe(55);
  });

  it('undoes a finish event', () => {
    const { data, gameId } = setupOneGameMatch();
    persistFinishGameEvent(data, gameId, {
      resultId: GameEventFinishResult.WinAway,
    });
    expect(gameHasFinishEvent(data, gameId)).toBe(true);
    const snapshot = undoLastGameEvent(data, gameId);
    expect(snapshot?.type).toBe('finish');
    expect(gameHasFinishEvent(data, gameId)).toBe(false);
    restoreGameEventSnapshot(data, snapshot!);
    expect(gameHasFinishEvent(data, gameId)).toBe(true);
  });
});
