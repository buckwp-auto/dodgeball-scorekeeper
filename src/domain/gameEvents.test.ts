import { describe, expect, it } from 'vitest';
import { createEmptyDatabase } from './database';
import { addMatch, addPlayer, addTeam, getPlayer, getPlayersForTeam } from './database';
import {
  addGame,
  addPlayerToMatchSide,
  isPlayerInGame,
  isPlayerInMatch,
  toggleGamePlayer,
  toggleMatchPlayer,
} from './matchGame';
import {
  DeflectionResult,
  GameEventErrorOffense,
  GameEventFinishResult,
  ThrowResult,
} from './statistics/constants';
import { getStatisticsSummaryCsvText } from './statistics/statisticsFormatService';
import { buildTimelineEntries, timelineRowVideoTimeLabel } from './gameEventTimeline';
import {
  ensureGameStartEvent,
  gameHasFinishEvent,
  getGameEventType,
  getGameEvents,
  getGameStartEvent,
  initialVideoSeekSeconds,
  inPageOpenSeekSeconds,
  trackGameOpenSeekSeconds,
  loadThrowDraftsFromEvent,
  loadErrorDraftFromEvent,
  persistErrorGameEvent,
  persistFinishGameEvent,
  persistNoBlockingGameEvent,
  persistThrowGameEvent,
  previewRemoveGamePlayer,
  previewRemovePlayerFromMatch,
  removeGamePlayerFromRoster,
  removeMatchSidePlayerConfirmMessage,
  removePlayerFromMatchSide,
  restoreGameEventSnapshot,
  setGameEventHighlight,
  setGameEventVideoOffset,
  undoLastGameEvent,
  isErrorDraftComplete,
  gameEventIncludesGamePlayer,
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
    expect(entry.isHighlight).toBe(false);

    setGameEventHighlight(data, eventId, true);
    expect(
      (data.Tables.GameEvent as { Id: string; IsHighlight?: boolean }[]).find(
        (row) => row.Id === eventId,
      )?.IsHighlight,
    ).toBe(true);
    expect(buildTimelineEntries(data, gameId, match.Id)[0].isHighlight).toBe(true);
  });

  it('records no blocking started as a player-less other event', () => {
    const { data, match, gameId } = setupOneGameMatch();
    const eventId = persistNoBlockingGameEvent(data, gameId, { videoOffsetSeconds: 180 });
    expect(getGameEventType(data, eventId)).toBe('noBlocking');
    const [entry] = buildTimelineEntries(data, gameId, match.Id);
    expect(entry.type).toBe('noBlocking');
    expect(entry.rows[0].segments.some((seg) => seg.kind === 'text')).toBe(true);
  });

  it('slots a new stamped event between earlier and later video times', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    const draft = {
      throwerGamePlayerId: homeGp.Id,
      targetGamePlayerId: awayGp.Id,
      resultId: ThrowResult.Hit,
      deflections: [],
      recoveredId: undefined,
    };
    const lateId = persistThrowGameEvent(data, gameId, match.Id, [draft], {
      videoOffsetSeconds: 40,
    });
    const earlyId = persistThrowGameEvent(data, gameId, match.Id, [draft], {
      videoOffsetSeconds: 10,
    });
    const midId = persistThrowGameEvent(data, gameId, match.Id, [draft], {
      videoOffsetSeconds: 25,
    });

    const events = getGameEvents(data, gameId);
    expect(events.map((row) => row.Id)).toEqual([
      getGameStartEvent(data, gameId)!.Id,
      earlyId,
      midId,
      lateId,
    ]);
    expect(events.map((row) => row.Ordinal)).toEqual([1, 2, 3, 4]);
  });

  it('appends unstamped events after stamped ones', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    const draft = {
      throwerGamePlayerId: homeGp.Id,
      targetGamePlayerId: awayGp.Id,
      resultId: ThrowResult.Hit,
      deflections: [],
      recoveredId: undefined,
    };
    persistThrowGameEvent(data, gameId, match.Id, [draft], { videoOffsetSeconds: 10 });
    const unstampedId = persistThrowGameEvent(data, gameId, match.Id, [draft]);
    const events = getGameEvents(data, gameId);
    expect(events[events.length - 1]?.Id).toBe(unstampedId);
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

  it('stamps an unstamped team throw when the second ball is saved with a time', () => {
    const { data, match, gameId, homeGp, homeGp2, awayGp } = setupOneGameMatch(true);
    const eventId = persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
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
        {
          throwerGamePlayerId: homeGp2!.Id,
          targetGamePlayerId: awayGp.Id,
          resultId: ThrowResult.Hit,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { gameEventId: eventId, videoOffsetSeconds: 18 },
    );
    expect(
      (data.Tables.GameEvent as { Id: string; VideoOffsetSeconds?: number | null }[]).find(
        (row) => row.Id === eventId,
      )?.VideoOffsetSeconds,
    ).toBe(18);
  });
});

