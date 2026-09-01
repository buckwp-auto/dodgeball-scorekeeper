import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  clampTrackGameTallPanelWidth,
  loadTrackGameTallPanelWidth,
  saveTrackGameTallPanelWidth,
} from '../domain/trackGameTallPanel';

export function useTrackGameTallPanelWidth(active: boolean) {
  const [panelWidth, setPanelWidth] = useState(loadTrackGameTallPanelWidth);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  useEffect(() => {
    if (!active) return;
    const onResize = () => {
      setPanelWidth((current) => clampTrackGameTallPanelWidth(current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active]);

  const onResizePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidthRef.current;

    const onMove = (moveEvent: PointerEvent) => {
      const next = clampTrackGameTallPanelWidth(startWidth + (moveEvent.clientX - startX));
      panelWidthRef.current = next;
      setPanelWidth(next);
    };

    const onUp = () => {
      saveTrackGameTallPanelWidth(panelWidthRef.current);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, []);

  return { panelWidth, onResizePointerDown };
}
