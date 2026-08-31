import { onboardingAnchorSelector } from '../../domain/onboarding';
import { useOnboarding } from '../../state/OnboardingContext';
import { GuidedTour } from './GuidedTour';

export function OnboardingTour() {
  const { active, step, stepIndex, stepCount, next, back, skip } = useOnboarding();

  return (
    <GuidedTour
      active={active}
      step={step}
      stepIndex={stepIndex}
      stepCount={stepCount}
      anchorSelector={onboardingAnchorSelector(step.anchor)}
      layoutActiveClass="sk-onboarding-active"
      tourClassName="sk-onboarding-tour"
      onNext={next}
      onBack={back}
      onSkip={skip}
    />
  );
}
