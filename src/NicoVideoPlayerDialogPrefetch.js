import * as $ from 'jquery';
import * as _ from 'lodash';
import {global} from './ZenzaContext';
import {CONSTANT} from './constant';
import {PlaybackPosition, VideoInfoLoader, NVWatchCaller, CommonsTreeLoader} from '../packages/lib/src/nico/loader';
import {Fullscreen, ShortcutKeyEmitter, util} from './util';
import {SHORTCUT_ACTIONS} from '../packages/zenza/src/ShortcutActions';
import {RelatedMenuActions} from '../packages/zenza/src/menu/RelatedMenuActions';
import {UiVisibilityRegistry} from './UiVisibilityRegistry';
import {NotificationJournal} from './NotificationJournal';
import {NotificationHistoryPanel} from './NotificationHistoryPanel';
import {RelatedMenuOrder} from './RelatedMenuOrder';
import {OfficialPlayerRoute} from '../packages/zenza/src/menu/OfficialPlayerRoute';
import {NicoVideoPlayer} from './NicoVideoPlayer';
import {VideoFilter, VideoInfoModel} from './VideoInfo';
import {CommentInputPanel} from './CommentInputPanel';
import {CommentPanel} from './CommentPanel';
import {VideoControlBar} from './VideoControlBar';
import {SceneSearchPlayerBinding} from '../packages/zenza/src/sceneSearch/SceneSearchPlayerBinding';
import {AutoResumeClearCoordinator} from '../packages/zenza/src/resume/AutoResumeClearCoordinator';
import {IndexedDbManualBookmarkBackend, ManualBookmarkRepository} from '../packages/zenza/src/resume/ManualBookmarkStore';
import {ManualBookmarkSession} from '../packages/zenza/src/resume/ManualBookmarkSession';
import {ManualBookmarkDock} from '../packages/zenza/src/resume/ManualBookmarkDock';
import {SavedVideoThumbnail} from '../packages/zenza/src/resume/SavedVideoThumbnail';
import {VideoInfoPanel} from './VideoInfoPanel';
import {PlayList, PlayListSession} from '../packages/zenza/src/Playlist/PlayList';
import {Emitter} from './baselib';
import {ThreadLoader} from '../packages/lib/src/nico/ThreadLoader';
import {sleep} from '../packages/lib/src/infra/sleep';
import {VideoSessionWorker} from '../packages/lib/src/nico/VideoSessionWorker';
import {PlayerState} from './State';
import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';
import {objUtil} from '../packages/lib/src/infra/objUtil';
import {MylistApiLoader} from '../packages/lib/src/nico/MylistApiLoader';
import {ThumbInfoLoader} from '../packages/lib/src/nico/ThumbInfoLoader';
import {WatchInfoCacheDb} from '../packages/lib/src/nico/WatchInfoCacheDb';
import {css, cssUtil} from '../packages/lib/src/css/css';
import {textUtil} from '../packages/lib/src/text/textUtil';
import {MediaSessionApi} from '../packages/lib/src/infra/MediaSessionApi';
import {LikeApi} from '../packages/lib/src/nico/LikeApi.js';
import {AudioAdjuster} from '../packages/zenza/src/audio/AudioAdjuster';
import {ScreenFilter, ScreenFilterPanel} from '../packages/zenza/src/videoPlayer/ScreenFilter';
import {ZenzaCommentHistoryCore} from '../packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js';
import {NicoVideoPlayerDialog} from './NicoVideoPlayerDialog';
import {DiagnosticConsole} from '../packages/zenza/src/diagnostics/DiagnosticConsole';

