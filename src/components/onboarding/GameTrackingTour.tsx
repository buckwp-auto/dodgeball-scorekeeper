import { gameTrackingAnchorSelector } from '../../domain/gameTrackingTour';
import { useGameTrackingTour } from '../../state/GameTrackingTourContext';
import { GuidedTour } from './GuidedTour';

export function GameTrackingTour() {
  const { active, busy, step, stepIndex, stepCount, canAdvance, next, back, skip } =
    useGameTrackingTour();

  return (
    <GuidedTour
      active={active}
      busy={busy}
      step={step}
      stepIndex={stepIndex}
      stepCount={stepCount}
      canAdvance={canAdvance}
      anchorSelector={gameTrackingAnchorSelector(step.anchor)}
      layoutActiveClass="sk-game-tracking-active"
      layoutInteractiveClass={step.interactive ? 'sk-game-tracking-interactive' : undefined}
      tourClassName="sk-game-tracking-tour"
      onNext={next}
      onBack={back}
      onSkip={skip}
    />
  );
}
