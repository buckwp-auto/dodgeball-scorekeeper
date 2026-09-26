import { ListItemButton, ListItemText } from '@mui/material';
import { Link, useLocation } from 'react-router';
import {
  buildMatchStatisticsClipboardTsv,
  resolveMatchNavTargets,
} from '../domain/matchNavigation';
import { useLastScoringStored } from '../hooks/useLastScoring';
import { useDatabase } from '../state/DatabaseContext';

type MatchNavSubmenuProps = {
  matchId: string;
  onNavigate?: () => void;
  onToast?: (toast: {
    message: string;
    severity: 'success' | 'error';
  }) => void;
};

export function MatchNavSubmenu({
  matchId,
  onNavigate,
  onToast,
}: MatchNavSubmenuProps) {
  const location = useLocation();
  const { data } = useDatabase();
  const lastScoring = useLastScoringStored();
  const targets = resolveMatchNavTargets(
    data,
    matchId,
    location.pathname,
    lastScoring,
  );
  if (!targets) return null;

  const onCopyStats = () => {
    const tsv = buildMatchStatisticsClipboardTsv(data, matchId);
    // Close the immersive drawer first so Track Game stays usable; toast lives
    // in AppShell so it still shows after this submenu is hidden/unmounted.
    onNavigate?.();
    void navigator.clipboard
      .writeText(tsv)
      .then(() => {
        onToast?.({
          message: 'Match statistics copied',
          severity: 'success',
        });
      })
      .catch(() => {
        onToast?.({
          message: 'Could not copy to clipboard',
          severity: 'error',
        });
      });
  };

  const trackUseLink = !targets.trackGame.disabled && targets.trackGame.href !== '';

  return (
    <>
      <ListItemButton
        component={!targets.goToMatch.disabled ? Link : 'div'}
        {...(!targets.goToMatch.disabled ? { to: targets.goToMatch.href } : {})}
        selected={targets.goToMatch.current}
        disabled={targets.goToMatch.disabled}
        onClick={!targets.goToMatch.disabled ? onNavigate : undefined}
        className="sk-menu-link sk-match-nav-goToMatch"
        sx={{ py: 0.5, pl: 3 }}
      >
        <ListItemText
          primary="Go to Match"
          slotProps={{
            primary: {
              sx: {
                fontSize: '0.875rem',
                fontWeight: targets.goToMatch.current ? 600 : 400,
              },
            },
          }}
        />
      </ListItemButton>
      <ListItemButton
        component={trackUseLink ? Link : 'div'}
        {...(trackUseLink ? { to: targets.trackGame.href } : {})}
        selected={targets.trackGame.current}
        disabled={targets.trackGame.disabled}
        onClick={trackUseLink ? onNavigate : undefined}
        className="sk-menu-link sk-match-nav-trackGame"
        sx={{ py: 0.5, pl: 3 }}
      >
        <ListItemText
          primary={targets.trackGame.label}
          slotProps={{
            primary: {
              sx: {
                fontSize: '0.875rem',
                fontWeight: targets.trackGame.current ? 600 : 400,
              },
            },
          }}
        />
      </ListItemButton>
      <ListItemButton
        type="button"
        disabled={!targets.copyStatsEnabled}
        onClick={onCopyStats}
        className="sk-menu-link sk-match-nav-copy-stats"
        sx={{ py: 0.5, pl: 3 }}
      >
        <ListItemText
          primary="Copy Stats"
          slotProps={{
            primary: { sx: { fontSize: '0.875rem', fontWeight: 400 } },
          }}
        />
      </ListItemButton>
    </>
  );
}
