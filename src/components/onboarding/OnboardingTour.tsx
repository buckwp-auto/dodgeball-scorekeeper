import {
  Box,
  Button,
  Paper,
  Popper,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { onboardingAnchorSelector, type OnboardingPlacement } from '../../domain/onboarding';
import { useOnboarding } from '../../state/OnboardingContext';

const SPOTLIGHT_CLASS = 'sk-onboarding-spotlight';

const POPPER_MODIFIERS = [
  {
    name: 'offset',
    options: { offset: [0, 12] },
  },
  {
    name: 'preventOverflow',
    options: {
      boundary: 'viewport',
      padding: 12,
      altAxis: true,
    },
  },
  {
    name: 'flip',
    options: {
      fallbackPlacements: ['bottom-start', 'top-start', 'right', 'left'],
    },
  },
];

function TourCard({
  placement,
  title,
  body,
  stepIndex,
  stepCount,
  isFirst,
  isLast,
  onSkip,
  onBack,
  onNext,
}: {
  placement: OnboardingPlacement;
  title: string;
  body: string;
  stepIndex: number;
  stepCount: number;
  isFirst: boolean;
  isLast: boolean;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const showArrow = placement === 'bottom-start';

  return (
    <Box
      className={showArrow ? 'sk-onboarding-tour-card sk-onboarding-tour-card--below' : 'sk-onboarding-tour-card'}
    >
      <Paper elevation={8} sx={{ p: 2, maxWidth: 320 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {body}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Step {stepIndex + 1} of {stepCount}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}
            useFlexGap
          >
            <Button size="small" onClick={onSkip} sx={{ mr: 'auto' }}>
              Skip tour
            </Button>
            {!isFirst ? (
              <Button size="small" onClick={onBack}>
                Back
              </Button>
            ) : null}
            <Button size="small" variant="contained" onClick={onNext}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export function OnboardingTour() {
  const { active, step, stepIndex, stepCount, next, back, skip } = useOnboarding();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const placement = step.placement ?? 'right';

  useEffect(() => {
    const layout = document.querySelector('.sk-layout');
    if (!layout) return undefined;
    if (active) layout.classList.add('sk-onboarding-active');
    else layout.classList.remove('sk-onboarding-active');
    return () => layout.classList.remove('sk-onboarding-active');
  }, [active]);

  useEffect(() => {
    if (!active) {
      setAnchorEl(null);
      document.querySelectorAll(`.${SPOTLIGHT_CLASS}`).forEach((node) => {
        node.classList.remove(SPOTLIGHT_CLASS);
      });
      return;
    }

    const selector = onboardingAnchorSelector(step.anchor);
    const resolveAnchor = () => document.querySelector<HTMLElement>(selector);

    const applySpotlight = (element: HTMLElement | null) => {
      document.querySelectorAll(`.${SPOTLIGHT_CLASS}`).forEach((node) => {
        node.classList.remove(SPOTLIGHT_CLASS);
      });
      if (element) {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        element.classList.add(SPOTLIGHT_CLASS);
        setAnchorEl(element);
      } else {
        setAnchorEl(null);
      }
    };

    applySpotlight(resolveAnchor());
    const retry = window.setTimeout(() => applySpotlight(resolveAnchor()), 120);

    return () => {
      window.clearTimeout(retry);
      document.querySelectorAll(`.${SPOTLIGHT_CLASS}`).forEach((node) => {
        node.classList.remove(SPOTLIGHT_CLASS);
      });
    };
  }, [active, step.anchor, stepIndex]);

  if (!active) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= stepCount - 1;

  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      className="sk-onboarding-tour"
      placement={placement}
      sx={{ zIndex: 1500 }}
      modifiers={POPPER_MODIFIERS}
    >
      <TourCard
        placement={placement}
        title={step.title}
        body={step.body}
        stepIndex={stepIndex}
        stepCount={stepCount}
        isFirst={isFirst}
        isLast={isLast}
        onSkip={skip}
        onBack={back}
        onNext={next}
      />
    </Popper>
  );
}
