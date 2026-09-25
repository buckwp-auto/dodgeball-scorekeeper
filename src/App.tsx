import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { Fragment, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { HelpPage } from './pages/HelpPage';
import { HistoryPage } from './pages/HistoryPage';
import { HighlightsPage } from './pages/HighlightsPage';
import { MatchPage } from './pages/MatchPage';
import { MatchEventsPage } from './pages/MatchEventsPage';
import { GamePage } from './pages/GamePage';
import { GameEventsPage } from './pages/GameEventsPage';
import { MatchesPage } from './pages/MatchesPage';
import { OverviewPage } from './pages/OverviewPage';
import { AppAdminPage } from './pages/AppAdminPage';
import { AppAdminLeaguePage } from './pages/AppAdminLeaguePage';
import { AppOperatorsPage } from './pages/AppOperatorsPage';
import { AppViewersPage } from './pages/AppViewersPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { PlayerPage } from './pages/PlayerPage';
import { PlayersDirectoryPage } from './pages/PlayersDirectoryPage';
import { TeamPage } from './pages/TeamPage';
import { TeamsPage } from './pages/TeamsPage';
import { ViewerLeaguesPage } from './pages/ViewerLeaguesPage';
import { YoutubePopoutPage } from './pages/YoutubePopoutPage';
import { YOUTUBE_POPOUT_PATH } from './domain/youtubePopout';
import type { OnboardingAnchor } from './domain/onboarding';
import type { ViewerOnboardingAnchor } from './domain/viewerOnboarding';
import {
  VIEWER_BASE,
  viewerLeaguesHref,
  viewerPlayersHref,
  viewerStatsHref,
} from './domain/viewerRoutes';
import { useAnalyticsPageViews } from './hooks/useAnalyticsPageViews';
import { DatabaseProvider } from './state/DatabaseContext';
import { AuthProvider } from './state/AuthContext';
import { AppRoleProvider } from './state/AppRoleContext';
import { LeagueProvider } from './state/LeagueContext';
import { OnboardingProvider } from './state/OnboardingContext';
import { ViewerOnboardingProvider } from './state/ViewerOnboardingContext';
import { GameTrackingTourProvider } from './state/GameTrackingTourContext';
import { YoutubePopoutProvider } from './state/YoutubePopoutContext';
import {
  TrackGameImmersiveProvider,
  useTrackGameImmersive,
} from './state/TrackGameImmersiveContext';
import {
  ViewerModeProvider,
  useViewerMode,
} from './state/ViewerModeContext';
import { OnboardingTour } from './components/onboarding/OnboardingTour';
import { ViewerOnboardingTour } from './components/onboarding/ViewerOnboardingTour';
import { GameTrackingTour } from './components/onboarding/GameTrackingTour';
import { CloudSyncBar } from './components/CloudSyncBar';
import { ColorModeToggle } from './components/ColorModeToggle';
import { ImportedMatchStatsGuard } from './components/ImportedMatchStatsGuard';
import { MadeByFooter } from './components/MadeByFooter';
import { MatchNavSubmenu } from './components/MatchNavSubmenu';
import { ResumeScoringNavItem } from './components/ResumeScoringButton';
import { matchIdFromPath } from './domain/youtubePopout';
import { useAppRole } from './state/AppRoleContext';

const drawerWidth = 200;

const navItems: { to: string; label: string; onboarding?: OnboardingAnchor }[] = [
  { to: '/', label: 'Overview' },
  { to: '/teams', label: 'Teams', onboarding: 'nav-teams' },
  { to: '/matches', label: 'Matches', onboarding: 'nav-matches' },
  { to: '/highlights', label: 'Highlights' },
  { to: '/stats', label: 'Stats', onboarding: 'nav-stats' },
  { to: '/settings', label: 'League Stat Settings', onboarding: 'nav-settings' },
  { to: '/help', label: 'Help', onboarding: 'nav-help' },
  { to: '/history', label: 'History' },
];

const viewerNavItems: {
  to: string;
  label: string;
  onboarding?: ViewerOnboardingAnchor;
}[] = [
  { to: viewerLeaguesHref(), label: 'Leagues', onboarding: 'viewer-nav-leagues' },
  { to: viewerStatsHref(), label: 'Stats', onboarding: 'viewer-nav-stats' },
  { to: viewerPlayersHref(), label: 'Players', onboarding: 'viewer-nav-players' },
];

function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const activeMatchId = matchIdFromPath(location.pathname);
  const { isAppAdmin } = useAppRole();
  const { isViewer } = useViewerMode();

  if (isViewer) {
    return (
      <List disablePadding className="sk-viewer-nav">
        {viewerNavItems.map((item) => {
          const selected =
            item.to === VIEWER_BASE
              ? location.pathname === VIEWER_BASE
              : location.pathname === item.to ||
                location.pathname.startsWith(`${item.to}/`);
          return (
            <ListItemButton
              key={item.to}
              component={Link}
              to={item.to}
              selected={selected}
              onClick={onNavigate}
              data-onboarding={item.onboarding}
              className={`sk-menu-link sk-menu-link--root sk-viewer-nav-link${item.to === viewerStatsHref() ? ' sk-stats-nav' : ''}`}
              sx={{ py: 0.75 }}
            >
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: { sx: { fontWeight: selected ? 600 : 400 } },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    );
  }

  const items = isAppAdmin
    ? [
        ...navItems.slice(0, 6),
        { to: '/admin', label: 'App admin' },
        ...navItems.slice(6),
      ]
    : navItems;

  return (
    <List disablePadding>
      {items.map((item) => {
        const selected =
          item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to);
        return (
          <Fragment key={item.to}>
            <ListItemButton
              component={Link}
              to={item.to}
              selected={selected}
              onClick={onNavigate}
              data-onboarding={item.onboarding}
              className={`sk-menu-link sk-menu-link--root${item.to === '/stats' ? ' sk-stats-nav' : ''}${item.to === '/admin' ? ' sk-app-admin-nav' : ''}`}
              sx={{ py: 0.75 }}
            >
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: { sx: { fontWeight: selected ? 600 : 400 } },
                }}
              />
            </ListItemButton>
            {item.to === '/matches' && activeMatchId ? (
              <MatchNavSubmenu matchId={activeMatchId} onNavigate={onNavigate} />
            ) : null}
          </Fragment>
        );
      })}
    </List>
  );
}

function AppShell() {
  const immersive = useTrackGameImmersive();
  const { isViewer } = useViewerMode();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);
  const toggleNav = () => setNavOpen((open) => !open);
  const showImmersiveNav = immersive && !isViewer;

  return (
    <Box className="sk-layout" sx={{ display: 'flex', minHeight: '100vh' }}>
      {showImmersiveNav ? (
        <IconButton
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          className="sk-nav-drawer-toggle"
          onClick={toggleNav}
          size="small"
          sx={{
            position: 'fixed',
            left: navOpen ? drawerWidth : 0,
            top: '50%',
            transform: navOpen ? 'translate(-50%, -50%)' : 'translateY(-50%)',
            zIndex: (theme) => theme.zIndex.drawer + 2,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: navOpen ? '50%' : '0 4px 4px 0',
            borderLeft: navOpen ? 1 : 0,
            boxShadow: 2,
            width: 28,
            height: 48,
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          {navOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      ) : null}
      <Drawer
        variant={showImmersiveNav ? 'temporary' : 'permanent'}
        open={showImmersiveNav ? navOpen : true}
        onClose={closeNav}
        slotProps={showImmersiveNav ? { root: { keepMounted: true } } : undefined}
        sx={{
          width: showImmersiveNav ? undefined : drawerWidth,
          flexShrink: showImmersiveNav ? undefined : 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
            borderRightColor: 'divider',
          },
        }}
      >
        <Toolbar sx={{ gap: 0.5, justifyContent: 'space-between', px: 1.5 }}>
          <Typography variant="h6" color="primary" noWrap>
            {isViewer ? 'League stats' : 'Scorekeeper'}
          </Typography>
          <ColorModeToggle />
        </Toolbar>
        <Box
          className="sk-menu-content"
          sx={{
            px: 1,
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            <AppNav onNavigate={showImmersiveNav ? closeNav : undefined} />
            {isViewer ? null : <ResumeScoringNavItem />}
          </Box>
          <CloudSyncBar />
          <Divider />
          <MadeByFooter />
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: showImmersiveNav ? 0 : 3, minWidth: 0 }}
      >
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamPage />} />
          <Route path="/players/:playerId" element={<PlayerPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/matches/:matchId" element={<MatchPage />} />
          <Route path="/matches/:matchId/stats" element={<StatsPage />} />
          <Route
            path="/matches/:matchId/events"
            element={
              <ImportedMatchStatsGuard>
                <MatchEventsPage />
              </ImportedMatchStatsGuard>
            }
          />
          <Route
            path="/matches/:matchId/games/:gameId"
            element={
              <ImportedMatchStatsGuard>
                <GamePage />
              </ImportedMatchStatsGuard>
            }
          />
          <Route
            path="/matches/:matchId/games/:gameId/stats"
            element={<StatsPage />}
          />
          <Route
            path="/matches/:matchId/games/:gameId/events"
            element={
              <ImportedMatchStatsGuard>
                <GameEventsPage />
              </ImportedMatchStatsGuard>
            }
          />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/highlights" element={<HighlightsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AppAdminPage />} />
          <Route path="/admin/operators" element={<AppOperatorsPage />} />
          <Route path="/admin/viewers" element={<AppViewersPage />} />
          <Route
            path="/admin/leagues/:leagueId"
            element={<AppAdminLeaguePage />}
          />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/history" element={<HistoryPage />} />

          <Route path={VIEWER_BASE} element={<ViewerLeaguesPage />} />
          <Route path={`${VIEWER_BASE}/stats`} element={<StatsPage />} />
          <Route
            path={`${VIEWER_BASE}/players`}
            element={<PlayersDirectoryPage />}
          />
          <Route
            path={`${VIEWER_BASE}/players/:playerId`}
            element={<PlayerPage />}
          />
          <Route
            path={`${VIEWER_BASE}/matches/:matchId/stats`}
            element={<StatsPage />}
          />
          <Route
            path={`${VIEWER_BASE}/matches/:matchId/games/:gameId/stats`}
            element={<StatsPage />}
          />
        </Routes>
      </Box>
      {isViewer ? (
        <ViewerOnboardingTour />
      ) : (
        <>
          <OnboardingTour />
          <GameTrackingTour />
        </>
      )}
    </Box>
  );
}

export function App() {
  useAnalyticsPageViews();
  const location = useLocation();
  if (location.pathname === YOUTUBE_POPOUT_PATH) {
    return <YoutubePopoutPage />;
  }

  return (
    <AuthProvider>
      <AppRoleProvider>
        <LeagueProvider>
          <DatabaseProvider>
            <OnboardingProvider>
              <ViewerOnboardingProvider>
                <GameTrackingTourProvider>
                  <YoutubePopoutProvider>
                    <TrackGameImmersiveProvider>
                      <ViewerModeProvider>
                        <AppShell />
                      </ViewerModeProvider>
                    </TrackGameImmersiveProvider>
                  </YoutubePopoutProvider>
                </GameTrackingTourProvider>
              </ViewerOnboardingProvider>
            </OnboardingProvider>
          </DatabaseProvider>
        </LeagueProvider>
      </AppRoleProvider>
    </AuthProvider>
  );
}
