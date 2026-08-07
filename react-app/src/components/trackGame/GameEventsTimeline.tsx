import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Typography } from '@mui/material';
import { useMemo, type ReactNode } from 'react';
import type {
  TimelineAction,
  TimelineEntry,
  TimelinePlayerRef,
  TimelineRow,
  TimelineSegment,
} from '../../domain/gameEvents';
import { formatVideoTime } from '../../domain/youtube';
import { rowBackgroundForTone } from '../../domain/timelineColors';
import { getTimelineActionIcon } from '../../domain/throwResultIcons';
import { PlayerPill } from './PlayerPill';
import { VideoTimestampEditor } from './VideoTimestampEditor';

const ROW_MIN_HEIGHT = 36;

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
        minHeight: ROW_MIN_HEIGHT,
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

function ActionBadges({ actions }: { actions: TimelineAction[] }) {
  if (actions.length === 0) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.35,
        flexShrink: 0,
        pt: 0.15,
      }}
    >
      {actions.map((action, index) => {
        const Icon = getTimelineActionIcon(action);
        return (
          <Box
            key={`${action.kind}-${index}`}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.12)',
              color: 'grey.100',
            }}
          >
            <Icon sx={{ fontSize: 16 }} />
          </Box>
        );
      })}
    </Box>
  );
}

function renderSegments(segments: TimelineSegment[]): ReactNode[] {
  return segments.map((segment, index) => {
    if (segment.kind === 'player') {
      const player: TimelinePlayerRef = segment.player;
      return (
        <PlayerPill
          key={`p-${index}-${player.gamePlayerId}`}
          name={player.playerName}
          teamHome={player.teamHome}
          playerId={player.playerId}
          surface="dark"
        />
      );
    }
    return (
      <Box component="span" key={`t-${index}`}>
        {segment.text}
      </Box>
    );
  });
}

type FlatItem =
  | { kind: 'insert-end' }
  | { kind: 'row'; entry: TimelineEntry; rowIndex: number }
  | { kind: 'insert-after'; entryId: string };

function flattenTimeline(
  entries: TimelineEntry[],
  showEndInsertMarker: boolean,
  insertBeforeEventId: string | null,
): FlatItem[] {
  const items: FlatItem[] = [];
  if (showEndInsertMarker) items.push({ kind: 'insert-end' });
  for (const entry of entries) {
    entry.rows.forEach((_, rowIndex) => items.push({ kind: 'row', entry, rowIndex }));
    if (insertBeforeEventId === entry.id) items.push({ kind: 'insert-after', entryId: entry.id });
  }
  return items;
}

