import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { Link, Route, Routes, useLocation } from 'react-router';
import { HistoryPage } from './pages/HistoryPage';
import { MatchPage } from './pages/MatchPage';
import { MatchEventsPage } from './pages/MatchEventsPage';
import { GamePage } from './pages/GamePage';
import { GameEventsPage } from './pages/GameEventsPage';
import { MatchesPage } from './pages/MatchesPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { TeamPage } from './pages/TeamPage';
import { TeamsPage } from './pages/TeamsPage';
import { YoutubePopoutPage } from './pages/YoutubePopoutPage';
import { YOUTUBE_POPOUT_PATH } from './domain/youtubePopout';
import { DatabaseProvider } from './state/DatabaseContext';
import { AuthProvider } from './state/AuthContext';
import { LeagueProvider } from './state/LeagueContext';
import { CloudSyncBar } from './components/CloudSyncBar';
import { MadeByFooter } from './components/MadeByFooter';
import { ResumeScoringNavItem } from './components/ResumeScoringButton';

const drawerWidth = 200;

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/teams', label: 'Teams' },
  { to: '/matches', label: 'Matches' },
  { to: '/stats', label: 'Stats' },
  { to: '/settings', label: 'Settings' },
  { to: '/history', label: 'History' },
];

function AppNav() {
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

export function App() {
  const location = useLocation();
  if (location.pathname === YOUTUBE_POPOUT_PATH) {
    return <YoutubePopoutPage />;
  }

  return (
    <AuthProvider>
      <LeagueProvider>
        <DatabaseProvider>
          <Box className="sk-layout" sx={{ display: 'flex', minHeight: '100vh' }}>
            <Drawer
              variant="permanent"
              sx={{
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                  width: drawerWidth,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                },
              }}
            >
              <Toolbar>
                <Typography variant="h6" color="primary" noWrap>
                  Scorekeeper
                </Typography>
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
                  <AppNav />
                  <ResumeScoringNavItem />
                </Box>
                <CloudSyncBar />
                <Divider />
                <MadeByFooter />
              </Box>
            </Drawer>
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/teams" element={<TeamsPage />} />
                <Route path="/teams/:teamId" element={<TeamPage />} />
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
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/history" element={<HistoryPage />} />
              </Routes>
            </Box>
          </Box>
        </DatabaseProvider>
      </LeagueProvider>
    </AuthProvider>
  );
}
