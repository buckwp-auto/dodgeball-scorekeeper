import {
  Box,
  Button,
  Paper,
  Popper,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { onboardingAnchorSelector } from '../../domain/onboarding';
import { useOnboarding } from '../../state/OnboardingContext';

const SPOTLIGHT_CLASS = 'sk-onboarding-spotlight';

export function OnboardingTour() {
  const { active, step, stepIndex, stepCount, next, back, skip } = useOnboarding();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

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
      placement="right"
      sx={{ zIndex: 1500 }}
      modifiers={[
        {
          name: 'offset',
          options: { offset: [0, 12] },
        },
      ]}
    >
      <Paper elevation={8} sx={{ p: 2, maxWidth: 320 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
              {step.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {step.body}
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
            <Button size="small" onClick={skip} sx={{ mr: 'auto' }}>
              Skip tour
            </Button>
            {!isFirst ? (
              <Button size="small" onClick={back}>
                Back
              </Button>
            ) : null}
            <Button size="small" variant="contained" onClick={next}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Popper>
  );
}
