import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineEntry } from '../../domain/gameEvents';
import { getVirtualWindow } from '../../domain/virtualList';

const ROW_HEIGHT = 32;

export function InsertMarker({ label }: { label?: string }) {
  return (
    <Box
      className="sk-timeline-insert"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 1,
        px: 1,
        height: ROW_HEIGHT,
        color: 'grey.300',
        borderBottom: '1px solid',
        borderColor: 'grey.800',
      }}
    >
      <Box sx={{ flex: 1, height: 2, bgcolor: 'grey.600' }} />
      <AddIcon fontSize="small" />
      {label ? (
        <Typography variant="caption" color="grey.400">
          {label}
        </Typography>
      ) : null}
      <Box sx={{ flex: 1, height: 2, bgcolor: 'grey.600' }} />
    </Box>
  );
}

type FlatItem =
  | { kind: 'insert-end' }
  | { kind: 'title'; entry: TimelineEntry }
  | { kind: 'line'; entry: TimelineEntry; lineIndex: number }
  | { kind: 'insert-after'; entryId: string };

function flattenTimeline(
  entries: TimelineEntry[],
  showEndInsertMarker: boolean,
  insertBeforeEventId: string | null,
): FlatItem[] {
  const items: FlatItem[] = [];
  if (showEndInsertMarker) items.push({ kind: 'insert-end' });
  for (const entry of entries) {
    items.push({ kind: 'title', entry });
    entry.lines.forEach((_, lineIndex) => items.push({ kind: 'line', entry, lineIndex }));
    if (insertBeforeEventId === entry.id) items.push({ kind: 'insert-after', entryId: entry.id });
  }
  return items;
}

export function GameEventsTimeline({
  entries,
  selectedEventId,
  insertBeforeEventId,
  showEndInsertMarker,
  onSelectEvent,
  onDeselectEvent,
}: {
  entries: TimelineEntry[];
  selectedEventId: string | null;
  insertBeforeEventId: string | null;
  showEndInsertMarker: boolean;
  onSelectEvent: (eventId: string) => void;
  onDeselectEvent: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const flatItems = useMemo(
    () => flattenTimeline(entries, showEndInsertMarker, insertBeforeEventId),
    [entries, showEndInsertMarker, insertBeforeEventId],
  );

  const { startIndex, endIndex, offsetY } = getVirtualWindow({
    scrollTop,
    viewportHeight,
    itemHeight: ROW_HEIGHT,
    itemCount: flatItems.length,
    overscan: 4,
  });

  const visibleItems = flatItems.slice(startIndex, endIndex + 1);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setViewportHeight(element.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={scrollRef}
      className="sk-game-timeline"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      sx={{
        bgcolor: 'grey.900',
        color: 'grey.100',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        minWidth: 280,
      }}
    >
      <Box sx={{ height: flatItems.length * ROW_HEIGHT, position: 'relative' }}>
        <Box sx={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item) => {
            if (item.kind === 'insert-end') {
              return <InsertMarker key="insert-end" label="Next event" />;
            }
            if (item.kind === 'insert-after') {
              return <InsertMarker key={`insert-${item.entryId}`} />;
            }
            if (item.kind === 'title') {
              return (
                <Button
                  key={`${item.entry.id}-title`}
                  fullWidth
                  onClick={() =>
                    selectedEventId === item.entry.id
                      ? onDeselectEvent()
                      : onSelectEvent(item.entry.id)
                  }
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    borderRadius: 0,
                    minHeight: ROW_HEIGHT,
                    px: 1.5,
                    bgcolor: selectedEventId === item.entry.id ? 'secondary.main' : 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: selectedEventId === item.entry.id ? 'secondary.dark' : 'primary.dark',
                    },
                  }}
                >
                  {item.entry.title}
                </Button>
              );
            }
            const line = item.entry.lines[item.lineIndex];
            return (
              <Typography
                key={`${item.entry.id}-line-${item.lineIndex}`}
                variant="body2"
                sx={{
                  height: ROW_HEIGHT,
                  lineHeight: `${ROW_HEIGHT}px`,
                  pl: line.kind === 'thrower' ? 1.5 : 4.5,
                  bgcolor: selectedEventId === item.entry.id ? 'secondary.light' : 'transparent',
                  opacity: 0.95,
                }}
              >
                {line.text}
                {line.resultLabel ? ` — ${line.resultLabel}` : ''}
              </Typography>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