describe('illegal block error events', () => {
  it('requires a thrower to complete an illegal-block draft', () => {
    expect(
      isErrorDraftComplete({
        offenderGamePlayerId: 'gp-off',
        throwerGamePlayerId: '',
        offenseId: GameEventErrorOffense.BlockIllegal,
      }),
    ).toBe(false);
    expect(
      isErrorDraftComplete({
        offenderGamePlayerId: 'gp-off',
        throwerGamePlayerId: 'gp-throw',
        offenseId: GameEventErrorOffense.BlockIllegal,
      }),
    ).toBe(true);
    expect(
      isErrorDraftComplete({
        offenderGamePlayerId: 'gp-off',
        offenseId: GameEventErrorOffense.LineOut,
      }),
    ).toBe(true);
  });

  it('persists optional ThrowerId and reloads it', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    const eventId = persistErrorGameEvent(data, gameId, match.Id, {
      throwerGamePlayerId: homeGp.Id,
      offenderGamePlayerId: awayGp.Id,
      offenseId: GameEventErrorOffense.BlockIllegal,
    });
    const row = (
      data.Tables.GameEventError as {
        GameEventId: string;
        ThrowerId?: string | null;
        OffenderId: string;
      }[]
    ).find((entry) => entry.GameEventId === eventId);
    expect(row?.ThrowerId).toBe(homeGp.Id);
    expect(row?.OffenderId).toBe(awayGp.Id);

    const draft = loadErrorDraftFromEvent(data, eventId);
    expect(draft.throwerGamePlayerId).toBe(homeGp.Id);
    expect(draft.offenderGamePlayerId).toBe(awayGp.Id);
    expect(draft.offenseId).toBe(GameEventErrorOffense.BlockIllegal);
    expect(gameEventIncludesGamePlayer(data, eventId, homeGp.Id)).toBe(true);
    expect(gameEventIncludesGamePlayer(data, eventId, awayGp.Id)).toBe(true);
  });

  it('rejects a same-team thrower and loads old rows without ThrowerId', () => {
    const { data, match, gameId, homeGp, homeGp2, awayGp } = setupOneGameMatch(true);
    expect(() =>
      persistErrorGameEvent(data, gameId, match.Id, {
        throwerGamePlayerId: homeGp.Id,
        offenderGamePlayerId: homeGp2!.Id,
        offenseId: GameEventErrorOffense.BlockIllegal,
      }),
    ).toThrow(/Invalid thrower/);

    const eventId = persistErrorGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: awayGp.Id,
      offenseId: GameEventErrorOffense.LineOut,
    });
    const row = (
      data.Tables.GameEventError as {
        GameEventId: string;
        OffenseId: number;
        ThrowerId?: string | null;
      }[]
    ).find((entry) => entry.GameEventId === eventId)!;
    row.OffenseId = GameEventErrorOffense.BlockIllegal;
    delete row.ThrowerId;

    const draft = loadErrorDraftFromEvent(data, eventId);
    expect(draft.throwerGamePlayerId).toBe('');
    expect(draft.offenderGamePlayerId).toBe(awayGp.Id);
    expect(isErrorDraftComplete(draft)).toBe(false);
  });

  it('clears ThrowerId when an illegal block is edited into a line-out', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    const eventId = persistErrorGameEvent(data, gameId, match.Id, {
      throwerGamePlayerId: homeGp.Id,
      offenderGamePlayerId: awayGp.Id,
      offenseId: GameEventErrorOffense.BlockIllegal,
    });
    persistErrorGameEvent(
      data,
      gameId,
      match.Id,
      {
        offenderGamePlayerId: awayGp.Id,
        offenseId: GameEventErrorOffense.LineOut,
      },
      { gameEventId: eventId },
    );
    const row = (
      data.Tables.GameEventError as { GameEventId: string; ThrowerId?: string | null }[]
    ).find((entry) => entry.GameEventId === eventId);
    expect(row?.ThrowerId ?? null).toBeNull();
  });

  it('undo and restore keep ThrowerId on an illegal block', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    persistErrorGameEvent(data, gameId, match.Id, {
      throwerGamePlayerId: homeGp.Id,
      offenderGamePlayerId: awayGp.Id,
      offenseId: GameEventErrorOffense.BlockIllegal,
    });
    const snapshot = undoLastGameEvent(data, gameId);
    expect(snapshot?.error?.ThrowerId).toBe(homeGp.Id);
    const restoredId = restoreGameEventSnapshot(data, snapshot!);
    expect(loadErrorDraftFromEvent(data, restoredId).throwerGamePlayerId).toBe(homeGp.Id);
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

  it('maps deprecated failed block/catch to Hit in timeline copy', () => {
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
    expect(flattenText(entry.rows[0].segments)).toContain('a Hit');
  });

  it('shows the event timestamp on every throw row of a team throw', () => {
    const { data, match, gameId, homeGp, homeGp2, awayGp } = setupOneGameMatch(true);
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
        {
          throwerGamePlayerId: homeGp2!.Id,
          targetGamePlayerId: awayGp.Id,
          resultId: ThrowResult.Miss,
          deflections: [],
          recoveredId: undefined,
        },
      ],
      { videoOffsetSeconds: 95 },
    );
    const [entry] = buildTimelineEntries(data, gameId, match.Id);
    expect(entry.rows).toHaveLength(2);
    expect(timelineRowVideoTimeLabel(entry, 0)).toBe('1:35');
    expect(timelineRowVideoTimeLabel(entry, 1)).toBe('1:35');
  });

  it('names thrower and offender on an illegal block', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    persistErrorGameEvent(data, gameId, match.Id, {
      throwerGamePlayerId: homeGp.Id,
      offenderGamePlayerId: awayGp.Id,
      offenseId: GameEventErrorOffense.BlockIllegal,
    });
    const [entry] = buildTimelineEntries(data, gameId, match.Id);
    expect(flattenText(entry.rows[0].segments)).toBe(
      'Alex threw at Casey — Illegal Block (No Blocking)',
    );
  });

  it('keeps offender-only copy for a legacy illegal block without thrower', () => {
    const { data, match, gameId, awayGp } = setupOneGameMatch();
    persistErrorGameEvent(data, gameId, match.Id, {
      throwerGamePlayerId: '',
      offenderGamePlayerId: awayGp.Id,
      offenseId: GameEventErrorOffense.LineOut,
    });
    const eventId = getGameEvents(data, gameId).find(
      (event) => getGameEventType(data, event.Id) === 'error',
    )!.Id;
    const row = (
      data.Tables.GameEventError as {
        GameEventId: string;
        OffenseId: number;
        ThrowerId?: string | null;
      }[]
    ).find((entry) => entry.GameEventId === eventId)!;
    row.OffenseId = GameEventErrorOffense.BlockIllegal;
    delete row.ThrowerId;

    const [entry] = buildTimelineEntries(data, gameId, match.Id);
    expect(flattenText(entry.rows[0].segments)).toBe(
      'Casey — Illegal Block (No Blocking)',
    );
  });
});

