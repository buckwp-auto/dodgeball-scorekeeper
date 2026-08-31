import {
  Box,
  Button,
  Paper,
  Popper,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { TourPlacement } from '../../domain/gameTrackingTour';
import { hotkeyForTrackGameTab, hotkeysForTrackGameAction } from '../../domain/hotkeys';
import {
  computeTourArrowOffset,
  pickTourSide,
  tourSideArrowClass,
  tourSideToPopperPlacement,
  type TourCardSide,
} from '../../domain/tourPlacement';
import {
  isTourBodyArray,
  type TourBodySegment,
  type TourStepBody,
} from '../../domain/tourContent';
import { HotkeyBadge } from '../HotkeyBadge';

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
  body: TourStepBody;
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

function hotkeysForSegment(segment: TourBodySegment): string[] {
  if (typeof segment === 'string') return [];
  if ('key' in segment) return [segment.key];
  if ('tab' in segment) return [hotkeyForTrackGameTab(segment.tab)];
  return hotkeysForTrackGameAction(segment.action);
}

function TourStepBody({ body }: { body: TourStepBody }) {
  if (!isTourBodyArray(body)) {
    return (
      <Typography variant="body2" color="text.secondary">
        {body}
      </Typography>
    );
  }

  return (
    <Typography
      variant="body2"
      color="text.secondary"
      component="div"
      sx={{ '& .sk-tour-hotkey': { display: 'inline-flex', verticalAlign: 'middle', mx: 0.5 } }}
    >
      {body.map((segment, index) => {
        if (typeof segment === 'string') {
          return <span key={index}>{segment}</span>;
        }
        if ('key' in segment) {
          return (
            <Box key={index} component="span" className="sk-tour-hotkey">
              <HotkeyBadge hotkey={segment.key} label={segment.label} />
            </Box>
          );
        }
        const keys = hotkeysForSegment(segment);
        return (
          <Box key={index} component="span" className="sk-tour-hotkey">
            {keys.map((key, keyIndex) => (
              <Box key={key} component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                {keyIndex > 0 ? (
                  <Box component="span" sx={{ mx: 0.25, color: 'text.secondary' }}>
                    /
                  </Box>
                ) : null}
                <HotkeyBadge hotkey={key} />
              </Box>
            ))}
          </Box>
        );
      })}
    </Typography>
  );
}

function TourCard({
  cardRef,
  side,
  arrowOffset,
  interactive,
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
  cardRef?: Ref<HTMLDivElement>;
  side: TourCardSide | null;
  arrowOffset: string;
  interactive?: boolean;
  title: string;
  body: TourStepBody;
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
  const arrowClass = side ? tourSideArrowClass(side) : null;
  const classNames = [
    'sk-onboarding-tour-card',
    arrowClass,
    interactive ? 'sk-onboarding-tour-card--interactive' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Box
      ref={cardRef}
      className={classNames}
      style={{ '--tour-arrow-offset': arrowOffset } as React.CSSProperties & Record<string, string>}
    >
      <Paper elevation={8} sx={{ p: 2, maxWidth: 320 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
              {title}
            </Typography>
            <TourStepBody body={body} />
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [missingAnchor, setMissingAnchor] = useState(false);
  const [resolvedSide, setResolvedSide] = useState<TourCardSide>('right');
  const [arrowOffset, setArrowOffset] = useState('28px');

  const popperPlacement = tourSideToPopperPlacement(resolvedSide);
  const interactive = Boolean(layoutInteractiveClass);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    if (!active || busy || !canAdvance) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') {
        return;
      }
      if (target?.isContentEditable) return;
      event.preventDefault();
      event.stopPropagation();
      onNextRef.current();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active, busy, canAdvance]);

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
        setResolvedSide(pickTourSide(element.getBoundingClientRect(), step.placement));
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
  }, [active, anchorSelector, step.placement, stepIndex]);

  useLayoutEffect(() => {
    if (!anchorEl || missingAnchor) return undefined;

    const refresh = () => {
      const anchorRect = anchorEl.getBoundingClientRect();
      const side = pickTourSide(anchorRect, step.placement);
      setResolvedSide(side);
      if (cardRef.current) {
        setArrowOffset(computeTourArrowOffset(side, anchorRect, cardRef.current.getBoundingClientRect()));
      }
    };

    refresh();
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [anchorEl, missingAnchor, step.placement, stepIndex]);

  if (!active) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= stepCount - 1;

  const card = (
    <TourCard
      cardRef={cardRef}
      side={missingAnchor ? null : resolvedSide}
      arrowOffset={arrowOffset}
      interactive={interactive}
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
      placement={popperPlacement}
      sx={{ zIndex: 1500 }}
      modifiers={POPPER_MODIFIERS}
    >
      {card}
    </Popper>
  );
}
