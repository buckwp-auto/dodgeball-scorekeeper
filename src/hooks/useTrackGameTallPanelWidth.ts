import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  clampTrackGameTallPanelWidth,
  loadTrackGameTallPanelWidth,
  saveTrackGameTallPanelWidth,
} from '../domain/trackGameTallPanel';

const WIDTH_VAR = '--sk-tall-panel-width';
/** Lets CSS punch through the YouTube iframe so drag keeps receiving events. */
const RESIZING_CLASS = 'sk-track-game--panel-resizing';

function applyPanelWidth(el: HTMLElement | null, width: number) {
  el?.style.setProperty(WIDTH_VAR, `${width}px`);
}

/**
 * Tall-view scoring column width. During a drag, mutates a CSS variable on the
 * grid container so Track Game does not re-render on every pointermove.
 *
 * Cross-origin YouTube iframes steal pointer events when the cursor crosses
 * them, so we also setPointerCapture and disable iframe hit-testing mid-drag.
 */
export function useTrackGameTallPanelWidth(active: boolean): {
  panelWidth: number;
  containerRef: RefObject<HTMLDivElement | null>;
  onResizePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
} {
  const [panelWidth, setPanelWidth] = useState(loadTrackGameTallPanelWidth);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    applyPanelWidth(containerRef.current, panelWidth);
  }, [panelWidth]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => {
      const next = clampTrackGameTallPanelWidth(panelWidthRef.current);
      panelWidthRef.current = next;
      applyPanelWidth(containerRef.current, next);
      setPanelWidth(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active]);

  const onResizePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    draggingRef.current = true;
    const startX = event.clientX;
    const startWidth = panelWidthRef.current;

    containerRef.current?.classList.add(RESIZING_CLASS);
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      /* capture unsupported — iframe pointer-events:none still covers us */
    }

    const onMove = (moveEvent: PointerEvent) => {
      const next = clampTrackGameTallPanelWidth(startWidth + (moveEvent.clientX - startX));
      if (next === panelWidthRef.current) return;
      panelWidthRef.current = next;
      // Direct DOM write — avoid re-rendering YoutubePlayer / editors mid-drag
      applyPanelWidth(containerRef.current, next);
    };

    const onUp = (upEvent: PointerEvent) => {
      draggingRef.current = false;
      containerRef.current?.classList.remove(RESIZING_CLASS);
      try {
        if (handle.hasPointerCapture(upEvent.pointerId)) {
          handle.releasePointerCapture(upEvent.pointerId);
        }
      } catch {
        /* ignore */
      }
      const committed = panelWidthRef.current;
      setPanelWidth(committed);
      saveTrackGameTallPanelWidth(committed);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // Listen on the handle (with capture) so moves over the iframe still reach us
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }, []);

  return { panelWidth, containerRef, onResizePointerDown };
}