function TimelineEventRow({
  row,
  selected,
  videoTimeLabel,
  editingTimestamp,
  videoOffsetSeconds,
  canSetFromPlayer,
  onClick,
  onCommitOffset,
  onSetFromPlayer,
}: {
  row: TimelineRow;
  selected: boolean;
  videoTimeLabel?: string;
  editingTimestamp?: boolean;
  videoOffsetSeconds?: number | null;
  canSetFromPlayer?: boolean;
  onClick: () => void;
  onCommitOffset?: (seconds: number | null) => void;
  onSetFromPlayer?: () => void;
}) {
  return (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: 'grey.800',
        bgcolor: rowBackgroundForTone(row.tone, selected),
        outline: selected ? '1px solid' : 'none',
        outlineColor: 'secondary.light',
        outlineOffset: -1,
      }}
    >
      <Button
        fullWidth
        onClick={onClick}
        sx={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          textAlign: 'left',
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 0,
          minHeight: ROW_MIN_HEIGHT,
          height: 'auto',
          py: 0.75,
          px: 1,
          pl: row.role === 'deflection' ? 2.5 : 1,
          gap: 1,
          color: 'grey.100',
          bgcolor: 'transparent',
          whiteSpace: 'normal',
          '&:hover': {
            bgcolor: rowBackgroundForTone(row.tone, true),
          },
        }}
      >
        <ActionBadges actions={row.actions} />
        <Box
          sx={{
            display: 'block',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            fontSize: '0.85rem',
            lineHeight: 1.45,
            minWidth: 0,
            flex: 1,
          }}
        >
          {videoTimeLabel && row.role !== 'deflection' && !editingTimestamp ? (
            <Typography
              component="span"
              variant="caption"
              sx={{
                display: 'inline-block',
                mr: 0.75,
                px: 0.5,
                py: 0.1,
                borderRadius: 0.5,
                bgcolor: 'rgba(255,255,255,0.12)',
                fontVariantNumeric: 'tabular-nums',
                color: 'grey.300',
              }}
            >
              {videoTimeLabel}
            </Typography>
          ) : null}
          {!videoTimeLabel && row.role !== 'deflection' && !editingTimestamp ? (
            <Typography
              component="span"
              variant="caption"
              sx={{
                display: 'inline-block',
                mr: 0.75,
                px: 0.5,
                py: 0.1,
                borderRadius: 0.5,
                bgcolor: 'rgba(255,255,255,0.06)',
                color: 'grey.500',
              }}
            >
              —:—
            </Typography>
          ) : null}
          {renderSegments(row.segments)}
        </Box>
      </Button>
      {editingTimestamp && onCommitOffset ? (
        <Box
          sx={{ px: 1, pb: 1, pl: row.role === 'deflection' ? 2.5 : 1 }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <VideoTimestampEditor
            dense
            valueSeconds={videoOffsetSeconds}
            onCommit={onCommitOffset}
            onSetFromPlayer={onSetFromPlayer}
            canSetFromPlayer={canSetFromPlayer}
          />
        </Box>
      ) : null}
    </Box>
  );
}

export function GameEventsTimeline({
  entries,
  selectedEventId,
  insertBeforeEventId,
  showEndInsertMarker,
  canSetFromPlayer,
  onSelectEvent,
  onDeselectEvent,
  onCommitVideoOffset,
  onSetVideoOffsetFromPlayer,
}: {
  entries: TimelineEntry[];
  selectedEventId: string | null;
  insertBeforeEventId: string | null;
  showEndInsertMarker: boolean;
  canSetFromPlayer?: boolean;
  onSelectEvent: (eventId: string) => void;
  onDeselectEvent: () => void;
  onCommitVideoOffset: (eventId: string, seconds: number | null) => void;
  onSetVideoOffsetFromPlayer?: (eventId: string) => void;
}) {
  const flatItems = useMemo(
    () => flattenTimeline(entries, showEndInsertMarker, insertBeforeEventId),
    [entries, showEndInsertMarker, insertBeforeEventId],
  );

  return (
    <Box
      className="sk-game-timeline"
      sx={{
        bgcolor: 'grey.900',
        color: 'grey.100',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        minWidth: 280,
        alignSelf: 'stretch',
      }}
    >
      {flatItems.map((item) => {
        if (item.kind === 'insert-end') {
          return <InsertMarker key="insert-end" label="Next event" />;
        }
        if (item.kind === 'insert-after') {
          return <InsertMarker key={`insert-${item.entryId}`} />;
        }
        const row = item.entry.rows[item.rowIndex];
        const selected = selectedEventId === item.entry.id;
        const videoTimeLabel =
          item.rowIndex === 0
            ? formatVideoTime(item.entry.videoOffsetSeconds ?? null) || undefined
            : undefined;
        return (
          <TimelineEventRow
            key={`${item.entry.id}-row-${item.rowIndex}`}
            row={row}
            selected={selected}
            videoTimeLabel={videoTimeLabel}
            editingTimestamp={selected && item.rowIndex === 0}
            videoOffsetSeconds={item.entry.videoOffsetSeconds}
            canSetFromPlayer={canSetFromPlayer}
            onClick={() =>
              selected ? onDeselectEvent() : onSelectEvent(item.entry.id)
            }
            onCommitOffset={(seconds) => onCommitVideoOffset(item.entry.id, seconds)}
            onSetFromPlayer={
              onSetVideoOffsetFromPlayer
                ? () => onSetVideoOffsetFromPlayer(item.entry.id)
                : undefined
            }
          />
        );
      })}
    </Box>
  );
}
