import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import {
  ONBOARDING_STEPS,
  clearOnboardingComplete,
  isOnboardingComplete,
  markOnboardingComplete,
  type OnboardingStep,
} from '../domain/onboarding';

type OnboardingContextValue = {
  active: boolean;
  stepIndex: number;
  step: OnboardingStep;
  stepCount: number;
  startTour: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const step = ONBOARDING_STEPS[stepIndex] ?? ONBOARDING_STEPS[0]!;
  const stepCount = ONBOARDING_STEPS.length;

  const finish = useCallback(() => {
    markOnboardingComplete();
    setActive(false);
    setStepIndex(0);
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      const nextStep = ONBOARDING_STEPS[index];
      if (!nextStep) return;
      setStepIndex(index);
      if (nextStep.route) navigate(nextStep.route);
    },
    [navigate],
  );

  const startTour = useCallback(() => {
    clearOnboardingComplete();
    setStepIndex(0);
    setActive(true);
    const first = ONBOARDING_STEPS[0];
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

  useEffect(() => {
    if (isOnboardingComplete()) return;
    const timer = window.setTimeout(() => {
      setActive(true);
      const first = ONBOARDING_STEPS[0];
      if (first?.route) navigate(first.route);
    }, 400);
    return () => window.clearTimeout(timer);
    // First visit only — do not restart when routes change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      active,
      stepIndex,
      step,
      stepCount,
      startTour,
      next,
      back,
      skip,
    }),
    [active, back, next, skip, startTour, step, stepCount, stepIndex],
  );

  return (
    <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding requires OnboardingProvider');
  return ctx;
}
