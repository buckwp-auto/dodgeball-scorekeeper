import { Box } from '@mui/material';
import {
  YoutubePlayer,
  YoutubePopoutBar,
} from './trackGame/YoutubePlayer';
import { useYoutubeControls } from '../hooks/useYoutubeControls';

/** Tall match VOD on roster screens so you can see who is playing vs subbing. */
export function RosterYoutubePlayer({ youtubeUrl }: { youtubeUrl: string }) {
  const {
    hasYoutube,
    mode,
    playerRef,
    setModeAndPersist,
    cueSeconds,
    popOut,
    dockBack,
    popoutPlayback,
  } = useYoutubeControls(youtubeUrl, { enableLayoutHotkeys: false });

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
          startSeconds={cueSeconds}
          onPopOut={popOut}
          popoutBlocked={popoutPlayback.blocked}
          showTrackGameHints={false}
          allowLayoutToggle={false}
        />
      )}
    </Box>
  );
}
