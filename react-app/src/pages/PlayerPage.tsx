import {
  Box,
  Button,
  Chip,
  Link as MuiLink,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EntityAvatar } from '../components/EntityAvatar';
import { StatsPlayerTable } from '../components/stats/StatsPlayerTable';
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
  formatCountValue,
  formatPct,
  leaderboardRank,
  loadIncludeSubStats,
  loadStatsCountingMode,
  saveIncludeSubStats,
  saveStatsCountingMode,
  type StatsCountingMode,
} from '../domain/statistics/displayStats';
import { attachVorWar } from '../domain/statistics/highlightStats';
import { useDatabase } from '../state/DatabaseContext';

export function PlayerPage() {
  const { playerId = '' } = useParams();
  const navigate = useNavigate();
  const { data, mutate } = useDatabase();
  const [counting, setCounting] = useState<StatsCountingMode>(() =>
    loadStatsCountingMode(),
  );
  const [includeSubs, setIncludeSubs] = useState(() => loadIncludeSubStats());

  const player = getPlayer(data, playerId);

  useEffect(() => {
    if (player?.LinkedPlayerId) {
      navigate(playerHref(player.LinkedPlayerId), { replace: true });
    }
  }, [navigate, player?.LinkedPlayerId]);

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

  const ranks = useMemo(() => {
    if (!stats) return null;
    return {
      kills: leaderboardRank(leagueRows, stats.playerId, 'kills', counting),
      catches: leaderboardRank(leagueRows, stats.playerId, 'catches', counting),
      hitRate: leaderboardRank(leagueRows, stats.playerId, 'hitRate', counting),
    };
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
        {team ? (
          <TextButton onClick={() => navigate(`/teams/${team.Id}`)}>
            {`Back to ${team.Name}`}
          </TextButton>
        ) : (
          <TextButton onClick={() => navigate('/teams')}>Back to teams</TextButton>
        )}
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        sx={{ alignItems: { sm: 'flex-start' }, mb: 3 }}
      >
        {photoSrc ? (
          <Box
            component="a"
            href={photoSrc}
            target="_blank"
            rel="noreferrer"
            sx={{ display: 'inline-block', flexShrink: 0 }}
          >
            <Box
              component="img"
              src={photoSrc}
              alt=""
              referrerPolicy="no-referrer"
              sx={{
                width: 200,
                height: 200,
                objectFit: 'cover',
                borderRadius: 2,
                display: 'block',
              }}
            />
          </Box>
        ) : (
          <EntityAvatar name={player.Name} image={player.Image} size={160} />
        )}
        <Stack spacing={1}>
          <Typography variant="h5">{player.Name}</Typography>
          {team ? (
            <Typography color="text.secondary">
              <MuiLink component={Link} to={`/teams/${team.Id}`} underline="hover">
                {team.Name}
              </MuiLink>
            </Typography>
          ) : null}
          {player.AddedFromMatch && !player.LinkedPlayerId ? (
            <Chip size="small" label="Added from match" className="sk-player-added-from-match" />
          ) : null}
          {ranks ? (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              <Typography>
                Kills {formatCountValue(ranks.kills?.value ?? 0)}
                {ranks.kills
                  ? ` · #${ranks.kills.rank} of ${ranks.kills.total}`
                  : ''}
              </Typography>
              <Typography>
                Catches {formatCountValue(ranks.catches?.value ?? 0)}
                {ranks.catches
                  ? ` · #${ranks.catches.rank} of ${ranks.catches.total}`
                  : ''}
              </Typography>
              <Typography>
                Hit% {formatPct(ranks.hitRate?.value ?? null)}
                {ranks.hitRate
                  ? ` · #${ranks.hitRate.rank} of ${ranks.hitRate.total}`
                  : ''}
              </Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary">
              No scored games yet for this player.
            </Typography>
          )}
        </Stack>
      </Stack>

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
                to={`/matches/${game.matchId}/games/${game.gameId}`}
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

      {guests.length > 0 ? (
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

      {linkSuggestions.length > 0 ? (
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
                  navigate(playerHref(candidate.playerId), { replace: true });
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
    </>
  );
}
