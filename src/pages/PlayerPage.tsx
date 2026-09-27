import {
  Box,
  Button,
  Link as MuiLink,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PlayerStatCard, type PlayerCardBasic } from '../components/stats/PlayerStatCard';
import { StatsPlayerTable } from '../components/stats/StatsPlayerTable';
import { ThrowTagsSummary } from '../components/stats/ThrowTagsSummary';
import { GameEventsTimeline } from '../components/trackGame/GameEventsTimeline';
import { PageHeader, TextButton } from '../components/Ui';
import { getPlayer, getTeamForPlayer } from '../domain/database';
import { setGameEventHighlight } from '../domain/gameEvents';
import {
  getPlayerHighlightGroups,
  highlightEventHref,
} from '../domain/highlights';
import { imageSrc } from '../domain/imageRef';
import { resolveHighlightQualifiers, resolveLeagueStatPolicy } from '../domain/leagueSettings';
import {
  getLinkedGuestPlayers,
  linkPlayer,
  suggestLinkedPlayers,
  unlinkPlayer,
} from '../domain/playerMatch';
import { getPlayerGamesPlayed, playerHref } from '../domain/playerProfile';
import {
  buildDisplayStats,
  displayedKills,
  formatCountValue,
  formatPct,
  leaderboardRank,
  loadIncludeSubStats,
  loadStatsCountingMode,
  saveIncludeSubStats,
  saveStatsCountingMode,
  type StatsCountingMode,
} from '../domain/statistics/displayStats';
import {
  attachVorWar,
  formatHighlightQualifiers,
} from '../domain/statistics/highlightStats';
import { buildPlayerCard, describeRank } from '../domain/statistics/playerCard';
import { viewerGameStatsHref, viewerPlayersHref } from '../domain/viewerRoutes';
import { useDatabase } from '../state/DatabaseContext';
import { useLeague } from '../state/LeagueContext';
import { useViewerMode } from '../state/ViewerModeContext';

