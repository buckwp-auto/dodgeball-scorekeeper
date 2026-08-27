import MenuIcon from '@mui/icons-material/Menu';
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
import { useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { HistoryPage } from './pages/HistoryPage';
import { HighlightsPage } from './pages/HighlightsPage';
import { MatchPage } from './pages/MatchPage';
import { MatchEventsPage } from './pages/MatchEventsPage';
import { GamePage } from './pages/GamePage';
import { GameEventsPage } from './pages/GameEventsPage';
import { MatchesPage } from './pages/MatchesPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { PlayerPage } from './pages/PlayerPage';
import { TeamPage } from './pages/TeamPage';
import { TeamsPage } from './pages/TeamsPage';
import { YoutubePopoutPage } from './pages/YoutubePopoutPage';
import { YOUTUBE_POPOUT_PATH } from './domain/youtubePopout';
import { useAnalyticsPageViews } from './hooks/useAnalyticsPageViews';
import { DatabaseProvider } from './state/DatabaseContext';
import { AuthProvider } from './state/AuthContext';
import { LeagueProvider } from './state/LeagueContext';
import { YoutubePopoutProvider } from './state/YoutubePopoutContext';
import {
  TrackGameImmersiveProvider,
  useTrackGameImmersive,
} from './state/TrackGameImmersiveContext';
import { CloudSyncBar } from './components/CloudSyncBar';
import { ColorModeToggle } from './components/ColorModeToggle';
import { MadeByFooter } from './components/MadeByFooter';
import { ResumeScoringNavItem } from './components/ResumeScoringButton';

const drawerWidth = 200;

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/teams', label: 'Teams' },
  { to: '/matches', label: 'Matches' },
  { to: '/highlights', label: 'Highlights' },
  { to: '/stats', label: 'Stats' },
  { to: '/settings', label: 'League Stat Settings' },
  { to: '/history', label: 'History' },
];

function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <List disablePadding>
      {navItems.map((item) => {
        const selected =
          item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to);
        return (
          <ListItemButton
            key={item.to}
            component={Link}
            to={item.to}
            selected={selected}
            onClick={onNavigate}
            className={`sk-menu-link sk-menu-link--root${item.to === '/stats' ? ' sk-stats-nav' : ''}`}
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

function AppShell() {
  const immersive = useTrackGameImmersive();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  return (
    <Box className="sk-layout" sx={{ display: 'flex', minHeight: '100vh' }}>
      {immersive ? (
        <IconButton
          aria-label="Open menu"
          className="sk-nav-menu-toggle"
          onClick={() => setNavOpen(true)}
          sx={{
            position: 'fixed',
            top: 8,
            left: 8,
            zIndex: (theme) => theme.zIndex.drawer + 2,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            boxShadow: 1,
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          <MenuIcon />
        </IconButton>
      ) : null}
      <Drawer
        variant={immersive ? 'temporary' : 'permanent'}
        open={immersive ? navOpen : true}
        onClose={closeNav}
        slotProps={immersive ? { root: { keepMounted: true } } : undefined}
        sx={{
          width: immersive ? undefined : drawerWidth,
          flexShrink: immersive ? undefined : 0,
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
            Scorekeeper
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
            <AppNav onNavigate={immersive ? closeNav : undefined} />
            <ResumeScoringNavItem />
          </Box>
          <CloudSyncBar />
          <Divider />
          <MadeByFooter />
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, minWidth: 0 }}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamPage />} />
          <Route path="/players/:playerId" element={<PlayerPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/matches/:matchId" element={<MatchPage />} />
          <Route path="/matches/:matchId/stats" element={<StatsPage />} />
          <Route path="/matches/:matchId/events" element={<MatchEventsPage />} />
          <Route path="/matches/:matchId/games/:gameId" element={<GamePage />} />
          <Route
            path="/matches/:matchId/games/:gameId/stats"
            element={<StatsPage />}
          />
          <Route
            path="/matches/:matchId/games/:gameId/events"
            element={<GameEventsPage />}
          />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/highlights" element={<HighlightsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </Box>
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
      <LeagueProvider>
        <DatabaseProvider>
          <YoutubePopoutProvider>
            <TrackGameImmersiveProvider>
              <AppShell />
            </TrackGameImmersiveProvider>
          </YoutubePopoutProvider>
        </DatabaseProvider>
      </LeagueProvider>
    </AuthProvider>
  );
}
