import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import { useNavigate } from 'react-router';
import { getMatches } from '../../domain/database';
import { getMatchGames } from '../../domain/matchGame';
import { listPlayersForDirectory, playerHref } from '../../domain/playerProfile';
import type { StatsScope } from '../../domain/statistics/displayStats';
import type { DatabaseDto } from '../../domain/types';

const LEAGUE_VALUE = 'league';
const MATCH_TOTALS_VALUE = 'match';
const PLAYER_PLACEHOLDER = 'none';

export function StatsScopeNav({
  data,
  scope,
}: {
  data: DatabaseDto;
  scope: StatsScope;
}) {
  const navigate = useNavigate();
  const matches = getMatches(data);
  const matchId = scope.kind === 'league' ? '' : scope.matchId;
  const gameId = scope.kind === 'game' ? scope.gameId : '';
  const games = matchId ? getMatchGames(data, matchId) : [];
  const players = listPlayersForDirectory(data);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      className="sk-stats-scope"
      sx={{ mb: 2, flexWrap: 'wrap' }}
    >
      <FormControl size="small" sx={{ minWidth: 220, flex: 1 }} className="sk-stats-match-select">
        <InputLabel id="sk-stats-match-label">Match</InputLabel>
        <Select
          labelId="sk-stats-match-label"
          label="Match"
          value={matchId || LEAGUE_VALUE}
          onChange={(event) => {
            const value = String(event.target.value);
            if (value === LEAGUE_VALUE) navigate('/stats');
            else navigate(`/matches/${value}/stats`);
          }}
        >
          <MenuItem value={LEAGUE_VALUE}>League totals</MenuItem>
          {matches.map(({ match, matchName }) => (
            <MenuItem key={match.Id} value={match.Id}>
              {matchName}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl
        size="small"
        sx={{ minWidth: 160 }}
        disabled={!matchId}
        className="sk-stats-game-select"
      >
        <InputLabel id="sk-stats-game-label">Game</InputLabel>
        <Select
          labelId="sk-stats-game-label"
          label="Game"
          value={gameId || MATCH_TOTALS_VALUE}
          onChange={(event) => {
            const value = String(event.target.value);
            if (!matchId) return;
            if (value === MATCH_TOTALS_VALUE) navigate(`/matches/${matchId}/stats`);
            else navigate(`/matches/${matchId}/games/${value}/stats`);
          }}
        >
          <MenuItem value={MATCH_TOTALS_VALUE}>Match totals</MenuItem>
          {games.map((game) => (
            <MenuItem key={game.gameId} value={game.gameId}>
              {game.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 220, flex: 1 }} className="sk-stats-player-select">
        <InputLabel id="sk-stats-player-label">Player</InputLabel>
        <Select
          labelId="sk-stats-player-label"
          label="Player"
          value={PLAYER_PLACEHOLDER}
          onChange={(event) => {
            const value = String(event.target.value);
            if (value && value !== PLAYER_PLACEHOLDER) navigate(playerHref(value));
          }}
        >
          <MenuItem value={PLAYER_PLACEHOLDER}>Choose player</MenuItem>
          {players.map((player) => (
            <MenuItem key={player.playerId} value={player.playerId}>
              {player.teamName
                ? `${player.playerName} · ${player.teamName}`
                : player.playerName}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
