import { ListItemButton, ListItemText } from '@mui/material';
import { Link, useLocation } from 'react-router';
import {
  buildMatchStatisticsClipboardTsv,
  resolveMatchNavTargets,
} from '../domain/matchNavigation';
import { useDatabase } from '../state/DatabaseContext';

type MatchNavSubmenuProps = {
  matchId: string;
  onNavigate?: () => void;
};

const submenuItems = [
  { key: 'goToMatch' as const, label: 'Go to Match' },
  { key: 'trackGame' as const, label: 'Track Game' },
  { key: 'continueGame' as const, label: 'Continue Game' },
];

export function MatchNavSubmenu({ matchId, onNavigate }: MatchNavSubmenuProps) {
  const location = useLocation();
  const { data } = useDatabase();
  const targets = resolveMatchNavTargets(data, matchId, location.pathname);
  if (!targets) return null;

  const onCopyStats = () => {
    const tsv = buildMatchStatisticsClipboardTsv(data, matchId);
    void navigator.clipboard.writeText(tsv);
    onNavigate?.();
  };

  return (
    <>
      {submenuItems.map(({ key, label }) => {
        const action = targets[key];
        const useLink = !action.disabled && action.href !== '';
        return (
          <ListItemButton
            key={key}
            component={useLink ? Link : 'div'}
            {...(useLink ? { to: action.href } : {})}
            selected={action.current}
            disabled={action.disabled}
            onClick={useLink ? onNavigate : undefined}
            className={`sk-menu-link sk-match-nav-${key}`}
            sx={{ py: 0.5, pl: 3 }}
          >
            <ListItemText
              primary={label}
              slotProps={{
                primary: { sx: { fontSize: '0.875rem', fontWeight: action.current ? 600 : 400 } },
              }}
            />
          </ListItemButton>
        );
      })}
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
