import {
  Box,
  Button,
  Paper,
  Popper,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { TourPlacement } from '../../domain/gameTrackingTour';

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

type GuidedTourStep = {
  title: string;
  body: string;
  placement?: TourPlacement;
};

type GuidedTourProps = {
  active: boolean;
  busy?: boolean;
  step: GuidedTourStep;
  stepIndex: number;
  stepCount: number;
  anchorSelector: string;
  layoutActiveClass: string;
  layoutInteractiveClass?: string;
  tourClassName: string;
  canAdvance?: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

function placementArrowClass(placement: TourPlacement): string | null {
  if (placement === 'bottom-start') return 'sk-onboarding-tour-card--below';
  if (placement === 'top-start') return 'sk-onboarding-tour-card--above';
  return null;
}

function TourCard({
  placement,
  title,
  body,
  stepIndex,
  stepCount,
  isFirst,
  isLast,
  busy,
  canAdvance = true,
  onSkip,
  onBack,
  onNext,
}: {
  placement: TourPlacement;
  title: string;
  body: string;
  stepIndex: number;
  stepCount: number;
  isFirst: boolean;
  isLast: boolean;
  busy?: boolean;
  canAdvance?: boolean;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const arrowClass = placementArrowClass(placement);

  return (
    <Box
      className={
        arrowClass ? `sk-onboarding-tour-card ${arrowClass}` : 'sk-onboarding-tour-card'
      }
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
            {!canAdvance && !busy ? ' — complete the step above to continue' : ''}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}
            useFlexGap
          >
            <Button size="small" onClick={onSkip} disabled={busy} sx={{ mr: 'auto' }}>
              Skip tour
            </Button>
            {!isFirst ? (
              <Button size="small" onClick={onBack} disabled={busy}>
                Back
              </Button>
            ) : null}
            <Button
              size="small"
              variant="contained"
              onClick={onNext}
              disabled={busy || !canAdvance}
            >
              {busy ? 'Loading…' : isLast ? 'Finish' : 'Next'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export function GuidedTour({
  active,
  busy = false,
  step,
  stepIndex,
  stepCount,
  anchorSelector,
  layoutActiveClass,
  layoutInteractiveClass,
  tourClassName,
  canAdvance = true,
  onNext,
  onBack,
  onSkip,
}: GuidedTourProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [missingAnchor, setMissingAnchor] = useState(false);
  const placement = step.placement ?? 'right';

  useEffect(() => {
    const layout = document.querySelector('.sk-layout');
    if (!layout) return undefined;
    if (active) {
      layout.classList.add(layoutActiveClass);
      if (layoutInteractiveClass) layout.classList.add(layoutInteractiveClass);
    } else {
      layout.classList.remove(layoutActiveClass);
      if (layoutInteractiveClass) layout.classList.remove(layoutInteractiveClass);
    }
    return () => {
      layout.classList.remove(layoutActiveClass);
      if (layoutInteractiveClass) layout.classList.remove(layoutInteractiveClass);
    };
  }, [active, layoutActiveClass, layoutInteractiveClass]);

  useEffect(() => {
    if (!active) {
      setAnchorEl(null);
      setMissingAnchor(false);
      document.querySelectorAll(`.${SPOTLIGHT_CLASS}`).forEach((node) => {
        node.classList.remove(SPOTLIGHT_CLASS);
      });
      return;
    }

    const resolveAnchor = () => document.querySelector<HTMLElement>(anchorSelector);

    const applySpotlight = (element: HTMLElement | null) => {
      document.querySelectorAll(`.${SPOTLIGHT_CLASS}`).forEach((node) => {
        node.classList.remove(SPOTLIGHT_CLASS);
      });
      if (element) {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        element.classList.add(SPOTLIGHT_CLASS);
        setAnchorEl(element);
        setMissingAnchor(false);
      } else {
        setAnchorEl(null);
        setMissingAnchor(true);
      }
    };

    applySpotlight(resolveAnchor());
    const retry = window.setTimeout(() => applySpotlight(resolveAnchor()), 120);
    const retryLate = window.setTimeout(() => applySpotlight(resolveAnchor()), 400);

    return () => {
      window.clearTimeout(retry);
      window.clearTimeout(retryLate);
      document.querySelectorAll(`.${SPOTLIGHT_CLASS}`).forEach((node) => {
        node.classList.remove(SPOTLIGHT_CLASS);
      });
    };
  }, [active, anchorSelector, stepIndex]);

  if (!active) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= stepCount - 1;

  const card = (
    <TourCard
      placement={placement}
      title={step.title}
      body={step.body}
      stepIndex={stepIndex}
      stepCount={stepCount}
      isFirst={isFirst}
      isLast={isLast}
      busy={busy}
      canAdvance={canAdvance}
      onSkip={onSkip}
      onBack={onBack}
      onNext={onNext}
    />
  );

  if (missingAnchor || !anchorEl) {
    return (
      <Box
        className={tourClassName}
        sx={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1500,
          maxWidth: 'calc(100vw - 24px)',
        }}
      >
        {card}
      </Box>
    );
  }

  return (
    <Popper
      open={!busy}
      anchorEl={anchorEl}
      className={tourClassName}
      placement={placement}
      sx={{ zIndex: 1500 }}
      modifiers={POPPER_MODIFIERS}
    >
      {card}
    </Popper>
  );
}
