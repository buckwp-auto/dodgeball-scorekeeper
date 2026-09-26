import { viewerOnboardingAnchorSelector } from '../../domain/viewerOnboarding';
import { useViewerOnboarding } from '../../state/ViewerOnboardingContext';
import { GuidedTour } from './GuidedTour';

export function ViewerOnboardingTour() {
  const { active, step, stepIndex, stepCount, next, back, skip } =
    useViewerOnboarding();

  return (
    <GuidedTour
      active={active}
      step={step}
      stepIndex={stepIndex}
      stepCount={stepCount}
      anchorSelector={viewerOnboardingAnchorSelector(step.anchor)}
      layoutActiveClass="sk-onboarding-active"
      tourClassName="sk-viewer-onboarding-tour"
      onNext={next}
      onBack={back}
      onSkip={skip}
    />
  );
}
