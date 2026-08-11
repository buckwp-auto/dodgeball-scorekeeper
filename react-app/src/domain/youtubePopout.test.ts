import { describe, expect, it, vi } from 'vitest';
import {
  YOUTUBE_FRAME_SECONDS,
  type YoutubePlayerHandle,
} from './youtube';
import {
  applyYoutubePopoutCommand,
  buildYoutubePopoutHref,
  createRemoteYoutubePlayerHandle,
  envelopeYoutubePopoutMessage,
  isYoutubePopoutControllerMessage,
  isYoutubePopoutHostMessage,
  matchIdFromPath,
  parseYoutubePopoutSearch,
  shouldAutoSeekPopoutForGame,
  attachedGameIdAfterPopoutOpen,
  YOUTUBE_POPOUT_MESSAGE_KIND,
  youtubePopoutChannelName,
  youtubePopoutSeekSettled,
  type YoutubePopoutSnapshot,
} from './youtubePopout';

describe('youtube popout URL + channel', () => {
  it('names a channel per session', () => {
    expect(youtubePopoutChannelName('abc')).toBe('scorekeeper-yt-popout:abc');
  });

  it('extracts match id from router paths', () => {
    expect(matchIdFromPath('/matches/m1')).toBe('m1');
    expect(matchIdFromPath('/matches/m1/games/g1/events')).toBe('m1');
    expect(matchIdFromPath('/stats')).toBeNull();
    expect(matchIdFromPath('/')).toBeNull();
  });

  it('treats seeks as settled within tolerance', () => {
    expect(youtubePopoutSeekSettled(40, 40)).toBe(true);
    expect(youtubePopoutSeekSettled(40.5, 40)).toBe(true);
    expect(youtubePopoutSeekSettled(42, 40)).toBe(false);
  });

  it('preserves attached game when popping out on the same match video', () => {
    expect(
      attachedGameIdAfterPopoutOpen({
        previousBoundMatchId: null,
        previousBoundVideoId: null,
        previousAttachedGameId: 'game-1',
        matchId: 'match-1',
        videoId: 'dQw4w9WgXcQ',
      }),
    ).toBe('game-1');
    expect(
      shouldAutoSeekPopoutForGame({
        attachedGameId: 'game-1',
        gameId: 'game-1',
        seekTargetSeconds: 95,
      }),
    ).toBe(false);
  });

  it('clears attach and seeks when opening a different game under an active pop-out', () => {
    expect(
      attachedGameIdAfterPopoutOpen({
        previousBoundMatchId: 'match-1',
        previousBoundVideoId: 'dQw4w9WgXcQ',
        previousAttachedGameId: 'game-1',
        matchId: 'match-1',
        videoId: 'dQw4w9WgXcQ',
      }),
    ).toBe('game-1');
    expect(
      shouldAutoSeekPopoutForGame({
        attachedGameId: 'game-1',
        gameId: 'game-2',
        seekTargetSeconds: 279,
      }),
    ).toBe(true);
    expect(
      shouldAutoSeekPopoutForGame({
        attachedGameId: 'game-1',
        gameId: 'game-2',
        seekTargetSeconds: null,
      }),
    ).toBe(false);
  });

  it('resets attach when the pop-out switches match or video', () => {
    expect(
      attachedGameIdAfterPopoutOpen({
        previousBoundMatchId: 'match-1',
        previousBoundVideoId: 'aaaaaaaaaaa',
        previousAttachedGameId: 'game-1',
        matchId: 'match-1',
        videoId: 'bbbbbbbbbbb',
      }),
    ).toBeNull();
  });

  it('builds and parses popout href query params', () => {
    const href = buildYoutubePopoutHref({
      videoId: 'dQw4w9WgXcQ',
      startSeconds: 61.5,
      sessionId: 'sess-1',
      origin: 'https://example.test',
      base: '/dodgeball-score/',
    });
    expect(href).toBe(
      'https://example.test/dodgeball-score/youtube-popout?v=dQw4w9WgXcQ&t=61.5&sid=sess-1',
    );
    const parsed = parseYoutubePopoutSearch(new URL(href).search);
    expect(parsed).toEqual({
      videoId: 'dQw4w9WgXcQ',
      startSeconds: 61.5,
      sessionId: 'sess-1',
    });
  });

  it('rejects invalid popout search', () => {
    expect(parseYoutubePopoutSearch('v=nope&sid=x')).toBeNull();
    expect(parseYoutubePopoutSearch('v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYoutubePopoutSearch('')).toBeNull();
  });

  it('defaults missing or invalid t to 0', () => {
    expect(
      parseYoutubePopoutSearch('v=dQw4w9WgXcQ&sid=s1'),
    ).toMatchObject({ startSeconds: 0 });
    expect(
      parseYoutubePopoutSearch('v=dQw4w9WgXcQ&sid=s1&t=-4'),
    ).toMatchObject({ startSeconds: 0 });
  });
});

describe('youtube popout messages', () => {
  it('accepts controller and host envelopes', () => {
    expect(
      isYoutubePopoutControllerMessage(
        envelopeYoutubePopoutMessage({ type: 'shutdown' }),
      ),
    ).toBe(true);
    expect(
      isYoutubePopoutControllerMessage(
        envelopeYoutubePopoutMessage({
          type: 'command',
          op: 'seekTo',
          seconds: 12,
        }),
      ),
    ).toBe(true);
    expect(
      isYoutubePopoutHostMessage(
        envelopeYoutubePopoutMessage({
          type: 'state',
          currentTime: 3,
          playing: true,
        }),
      ),
    ).toBe(true);
    expect(
      isYoutubePopoutHostMessage(
        envelopeYoutubePopoutMessage({
          type: 'keydown',
          key: ' ',
          code: 'Space',
          repeat: false,
          shiftKey: false,
        }),
      ),
    ).toBe(true);
  });

  it('rejects garbage', () => {
    expect(isYoutubePopoutControllerMessage({ type: 'shutdown' })).toBe(false);
    expect(
      isYoutubePopoutHostMessage({
        kind: YOUTUBE_POPOUT_MESSAGE_KIND,
        type: 'state',
        currentTime: 'nope',
        playing: true,
      }),
    ).toBe(false);
  });
});

describe('applyYoutubePopoutCommand', () => {
  it('drives the local player handle', () => {
    const player: YoutubePlayerHandle = {
      getCurrentTime: () => 10,
      seekTo: vi.fn(),
      seekBy: vi.fn(),
      togglePlayPause: vi.fn(),
      stepFrame: vi.fn(),
      isPaused: () => true,
    };
    applyYoutubePopoutCommand(player, { type: 'command', op: 'togglePlayPause' });
    applyYoutubePopoutCommand(player, {
      type: 'command',
      op: 'seekTo',
      seconds: 40,
    });
    applyYoutubePopoutCommand(player, {
      type: 'command',
      op: 'seekBy',
      deltaSeconds: -5,
    });
    applyYoutubePopoutCommand(player, {
      type: 'command',
      op: 'stepFrame',
      direction: 1,
    });
    expect(player.togglePlayPause).toHaveBeenCalledOnce();
    expect(player.seekTo).toHaveBeenCalledWith(40);
    expect(player.seekBy).toHaveBeenCalledWith(-5);
    expect(player.stepFrame).toHaveBeenCalledWith(1);
  });
});

describe('createRemoteYoutubePlayerHandle', () => {
  it('posts commands and updates the snapshot optimistically', () => {
    const posted: unknown[] = [];
    const snapshot: YoutubePopoutSnapshot = {
      currentTime: 10,
      playing: false,
      ready: true,
    };
    const handle = createRemoteYoutubePlayerHandle({
      post: (message) => posted.push(message),
      getSnapshot: () => snapshot,
    });

    handle.seekBy(5);
    expect(snapshot.currentTime).toBe(15);
    handle.togglePlayPause();
    expect(snapshot.playing).toBe(true);
    handle.stepFrame(1);
    expect(snapshot.currentTime).toBe(15);
    handle.togglePlayPause();
    handle.stepFrame(1);
    expect(snapshot.currentTime).toBeCloseTo(15 + YOUTUBE_FRAME_SECONDS);

    expect(posted).toEqual([
      envelopeYoutubePopoutMessage({
        type: 'command',
        op: 'seekBy',
        deltaSeconds: 5,
      }),
      envelopeYoutubePopoutMessage({ type: 'command', op: 'togglePlayPause' }),
      envelopeYoutubePopoutMessage({ type: 'command', op: 'togglePlayPause' }),
      envelopeYoutubePopoutMessage({
        type: 'command',
        op: 'stepFrame',
        direction: 1,
      }),
    ]);
    expect(handle.getCurrentTime()).toBeCloseTo(15 + YOUTUBE_FRAME_SECONDS);
    expect(handle.isPaused()).toBe(true);
  });
});
