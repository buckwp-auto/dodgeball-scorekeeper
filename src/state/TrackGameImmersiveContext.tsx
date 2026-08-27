import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type TrackGameImmersiveContextValue = {
  immersive: boolean;
  setImmersive: (next: boolean) => void;
};

const TrackGameImmersiveContext = createContext<TrackGameImmersiveContextValue>({
  immersive: false,
  setImmersive: () => {},
});

export function TrackGameImmersiveProvider({ children }: { children: ReactNode }) {
  const [immersive, setImmersive] = useState(false);
  const value = useMemo(
    () => ({ immersive, setImmersive }),
    [immersive],
  );
  return (
    <TrackGameImmersiveContext.Provider value={value}>
      {children}
    </TrackGameImmersiveContext.Provider>
  );
}

export function useTrackGameImmersive(): boolean {
  return useContext(TrackGameImmersiveContext).immersive;
}

export function useSetTrackGameImmersive(): (next: boolean) => void {
  return useContext(TrackGameImmersiveContext).setImmersive;
}
