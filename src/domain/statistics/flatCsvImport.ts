import {
  ECompetitionOutcome,
  EDeathError,
  EDeathType,
  EKillType,
  EThrowError,
  ThrowResult,
} from './constants';
import {
  addToMap,
  emptyPayload,
  finalizeRow,
  parseCount,
  type StatsCsvParseResult,
  type StatsCsvRow,
} from './statsCsvCommon';

type FlatStat =
  | 'team'
  | 'player'
  | 'games'
  | 'wins'
  | 'losses'
  | 'ties'
  | 'record'
  | 'matches'
  | 'kills'
  | 'deaths'
  | 'catches'
  | 'caught'
  | 'throws'
  | 'hits'
  | 'blocks'
  | 'dodges'
  | 'misses'
  | 'targeted'
  | 'lineOuts'
  | 'wastedBalls';

/** Header aliases after lowercasing and dropping non-alphanumerics. */
const FLAT_ALIASES: Record<FlatStat, string[]> = {
  team: ['team', 'teamname'],
  player: ['player', 'playername', 'name'],
  games: ['gp', 'games', 'gamesplayed'],
  wins: ['w', 'wins', 'gameswon', 'gamewins'],
  losses: ['l', 'losses', 'gameslost', 'gamelosses'],
  ties: ['t', 'ties', 'gamestied'],
  record: ['wl', 'wlt', 'record'],
  matches: ['mp', 'matches', 'matchesplayed'],
  kills: ['k', 'kills', 'eliminations', 'elims'],
  deaths: ['d', 'deaths', 'outs'],
  catches: ['c', 'catches', 'catchesmade'],
  caught: ['caught', 'timescaught', 'catchesthrown'],
  throws: ['throws', 'throwsattempted', 'attempts'],
  hits: ['hits', 'throwhits'],
  blocks: ['blocks'],
  dodges: ['dodges'],
  misses: ['misses'],
  targeted: ['targeted', 'targets', 'timestargeted'],
  lineOuts: ['lineouts'],
  wastedBalls: ['wastedballs'],
};

const EXPECTED_FLAT_STATS: { label: string; anyOf: FlatStat[] }[] = [
  { label: 'Games played / W-L', anyOf: ['games', 'wins', 'record'] },
  { label: 'Kills', anyOf: ['kills'] },
  { label: 'Deaths', anyOf: ['deaths'] },
  { label: 'Catches', anyOf: ['catches'] },
  { label: 'Caught (times thrown ball was caught)', anyOf: ['caught'] },
  { label: 'Throws', anyOf: ['throws'] },
  { label: 'Hits (throws that hit)', anyOf: ['hits'] },
  { label: 'Targeted', anyOf: ['targeted'] },
];

function headerKey(cell: string): string {
  return cell.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function statForHeader(cell: string): FlatStat | null {
  const key = headerKey(cell);
  for (const [stat, aliases] of Object.entries(FLAT_ALIASES) as [FlatStat, string[]][]) {
    if (aliases.includes(key)) return stat;
  }
  return null;
}

function parseRecord(value: string, context: () => string): [number, number, number] {
  const trimmed = value.trim();
  if (!trimmed) return [0, 0, 0];
  const parts = trimmed.split(/\s*[-–/]\s*/);
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`${context()}: "${value}" is not a W-L record`);
  }
  const [wins, losses, ties = '0'] = parts;
  return [parseCount(wins, context), parseCount(losses, context), parseCount(ties, context)];
}

