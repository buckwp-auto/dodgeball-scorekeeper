import { SAMPLE_LEAGUE_LABEL } from './localLeagueLabel';

export const SAMPLE_LEAGUE_URL = `${import.meta.env.BASE_URL}samples/league-six-teams.scrkpr`;

export { SAMPLE_LEAGUE_LABEL };

export async function fetchSampleLeagueDatabase(): Promise<unknown> {
  const response = await fetch(SAMPLE_LEAGUE_URL);
  if (!response.ok) {
    throw new Error(`Could not fetch sample (${response.status})`);
  }
  return response.json();
}
