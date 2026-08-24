import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export function createAppTheme(mode: PaletteMode) {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#1565c0',
      },
      secondary: {
        main: '#00838f',
      },
    },
    typography: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  });
}
