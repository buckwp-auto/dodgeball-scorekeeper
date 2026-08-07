import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getFirebase, isFirebaseConfigured } from '../cloud/firebase';

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
    const fb = getFirebase();
    if (!fb) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(fb.auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const fb = getFirebase();
    if (!fb) throw new Error('Firebase is not configured');
    await signInWithPopup(fb.auth, new GoogleAuthProvider());
  }, []);

  const signOut = useCallback(async () => {
    const fb = getFirebase();
    if (!fb) return;
    await firebaseSignOut(fb.auth);
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