export function PlayerPage() {
  const { playerId = '' } = useParams();
  const navigate = useNavigate();
  const { data, mutate, readOnly } = useDatabase();
  const { isViewer, routeBase } = useViewerMode();
  const { activeLeagueId, leagues } = useLeague();
  const league = leagues.find((entry) => entry.id === activeLeagueId);
  const [counting, setCounting] = useState<StatsCountingMode>(() =>
    loadStatsCountingMode(),
  );
  const [includeSubs, setIncludeSubs] = useState(() => loadIncludeSubStats());

  const player = getPlayer(data, playerId);

  useEffect(() => {
    if (player?.LinkedPlayerId) {
      navigate(playerHref(player.LinkedPlayerId, { base: routeBase }), {
        replace: true,
      });
    }
  }, [navigate, player?.LinkedPlayerId, routeBase]);

  const team = player ? getTeamForPlayer(data, player.Id) : undefined;
  const photoSrc = imageSrc(player?.Image);
  const qualifiers = useMemo(() => resolveHighlightQualifiers(data), [data]);
  const leagueRows = useMemo(
    () =>
      attachVorWar(
        buildDisplayStats(data, { kind: 'league' }, { includeSubStats: includeSubs }),
        counting,
        qualifiers,
      ),
    [data, counting, qualifiers, includeSubs],
  );
  const guests = useMemo(
    () => (player ? getLinkedGuestPlayers(data, player.Id) : []),
    [data, player],
  );
  const linkSuggestions = useMemo(
    () =>
      player?.AddedFromMatch && !player.LinkedPlayerId
        ? suggestLinkedPlayers(data, {
            query: player.Name,
            excludePlayerId: player.Id,
          }).filter(
            (row) =>
              !row.sameTeam &&
              (row.rank === 'exact' || row.rank === 'prefix' || row.rank === 'token'),
          )
        : [],
    [data, player],
  );
  const stats = leagueRows.find((row) => row.playerId === playerId);
  const policy = useMemo(() => resolveLeagueStatPolicy(data), [data]);
  const games = useMemo(
    () => (player ? getPlayerGamesPlayed(data, player.Id) : []),
    [data, player],
  );
  const highlightGroups = useMemo(
    () => (player ? getPlayerHighlightGroups(data, player.Id) : []),
    [data, player],
  );

  const card = useMemo(
    () => buildPlayerCard(leagueRows, playerId, { counting, qualifiers }),
    [leagueRows, playerId, counting, qualifiers],
  );
  const basics = useMemo((): PlayerCardBasic[] => {
    if (!stats) return [];
    const rankOf = (metric: 'kills' | 'catches' | 'hitRate') => {
      const found = leaderboardRank(leagueRows, stats.playerId, metric, counting);
      return found ? describeRank(found.rank, found.total) : null;
    };
    return [
      { label: 'Games', value: String(stats.gamesPlayed), rank: null },
      { label: 'Kills', value: formatCountValue(displayedKills(stats, counting)), rank: rankOf('kills') },
      { label: 'Catches', value: String(stats.catches), rank: rankOf('catches') },
      { label: 'Hit %', value: formatPct(stats.hitRate), rank: rankOf('hitRate') },
    ];
  }, [leagueRows, stats, counting]);

  const showAssists =
    policy.teamThrowAssistMode !== 'none' || Boolean(stats && stats.assists > 0);
  const showMultiKills =
    policy.trackMultiKills ||
    Boolean(
      stats && stats.doubleKills + stats.tripleKills + stats.quadKills > 0,
    );
  const showMultiCatches =
    policy.trackMultiCatches ||
    Boolean(
      stats && stats.doubleCatches + stats.tripleCatches + stats.quadCatches > 0,
    );
  const showDeflectionCatches =
    policy.countDeflectionCatchesSeparately ||
    Boolean(stats && stats.catchesDeflection > 0);

  const toggleHighlight = (eventId: string, currentlyHighlighted: boolean) => {
    mutate(
      (draft) => {
        setGameEventHighlight(draft, eventId, !currentlyHighlighted);
        return null;
      },
      currentlyHighlighted ? 'Removed highlight.' : 'Starred highlight.',
    );
  };

  if (!player) {
    return <PageHeader>Player</PageHeader>;
  }

  return (
    <>
      <PageHeader>{player.Name}</PageHeader>
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        {isViewer ? (
          <TextButton onClick={() => navigate(viewerPlayersHref())}>
            Back to players
          </TextButton>
        ) : team ? (
          <TextButton onClick={() => navigate(`/teams/${team.Id}`)}>
            {`Back to ${team.Name}`}
          </TextButton>
        ) : (
          <TextButton onClick={() => navigate('/teams')}>Back to teams</TextButton>
        )}
      </Stack>

      <PlayerStatCard
        playerName={player.Name}
        image={player.Image}
        photoSrc={photoSrc}
        team={
          team
            ? { name: team.Name, href: isViewer ? undefined : `/teams/${team.Id}` }
            : undefined
        }
        addedFromMatch={Boolean(player.AddedFromMatch && !player.LinkedPlayerId)}
        leagueName={league?.name}
        leagueLogo={league?.logo}
        card={card}
        basics={basics}
        qualifierText={formatHighlightQualifiers(qualifiers)}
      />

      {stats ? (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={counting}
              onChange={(_, next: StatsCountingMode | null) => {
                if (!next) return;
                setCounting(next);
                saveStatsCountingMode(next);
              }}
              className="sk-stats-counting"
            >
              <ToggleButton value="counts">Counts</ToggleButton>
              <ToggleButton value="credit">Credit</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={includeSubs ? 'include' : 'exclude'}
              onChange={(_, next: 'include' | 'exclude' | null) => {
                if (!next) return;
                setIncludeSubs(next === 'include');
                saveIncludeSubStats(next === 'include');
              }}
              className="sk-stats-include-subs"
            >
              <ToggleButton value="include">Include sub stats</ToggleButton>
              <ToggleButton value="exclude">Exclude sub stats</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <StatsPlayerTable
            rows={[stats]}
            metric="kills"
            onMetricChange={() => {}}
            minGames={0}
            onMinGamesChange={() => {}}
            counting={counting}
            showAssists={showAssists}
            showMultiKills={showMultiKills}
            showMultiCatches={showMultiCatches}
            showDeflectionCatches={showDeflectionCatches}
            hideFilters
          />
          <ThrowTagsSummary stats={stats} />
        </>
      ) : null}

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Games played
      </Typography>
      {games.length === 0 ? (
        <Typography color="text.secondary">Not on any game roster yet.</Typography>
      ) : (
        <Stack spacing={0.75} component="ul" sx={{ m: 0, pl: 2 }}>
          {games.map((game) => (
            <Typography key={game.gameId} component="li">
              <MuiLink
                component={Link}
                to={
                  isViewer
                    ? viewerGameStatsHref(game.matchId, game.gameId)
                    : `/matches/${game.matchId}/games/${game.gameId}`
                }
                underline="hover"
              >
                {game.matchName} · {game.gameName}
              </MuiLink>
              {game.scoringComplete ? ' (complete)' : ' (in progress)'}
              {game.substitute ? ' · sub' : ''}
            </Typography>
          ))}
        </Stack>
      )}

      {!readOnly && guests.length > 0 ? (
        <>
          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            Subbed for
          </Typography>
          <Stack spacing={1} className="sk-player-sub-appearances">
            {guests.map((guest) => {
              const guestTeam = getTeamForPlayer(data, guest.Id);
              return (
                <Stack
                  key={guest.Id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Typography>
                    {guestTeam ? `${guestTeam.Name} · ${guest.Name}` : guest.Name}
                  </Typography>
                  <Button
                    size="small"
                    className="sk-unlink-player"
                    onClick={() => {
                      mutate((draft) => {
                        unlinkPlayer(draft, guest.Id);
                        return null;
                      }, `Unlinked ${guest.Name}.`);
                    }}
                  >
                    Unlink
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </>
      ) : null}

      {!readOnly && linkSuggestions.length > 0 ? (
        <>
          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            Link to a league player
          </Typography>
          <Stack spacing={1} className="sk-player-link-suggestions">
            {linkSuggestions.map((candidate) => (
              <Button
                key={candidate.playerId}
                size="small"
                variant="outlined"
                className="sk-link-player"
                onClick={() => {
                  mutate((draft) => {
                    linkPlayer(draft, player.Id, candidate.playerId);
                    return null;
                  }, `Linked ${player.Name} to ${candidate.playerName}.`);
                  navigate(playerHref(candidate.playerId, { base: routeBase }), {
                    replace: true,
                  });
                }}
              >
                {candidate.playerName} · {candidate.teamName}
              </Button>
            ))}
          </Stack>
        </>
      ) : null}

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Highlights
      </Typography>
      {highlightGroups.length === 0 ? (
        <Typography color="text.secondary">
          No starred timeline events mention this player yet.
        </Typography>
      ) : (
        <Stack spacing={3}>
          {highlightGroups.map((match) => (
            <Box key={match.matchId}>
              <Typography variant="subtitle1" gutterBottom>
                {match.matchName}
              </Typography>
              <Stack spacing={2}>
                {match.games.map((game) => (
                  <Box key={game.gameId}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
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
                          navigate(
                            isViewer
                              ? viewerGameStatsHref(match.matchId, game.gameId)
                              : highlightEventHref(
                                  match.matchId,
                                  game.gameId,
                                  eventId,
                                ),
                          )
                        }
                        onDeselectEvent={() => {}}
                        onCommitVideoOffset={() => {}}
                        onToggleHighlight={
                          readOnly
                            ? undefined
                            : (eventId) => {
                                const highlight = game.highlights.find(
                                  (row) => row.eventId === eventId,
                                );
                                toggleHighlight(
                                  eventId,
                                  highlight?.entry.isHighlight ?? true,
                                );
                              }
                        }
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </>
  );
}