describe('initialVideoSeekSeconds / trackGameOpenSeekSeconds', () => {
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
    expect(trackGameOpenSeekSeconds(data, gameId)).toBe(95);
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
    expect(trackGameOpenSeekSeconds(data, gameId)).toBe(12);
  });

  it('returns null when nothing is stamped yet (keep pop-out position)', () => {
    const { data, gameId } = setupOneGameMatch();
    expect(trackGameOpenSeekSeconds(data, gameId)).toBeNull();
    expect(initialVideoSeekSeconds(data, gameId)).toBe(0);
  });

  it('returns game start when only start is stamped', () => {
    const { data, gameId } = setupOneGameMatch();
    setGameEventVideoOffset(data, getGameStartEvent(data, gameId)!.Id, 33);
    expect(trackGameOpenSeekSeconds(data, gameId)).toBe(33);
    expect(initialVideoSeekSeconds(data, gameId)).toBe(33);
  });

  it('in-page seek continues from the previous game finish when unstamped', () => {
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

    const game2Id = addGame(data, match.Id);

    expect(trackGameOpenSeekSeconds(data, game2Id)).toBeNull();
    expect(inPageOpenSeekSeconds(data, game2Id)).toBe(100);
    expect(initialVideoSeekSeconds(data, game2Id)).toBe(100);
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
    const throwId = getGameEvents(data, gameId).find(
      (row) => getGameEventType(data, row.Id) === 'throw',
    )!.Id;
    setGameEventHighlight(data, throwId, true);

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
      (data.Tables.GameEvent as {
        Id: string;
        VideoOffsetSeconds?: number;
        IsHighlight?: boolean;
      }[]).find((row) => row.Id === restoredId)?.VideoOffsetSeconds,
    ).toBe(55);
    expect(
      (data.Tables.GameEvent as { Id: string; IsHighlight?: boolean }[]).find(
        (row) => row.Id === restoredId,
      )?.IsHighlight,
    ).toBe(true);
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

describe('game roster event rollback', () => {
  it('rolls back from the first event that includes the removed player', () => {
    const { data, match, gameId, homeGp, homeGp2, awayGp } = setupOneGameMatch(true);
    const h1Id = (data.Tables.Player as { Id: string; Name: string }[]).find(
      (row) => row.Name === 'Alex',
    )!.Id;
    const h2Id = (data.Tables.Player as { Id: string; Name: string }[]).find(
      (row) => row.Name === 'Blake',
    )!.Id;

    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp2!.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Miss,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    persistFinishGameEvent(data, gameId, { resultId: GameEventFinishResult.WinHome });

    const preview = previewRemoveGamePlayer(data, match.Id, gameId, h1Id);
    expect(preview?.eventCount).toBe(2);

    const result = removeGamePlayerFromRoster(data, match.Id, gameId, h1Id, {
      rollbackEvents: true,
    });
    expect(result).toEqual({ removed: true, rolledBackEvents: 2 });
    expect(isPlayerInGame(data, gameId, h1Id, match.Id)).toBe(false);
    expect(isPlayerInGame(data, gameId, h2Id, match.Id)).toBe(true);
    expect(gameHasFinishEvent(data, gameId)).toBe(false);

    const events = getGameEvents(data, gameId);
    expect(events).toHaveLength(2);
    expect(getGameEventType(data, events[0].Id)).toBe('start');
    expect(getGameEventType(data, events[1].Id)).toBe('throw');
    expect(loadThrowDraftsFromEvent(data, events[1].Id)[0].throwerGamePlayerId).toBe(
      homeGp2!.Id,
    );
  });

  it('keeps events when the removed player never appeared in them', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch(true);
    const h2Id = (data.Tables.Player as { Id: string; Name: string }[]).find(
      (row) => row.Name === 'Blake',
    )!.Id;

    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);

    expect(previewRemoveGamePlayer(data, match.Id, gameId, h2Id)).toBeNull();
    const result = removeGamePlayerFromRoster(data, match.Id, gameId, h2Id);
    expect(result).toEqual({ removed: true, rolledBackEvents: 0 });
    expect(getGameEvents(data, gameId)).toHaveLength(2);
    expect(isPlayerInGame(data, gameId, h2Id, match.Id)).toBe(false);
  });

  it('treats error offenders and catch recoveries as involvement', () => {
    const { data, match, gameId, homeGp, homeGp2, awayGp } = setupOneGameMatch(true);
    const h1Id = (data.Tables.Player as { Id: string; Name: string }[]).find(
      (row) => row.Name === 'Alex',
    )!.Id;
    const h2Id = (data.Tables.Player as { Id: string; Name: string }[]).find(
      (row) => row.Name === 'Blake',
    )!.Id;

    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: awayGp.Id,
        targetGamePlayerId: homeGp.Id,
        resultId: ThrowResult.Catch,
        deflections: [],
        recoveredId: homeGp2!.Id,
      },
    ]);
    persistErrorGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.Id,
      offenseId: GameEventErrorOffense.LineOut,
    });

    expect(previewRemoveGamePlayer(data, match.Id, gameId, h2Id)?.eventCount).toBe(2);
    removeGamePlayerFromRoster(data, match.Id, gameId, h2Id, { rollbackEvents: true });
    expect(getGameEvents(data, gameId)).toHaveLength(1);
    expect(getGameEventType(data, getGameEvents(data, gameId)[0].Id)).toBe('start');

    toggleGamePlayer(data, match.Id, gameId, h2Id);
    persistErrorGameEvent(data, gameId, match.Id, {
      offenderGamePlayerId: homeGp.Id,
      offenseId: GameEventErrorOffense.LineOut,
    });
    expect(previewRemoveGamePlayer(data, match.Id, gameId, h1Id)?.eventCount).toBe(1);
    expect(() => removeGamePlayerFromRoster(data, match.Id, gameId, h1Id)).toThrow(
      /appears in recorded events/,
    );
  });
});

