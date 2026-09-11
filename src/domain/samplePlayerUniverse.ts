import type { ImageRef } from './imageRef';
import type { UniversePlayer } from './playerUniverse';

/** Demo “other league” used when the sample league is loaded (no Firebase needed). */
export const SAMPLE_PRIOR_LEAGUE_ID = 'sample-prior-season';
export const SAMPLE_PRIOR_LEAGUE_NAME = 'Prior season (demo)';

function samplePhoto(style: string, seed: string): ImageRef {
  return {
    kind: 'external',
    url: `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(seed)}&size=256`,
  };
}

type SampleRosterPlayer = {
  playerName: string;
  teamName: string;
  style: string;
};

/**
 * Prior-season roster for Team page autocomplete while exploring the sample league.
 * Includes a few names that also appear in the six-team demo (returning players)
 * plus new names you can add to a team roster.
 */
const SAMPLE_PRIOR_ROSTER: SampleRosterPlayer[] = [
  // Overlaps with sample league — try typing “Frodo” / “Luke” / “Harry” on another team
  { playerName: 'Frodo Baggins', teamName: 'Shire All-Stars', style: 'adventurer' },
  { playerName: 'Luke Skywalker', teamName: 'Outer Rim', style: 'pixel-art' },
  { playerName: 'Harry Potter', teamName: 'Hogwarts Alumni', style: 'lorelei' },
  { playerName: 'Tony Stark', teamName: 'Stark Industries', style: 'avataaars' },
  { playerName: 'Eleven', teamName: 'Hawkins Varsity', style: 'open-peeps' },
  { playerName: 'Jim Halpert', teamName: 'Scranton Scrappers', style: 'micah' },
  // New recruits (not on the six-team sample rosters)
  { playerName: 'Katniss Everdeen', teamName: 'District 12', style: 'notionists' },
  { playerName: 'Peeta Mellark', teamName: 'District 12', style: 'notionists' },
  { playerName: 'Gale Hawthorne', teamName: 'District 12', style: 'notionists' },
  { playerName: 'Indiana Jones', teamName: 'Archeology Club', style: 'thumbs' },
  { playerName: 'Marion Ravenwood', teamName: 'Archeology Club', style: 'thumbs' },
  { playerName: 'Short Round', teamName: 'Archeology Club', style: 'thumbs' },
  { playerName: 'Ellen Ripley', teamName: 'Nostromo', style: 'bottts' },
  { playerName: 'Dallas', teamName: 'Nostromo', style: 'bottts' },
  { playerName: 'Parker', teamName: 'Nostromo', style: 'bottts' },
];

export const SAMPLE_PLAYER_UNIVERSE: UniversePlayer[] = SAMPLE_PRIOR_ROSTER.map(
  (row, index) => ({
    key: `${SAMPLE_PRIOR_LEAGUE_ID}:${index}`,
    playerName: row.playerName,
    teamName: row.teamName,
    leagueName: SAMPLE_PRIOR_LEAGUE_NAME,
    leagueId: SAMPLE_PRIOR_LEAGUE_ID,
    image: samplePhoto(row.style, row.playerName),
    addedFromMatch: false,
  }),
);
