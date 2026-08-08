import type { User } from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isFirebaseConfigured } from '../cloud/firebaseConfig';

type AuthContextValue = {
  configured: boolean;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      const { watchAuthState } = await import('../cloud/authApi');
      if (cancelled) return;
      unsubscribe = watchAuthState((next) => {
        setUser(next);
        setLoading(false);
      });
      if (!unsubscribe) setLoading(false);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    const api = await import('../cloud/authApi');
    await api.signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    const api = await import('../cloud/authApi');
    await api.signOutOfFirebase();
  }, []);

  const value = useMemo(
    () => ({
      configured,
      user,
      loading,
      signInWithGoogle,
      signOut,
    }),
    [configured, user, loading, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AuthProvider');
  return ctx;
}
