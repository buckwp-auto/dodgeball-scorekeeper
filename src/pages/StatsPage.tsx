import { Button, Stack, Tab, Tabs, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { MatchSeriesScoreboard } from '../components/stats/MatchSeriesScoreboard';
import { StatsCharts } from '../components/stats/StatsCharts';
import { StatsHeatmap } from '../components/stats/StatsHeatmap';
import { StatsLeaderboard } from '../components/stats/StatsLeaderboard';
import { StatsPlayerTable } from '../components/stats/StatsPlayerTable';
import { StatsScopeNav } from '../components/stats/StatsScopeNav';
import { StatsStandingsTable } from '../components/stats/StatsStandingsTable';
import { PageHeader } from '../components/Ui';
import { getMatchName } from '../domain/database';
import { buildEliminationTimeline } from '../domain/gameElimination';
import { getMatchById, getMatchGames } from '../domain/matchGame';
import { resolveHighlightQualifiers, resolveLeagueStatPolicy } from '../domain/leagueSettings';
import {
  buildDisplayStats,
  loadIncludeSubStats,
  loadStatsCountingMode,
  resolveStatsQuery,
  saveIncludeSubStats,
  saveStatsCountingMode,
  statsPageTitle,
  type LeaderboardMetric,
  type StatsCountingMode,
  type StatsScope,
} from '../domain/statistics/displayStats';
import { attachVorWar } from '../domain/statistics/highlightStats';
import { getStatisticsSummaryCsv } from '../domain/statistics/statisticsFormatService';
import { buildTargetHeatmap } from '../domain/statistics/targetHeatmap';
import {
  buildMatchSeries,
  buildTeamStandingsForScope,
} from '../domain/statistics/teamStandings';
import { useDatabase } from '../state/DatabaseContext';
import { useLeague } from '../state/LeagueContext';

type StatsTab = 'standings' | 'players' | 'charts' | 'leaderboards';

export function StatsPage() {
  const { matchId, gameId } = useParams();
  const { data } = useDatabase();
  const { activeLeagueId, leagues } = useLeague();
  const [tab, setTab] = useState<StatsTab>(matchId && gameId ? 'players' : 'standings');
  const [metric, setMetric] = useState<LeaderboardMetric>('kills');
  const [minGames, setMinGames] = useState(1);
  const [counting, setCounting] = useState<StatsCountingMode>(() => loadStatsCountingMode());
  const [includeSubs, setIncludeSubs] = useState(() => loadIncludeSubStats());

  const scope: StatsScope | null = useMemo(() => {
    if (matchId && gameId) return { kind: 'game', matchId, gameId };
    if (matchId) return { kind: 'match', matchId };
    return { kind: 'league' };
  }, [matchId, gameId]);

  const valid = useMemo(() => {
    if (!scope || scope.kind === 'league') return true;
    if (!getMatchById(data, scope.matchId)) return false;
    if (scope.kind === 'game') {
      return getMatchGames(data, scope.matchId).some((game) => game.gameId === scope.gameId);
    }
    return true;
  }, [data, scope]);

  const qualifiers = useMemo(() => resolveHighlightQualifiers(data), [data]);
  const rows = useMemo(
    () =>
      scope && valid
        ? attachVorWar(
            buildDisplayStats(data, scope, {
              includeSubStats: scope.kind === 'league' ? includeSubs : true,
            }),
            counting,
            qualifiers,
          )
        : [],
    [data, scope, valid, counting, qualifiers, includeSubs],
  );
  const policy = useMemo(() => resolveLeagueStatPolicy(data), [data]);
  const showAssists =
    policy.teamThrowAssistMode !== 'none' || rows.some((row) => row.assists > 0);
  const showMultiKills =
    policy.trackMultiKills ||
    rows.some((row) => row.doubleKills + row.tripleKills + row.quadKills > 0);
  const showMultiCatches =
    policy.trackMultiCatches ||
    rows.some((row) => row.doubleCatches + row.tripleCatches + row.quadCatches > 0);
  const showDeflectionCatches =
    policy.countDeflectionCatchesSeparately ||
    rows.some((row) => row.catchesDeflection > 0);

  const onCountingChange = (next: StatsCountingMode) => {
    setCounting(next);
    saveStatsCountingMode(next);
  };
  const onIncludeSubsChange = (next: boolean) => {
    setIncludeSubs(next);
    saveIncludeSubStats(next);
  };
  const standings = useMemo(
    () => (scope && valid ? buildTeamStandingsForScope(data, scope) : []),
    [data, scope, valid],
  );
  const series = useMemo(() => {
    if (!scope || !valid || scope.kind === 'league') return null;
    return buildMatchSeries(data, scope.matchId);
  }, [data, scope, valid]);
  const timeline = useMemo(() => {
    if (!scope || !valid || scope.kind !== 'game') return undefined;
    return buildEliminationTimeline(data, scope.matchId, scope.gameId);
  }, [data, scope, valid]);
  const heatmap = useMemo(() => {
    if (!scope || !valid || scope.kind === 'league') return null;
    return buildTargetHeatmap(data, scope);
  }, [data, scope, valid]);

  const leagueName = leagues.find((league) => league.id === activeLeagueId)?.name;
  const title =
    scope?.kind === 'league' && leagueName
      ? `${leagueName} stats`
      : scope
        ? statsPageTitle(data, scope)
        : 'Stats';

  const showStandings = scope?.kind !== 'game';
  const showLeaderboards = scope?.kind === 'league';
  const activeTab =
    (!showStandings && tab === 'standings') || (!showLeaderboards && tab === 'leaderboards')
      ? 'players'
      : tab;
  const canDownloadCsv = Boolean(scope && valid && scope.kind !== 'game' && rows.length > 0);

  const downloadCsv = () => {
    if (!scope) return;
    const { matchIds } = resolveStatsQuery(data, scope);
    if (matchIds.length === 0) return;
    const bytes = getStatisticsSummaryCsv(data, matchIds);
    const blob = new Blob([bytes], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const match = scope.kind === 'match' ? getMatchById(data, scope.matchId) : undefined;
    const filename =
      scope.kind === 'match' && match
        ? `Dodgeball Match (${getMatchName(data, match)}) Statistics.csv`
        : `Dodgeball ${leagueName ?? 'League'} Statistics.csv`;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!valid) {
    return (
      <>
        <PageHeader>Stats</PageHeader>
        <StatsScopeNav data={data} scope={{ kind: 'league' }} />
      </>
    );
  }

  return (
    <>
      <PageHeader>{title}</PageHeader>
      {scope ? <StatsScopeNav data={data} scope={scope} /> : null}
      {canDownloadCsv ? (
        <Stack direction="row" spacing={1} className="button-row" sx={{ flexWrap: 'wrap', mb: 2, rowGap: 1 }}>
          <Button
            type="button"
            variant="outlined"
            className="bw-button bw-button--text"
            onClick={downloadCsv}
          >
            Download Statistics CSV
          </Button>
        </Stack>
      ) : null}
      {series ? <MatchSeriesScoreboard series={series} /> : null}
      <Tabs
        value={activeTab}
        onChange={(_, next: StatsTab) => setTab(next)}
        className="sk-stats-tabs"
        sx={{ mb: 2 }}
      >
        {showStandings ? <Tab value="standings" label="Standings" /> : null}
        <Tab value="players" label="Players" />
        {showLeaderboards ? <Tab value="leaderboards" label="Leaderboards" /> : null}
        <Tab value="charts" label="Charts" />
      </Tabs>
      {activeTab === 'players' || activeTab === 'charts' || activeTab === 'leaderboards' ? (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={counting}
            onChange={(_, next: StatsCountingMode | null) => {
              if (next) onCountingChange(next);
            }}
            className="sk-stats-counting"
          >
            <ToggleButton value="counts">Counts</ToggleButton>
            <ToggleButton value="credit">Credit</ToggleButton>
          </ToggleButtonGroup>
          {scope?.kind === 'league' ? (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={includeSubs ? 'include' : 'exclude'}
              onChange={(_, next: 'include' | 'exclude' | null) => {
                if (!next) return;
                onIncludeSubsChange(next === 'include');
              }}
              className="sk-stats-include-subs"
            >
              <ToggleButton value="include">Include sub stats</ToggleButton>
              <ToggleButton value="exclude">Exclude sub stats</ToggleButton>
            </ToggleButtonGroup>
          ) : null}
        </Stack>
      ) : null}
      {activeTab === 'standings' ? <StatsStandingsTable rows={standings} /> : null}
      {activeTab === 'players' ? (
        <StatsPlayerTable
          rows={rows}
          metric={metric}
          onMetricChange={setMetric}
          minGames={minGames}
          onMinGamesChange={setMinGames}
          counting={counting}
          showAssists={showAssists}
          showMultiKills={showMultiKills}
          showMultiCatches={showMultiCatches}
          showDeflectionCatches={showDeflectionCatches}
        />
      ) : null}
      {activeTab === 'leaderboards' ? (
        <StatsLeaderboard
          rows={rows}
          counting={counting}
          qualifiers={qualifiers}
          leagueName={leagueName}
          leagueLogo={leagues.find((league) => league.id === activeLeagueId)?.logo}
          data={data}
        />
      ) : null}
      {activeTab === 'charts' ? (
        <>
          <StatsCharts
            rows={rows}
            metric={metric}
            minGames={minGames}
            counting={counting}
            homeTeamName={series?.homeTeam.Name}
            awayTeamName={series?.awayTeam.Name}
            timeline={timeline}
          />
          {heatmap ? <StatsHeatmap heatmap={heatmap} /> : null}
        </>
      ) : null}
    </>
  );
}
