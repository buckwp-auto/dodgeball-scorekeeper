import { Box, Button, Stack, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router';
import { PageHeader, TextButton } from '../components/Ui';
import { getMatchName } from '../domain/database';
import { autoSelectGameRoster } from '../domain/rosterAutoSelect';
import {
  addGame as addGameOp,
  canNavigateToGameEvents,
  getMatchById,
  getMatchGames,
} from '../domain/matchGame';
import type { DatabaseDto } from '../domain/types';
import { useDatabase } from '../state/DatabaseContext';

function gameHref(matchId: string, gameId: string, data: DatabaseDto) {
  if (canNavigateToGameEvents(data, matchId, gameId)) {
    return `/matches/${matchId}/games/${gameId}/events`;
  }
  return `/matches/${matchId}/games/${gameId}`;
}

export function MatchEventsPage() {
  const { matchId = '' } = useParams();
  const navigate = useNavigate();
  const { data, mutate } = useDatabase();
  const games = getMatchGames(data, matchId);

  const onAddGame = () => {
    const { gameId, openEvents } = mutate(
      (draft) => {
        const gameId = addGameOp(draft, matchId);
        autoSelectGameRoster(draft, matchId, gameId);
        const match = getMatchById(draft, matchId);
        return {
          gameId,
          openEvents: canNavigateToGameEvents(draft, matchId, gameId),
          message: match
            ? `Added game to match (${getMatchName(draft, match)}).`
            : 'Added game to match.',
        };
      },
      ({ message }) => message,
    );
    navigate(
      openEvents
        ? `/matches/${matchId}/games/${gameId}/events`
        : `/matches/${matchId}/games/${gameId}`,
    );
  };

  return (
    <>
      <PageHeader>Track Match</PageHeader>
      <Stack direction="row" spacing={1} className="button-row" sx={{ mb: 2 }}>
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
          <Stack spacing={0.5}>
            {games.map(({ gameId, label, scoringComplete }) => (
              <TextButton
                key={gameId}
                onClick={() => navigate(gameHref(matchId, gameId, data))}
              >
                {label} — {scoringComplete ? 'Scoring complete' : 'In progress'}
              </TextButton>
            ))}
          </Stack>
        </Box>
      ) : null}
    </>
  );
}
