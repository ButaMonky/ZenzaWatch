import {Emitter} from '../Emitter';
// GENERATED FROM tools/typescript-stage1/nico-src/MediaSessionApi.ts (Task726). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const MediaSessionApi = (() => {
    const emitter = new Emitter();
    let init = false;
    /**
     * MSA-POSITION-001 (Task781): Media Session expects `position`, and throws a
     * TypeError for a non-finite/negative duration, a position outside 0..duration
     * or a zero/invalid rate. Media keys and OS controls must never break playback
     * code (seek, play, rate change), so invalid states are skipped and the call is
     * best effort.
     */
    const setPosition = (nm, duration, playbackRate, currentTime) => {
        if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
            return;
        }
        const state = { duration };
        if (playbackRate !== undefined) {
            state.playbackRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
        }
        if (currentTime !== undefined) {
            state.position = Number.isFinite(currentTime) ? Math.min(Math.max(currentTime, 0), duration) : 0;
        }
        try {
            nm.setPositionState(state);
        }
        catch (e) {
            // best effort: the OS position display is optional
        }
    };
    const update = ({ title, artist, album, artwork, duration } = { title: '', artist: '', album: '', artwork: [], duration: 1 }) => {
        if (!('mediaSession' in navigator)) {
            return;
        }
        navigator.mediaSession.metadata = new self.MediaMetadata({
            title,
            artist,
            album,
            // Optional artwork must not abort playback when an image URL is missing.
            artwork: (artwork || []).filter(image => typeof image?.src === 'string' && image.src.trim())
        });
        const nm = navigator.mediaSession;
        if ('setPositionState' in nm) {
            setPosition(nm, duration);
        }
        if (init) {
            return;
        }
        init = true;
        nm.setActionHandler('play', () => emitter.emit('command', 'play'));
        nm.setActionHandler('pause', () => emitter.emit('command', 'pause'));
        nm.setActionHandler('seekbackward', () => emitter.emit('command', 'seekBy', -5));
        nm.setActionHandler('seekforward', () => emitter.emit('command', 'seekBy', +5));
        nm.setActionHandler('previoustrack', () => emitter.emit('command', 'playPreviousVideo'));
        nm.setActionHandler('nexttrack', () => emitter.emit('command', 'playNextVideo'));
        nm.setActionHandler('stop', () => emitter.emit('command', 'close'));
        nm.setActionHandler('seekto', e => {
            emitter.emit('command', 'seekTo', e.seekTime);
        });
    };
    const updateByVideoInfo = (videoInfo) => {
        const title = videoInfo.title;
        const artist = videoInfo.owner.name;
        const album = '';
        const artwork = [{ src: videoInfo.thumbnail, sizes: '130x100', type: 'image/jpg' }];
        if (videoInfo.betterThumbnail) {
            artwork.push({ src: videoInfo.betterThumbnail, sizes: '320x270', type: 'image/jpg' });
        }
        if (videoInfo.largeThumbnail) {
            artwork.push({ src: videoInfo.largeThumbnail, sizes: '1280x720', type: 'image/jpg' });
        }
        // self.console.info({title, artist, album, artwork});
        update({ title, artist, album, artwork, duration: videoInfo.duration });
    };
    const updatePositionState = ({ duration, playbackRate, currentTime }) => {
        const nm = navigator.mediaSession;
        // MSA-NOSESSION-002 (Task781): `in` on a missing mediaSession threw a TypeError.
        if (!nm || !('setPositionState' in nm)) {
            return;
        }
        setPosition(nm, duration, playbackRate, currentTime);
    };
    const updatePositionStateByMedia = (media) => {
        updatePositionState({
            duration: media.duration,
            playbackRate: media.playbackRate,
            currentTime: media.currentTime
        });
    };
    return {
        onCommand: (callback) => emitter.on('command', callback),
        update,
        updateByVideoInfo,
        updatePositionState,
        updatePositionStateByMedia
    };
})();
//===END===
export {MediaSessionApi};
