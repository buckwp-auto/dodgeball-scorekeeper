import { useEffect } from 'react';

export function useDocumentHotkeys(
  handler: (key: string, event: KeyboardEvent) => void,
  enabled = true,
  options?: { capture?: boolean },
) {
  const capture = options?.capture ?? false;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (target?.isContentEditable) return;
      handler(event.key, event);
    };
    window.addEventListener('keydown', onKeyDown, capture);
    return () => window.removeEventListener('keydown', onKeyDown, capture);
  }, [handler, enabled, capture]);
}
