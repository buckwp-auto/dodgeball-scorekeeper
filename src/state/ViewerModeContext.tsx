import { createContext, useContext, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { isViewerPath, VIEWER_BASE } from '../domain/viewerRoutes';

type ViewerModeContextValue = {
  isViewer: boolean;
  /** Empty string in scorekeeper; `/view-stats` in the viewer shell. */
  routeBase: string;
};

const ViewerModeContext = createContext<ViewerModeContextValue>({
  isViewer: false,
  routeBase: '',
});

export function ViewerModeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isViewer = isViewerPath(pathname);
  const value: ViewerModeContextValue = {
    isViewer,
    routeBase: isViewer ? VIEWER_BASE : '',
  };
  return (
    <ViewerModeContext.Provider value={value}>
      {children}
    </ViewerModeContext.Provider>
  );
}

export function useViewerMode(): ViewerModeContextValue {
  return useContext(ViewerModeContext);
}
