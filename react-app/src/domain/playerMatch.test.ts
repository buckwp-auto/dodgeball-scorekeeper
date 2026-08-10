import { describe, expect, it } from 'vitest';
import {
  addMatch,
  addPlayer,
  addTeam,
  createEmptyDatabase,
  setPlayerImage,
} from './database';
import { addPlayerToMatchSide, toggleMatchPlayer } from './matchGame';
import {
  getLinkedGuestPlayers,
  getPlayerIdsForProfile,
  linkPlayer,
  linkedPlayerLabel,
  normalizePlayerName,
  rankNameMatch,
  resolveCanonicalPlayerId,
  suggestLinkedPlayers,
  unlinkPlayer,
} from './playerMatch';

describe('normalizePlayerName / rankNameMatch', () => {
  it('normalizes unicode, case, and extra spaces', () => {
    expect(normalizePlayerName('  Alex   Smith  ')).toBe('alex smith');
    expect(normalizePlayerName('José')).toBe(normalizePlayerName('JOSÉ'));
  });

  it('ranks exact, prefix, token, substring, and close fuzzy matches', () => {
    expect(rankNameMatch('Alex', 'alex')).toBe('exact');
    expect(rankNameMatch('Al', 'Alex')).toBe('prefix');
    expect(rankNameMatch('Alex', 'Alex Smith')).toBe('prefix');
    expect(rankNameMatch('Smith', 'Alex Smith')).toBe('token');
    expect(rankNameMatch('Smi', 'Alex Smith')).toBe('token');
    expect(rankNameMatch('Buck', 'Will Buck')).toBe('token');
    expect(rankNameMatch('Smith', 'Alex-Smith')).toBe('token');
    expect(rankNameMatch('lex', 'Alex Smith')).toBe('substring');
    expect(rankNameMatch('Alec', 'Alex')).toBe('fuzzy');
    expect(rankNameMatch('Smth', 'Alex Smith')).toBe('fuzzy');
    expect(rankNameMatch('Al', 'Casey')).toBeNull();
    expect(rankNameMatch('Pat', 'Patrice')).toBe('prefix');
  });
});

describe('suggestLinkedPlayers', () => {
  it('suggests other-team exact matches and excludes aliases and match roster', () => {
    const data = createEmptyDatabase();
    const hawks = addTeam(data, 'Hawks');
    const owls = addTeam(data, 'Owls');
    const wolves = addTeam(data, 'Wolves');
    const alex = addPlayer(data, hawks.Id, 'Alex');
    const casey = addPlayer(data, owls.Id, 'Casey');
    const alexGuestCore = addPlayer(data, wolves.Id, 'Alexandra');
    const match = addMatch(data, hawks.Id, owls.Id);
    toggleMatchPlayer(data, match.Id, alex.Id, true);
    toggleMatchPlayer(data, match.Id, casey.Id, false);

    const guest = addPlayerToMatchSide(data, match.Id, false, 'Alexandra', true);
    linkPlayer(data, guest.Id, alexGuestCore.Id);

    const hits = suggestLinkedPlayers(data, {
      query: 'Alex',
      matchId: match.Id,
      sideTeamId: owls.Id,
    });
    expect(hits.map((row) => row.playerId)).not.toContain(alex.Id);
    expect(hits.map((row) => row.playerId)).not.toContain(guest.Id);
    expect(hits.some((row) => row.playerId === alexGuestCore.Id)).toBe(true);

    const prefix = suggestLinkedPlayers(data, {
      query: 'Alex',
      sideTeamId: owls.Id,
    });
    expect(prefix[0]).toMatchObject({
      playerId: alex.Id,
      teamName: 'Hawks',
      rank: 'exact',
      sameTeam: false,
      addedFromMatch: false,
    });
  });

  it('prefers same-team and core roster over match-added guests', () => {
    const data = createEmptyDatabase();
    const hawks = addTeam(data, 'Hawks');
    const owls = addTeam(data, 'Owls');
    const coreSame = addPlayer(data, owls.Id, 'Pat');
    const guest = addPlayer(data, owls.Id, 'Pat');
    guest.AddedFromMatch = true;
    const coreOther = addPlayer(data, hawks.Id, 'Pat');

    const hits = suggestLinkedPlayers(data, { query: 'Pat', sideTeamId: owls.Id });
    expect(hits[0]?.playerId).toBe(coreSame.Id);
    expect(hits[0]?.sameTeam).toBe(true);
    expect(hits[0]?.addedFromMatch).toBe(false);
    expect(hits.find((row) => row.playerId === guest.Id)?.addedFromMatch).toBe(true);
    expect(hits.find((row) => row.playerId === coreOther.Id)?.sameTeam).toBe(false);
  });

  it('suggests players when the query matches a later name token', () => {
    const data = createEmptyDatabase();
    const hawks = addTeam(data, 'Hawks');
    const owls = addTeam(data, 'Owls');
    const alex = addPlayer(data, hawks.Id, 'Alex Smith');
    addPlayer(data, owls.Id, 'Casey');

    const hits = suggestLinkedPlayers(data, { query: 'Smith', sideTeamId: owls.Id });
    expect(hits[0]).toMatchObject({
      playerId: alex.Id,
      playerName: 'Alex Smith',
      rank: 'token',
    });
  });
});

describe('linkPlayer / unlinkPlayer', () => {
  it('sets LinkedPlayerId, copies image, and can clear the link', () => {
    const data = createEmptyDatabase();
    const hawks = addTeam(data, 'Hawks');
    const owls = addTeam(data, 'Owls');
    const alex = addPlayer(data, hawks.Id, 'Alex');
    setPlayerImage(data, alex.Id, 'https://cdn.example/alex.png');
    const guest = addPlayer(data, owls.Id, 'Alex');
    guest.AddedFromMatch = true;

    linkPlayer(data, guest.Id, alex.Id);
    expect(guest.LinkedPlayerId).toBe(alex.Id);
    expect(guest.Image).toMatchObject({ url: 'https://cdn.example/alex.png' });
    expect(resolveCanonicalPlayerId(data, guest.Id)).toBe(alex.Id);
    expect(getLinkedGuestPlayers(data, alex.Id).map((row) => row.Id)).toEqual([guest.Id]);
    expect(getPlayerIdsForProfile(data, alex.Id)).toEqual([alex.Id, guest.Id]);
    expect(getPlayerIdsForProfile(data, guest.Id)).toEqual([alex.Id, guest.Id]);
    expect(linkedPlayerLabel(data, guest)).toBe('sub for Hawks · Alex');

    unlinkPlayer(data, guest.Id);
    expect(guest.LinkedPlayerId).toBeUndefined();
    expect(resolveCanonicalPlayerId(data, guest.Id)).toBe(guest.Id);
  });

  it('rejects self-links and linking to an alias', () => {
    const data = createEmptyDatabase();
    const hawks = addTeam(data, 'Hawks');
    const owls = addTeam(data, 'Owls');
    const wolves = addTeam(data, 'Wolves');
    const alex = addPlayer(data, hawks.Id, 'Alex');
    const guest = addPlayer(data, owls.Id, 'Alex');
    const other = addPlayer(data, wolves.Id, 'Alex');
    linkPlayer(data, guest.Id, alex.Id);
    expect(() => linkPlayer(data, alex.Id, alex.Id)).toThrow(/themselves/);
    expect(() => linkPlayer(data, other.Id, guest.Id)).toThrow(/alias/);
  });
});
