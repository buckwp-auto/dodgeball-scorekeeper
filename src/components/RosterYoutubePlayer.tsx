import { Box } from '@mui/material';
import { useEffect, useMemo } from 'react';
import { inPageOpenSeekSeconds } from '../domain/gameEvents';
import { shouldAutoSeekPopoutForGame } from '../domain/youtubePopout';
import { useYoutubeControls } from '../hooks/useYoutubeControls';
import { useDatabase } from '../state/DatabaseContext';
import { useYoutubePopout } from '../state/YoutubePopoutContext';
import {
  YoutubePlayer,
  YoutubePopoutBar,
} from './trackGame/YoutubePlayer';

/** Tall match VOD on roster screens so you can see who is playing vs subbing. */
export function RosterYoutubePlayer({
  youtubeUrl,
  gameId,
}: {
  youtubeUrl: string;
  /** When set, cue from this game's stamps or the prior game's end. */
  gameId?: string;
}) {
  const { data } = useDatabase();
  const { attachedGameId, setAttachedGameId } = useYoutubePopout();
  const {
    hasYoutube,
    mode,
    playerRef,
    setModeAndPersist,
    cueSeconds,
    seekToVideoOffset,
    popOut,
    dockBack,
    popoutPlayback,
  } = useYoutubeControls(youtubeUrl, { enableLayoutHotkeys: false });

  const openSeekSeconds = useMemo(() => {
    return gameId ? inPageOpenSeekSeconds(data, gameId) : null;
    // Snapshot once per game open — later edits should not recreate the player
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    if (mode !== 'popout') {
      if (attachedGameId !== gameId) setAttachedGameId(gameId);
      return;
    }

    if (attachedGameId !== gameId) {
      const previousAttachedGameId = attachedGameId;
      setAttachedGameId(gameId);
      if (
        openSeekSeconds != null &&
        shouldAutoSeekPopoutForGame({
          attachedGameId: previousAttachedGameId,
          gameId,
          seekTargetSeconds: openSeekSeconds,
        })
      ) {
        seekToVideoOffset(openSeekSeconds);
      }
    }
  }, [
    attachedGameId,
    gameId,
    mode,
    openSeekSeconds,
    seekToVideoOffset,
    setAttachedGameId,
  ]);

  if (!hasYoutube) return null;

  const displayMode = mode === 'docked' ? 'tall' : mode;

  return (
    <Box
      className="sk-roster-youtube"
      sx={{
        mb: 2,
        minHeight: displayMode === 'hidden' ? undefined : { xs: 220, sm: 320, md: 420 },
        height: displayMode === 'hidden' ? 'auto' : { xs: 220, sm: 360, md: 'min(52vh, 520px)' },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      {mode === 'popout' ? (
        <YoutubePopoutBar
          ready={popoutPlayback.ready}
          playing={popoutPlayback.playing}
          displayTime={popoutPlayback.displayTime}
          seekingTo={popoutPlayback.seekingTo}
          blocked={popoutPlayback.blocked}
          handle={popoutPlayback.handle}
          onDockBack={() => dockBack('tall')}
          onModeChange={(next) => setModeAndPersist(next === 'docked' ? 'tall' : next)}
        />
      ) : (
        <YoutubePlayer
          ref={playerRef}
          youtubeUrl={youtubeUrl}
          mode={displayMode}
          onModeChange={(next) => setModeAndPersist(next === 'docked' ? 'tall' : next)}
          startSeconds={cueSeconds ?? openSeekSeconds ?? undefined}
          onPopOut={popOut}
          popoutBlocked={popoutPlayback.blocked}
          showTrackGameHints={false}
          allowLayoutToggle={false}
        />
      )}
    </Box>
  );
}
