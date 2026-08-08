import { Button, ListItemButton, ListItemText } from '@mui/material';
import { Link, useLocation } from 'react-router';
import { useLastScoring } from '../hooks/useLastScoring';

/** Sidebar resume control — hidden when there is nothing to jump to. */
export function ResumeScoringNavItem() {
  const location = useLocation();
  const link = useLastScoring();
  if (!link) return null;

  const selected = location.pathname === link.href;

  return (
    <ListItemButton
      component={Link}
      to={link.href}
      selected={selected}
      className="sk-menu-link sk-resume-scoring"
      sx={{ py: 0.75, mt: 0.5, borderRadius: 1 }}
    >
      <ListItemText
        primary={link.title}
        secondary={link.matchName}
        slotProps={{
          primary: { sx: { fontWeight: selected ? 600 : 500 } },
          secondary: { sx: { fontSize: '0.72rem' } },
        }}
      />
    </ListItemButton>
  );
}

/** Overview CTA — same target as the nav item. */
export function ResumeScoringCta() {
  const link = useLastScoring();
  if (!link) return null;

  return (
    <Button
      component={Link}
      to={link.href}
      variant="contained"
      className="sk-resume-scoring"
      sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
    >
      {`${link.title} · ${link.matchName}`}
    </Button>
  );
}
