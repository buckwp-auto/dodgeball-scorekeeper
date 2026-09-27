import { Box } from '@mui/material';

export const NAVY = '#0b1f3a';
export const NAVY_DEEP = '#071526';
export const GOLD = '#f0c14b';
export const SILVER = '#c9d1dc';
export const BRONZE = '#d08a4e';
export const RANK_TOP = '#5fd38d';
export const RANK_BOTTOM = '#ff7a7a';

export function SplitName({ name }: { name: string }) {
  const trimmed = name.trim();
  const index = trimmed.indexOf(' ');
  const first = index < 0 ? trimmed : trimmed.slice(0, index);
  const last = index < 0 ? '' : trimmed.slice(index + 1);
  return (
    <Box component="span" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
      <Box component="span" sx={{ color: '#fff' }}>
        {first.toUpperCase()}
      </Box>
      {last ? (
        <>
          {' '}
          <Box component="span" sx={{ color: GOLD }}>
            {last.toUpperCase()}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
