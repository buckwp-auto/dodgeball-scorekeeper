import { Box, Button, Stack, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router';
import { SeeStatsButton } from '../components/stats/SeeStatsButton';
import { MatchScoreLine } from '../components/MatchScoreLine';
import { PageHeader, TextButton } from '../components/Ui';
import { getMatchName } from '../domain/database';
import { addGameWithAutoRoster } from '../domain/rosterAutoSelect';
import {
  canNavigateToGameEvents,
  getMatchById,
  getMatchGames,
} from '../domain/matchGame';
import type { DatabaseDto } from '../domain/types';
import { useDatabase } from '../state/DatabaseContext';
import { useLeague } from '../state/LeagueContext';

function gameHref(matchId: string, gameId: string, data: DatabaseDto) {
  if (canNavigateToGameEvents(data, matchId, gameId)) {
    return `/matches/${matchId}/games/${gameId}/events`;
  }
  return `/matches/${matchId}/games/${gameId}`;
}

export function MatchEventsPage() {
  const { matchId = '' } = useParams();
  const navigate = useNavigate();
  const { data, mutate, deleteGame } = useDatabase();
  const { canDeleteGame } = useLeague();
  const match = getMatchById(data, matchId);
  const games = getMatchGames(data, matchId);
  const showDeleteGame = canDeleteGame(match?.CreatedByUid);

  const onAddGame = () => {
    const { gameId } = mutate(
      (draft) => {
        const gameId = addGameWithAutoRoster(draft, matchId);
        const match = getMatchById(draft, matchId);
        return {
          gameId,
          message: match
            ? `Added game to match (${getMatchName(draft, match)}).`
            : 'Added game to match.',
        };
      },
      ({ message }) => message,
    );
    // Always land on game roster first so starters can be reviewed/adjusted.
    navigate(`/matches/${matchId}/games/${gameId}`);
  };

  const onDeleteGame = (gameId: string, label: string) => {
    if (!window.confirm(`Delete ${label} and all of its events?`)) return;
    deleteGame(matchId, gameId);
  };

  return (
    <>
      <PageHeader>Track Match</PageHeader>
      <MatchScoreLine matchId={matchId} />
      <Stack direction="row" spacing={1} className="button-row" sx={{ mb: 2, rowGap: 1 }}>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="contained"
          onClick={onAddGame}
        >
          Add Game
        </Button>
      </Stack>
      {games.length > 0 ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            Match Events
          </Typography>
          <Stack spacing={1}>
            {games.map(({ gameId, label, scoringComplete }) => (
              <Stack
                key={gameId}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center' }}
              >
                <TextButton
                  expand
                  onClick={() => navigate(gameHref(matchId, gameId, data))}
                >
                  {`${label} — ${scoringComplete ? 'Scoring complete' : 'In progress'}`}
                </TextButton>
                <SeeStatsButton to={`/matches/${matchId}/games/${gameId}/stats`} />
                {showDeleteGame ? (
                  <Button
                    size="small"
                    color="error"
                    className="bw-button bw-button--text"
                    onClick={() => onDeleteGame(gameId, label)}
                  >
                    Delete
                  </Button>
                ) : null}
              </Stack>
            ))}
          </Stack>
        </Box>
      ) : null}
    </>
  );
}
