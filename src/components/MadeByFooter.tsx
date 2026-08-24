import { Box, Link, Typography } from '@mui/material';

const BONINGER_SCOREKEEPER_URL =
  'https://www.boningerworks.com/dodgeball/scorekeeper2';

export function MadeByFooter() {
  return (
    <Box
      sx={{
        px: 0.5,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ lineHeight: 1.35, display: 'block', fontStyle: 'italic' }}
      >
        For Dodgeballers, by Will B, with inspiration from{' '}
        <Link
          href={BONINGER_SCOREKEEPER_URL}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ color: 'primary.light' }}
        >
          Jason Boninger&apos;s Scorekeeper App
        </Link>
      </Typography>
    </Box>
  );
}
