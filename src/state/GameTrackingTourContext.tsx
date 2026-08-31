import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getMatches, normalizeDatabase } from '../domain/database';
import {
  GAME_TRACKING_STEPS,
  gameTrackingAdvanceMet,
  gameTrackingStepRoute,
  resolveGameTrackingTargets,
  type GameTrackingStep,
} from '../domain/gameTrackingTour';
import { addGameWithAutoRoster } from '../domain/rosterAutoSelect';
import { SAMPLE_LEAGUE_LABEL, fetchSampleLeagueDatabase } from '../domain/sampleLeague';
import type { Guid } from '../domain/types';
import { useDatabase } from './DatabaseContext';

const AUTO_ADVANCE_DELAY_MS = 350;

type GameTrackingTourContextValue = {
  active: boolean;
  busy: boolean;
  stepIndex: number;
  step: GameTrackingStep;
  stepCount: number;
  canAdvance: boolean;
  startTour: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
};

const GameTrackingTourContext = createContext<GameTrackingTourContextValue | null>(null);

export function GameTrackingTourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, replaceDatabase, mutate } = useDatabase();
  const dataRef = useRef(data);
  dataRef.current = data;

  const [tourGameId, setTourGameId] = useState<Guid | null>(null);
  const tourGameIdRef = useRef<Guid | null>(null);
  tourGameIdRef.current = tourGameId;

  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const prevCanAdvanceRef = useRef(false);

  const step = GAME_TRACKING_STEPS[stepIndex] ?? GAME_TRACKING_STEPS[0]!;
  const stepCount = GAME_TRACKING_STEPS.length;

  const targets = resolveGameTrackingTargets(data, tourGameId);
  const canAdvance = gameTrackingAdvanceMet(
    data,
    targets?.gameId,
    step.advanceWhen,
    location.pathname,
  );

  const ensureSampleLoaded = useCallback(async () => {
    if (getMatches(dataRef.current).length > 0) return dataRef.current;
    const raw = await fetchSampleLeagueDatabase();
    const normalized = normalizeDatabase(raw);
    replaceDatabase(raw, { localLabel: SAMPLE_LEAGUE_LABEL });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    return normalized;
  }, [replaceDatabase]);

  const finish = useCallback(() => {
    setActive(false);
    setBusy(false);
    setStepIndex(0);
    setTourGameId(null);
    tourGameIdRef.current = null;
    prevCanAdvanceRef.current = false;
  }, []);

  const goToStep = useCallback(
    async (index: number) => {
      const nextStep = GAME_TRACKING_STEPS[index];
      if (!nextStep) return;

      setBusy(true);
      try {
        if (nextStep.loadSample) {
          await ensureSampleLoaded();
        }

        let stepTargets = resolveGameTrackingTargets(dataRef.current, tourGameIdRef.current);

        if (nextStep.createGame && stepTargets?.matchId && !tourGameIdRef.current) {
          const gameId = mutate(
            (draft) => addGameWithAutoRoster(draft, stepTargets!.matchId),
            'Added tour practice game.',
          );
          tourGameIdRef.current = gameId;
          setTourGameId(gameId);
          stepTargets = { matchId: stepTargets.matchId, gameId };
        }

        const route = gameTrackingStepRoute(nextStep.id, stepTargets);
        if (route) navigate(route);
        setStepIndex(index);
        prevCanAdvanceRef.current = false;
      } finally {
        setBusy(false);
      }
    },
    [ensureSampleLoaded, mutate, navigate],
  );

  const startTour = useCallback(() => {
    setTourGameId(null);
    tourGameIdRef.current = null;
    setStepIndex(0);
    setActive(true);
    void goToStep(0);
  }, [goToStep]);

  const next = useCallback(() => {
    if (
      !gameTrackingAdvanceMet(
        dataRef.current,
        resolveGameTrackingTargets(dataRef.current, tourGameIdRef.current)?.gameId,
        step.advanceWhen,
        location.pathname,
      )
    ) {
      return;
    }
    if (stepIndex >= stepCount - 1) {
      finish();
      return;
    }
    void goToStep(stepIndex + 1);
  }, [finish, goToStep, location.pathname, step.advanceWhen, stepCount, stepIndex]);

  const back = useCallback(() => {
    if (stepIndex <= 0) return;
    void goToStep(stepIndex - 1);
  }, [goToStep, stepIndex]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  useEffect(() => {
    if (!active || busy || !step.advanceWhen) {
      prevCanAdvanceRef.current = canAdvance;
      return undefined;
    }

    const justMet = canAdvance && !prevCanAdvanceRef.current;
    prevCanAdvanceRef.current = canAdvance;
    if (!justMet) return undefined;

    const timer = window.setTimeout(() => {
      next();
    }, AUTO_ADVANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, busy, canAdvance, next, step.advanceWhen]);

  const value = useMemo(
    () => ({
      active,
      busy,
      stepIndex,
      step,
      stepCount,
      canAdvance,
      startTour,
      next,
      back,
      skip,
    }),
    [active, back, busy, canAdvance, next, skip, startTour, step, stepCount, stepIndex],
  );

  return (
    <GameTrackingTourContext.Provider value={value}>{children}</GameTrackingTourContext.Provider>
  );
}

export function useGameTrackingTour(): GameTrackingTourContextValue {
  const ctx = useContext(GameTrackingTourContext);
  if (!ctx) throw new Error('useGameTrackingTour requires GameTrackingTourProvider');
  return ctx;
}
