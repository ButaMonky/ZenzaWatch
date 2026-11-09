/**
 * Canonical TypeScript source for packages/lib/src/infra/MediaSessionApi.js (Task726).
 * Media Session metadata/position for OS media controls; hardware media keys are
 * re-emitted as player commands through `onCommand`.
 */
type CommandListener = (command: string, ...args: unknown[]) => void;
/** The part of Emitter (packages/lib/src/Emitter.js) used here. */
declare const Emitter: new () => {
  emit(name: string, ...args: unknown[]): unknown;
  on(name: string, callback: CommandListener): unknown;
};

export interface MediaSessionMeta {
  title: string;
  artist: string;
  album: string;
  artwork?: MediaImage[] | null | undefined;
  duration: number;
}
/** Fields read from a VideoInfoModel. */
export interface MediaSessionVideoInfo {
  title: string;
  owner: {name: string};
  thumbnail: string;
  betterThumbnail?: string | null | undefined;
  largeThumbnail?: string | null | undefined;
  duration: number;
}
export interface MediaPositionLike {
  duration: number;
  playbackRate: number;
  currentTime: number;
}

const MediaSessionApi = (() => {
  const emitter = new Emitter();
  let activeSession: MediaSession | null = null;
  const registeredActions = new Set<string>();

  /**
   * MSA-POSITION-001 (Task781): Media Session expects `position`, and throws a
   * TypeError for a non-finite/negative duration, a position outside 0..duration
   * or a zero/invalid rate. Media keys and OS controls must never break playback
   * code (seek, play, rate change), so invalid states are skipped and the call is
   * best effort.
   */
  const setPosition = (nm: MediaSession, duration: number, playbackRate?: number, currentTime?: number) => {
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      return;
    }
    const state: MediaPositionState = {duration};
    if (playbackRate !== undefined) {
      state.playbackRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
    }
    if (currentTime !== undefined) {
      state.position = Number.isFinite(currentTime) ? Math.min(Math.max(currentTime, 0), duration) : 0;
    }
    try {
      nm.setPositionState(state);
    } catch (e) {
      // best effort: the OS position display is optional
    }
  };

  const update = (
    {title, artist, album, artwork, duration}: MediaSessionMeta = {title: '', artist: '', album: '', artwork: [], duration: 1}) => {
    if (!('mediaSession' in navigator)) {
      return;
    }
    const nm = navigator.mediaSession;
    if (!nm) { return; }
    // Metadata/individual media-key handlers are optional OS integrations,
    // and must not prevent the VideoSessionWorker from starting playback.
    try {
      nm.metadata = new self.MediaMetadata({
        title,
        artist,
        album,
        artwork: (artwork || []).filter(image => typeof image?.src === 'string' && image.src.trim())
      });
    } catch (_) { /* MediaMetadata may be unavailable even if mediaSession exists. */ }

    if ('setPositionState' in nm) {
      setPosition(nm, duration);
    }
    // A new MediaSession object must not inherit the old object's registrations.
    if (activeSession !== nm) {
      activeSession = nm;
      registeredActions.clear();
    }
    const register = (action: Parameters<MediaSession['setActionHandler']>[0],
      handler: Parameters<MediaSession['setActionHandler']>[1]) => {
      if (registeredActions.has(action)) { return; }
      try {
        nm.setActionHandler(action, handler);
        registeredActions.add(action);
      } catch (_) {
        // Unsupported actions or transient permission errors are non-fatal.
        // A later update may retry only this missing handler.
      }
    };
    register('play',          () => emitter.emit('command', 'play'));
    register('pause',         () => emitter.emit('command', 'pause'));
    register('seekbackward',  () => emitter.emit('command', 'seekBy', -5));
    register('seekforward',   () => emitter.emit('command', 'seekBy', +5));
    register('previoustrack', () => emitter.emit('command', 'playPreviousVideo'));
    register('nexttrack',     () => emitter.emit('command', 'playNextVideo'));
    register('stop',          () => emitter.emit('command', 'close'));
    register('seekto',        e => {
      emitter.emit('command', 'seekTo', e.seekTime);
    });
  };

  const updateByVideoInfo = (videoInfo: MediaSessionVideoInfo) => {
    const title = videoInfo.title;
    const artist = videoInfo.owner?.name || '';
    const album = '';
    const artwork: MediaImage[] = [{src: videoInfo.thumbnail, sizes: '130x100', type: 'image/jpg'}];
    if (videoInfo.betterThumbnail) {
      artwork.push({src: videoInfo.betterThumbnail, sizes: '320x270', type: 'image/jpg'});
    }
    if (videoInfo.largeThumbnail) {
      artwork.push({src: videoInfo.largeThumbnail, sizes: '1280x720', type: 'image/jpg'});
    }
    // self.console.info({title, artist, album, artwork});
    update({title, artist, album, artwork, duration: videoInfo.duration});
  };

  const updatePositionState = ({duration, playbackRate, currentTime}: MediaPositionLike) => {
    const nm = navigator.mediaSession;
    // MSA-NOSESSION-002 (Task781): `in` on a missing mediaSession threw a TypeError.
    if (!nm || !('setPositionState' in nm)) {
      return;
    }
    setPosition(nm, duration, playbackRate, currentTime);
  };
  const updatePositionStateByMedia = (media: MediaPositionLike) => {
    updatePositionState({
      duration: media.duration,
      playbackRate: media.playbackRate,
      currentTime: media.currentTime
    });
  };

  return {
    onCommand: (callback: CommandListener) => emitter.on('command', callback),
    update,
    updateByVideoInfo,
    updatePositionState,
    updatePositionStateByMedia
  };
})();

export {MediaSessionApi};