describe('remove player from match side', () => {
  it('removes a match-added player from the match and deletes them from the team', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const match = addMatch(data, home.Id, away.Id);
    const added = addPlayerToMatchSide(data, match.Id, true, 'Remy');
    const preview = previewRemovePlayerFromMatch(data, match.Id, added.Id);
    expect(preview).toMatchObject({
      onThisMatch: true,
      willDeletePlayer: true,
      canRemove: true,
      eventCount: 0,
    });
    expect(removeMatchSidePlayerConfirmMessage('Remy', preview)).toContain(
      'delete them from the team',
    );

    const result = removePlayerFromMatchSide(data, match.Id, added.Id);
    expect(result).toEqual({
      removedFromMatch: true,
      deletedPlayer: true,
      rolledBackEvents: 0,
    });
    expect(isPlayerInMatch(data, match.Id, added.Id)).toBe(false);
    expect(getPlayer(data, added.Id)).toBeUndefined();
    expect(getPlayersForTeam(data, home.Id)).toHaveLength(0);
  });

  it('does not allow removing a core team-roster player from the match screen', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const player = addPlayer(data, home.Id, 'Alex');
    const match = addMatch(data, home.Id, away.Id);
    toggleMatchPlayer(data, match.Id, player.Id, true);

    const preview = previewRemovePlayerFromMatch(data, match.Id, player.Id);
    expect(preview.canRemove).toBe(false);
    expect(removeMatchSidePlayerConfirmMessage('Alex', preview)).toBeNull();
    expect(() => removePlayerFromMatchSide(data, match.Id, player.Id)).toThrow(
      /core roster/,
    );
    expect(isPlayerInMatch(data, match.Id, player.Id)).toBe(true);
    expect(getPlayer(data, player.Id)?.Name).toBe('Alex');
  });

  it('keeps the team player when a match-added player is on another match', () => {
    const data = createEmptyDatabase();
    const home = addTeam(data, 'Home');
    const away = addTeam(data, 'Away');
    const match1 = addMatch(data, home.Id, away.Id);
    const match2 = addMatch(data, home.Id, away.Id);
    const player = addPlayerToMatchSide(data, match1.Id, true, 'Alex');
    toggleMatchPlayer(data, match2.Id, player.Id, true);

    const preview = previewRemovePlayerFromMatch(data, match1.Id, player.Id);
    expect(preview.canRemove).toBe(true);
    expect(preview.willDeletePlayer).toBe(false);
    expect(removeMatchSidePlayerConfirmMessage('Alex', preview)).toContain(
      'stay on the team',
    );

    const result = removePlayerFromMatchSide(data, match1.Id, player.Id);
    expect(result.deletedPlayer).toBe(false);
    expect(isPlayerInMatch(data, match1.Id, player.Id)).toBe(false);
    expect(isPlayerInMatch(data, match2.Id, player.Id)).toBe(true);
    expect(getPlayer(data, player.Id)?.Name).toBe('Alex');
  });

  it('rolls back game events when removing a player used in scoring', () => {
    const { data, match, gameId, homeGp, awayGp } = setupOneGameMatch();
    persistThrowGameEvent(data, gameId, match.Id, [
      {
        throwerGamePlayerId: homeGp.Id,
        targetGamePlayerId: awayGp.Id,
        resultId: ThrowResult.Hit,
        deflections: [],
        recoveredId: undefined,
      },
    ]);
    const alex = (data.Tables.Player as { Id: string; Name: string; AddedFromMatch?: boolean }[]).find(
      (row) => row.Name === 'Alex',
    )!;
    alex.AddedFromMatch = true;
    const alexId = alex.Id;
    const preview = previewRemovePlayerFromMatch(data, match.Id, alexId);
    expect(preview.eventCount).toBeGreaterThan(0);
    expect(() => removePlayerFromMatchSide(data, match.Id, alexId)).toThrow(
      /appears in recorded events/,
    );

    const result = removePlayerFromMatchSide(data, match.Id, alexId, {
      rollbackEvents: true,
    });
    expect(result.rolledBackEvents).toBeGreaterThan(0);
    expect(isPlayerInGame(data, gameId, alexId, match.Id)).toBe(false);
    expect(isPlayerInMatch(data, match.Id, alexId)).toBe(false);
    expect(
      getGameEvents(data, gameId).every(
        (event) => getGameEventType(data, event.Id) !== 'throw',
      ),
    ).toBe(true);
  });
});
