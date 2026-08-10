import { CssBaseline, ThemeProvider } from '@mui/material';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  COLOR_MODE_KEY,
  loadColorModePreference,
  resolveColorMode,
  saveColorModePreference,
  systemPrefersDark,
  type ColorModePreference,
  type ResolvedColorMode,
} from '../domain/colorMode';
import { createAppTheme } from '../theme';

type ColorModeContextValue = {
  preference: ColorModePreference;
  resolved: ResolvedColorMode;
  setPreference: (preference: ColorModePreference) => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(loadColorModePreference);
  const [osPrefersDark, setOsPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setOsPrefersDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === COLOR_MODE_KEY || event.key === null) {
        setPreferenceState(loadColorModePreference());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next: ColorModePreference) => {
    saveColorModePreference(next);
    setPreferenceState(next);
  }, []);

  const resolved = resolveColorMode(preference, osPrefersDark);
  const theme = useMemo(() => createAppTheme(resolved), [resolved]);

  useEffect(() => {
    document.documentElement.dataset.colorMode = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode requires ColorModeProvider');
  return ctx;
}
