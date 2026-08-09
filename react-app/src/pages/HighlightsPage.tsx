import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { GameEventsTimeline } from '../components/trackGame/GameEventsTimeline';
import { PageHeader } from '../components/Ui';
import { setGameEventHighlight } from '../domain/gameEvents';
import {
  getLeagueHighlightGroups,
  highlightEventHref,
} from '../domain/highlights';
import { useDatabase } from '../state/DatabaseContext';
import { useLeague } from '../state/LeagueContext';

export function HighlightsPage() {
  const navigate = useNavigate();
  const { data, mutate } = useDatabase();
  const { activeLeagueId, leagues } = useLeague();
  const groups = useMemo(() => getLeagueHighlightGroups(data), [data]);
  const leagueName = leagues.find((league) => league.id === activeLeagueId)?.name;

  const toggleHighlight = (eventId: string, currentlyHighlighted: boolean) => {
    mutate(
      (draft) => {
        setGameEventHighlight(draft, eventId, !currentlyHighlighted);
        return null;
      },
      currentlyHighlighted ? 'Removed highlight.' : 'Starred highlight.',
    );
  };

  return (
    <div className="highlights">
      <PageHeader>{leagueName ? `${leagueName} highlights` : 'Highlights'}</PageHeader>
      {groups.length === 0 ? (
        <Typography color="text.secondary">
          Star events on a game timeline to collect highlights for this league.
        </Typography>
      ) : (
        <Stack spacing={3}>
          {groups.map((match) => (
            <Box key={match.matchId}>
              <Typography variant="h6" gutterBottom>
                {match.matchName}
              </Typography>
              <Stack spacing={2}>
                {match.games.map((game) => (
                  <Box key={game.gameId}>
                    <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                      {game.gameName}
                    </Typography>
                    <Box sx={{ borderRadius: 1, overflow: 'hidden' }}>
                      <GameEventsTimeline
                        entries={game.highlights.map((row) => row.entry)}
                        selectedEventId={null}
                        insertBeforeEventId={null}
                        showEndInsertMarker={false}
                        fillHeight={false}
                        onSelectEvent={(eventId) =>
                          navigate(highlightEventHref(match.matchId, game.gameId, eventId))
                        }
                        onDeselectEvent={() => {}}
                        onCommitVideoOffset={() => {}}
                        onToggleHighlight={(eventId) => {
                          const highlight = game.highlights.find(
                            (row) => row.eventId === eventId,
                          );
                          toggleHighlight(eventId, highlight?.entry.isHighlight ?? true);
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </div>
  );
}