// GENERATED FROM tools/typescript-stage1/nico-src/NicoVideoPlayerDialogPrefetch.ts (Task1060). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/** 次の動画の先読み（候補の選び方・開始条件・状態の表示）と、切り替えの診断ログ。 */
const NicoVideoPlayerDialogPrefetch = {
    /** Extra network activity is always user opt-in, and only in a real playlist. */
    _prefetchFeatureEnabled() {
        // Task1035: 外部サイトからの再生（www.nicovideo.jp/robots.txt の枠）では先読みしない。
        // 実機ログでは、他サイトに埋め込まれた枠からの再生用データ取得が毎回 HTTP エラーになる一方、
        // 動画情報・再生許可・コメントの取得は毎回走り、10秒あたり25〜37MBの通信と長い処理が続いていた。
        if (NicoVideoPlayerDialog.isExternalPlayback()) {
            return false;
        }
        const config = this._playerConfig;
        return config?.getValue('playlist.prefetchAhead.enabled') === true;
    },
    _prefetchSettingsKey() {
        const config = this._playerConfig;
        return JSON.stringify([
            config.getValue('videoServerType'), config.getValue('domandVideoQuality'),
            config.getValue('autoDisableNew'), config.getValue('video.hls.use_native_hls'),
            // Bandwidth estimates are updated automatically by HLS during playback;
            // they are NOT a settings change and must not evict every prepared video.
            global.debug?.hlsConfig?.startLevel
        ]);
    },
    _getPrefetchReporter() {
        const runtime = global.debug?.playlistPrefetch;
        if (!runtime?.createReporter)
            return null;
        return this._prefetchReporter ||= runtime.createReporter({
            diagnostics: () => runtime.trialDiagnostics === true ||
                this._playerConfig.getValue('playlist.prefetchAhead.consoleLog') === true,
            notifyMode: () => this._playerConfig.getValue('playlist.prefetchAhead.notify') || 'journal',
            console: (name, payload) => window.console.info(name, JSON.stringify(payload)),
            trace: (name, payload) => this._diagToConsole(name, payload),
            record: (entry) => this._recordDiagnostic(entry),
            warning: (message) => this.execCommand('warning', message),
            notify: (message) => this.execCommand('notify', message),
            describe: runtime.describeError
        });
    },
    _prepareNextStartup(watchId, signal) {
        const runtime = global.debug?.playlistPrefetch;
        if (!runtime?.createPreparer || !VideoInfoLoader?.prefetch) {
            return Promise.reject(new Error('Playlist prefetch unavailable'));
        }
        this._prefetchPreparer ||= runtime.createPreparer({
            loadVideoInfo: (id, abort) => VideoInfoLoader.prefetch(id, { signal: abort }),
            createModel: (data) => new VideoInfoModel(data, null),
            isNgVideo: (info) => this._videoFilter.isNgVideo(info),
            getConfig: (key) => this._playerConfig.getValue(key),
            createSession: (info, videoQuality) => VideoSessionWorker.create({
                videoInfo: info, videoQuality, serverType: 'domand', useHLS: true, prefetch: true
            }),
            prepareBytes: (url, abort) => runtime.bytes.prepare(url, abort),
            settingsKey: () => this._prefetchSettingsKey(),
            log: (name, payload) => this._getPrefetchReporter()?.prepareLog(name, payload),
            // コメントと場面画像の先読み。失敗しても本体の準備は失敗にしない。
            prepareCompanions: async (info, sig) => {
                if (this._playerConfig.getValue('playlist.prefetchAhead.companions') !== true)
                    return null;
                if (this._playerConfig.getValue('enableStoryboard') && info.hasStoryboard && !sig.aborted) {
                    Promise.resolve()
                        .then(() => sig.aborted ? null : global.api?.StoryboardInfoLoader?.load('domand', info))
                        .catch(() => { });
                }
                if (!this.threadLoader || !info.msgInfo)
                    return null;
                const msgInfo = Object.assign({}, info.msgInfo);
                msgInfo.language = this._playerConfig.props.commentLanguage;
                // 先読みのコメント取得は失敗しても本編に影響しない。3秒・6秒を空けた
                // リトライを繰り返すと通信とログを無駄に増やすので1回で諦める（Task1029）。
                const result = await this.threadLoader.load(msgInfo, { signal: sig, noRetry: true });
                return { comments: { language: msgInfo.language, result } };
            }
        });
        return this._prefetchPreparer(watchId, signal);
    },
    /**
     * 先読み候補を、設定した順番で各一覧から perSource 本ずつ集める。
     * 重複と再生中の動画は除き、合計は HARD_MAX_WINDOW(96) までに抑える。
     */
    _collectPrefetchCandidates(perSource) {
        const config = this._playerConfig;
        const order = String(config.getValue('playlist.prefetchAhead.order') ||
            'playlist,related,description').split(',');
        const seen = new Set();
        if (this._watchId)
            seen.add(this._watchId);
        const out = [];
        const push = (value) => {
            const id = String(value || '');
            if (!/^(?:sm|so|nm)\d+$/.test(id) || seen.has(id))
                return false;
            seen.add(id);
            out.push(id);
            return true;
        };
        for (const source of order) {
            let taken = 0;
            if (source === 'playlist') {
                // 既定ONのため、値が未設定でも有効として扱う
                if (config.getValue('playlist.prefetchAhead.sourcePlaylist') === false || !this._playlist)
                    continue;
                for (const id of (this._playlist.peekNextIds?.(perSource * 2) || [])) {
                    if (taken >= perSource)
                        break;
                    if (push(id))
                        taken++;
                }
            }
            else if (source === 'related') {
                if (config.getValue('playlist.prefetchAhead.sourceRelated') !== true)
                    continue;
                for (const item of (this._videoInfo?.relatedVideoItems || [])) {
                    if (taken >= perSource)
                        break;
                    if (push(typeof item === 'string' ? item : item?.id))
                        taken++;
                }
            }
            else if (source === 'description') {
                if (config.getValue('playlist.prefetchAhead.sourceDescription') !== true)
                    continue;
                for (const m of String(this._videoInfo?.description || '').matchAll(/watch\/((?:sm|so|nm)\d+)/g)) {
                    if (taken >= perSource)
                        break;
                    if (push(m[1]))
                        taken++;
                }
            }
        }
        return out.slice(0, 96);
    },
    /** 先読み済みコメントを再生時に引き渡す。過去ログ指定と手動再読み込みでは使わない。 */
    _takePrefetchComments(msgInfo, loadOptions = {}) {
        const held = this._prefetchCompanions;
        if (!held?.comments)
            return null;
        // msgInfo.when の既定値は null。過去ログ指定は when > 0 で表される。
        if (loadOptions.manualReload || Number(msgInfo?.when) > 0)
            return null;
        if (held.watchId !== this._watchId ||
            held.comments.language !== this._playerConfig.props.commentLanguage)
            return null;
        this._prefetchCompanions = null;
        return held.comments.result;
    },
    /** performance が無い環境でも計測できるようにする。 */
    _prefetchNow() {
        return typeof performance !== 'undefined' && typeof performance.now === 'function' ?
            performance.now() : Date.now();
    },
    /**
     * Task1029: 1回の切り替えの内訳を1行で出す。
     * prefetchUsed=先読みのセッションを使えたか。
     * infoSource=動画情報の取得元（prefetch=先読みを再利用 / network=取り直した）。
     * marks は動画を開いてからの経過ms（videoInfo=動画情報が揃った、session=再生許可が揃った、
     * setVideo=プレーヤーへ渡した、canPlay=再生可能になった）。
     */
    _diagOpenTiming() {
        const t = this._prefetchTiming;
        if (!t || !this._diagWanted()) {
            return;
        }
        const hits = (() => {
            try {
                return global.debug?.playlistPrefetch?.bytes?.hits?.(t.source) ?? null;
            }
            catch (_) {
                return null;
            }
        })();
        this._diag('ZENZA_OPEN_TIMING', {
            videoId: t.videoId || null,
            prefetchUsed: !!t.used,
            infoSource: t.infoSource || null,
            infoReuseBlocked: t.infoReuseBlocked || null,
            infoAgeSec: Number.isFinite(t.infoAgeSec) ? t.infoAgeSec : null,
            cacheHits: hits,
            totalMs: Math.round(this._prefetchNow() - t.started),
            marks: t.marks || {},
            readyCount: (this._playlistPrefetch?.readyIds?.() || []).length
        });
    },
    /** 再生開始までにかかった秒数を通知する（設定がONのときだけ画面に出す）。 */
    _reportPrefetchTiming() {
        const t = this._prefetchTiming;
        if (!t || t.reported || t.requestId !== this._requestId)
            return;
        t.reported = true;
        const reporter = this._getPrefetchReporter();
        if (!reporter)
            return;
        const seconds = Number(((this._prefetchNow() - t.started) / 1000).toFixed(3));
        const config = this._playerConfig;
        try {
            if (t.used) {
                const hits = global.debug?.playlistPrefetch?.bytes?.hits?.(t.source) ?? 0;
                reporter.hit?.(t.videoId, seconds, hits, config.getValue('playlist.prefetchAhead.notifyHit') === true);
            }
            else {
                reporter.miss?.(t.videoId, seconds, config.getValue('playlist.prefetchAhead.notifyMiss') === true);
            }
        }
        catch (_) { /* 計測は再生に影響させない */ }
    },
    _updatePrefetchMarks() {
        const runtime = global.debug?.playlistPrefetch;
        if (!runtime)
            return;
        const enabled = this._prefetchFeatureEnabled() &&
            this._playerConfig.getValue('playlist.prefetchAhead.showMark') !== false;
        const ids = enabled ? (this._playlistPrefetch?.readyIds?.() || []) : [];
        const key = JSON.stringify(ids);
        if (this._prefetchMarkSignature === key)
            return;
        this._prefetchMarkSignature = key;
        runtime.markIds = ids;
        global.emitter.emit?.('zenza-prefetch-marks', ids);
    },
    /**
     * Task1029: 動画を開いてからの区間時間を刻む。
     * どこで時間を使っているのかを1回の切り替えごとに1行で出すため。
     */
    _markTiming(key) {
        const t = this._prefetchTiming;
        if (!t || t.requestId !== this._requestId) {
            return;
        }
        t.marks ||= {};
        if (t.marks[key] === undefined) {
            t.marks[key] = Math.round(this._prefetchNow() - t.started);
        }
    },
    /**
     * Task1029: 調査用の1行を出す。payload は JSON にして1行にまとめる
     * （コンソールで折り畳まれず、そのままコピーして貼れるようにするため）。
     */
    _diag(name, payload) {
        if (this._prefetchConsoleLog()) {
            try {
                window.console.info(name, JSON.stringify(payload));
            }
            catch (_) { /* 調査用の出力で本編を止めない。 */ }
        }
        this._diagToConsole(name, payload);
    },
    /** Task1054: 先読み・切り替えの調査用の記録を、上級者設定の診断ログ（再生）にも出す。 */
    _diagToConsole(name, payload) {
        try {
            if (typeof DiagnosticConsole !== 'undefined' && DiagnosticConsole?.enabled?.('player')) {
                DiagnosticConsole.log('player', 'info', '先読み・切り替え: ' + name, payload);
            }
        }
        catch (_) { /* 調査用の出力で本編を止めない。 */ }
    },
    /** 先読みのコンソール記録（従来の設定）か、診断ログの「再生」のどちらかが ON か。 */
    _diagWanted() {
        const legacy = this._prefetchConsoleLog();
        try {
            return legacy || (typeof DiagnosticConsole !== 'undefined' && DiagnosticConsole?.enabled?.('player') === true);
        }
        catch (_) {
            return legacy;
        }
    },
    /**
     * Task1030: 動画を開いてから実際に再生が始まるまで（canPlay は HLS では
     * マニフェスト解析時点の互換イベントで、映像が出た時刻ではない）。
     * 先読みデータを hls.js が本当に使えたか（hits/misses）も出す。
     */
    _diagFirstPlaying() {
        const t = this._prefetchTiming;
        if (!t || t.requestId !== this._requestId || t.firstPlayingReported) {
            return;
        }
        t.firstPlayingReported = true;
        this._markTiming('playing');
        if (!this._diagWanted()) {
            return;
        }
        const stats = (() => {
            try {
                return t.source ? global.debug?.playlistPrefetch?.bytes?.stats?.(t.source) ?? null : null;
            }
            catch (_) {
                return null;
            }
        })();
        const level = (() => {
            try {
                const hls = global.debug?.video?.hls || this._nicoVideoPlayer?._videoPlayer?._video?.hls;
                return typeof hls?.currentLevel === 'number' ? hls.currentLevel : null;
            }
            catch (_) {
                return null;
            }
        })();
        this._diag('ZENZA_FIRST_PLAYING', {
            videoId: t.videoId || null,
            prefetchUsed: !!t.used,
            infoSource: t.infoSource || null,
            playingMs: Math.round(this._prefetchNow() - t.started),
            marks: t.marks || {},
            cache: stats,
            currentLevel: level
        });
    },
    /** Task1029: 同じ内容を繰り返し出さないための記録。 */
    _diagOnce(name, key, payload) {
        if (!this._diagWanted()) {
            return;
        }
        this._diagSeen ||= new Map();
        if (this._diagSeen.get(name) === key) {
            return;
        }
        this._diagSeen.set(name, key);
        this._diag(name, payload);
    },
    /** Task1029: 起動時に版と設定をまとめて出す（どのビルドのログか後から分かるように）。 */
    _diagEnvironment() {
        if (!this._diagWanted() || this._diagEnvDone) {
            return;
        }
        this._diagEnvDone = true;
        const config = this._playerConfig;
        const keys = ['playlist.prefetchAhead.enabled', 'playlist.prefetchAhead.sourcePlaylist',
            'playlist.prefetchAhead.sourceRelated', 'playlist.prefetchAhead.sourceDescription',
            'playlist.prefetchAhead.order', 'playlist.prefetchAhead.window', 'playlist.prefetchAhead.cacheMB',
            'playlist.prefetchAhead.pacingMs', 'playlist.prefetchAhead.companions',
            'playlist.prefetchAhead.skipWhenLoop', 'playlist.prefetchAhead.skipWhenPaused', 'playlist.prefetchAhead.skipWhenDataSaver',
            'playbackRate.respectExternal', 'playbackRate',
            'loop', 'playlistLoop', 'autoPlay', 'enableStoryboard', 'videoServerType', 'domandVideoQuality',
            'playlist.prefetchAhead.showMark', 'playlist.prefetchAhead.notify'];
        const settings = {};
        for (const key of keys) {
            try {
                settings[key] = config.getValue(key);
            }
            catch (_) {
                settings[key] = '?';
            }
        }
        this._diag('ZENZA_DIAG_ENV', {
            version: global.version || window.ZenzaWatch?.version || null,
            saveData: navigator.connection?.saveData === true,
            memoryGB: navigator.deviceMemory ?? null,
            hardwareConcurrency: navigator.hardwareConcurrency ?? null,
            settings
        });
    },
    /** Task1029: 上級者設定「コンソールに詳しく出力」がONか。 */
    _prefetchConsoleLog() {
        const on = this._playerConfig?.getValue('playlist.prefetchAhead.consoleLog') === true ||
            global.debug?.playlistPrefetch?.trialDiagnostics === true;
        // プレイリストの保存は別モジュールなので、静的フラグで伝える。
        try {
            if (typeof PlayListSession !== 'undefined' && PlayListSession.diagnostics !== on) {
                PlayListSession.diagnostics = on;
            }
        }
        catch (_) { /* 伝えられなくても本編には影響しない。 */ }
        return on;
    },
    _updateNextPrefetch() {
        try {
            this._diagEnvironment();
            if (!this._prefetchFeatureEnabled()) {
                const cache = this._playlistPrefetch;
                this._playlistPrefetch = null;
                cache?.reset();
                this._updatePrefetchMarks();
                const gate = NicoVideoPlayerDialog.isExternalPlayback() ? 'external-site' : 'disabled';
                this._diagOnce('ZENZA_PREFETCH_GATE', gate, { gate });
                return;
            }
            const runtime = global.debug?.playlistPrefetch;
            // Task1029: どの条件で止まっているのかを1つずつ記録する。
            // 「先読みを追加しなくなった」の原因をログだけで切り分けられるようにするため。
            const gate = !runtime?.create ? 'no-runtime' :
                !this.isOpen ? 'player-closed' :
                    !this._playlist ? 'no-playlist' :
                        // Task1055: 「データセーバー中」「ループ中」で止めるのは、上級者設定で選んだ時だけ（初期値は先読みする）。
                        (this._playerConfig.getValue('playlist.prefetchAhead.skipWhenDataSaver') === true &&
                            navigator.connection?.saveData === true) ? 'data-saver' :
                            // Task1056: 動画の切り替え中は一時的に再生方式が決まっていない。'not-hls' と区別する。
                            this._state?.isLoading ? 'switching' :
                                !runtime.supported() ? 'not-hls' :
                                    this._state.isError ? 'video-error' :
                                        (this._playerConfig.getValue('playlist.prefetchAhead.skipWhenLoop') === true &&
                                            this._playerConfig.getValue('loop') === true) ? 'loop-on' : null;
            if (gate) {
                this._playlistPrefetch?.interrupt?.('waiting');
                this._diagOnce('ZENZA_PREFETCH_GATE', gate, {
                    gate,
                    playerMode: global.debug?.video?.playerMode ?? null,
                    // supported() が見ているのは ZenzaHLS 側の primaryVideo。
                    // 引き継ぎ後に古い要素を指したままになる不具合があったため、別に出す。
                    supported: (() => {
                        try {
                            return global.debug?.playlistPrefetch?.supported?.() === true;
                        }
                        catch (_) {
                            return null;
                        }
                    })(),
                    sampleTime: (() => {
                        try {
                            return global.debug?.playlistPrefetch?.sample?.()?.currentTime ?? null;
                        }
                        catch (_) {
                            return null;
                        }
                    })(),
                    isOpen: !!this.isOpen,
                    playlistItems: this._playlist?.length ?? null,
                    watchId: this._watchId || null
                });
                return;
            }
            this._diagOnce('ZENZA_PREFETCH_GATE', 'open', { gate: 'open' });
            const perSource = Math.max(1, Math.min(32, Number(this._playerConfig.getValue('playlist.prefetchAhead.window')) || 5));
            const maxStoreBytes = Math.max(16, Math.min(512, Number(this._playerConfig.getValue('playlist.prefetchAhead.cacheMB')) || 128)) * 1048576;
            const pacingMs = Math.max(0, Math.min(10000, Number(this._playerConfig.getValue('playlist.prefetchAhead.pacingMs')) || 0));
            const candidates = this._collectPrefetchCandidates(perSource);
            this._diagOnce('ZENZA_PREFETCH_CANDIDATES', candidates.join(','), {
                current: this._watchId || null,
                candidates,
                perSource,
                playlistItems: this._playlist?.length ?? null,
                playlistIndex: this._playlist?.index ?? null,
                playlistEnable: !!this.isPlaylistEnable,
                peekNext: (() => {
                    try {
                        return this._playlist?.peekNextIds?.(5) || null;
                    }
                    catch (_) {
                        return 'error';
                    }
                })(),
                relatedCount: (this._videoInfo?.relatedVideoItems || []).length,
                ready: this._playlistPrefetch?.readyIds?.() || []
            });
            if (!candidates.length) {
                // 候補が無いだけならキャッシュは残すが、準備中の通信は止める
                this._playlistPrefetch?.interrupt?.('not-playing');
                this._updatePrefetchMarks();
                return;
            }
            const windowCount = candidates.length;
            this._playlistPrefetch ||= runtime.create((id, signal) => this._prepareNextStartup(id, signal), (id) => {
                this._getPrefetchReporter()?.ready(id, this._playerConfig.getValue('playlist.prefetchAhead.notifyReady') === true);
                this._updatePrefetchMarks();
            }, (event) => { this._getPrefetchReporter()?.schedulerEvent(event); this._updatePrefetchMarks(); });
            const sample = runtime.sample(), currentTime = Number(sample?.currentTime) || 0;
            let bufferEnd = currentTime;
            const buffered = sample?.buffered;
            if (buffered)
                for (let i = 0; i < buffered.length; i++) {
                    if (buffered.start(i) <= currentTime + 0.05 && buffered.end(i) > currentTime) {
                        bufferEnd = buffered.end(i);
                        break;
                    }
                }
            const schedulerInput = {
                settings: this._prefetchSettingsKey(), candidates,
                currentId: this._watchId || null, enabled: true,
                // Task1055: 一時停止中も先読みを続ける（上級者設定「一時停止中は先読みしない」が ON の時だけ止める）。
                playing: this.isPlaying || this._prefetchWhilePaused(sample),
                seeking: !!this._state.isSeeking, waiting: !!this._state.isStalled,
                currentTime, duration: Number(sample?.duration), bufferEnd,
                rate: Number(sample?.rate) || 1, ended: !!sample?.ended,
                windowCount, maxStoreBytes, pacingMs
            };
            // 止まっている原因が「再生が安定していない」なのか分かるように、
            // 判断に使った値そのものを出す（状態が変わったときだけ）。
            // 判断に関わる状態が変わったときだけ出す。再生位置では出さない
            // （0.5秒ごとに1行出て他の記録が埋もれるため）。
            // ahead は先読みが実際に使う値（残量を再生速度で割ったもの）。
            // 以前は割る前の値を出していて、2倍速のときに判断を読み違えた。
            const ahead = Math.max(0, bufferEnd - currentTime) / Math.max(0.25, schedulerInput.rate);
            const readyCount = (this._playlistPrefetch?.readyIds?.() || []).length;
            const busy = this._playlistPrefetch?.isBusy?.() === true;
            this._diagOnce('ZENZA_PREFETCH_INPUT', [schedulerInput.playing, schedulerInput.seeking, schedulerInput.waiting,
                schedulerInput.ended, ahead >= 15, busy, readyCount].join('/'), {
                playing: schedulerInput.playing, seeking: schedulerInput.seeking,
                waiting: schedulerInput.waiting, ended: schedulerInput.ended,
                currentTime: Number(currentTime.toFixed(1)),
                bufferEnd: Number(bufferEnd.toFixed(1)),
                aheadSec: Number(ahead.toFixed(1)),
                aheadEnough: ahead >= 15,
                duration: Number(sample?.duration) || null,
                rate: schedulerInput.rate,
                busy, readyCount,
                ready: this._playlistPrefetch?.readyIds?.() || [],
                totalBytes: this._playlistPrefetch?.totalBytes?.() ?? null
            });
            this._playlistPrefetch.update(schedulerInput);
            this._updatePrefetchMarks();
        }
        catch (_) {
            // Never allow a background optimization to interfere with foreground video.
            this._playlistPrefetch?.interrupt?.('waiting');
        }
    },
    /** Task1030: 先読みのメタデータを使えない理由（使えるなら null）。 */
    _prefetchDataReuseBlock(watchId, options, prepared) {
        if (!prepared) {
            return 'not-prefetched';
        }
        if (typeof VideoInfoLoader?.adoptPrefetched !== 'function') {
            return 'unsupported';
        }
        if (prepared.watchId !== watchId || !prepared.data) {
            return 'mismatch';
        }
        if (options?.videoLoadOptions?.economy) {
            return 'economy';
        }
        const age = Date.now() - Number(prepared.dataAt);
        if (!Number.isFinite(age) || age < 0) {
            return 'no-timestamp';
        }
        if (age > NicoVideoPlayerDialog.PREFETCH_DATA_MAX_AGE_MS) {
            return 'stale';
        }
        return null;
    },
    /** Task1055: 一時停止中でも先読みしてよいか（終わった動画・シーク中・設定で止めた時は不可）。 */
    _prefetchWhilePaused(sample) {
        if (this.isPlaying || this._playerConfig?.getValue('playlist.prefetchAhead.skipWhenPaused') === true) {
            return false;
        }
        if (!this._playerConfig || !this.isOpen || this._state?.isSeeking || this._state?.isError) {
            return false;
        }
        const media = sample || global.debug?.playlistPrefetch?.sample?.();
        return !!media && media.ended !== true && Number(media.currentTime) > 0;
    },
    /** Task1055: 一時停止中は timeupdate が来ないので、1 秒ごとに先読みの判断を進める。 */
    _syncPausedPrefetchTimer() {
        const want = this._prefetchWhilePaused();
        if (want && !this._prefetchPausedTimer) {
            this._prefetchPausedTimer = window.setInterval(() => {
                if (!this._prefetchWhilePaused()) {
                    this._syncPausedPrefetchTimer();
                    return;
                }
                this._updateNextPrefetch();
            }, 1000);
        }
        else if (!want && this._prefetchPausedTimer) {
            window.clearInterval(this._prefetchPausedTimer);
            this._prefetchPausedTimer = 0;
        }
    },
};
//===END===
export {NicoVideoPlayerDialogPrefetch};
