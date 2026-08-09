import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { logPageView } from '../cloud/logAnalytics';

/** Send a page_view on every client-side navigation. */
export function useAnalyticsPageViews(): void {
  const location = useLocation();

  useEffect(() => {
    logPageView(location.pathname);
  }, [location.pathname]);
}