/** Spreadsheet with one column per stat (Team, Player, GP, Kills, Deaths, …). */
export function parseFlatStatsCsv(header: string[], body: string[][]): StatsCsvParseResult {
  const columns = new Map<FlatStat, number>();
  const ignoredColumns: string[] = [];
  header.forEach((raw, index) => {
    const cell = raw.trim();
    if (!cell) return;
    const stat = statForHeader(cell);
    if (!stat || columns.has(stat)) {
      ignoredColumns.push(cell);
      return;
    }
    columns.set(stat, index);
  });

  const teamCol = columns.get('team');
  const playerCol = columns.get('player');
  if (teamCol == null || playerCol == null) {
    throw new Error('Statistics CSV needs a Team and a Player column');
  }

  const rows: StatsCsvRow[] = [];
  let skipped = 0;
  let throwsAsMisses = 0;
  let targetedAsDodges = 0;

  for (const cells of body) {
    const teamName = (cells[teamCol] ?? '').trim();
    const playerName = (cells[playerCol] ?? '').trim();
    if (!teamName || !playerName) {
      skipped += 1;
      continue;
    }
    const cellFor = (stat: FlatStat) => {
      const index = columns.get(stat);
      return index == null ? '' : (cells[index] ?? '');
    };
    const count = (stat: FlatStat) =>
      parseCount(cellFor(stat), () => `${playerName} (${header[columns.get(stat)!]})`);

    const payload = emptyPayload();

    let [wins, losses, ties] = columns.has('record')
      ? parseRecord(cellFor('record'), () => `${playerName} (${header[columns.get('record')!]})`)
      : [0, 0, 0];
    if (columns.has('wins')) wins = count('wins');
    if (columns.has('losses')) losses = count('losses');
    if (columns.has('ties')) ties = count('ties');
    const decided = wins + losses + ties;
    const games = columns.has('games') ? count('games') : decided;
    addToMap(payload.games, ECompetitionOutcome.Win, wins);
    addToMap(payload.games, ECompetitionOutcome.Loss, losses);
    addToMap(payload.games, ECompetitionOutcome.Tie, ties);
    addToMap(payload.games, ECompetitionOutcome.Incomplete, games - decided);
    addToMap(
      payload.matches,
      ECompetitionOutcome.Incomplete,
      columns.has('matches') ? count('matches') : 1,
    );

    const kills = count('kills');
    addToMap(payload.killsDirectIndividual, EKillType.Hit, kills);
    addToMap(payload.killsDirectCredit, EKillType.Hit, kills);

    const lineOuts = count('lineOuts');
    const hitDeaths = Math.max(0, count('deaths') - lineOuts);
    addToMap(payload.deathsErrors, EDeathError.LineOut, lineOuts);
    addToMap(payload.deathsDirect, EDeathType.Hit, hitDeaths);

    const caught = count('caught');
    addToMap(payload.deathsDirect, EDeathType.CatchThrown, caught);

    const hits = count('hits');
    const blocks = count('blocks');
    const dodges = count('dodges');
    const misses = count('misses');
    addToMap(payload.offenseThrowsIndividual, ThrowResult.Hit, hits);
    addToMap(payload.offenseThrowsIndividual, ThrowResult.Catch, caught);
    addToMap(payload.offenseThrowsIndividual, ThrowResult.Block, blocks);
    addToMap(payload.offenseThrowsIndividual, ThrowResult.Dodge, dodges);
    addToMap(payload.offenseThrowsIndividual, ThrowResult.Miss, misses);
    const unbrokenThrows = count('throws') - (hits + caught + blocks + dodges + misses);
    if (unbrokenThrows > 0) {
      addToMap(payload.offenseThrowsIndividual, ThrowResult.Miss, unbrokenThrows);
      throwsAsMisses += unbrokenThrows;
    }
    addToMap(payload.offenseErrors, EThrowError.WastedBall, count('wastedBalls'));

    const catches = count('catches');
    addToMap(payload.defenseTargets, ThrowResult.Catch, catches);
    addToMap(payload.defenseTargets, ThrowResult.Hit, hitDeaths);
    const unbrokenTargets = count('targeted') - (catches + hitDeaths);
    if (unbrokenTargets > 0) {
      addToMap(payload.defenseTargets, ThrowResult.Dodge, unbrokenTargets);
      targetedAsDodges += unbrokenTargets;
    }

    rows.push(finalizeRow(teamName, playerName, payload));
  }

  const notes: string[] = [];
  if (skipped) {
    notes.push(`Skipped ${skipped} row${skipped === 1 ? '' : 's'} without a team or player name`);
  }
  if (throwsAsMisses) {
    notes.push(
      `${throwsAsMisses} throw${throwsAsMisses === 1 ? '' : 's'} had no result breakdown and were counted as misses (Hit% and Caught% are unaffected)`,
    );
  }
  if (targetedAsDodges) {
    notes.push(
      `${targetedAsDodges} time${targetedAsDodges === 1 ? '' : 's'} targeted without a hit or catch were counted as dodges`,
    );
  }

  return {
    format: 'flat',
    rows,
    missingStats: EXPECTED_FLAT_STATS.filter(
      ({ anyOf }) => !anyOf.some((stat) => columns.has(stat)),
    ).map(({ label }) => label),
    ignoredColumns,
    notes,
  };
}
