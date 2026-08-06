import {
  Box,
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
import { TeamPage } from './pages/TeamPage';
import { TeamsPage } from './pages/TeamsPage';
import { DatabaseProvider } from './state/DatabaseContext';

const drawerWidth = 200;

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/teams', label: 'Teams' },
  { to: '/matches', label: 'Matches' },
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
            className="sk-menu-link sk-menu-link--root"
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
  return (
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
            },
          }}
        >
          <Toolbar>
            <Typography variant="h6" color="primary" noWrap>
              Scorekeeper
            </Typography>
          </Toolbar>
          <Box className="sk-menu-content" sx={{ px: 1 }}>
            <AppNav />
          </Box>
        </Drawer>
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/:matchId" element={<MatchPage />} />
            <Route path="/matches/:matchId/events" element={<MatchEventsPage />} />
            <Route path="/matches/:matchId/games/:gameId" element={<GamePage />} />
            <Route
              path="/matches/:matchId/games/:gameId/events"
              element={<GameEventsPage />}
            />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </Box>
      </Box>
    </DatabaseProvider>
  );
}
