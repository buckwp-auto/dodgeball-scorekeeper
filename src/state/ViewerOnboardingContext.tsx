import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import { isViewerPath } from '../domain/viewerRoutes';
import {
  VIEWER_ONBOARDING_STEPS,
  clearViewerOnboardingComplete,
  isViewerOnboardingComplete,
  markViewerOnboardingComplete,
  type ViewerOnboardingStep,
} from '../domain/viewerOnboarding';

type ViewerOnboardingContextValue = {
  active: boolean;
  stepIndex: number;
  step: ViewerOnboardingStep;
  stepCount: number;
  startTour: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
};

const ViewerOnboardingContext =
  createContext<ViewerOnboardingContextValue | null>(null);

export function ViewerOnboardingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inViewer = isViewerPath(location.pathname);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const step = VIEWER_ONBOARDING_STEPS[stepIndex] ?? VIEWER_ONBOARDING_STEPS[0]!;
  const stepCount = VIEWER_ONBOARDING_STEPS.length;

  const finish = useCallback(() => {
    markViewerOnboardingComplete();
    setActive(false);
    setStepIndex(0);
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      const nextStep = VIEWER_ONBOARDING_STEPS[index];
      if (!nextStep) return;
      if (nextStep.route) navigate(nextStep.route);
      setStepIndex(index);
    },
    [navigate],
  );

  const startTour = useCallback(() => {
    clearViewerOnboardingComplete();
    setStepIndex(0);
    setActive(true);
    const first = VIEWER_ONBOARDING_STEPS[0];
    if (first?.route) navigate(first.route);
  }, [navigate]);

  const next = useCallback(() => {
    if (stepIndex >= stepCount - 1) {
      finish();
      return;
    }
    goToStep(stepIndex + 1);
  }, [finish, goToStep, stepCount, stepIndex]);

  const back = useCallback(() => {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  // Pause if the user leaves the viewer shell mid-tour (do not mark complete).
  useEffect(() => {
    if (!inViewer && active) {
      setActive(false);
      setStepIndex(0);
    }
  }, [inViewer, active]);

  // First visit on the viewer shell only — never steal control of scorekeeper routes.
  useEffect(() => {
    if (!inViewer) return;
    if (isViewerOnboardingComplete()) return;
    const timer = window.setTimeout(() => {
      if (!isViewerPath(window.location.pathname)) return;
      setActive(true);
      const first = VIEWER_ONBOARDING_STEPS[0];
      if (first?.route) navigate(first.route);
    }, 400);
    return () => window.clearTimeout(timer);
    // First viewer visit only — do not restart when routes change inside the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inViewer]);

  const value = useMemo(
    () => ({
      active: active && inViewer,
      stepIndex,
      step,
      stepCount,
      startTour,
      next,
      back,
      skip,
    }),
    [active, back, inViewer, next, skip, startTour, step, stepCount, stepIndex],
  );

  return (
    <ViewerOnboardingContext.Provider value={value}>
      {children}
    </ViewerOnboardingContext.Provider>
  );
}

export function useViewerOnboarding(): ViewerOnboardingContextValue {
  const ctx = useContext(ViewerOnboardingContext);
  if (!ctx) {
    throw new Error('useViewerOnboarding requires ViewerOnboardingProvider');
  }
  return ctx;
}
