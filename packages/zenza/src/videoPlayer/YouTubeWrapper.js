// import * as _ from 'lodash';
import {global} from '../../../../src/ZenzaWatchIndex';
import {Emitter} from '../../../lib/src/Emitter';
import {textUtil} from '../../../lib/src/text/textUtil';
// GENERATED FROM tools/typescript-stage1/nico-src/YouTubeWrapper.ts (Task960). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const { YouTubeWrapper } = (() => {
    const STATE_PLAYING = 1;
    class YouTubeWrapper extends Emitter {
        static parseStartTime(value) {
            if (typeof value !== 'string' || !value) {
                return 0;
            }
            if (/^\d+$/.test(value)) {
                const seconds = Number(value);
                return Number.isSafeInteger(seconds) ? seconds : 0;
            }
            const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
            if (!match) {
                return 0;
            }
            const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
            return Number.isSafeInteger(seconds) ? seconds : 0;
        }
        constructor({ parentNode, autoplay = true, volume = 0.3, playbackRate = 1, loop = false }) {
            super();
            this._isInitialized = false;
            this._parentNode = parentNode;
            this._autoplay = autoplay;
            this._volume = volume;
            this._playbackRate = playbackRate;
            this._actualPlaybackRate = playbackRate;
            this._loop = loop;
            this._sourceRequest = 0;
            this._startDiff = 0;
            this._isSeeking = false;
            this._seekTime = 0;
            this._seekSequence = 0;
            this._seekDispatchedSequence = 0;
            this._seekCompletionTimer = null;
            this._onSeekEnd = _.debounce(this._onSeekEnd.bind(this), 500);
        }
        async setSrc(url, startSeconds = 0) {
            const request = this._sourceRequest = (this._sourceRequest || 0) + 1;
            const pendingSeek = this._onSeekEnd;
            pendingSeek.cancel?.();
            this._cancelSeekCompletion();
            this._src = url;
            this._videoId = this._parseVideoId(url);
            this._canPlay = false;
            this._isSeeking = false;
            this._seekTime = 0;
            const params = this._parseUrlParams(url);
            // The URL's t= is a startup offset only. IFrame getCurrentTime(),
            // seekTo() and getDuration() already use absolute seconds from video 0.
            this._startDiff = YouTubeWrapper.parseStartTime(params.t);
            startSeconds += this._startDiff;
            const requestedVideoId = this._videoId;
            // Clear also invalidates an in-flight iframe creation. A late onReady
            // must never autoplay or select the superseded video.
            if (!url) {
                this._player?.stopVideo?.();
                return;
            }
            let player = this._player;
            if (this._playerInitPromise) {
                // A shared initialization is only the iframe readiness gate.
                // Never let its original A videoId satisfy a newer B request.
                const ready = await this._playerInitPromise;
                player = ready.player;
            }
            else if (!player) {
                // Start initially paused; the newest source will decide whether to
                // load or cue after readiness, preventing an orphan autoplaying A.
                const ready = await this._initPlayer(requestedVideoId, startSeconds, true);
                player = ready.player;
            }
            if (request !== this._sourceRequest || !this._src || !player) {
                return;
            }
            // Provider single-video loads reset playback rate; the existing PLAYING
            // rate reconciliation handles that separately.
            this._actualPlaybackRate = 1;
            const payload = { videoId: requestedVideoId, startSeconds };
            if (this._autoplay) {
                player.loadVideoById(payload);
            }
            else {
                player.cueVideoById(payload);
            }
        }
        cancelPendingSource() {
            // Used when native playback wins while the YouTube iframe is still initializing.
            ++this._sourceRequest;
            this._src = '';
            this._videoId = '';
            const pending = this._onSeekEnd;
            pending.cancel?.();
            this._cancelSeekCompletion();
            // The API may not expose stopVideo before onReady; stale work stays
            // invalidated even if stopping an incomplete iframe throws.
            try {
                this._player?.stopVideo?.();
            }
            catch (_) { }
        }
        set src(v) {
            this.setSrc(v);
        }
        get src() {
            return this._src;
        }
        _parseVideoId(url) {
            const videoId = (() => {
                const a = textUtil.parseUrl(url);
                if (a.hostname === 'youtu.be') {
                    return a.pathname.substring(1);
                }
                else {
                    return textUtil.parseQuery(a.search).v;
                }
            })();
            if (!videoId) {
                return videoId;
            }
            // 自動リンクでURLの前後につきそうな文字列を除去
            // たぶんYouTubeのVideoIdには使われない奴
            return videoId
                .replace(/[?[\]()"'@]/g, '')
                .replace(/<[a-z0-9]*>/, '');
        }
        _parseUrlParams(url) {
            const a = textUtil.parseUrl(url);
            return a.search.startsWith('?') ? textUtil.parseQuery(a.search) : {};
        }
        async _initPlayer(videoId, startSeconds = 0, suppressAutoplay = false) {
            if (this._playerInitPromise) {
                return this._playerInitPromise;
            }
            if (this._player) {
                return { player: this._player };
            }
            // Every same-turn first caller must wait for the same player to become
            // ready, not allocate an additional iframe.
            const init = (async () => {
                const YT = await this._initYT();
                const { player } = await new Promise((resolve, reject) => {
                    let ready = false;
                    const timeout = setTimeout(() => {
                        if (ready) {
                            return;
                        }
                        ready = true;
                        reject(new Error('YouTube player ready timed out'));
                    }, 20000);
                    const onReady = () => {
                        if (ready) {
                            return;
                        }
                        ready = true;
                        clearTimeout(timeout);
                        resolve({ player: this._player });
                    };
                    try {
                        this._player = new YT.Player(this._parentNode, {
                            videoId,
                            events: {
                                onReady,
                                onStateChange: this._onPlayerStateChange.bind(this),
                                onPlaybackQualityChange: (e) => window.console.info('video quality: ', e.data),
                                onPlaybackRateChange: (e) => {
                                    const actual = Number(e?.data);
                                    if (Number.isFinite(actual) && actual > 0) {
                                        this._actualPlaybackRate = actual;
                                    }
                                },
                                onError: (e) => this.emit('error', e)
                            },
                            playerVars: {
                                autoplay: suppressAutoplay ? 0 : (this._autoplay ? 1 : 0),
                                volume: this._volume * 100,
                                start: startSeconds,
                                fs: 0,
                                loop: 0,
                                controls: 1,
                                disablekb: 1,
                                modestbranding: 0,
                                playsinline: 1,
                                rel: 0,
                                showInfo: 1
                            }
                        });
                    }
                    catch (error) {
                        if (!ready) {
                            ready = true;
                            clearTimeout(timeout);
                            // Preserve the internal rejection contract; the owner handles it
                            // without logging or displaying the opaque error body.
                            reject(error);
                        }
                    }
                });
                if (!suppressAutoplay || this._src) {
                    this._onPlayerReady();
                }
                else {
                    // The source was cleared before onReady; stop any late iframe.
                    player?.stopVideo?.();
                }
                return { player };
            })();
            this._playerInitPromise = init;
            try {
                return await init;
            }
            catch (error) {
                // Do not leave a partially constructed iframe playing after timeout.
                const abandoned = this._player;
                this._player = null;
                try {
                    abandoned?.stopVideo?.();
                    abandoned?.destroy?.();
                }
                catch (_) { }
                throw error;
            }
            finally {
                if (this._playerInitPromise === init) {
                    this._playerInitPromise = null;
                }
            }
        }
        async _initYT() {
            if (window.YT?.Player) {
                return window.YT;
            }
            // Share the IFrame API load across different player instances on this page.
            if (YouTubeWrapper._ytApiPromise) {
                return YouTubeWrapper._ytApiPromise;
            }
            const loader = new Promise((resolve, reject) => {
                const previousReady = window.onYouTubeIframeAPIReady;
                let settled = false;
                let tag;
                let timer;
                const restore = () => {
                    if (window.onYouTubeIframeAPIReady === onReady) {
                        window.onYouTubeIframeAPIReady = previousReady;
                    }
                };
                const finish = (yt, failed) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    if (timer !== undefined) {
                        clearTimeout(timer);
                    }
                    restore();
                    if (failed) {
                        tag?.remove?.();
                        reject(new Error('YouTube IFrame API unavailable'));
                    }
                    else {
                        resolve(yt);
                    }
                };
                const onReady = () => {
                    if (settled) {
                        return;
                    }
                    // Do not steal the callback from another script using the same API.
                    if (typeof previousReady === 'function') {
                        try {
                            previousReady();
                        }
                        catch (_) {
                            console.warn('YouTube prior ready callback failed');
                        }
                    }
                    finish(window.YT, !window.YT?.Player);
                };
                const onError = () => finish(null, true);
                window.onYouTubeIframeAPIReady = onReady;
                timer = setTimeout(onError, 15000);
                try {
                    tag = document.createElement('script');
                    tag.src = 'https://www.youtube.com/iframe_api';
                    tag.addEventListener?.('error', onError, { once: true });
                    document.head.append(tag);
                }
                catch (_) {
                    onError();
                }
            });
            YouTubeWrapper._ytApiPromise = loader.catch(error => {
                YouTubeWrapper._ytApiPromise = null;
                throw error;
            });
            return YouTubeWrapper._ytApiPromise;
        }
        _onPlayerReady() {
            this._restorePlaybackRate();
            this.emitAsync('loadedMetaData');
            // this.emitAsync('canplay');
        }
        _restorePlaybackRate() {
            const player = this._player;
            if (!player || typeof player.getPlaybackRate !== 'function' ||
                typeof player.setPlaybackRate !== 'function') {
                return;
            }
            try {
                const actual = Number(player.getPlaybackRate());
                if (Number.isFinite(actual) && actual > 0 &&
                    actual !== this._playbackRate) {
                    player.setPlaybackRate(this._playbackRate);
                }
            }
            catch (_) { /* the video can still play at the provider's default speed */ }
        }
        _onPlayerStateChange(e) {
            const state = e.data;
            this.playerState = state;
            const YT = window.YT;
            switch (state) {
                case YT.PlayerState.ENDED:
                    if (this._loop) {
                        this.currentTime = 0;
                        this.play();
                    }
                    else {
                        this.emit('ended');
                    }
                    break;
                case YT.PlayerState.PLAYING:
                    this._restorePlaybackRate();
                    if (!this._canPlay) {
                        this._canPlay = true;
                        this.muted = this._muted;
                        this.emit('loadedmetadata');
                        this.emit('canplay');
                    }
                    this.emit('play');
                    this.emit('playing');
                    this._completeSeekFromState();
                    break;
                case YT.PlayerState.PAUSED:
                    this._completeSeekFromState();
                    this.emit('pause');
                    break;
                case YT.PlayerState.BUFFERING:
                    //this.emit('stalled');
                    break;
                case YT.PlayerState.CUED:
                    this._restorePlaybackRate();
                    this._completeSeekFromState();
                    break;
            }
        }
        play() {
            this._player.playVideo();
            return Promise.resolve(); // 互換のため
        }
        pause() {
            this._player.pauseVideo();
        }
        get paused() {
            return window.YT ?
                this.playerState !== window.YT.PlayerState.PLAYING : true;
        }
        selectBestQuality() {
            // YouTube controls playback quality; its former setter is unsupported.
            // Retain this public method for extensions without changing playback state.
            return false;
        }
        /** Cancels completion ownership, including a timer from the previous video. */
        _cancelSeekCompletion() {
            this._seekSequence = (this._seekSequence || 0) + 1;
            this._seekDispatchedSequence = 0;
            if (this._seekCompletionTimer != null) {
                clearTimeout(this._seekCompletionTimer);
                this._seekCompletionTimer = null;
            }
            this._isSeeking = false;
        }
        /** A settled request only clears "seeking"; landing is verified by the AB clock. */
        _completeSeek(sequence, source) {
            if (!this._isSeeking || this._seekSequence !== sequence ||
                this._seekDispatchedSequence !== sequence ||
                this._sourceRequest !== source || !this._src) {
                return;
            }
            if (this._seekCompletionTimer != null) {
                clearTimeout(this._seekCompletionTimer);
                this._seekCompletionTimer = null;
            }
            this._seekDispatchedSequence = 0;
            this._isSeeking = false;
            this.emit('seeked');
        }
        /** Ignore PLAYING emitted before the actual debounced seekTo or at old time. */
        _completeSeekFromState() {
            if (!this._isSeeking ||
                this._seekDispatchedSequence !== this._seekSequence) {
                return;
            }
            const getter = this._player?.getCurrentTime;
            if (typeof getter !== 'function') {
                return;
            }
            try {
                const position = Number(getter.call(this._player));
                if (!Number.isFinite(position) ||
                    Math.abs(position - this._seekTime) > 0.2) {
                    return;
                }
            }
            catch (_) {
                return;
            }
            this._completeSeek(this._seekSequence, this._sourceRequest);
        }
        _onSeekEnd() {
            if (!this._src || !this._player) {
                this._cancelSeekCompletion();
                return;
            }
            const sequence = this._seekSequence, source = this._sourceRequest;
            this._seekDispatchedSequence = sequence;
            try {
                // _seekTime is absolute; the URL t= affects initial load only.
                this._player.seekTo(this._seekTime, true);
            }
            catch (_) {
                // A rejected seek must not strand the dialog in the seeking state.
                // No opaque provider exception is emitted or logged.
                this._completeSeek(sequence, source);
                return;
            }
            // IFrame API has no native "seeked" event. PAUSED/CUED might never
            // transition to PLAYING, so a bounded settlement is required.
            if (this._isSeeking && this._seekSequence === sequence &&
                this._sourceRequest === source) {
                this._seekCompletionTimer = setTimeout(() => this._completeSeek(sequence, source), 1500);
            }
        }
        set currentTime(v) {
            if (this._seekCompletionTimer != null) {
                clearTimeout(this._seekCompletionTimer);
                this._seekCompletionTimer = null;
            }
            this._seekSequence = (this._seekSequence || 0) + 1;
            this._seekDispatchedSequence = 0;
            this._isSeeking = true;
            this._seekTime = Math.max(0, Math.min(v, this.duration));
            // "seeking" must precede the debounced operation even in test harnesses
            // where debounce executes synchronously.
            this.emit('seeking');
            this._onSeekEnd();
        }
        get currentTime() {
            const now = performance.now();
            if (this._isSeeking) {
                this._lastTime = now;
                return this._seekTime;
            }
            const state = this._player.getPlayerState();
            const currentTime = this._player.getCurrentTime();
            if (state !== STATE_PLAYING || this._lastCurrentTime !== currentTime) {
                this._lastCurrentTime = currentTime;
                this._lastTime = now;
                return currentTime;
            }
            // 本家watchページ上ではなぜかgetCurrentTimeの精度が落ちるため、
            // status===PLAYINGにもかかわらずcurrentTimeが進んでいない時は、wrapper側で補完する。
            // 精度が落ちると断続的なstalled判定になりコメントがカクカクする
            // Task960 (YOUTUBE-CURRENTTIME-UNIT-001): performance.now() is in milliseconds; the old
            // `/ 1000000` made this interpolation 1000 times too small, so it never smoothed anything.
            const timeDiff = (now - this._lastTime) * this.playbackRate / 1000;
            this._lastCurrentTime = Math.min(currentTime, this.duration);
            return Math.min(currentTime + timeDiff, this.duration);
        }
        get duration() {
            return this._player.getDuration();
        }
        set muted(v) {
            if (v) {
                this._player.mute();
            }
            else {
                this._player.unMute();
            }
            this._muted = !!v;
        }
        get muted() {
            return this._player.isMuted();
        }
        set volume(v) {
            if (this._volume !== v) {
                this._volume = v;
                this._player.setVolume(v * 100);
                this.emit('volumeChange', v);
            }
        }
        get volume() {
            return this._volume;
        }
        set playbackRate(v) {
            const rate = Number(v);
            if (!Number.isFinite(rate) || rate <= 0) {
                return;
            }
            this._playbackRate = rate;
            // A new YouTube video resets its actual speed even if our desired speed
            // did not change; always compare with the provider, not just the cache.
            if (this._player && typeof this._player.setPlaybackRate === 'function' &&
                this.playbackRate !== rate) {
                this._player.setPlaybackRate(rate);
            }
        }
        get playbackRate() {
            try {
                const actual = Number(this._player?.getPlaybackRate?.());
                if (Number.isFinite(actual) && actual > 0) {
                    return actual;
                }
            }
            catch (_) { /* provider state is temporarily unavailable */ }
            return this._actualPlaybackRate || this._playbackRate;
        }
        set loop(v) {
            if (this._loop !== v) {
                this._loop = v;
                this._player.setLoop(v);
            }
        }
        get loop() {
            return this._loop;
        }
        get _state() {
            return this._player.getPlayerState();
        }
        get playing() {
            return this._state === 1;
        }
        // 互換のためのダミー実装
        get videoWidth() {
            return 1280;
        }
        get videoHeight() {
            return 720;
        }
        getAttribute(k) {
            return this[k];
        }
        removeAttribute() {
        }
    }
    return { YouTubeWrapper };
})();
global.debug.YouTubeWrapper = YouTubeWrapper;
//===END===
export {
  YouTubeWrapper
};
