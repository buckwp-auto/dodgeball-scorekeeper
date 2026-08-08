import { Alert, Box } from '@mui/material';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import {
  YoutubePlayer,
  type YoutubePlayerHandle,
} from '../components/trackGame/YoutubePlayer';
import { parseYoutubePopoutSearch } from '../domain/youtubePopout';
import { useYoutubePopoutHost } from '../hooks/useYoutubePopout';

export function YoutubePopoutPage() {
  const [params] = useSearchParams();
  const parsed = parseYoutubePopoutSearch(params.toString());
  const playerRef = useRef<YoutubePlayerHandle | null>(null);
  const { requestClose } = useYoutubePopoutHost({
    sessionId: parsed?.sessionId ?? '',
    playerRef,
    enabled: Boolean(parsed),
  });

  useEffect(() => {
    document.title = 'Scorekeeper video';
  }, []);

  if (!parsed) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        This pop-out isn’t connected. Return to Track Game and pop out again.
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100vh', bgcolor: 'grey.900', overflow: 'hidden' }}>
      <YoutubePlayer
        ref={playerRef}
        youtubeUrl={`https://www.youtube.com/watch?v=${parsed.videoId}`}
        mode="tall"
        variant="popoutWindow"
        onModeChange={() => {}}
        onDockBack={requestClose}
        startSeconds={parsed.startSeconds}
      />
    </Box>
  );
}
