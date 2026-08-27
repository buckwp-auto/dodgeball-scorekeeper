import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Chip, IconButton, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import type { MatchListSpoiler } from '../domain/matchListSpoiler';
import {
  loadRevealedMatchScoreIds,
  saveRevealedMatchScoreIds,
} from '../domain/matchListSpoiler';

function persistReveal(matchId: string, revealed: boolean) {
  const ids = loadRevealedMatchScoreIds();
  if (revealed) ids.add(matchId);
  else ids.delete(matchId);
  saveRevealedMatchScoreIds(ids);
}

export function MatchScoreSpoiler({
  matchName,
  spoiler,
}: {
  matchName: string;
  spoiler: MatchListSpoiler;
}) {
  const [revealed, setRevealed] = useState(() =>
    loadRevealedMatchScoreIds().has(spoiler.matchId),
  );

  const onToggle = () => {
    setRevealed((prev) => {
      const next = !prev;
      persistReveal(spoiler.matchId, next);
      return next;
    });
  };

  const clock =
    spoiler.progress === 'inProgress' && spoiler.gameClockText
      ? `${spoiler.activeGameLabel ?? 'Game'} · ${spoiler.gameClockText}`
      : null;

  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
      className="sk-match-spoiler"
    >
      <Chip
        size="small"
        className="sk-match-progress"
        variant={spoiler.progress === 'finished' ? 'filled' : 'outlined'}
        color={spoiler.progress === 'inProgress' ? 'primary' : 'default'}
        label={spoiler.progressLabel}
      />
      <IconButton
        size="small"
        className="sk-match-score-toggle"
        aria-label={
          revealed ? `Hide score for ${matchName}` : `Show score for ${matchName}`
        }
        aria-pressed={revealed}
        onClick={onToggle}
      >
        {revealed ? (
          <VisibilityIcon fontSize="small" />
        ) : (
          <VisibilityOffIcon fontSize="small" />
        )}
      </IconButton>
      {revealed ? (
        <Typography
          variant="body2"
          color="text.secondary"
          className="sk-match-list-score"
          sx={{ ml: 0.5 }}
        >
          {spoiler.scoreText}
          {clock ? (
            <span className="sk-match-game-clock">{` · ${clock}`}</span>
          ) : null}
        </Typography>
      ) : null}
    </Stack>
  );
}
