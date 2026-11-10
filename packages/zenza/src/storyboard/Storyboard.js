import {VideoInfoLoader} from '../../../lib/src/nico/VideoInfoLoader';
import {VideoSessionWorker} from '../../../lib/src/nico/VideoSessionWorker';
import {netUtil} from '../../../lib/src/infra/netUtil';
import {RequestDiagnostics} from '../../../lib/src/infra/RequestDiagnostics';
import {Emitter} from '../../../lib/src/Emitter';
import {StoryboardInfoLoader} from '../../../lib/src/nico/StoryboardInfoLoader';
import {StoryboardCacheDb} from '../../../lib/src/nico/StoryboardCacheDb';
import {StoryboardView} from './StoryboardView';
import {StoryboardInfoModel} from './StoryboardInfoModel';
import {SeekBarThumbnail} from './SeekBarThumbnail';
import {StoryboardWorker} from './StoryboardWorker';
import {global} from '../../../../src/ZenzaWatchIndex';
import {ClassList} from '../../../lib/src/dom/ClassListWrapper';

// GENERATED FROM tools/typescript-stage1/nico-src/Storyboard.ts (Task901). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require VideoInfoLoader
//@require netUtil
//@require RequestDiagnostics
//@require StoryboardInfoModel
//@require StoryboardView
//@require SeekBarThumbnail
//@require StoryboardWorker
/** Passive, reference-counted requests. No ownership of the video player. */
class SavedSceneLoader {
    resources = new Map();
    cooldown = new Map();
    running = 0;
    queue = [];
    deps;
    constructor(deps) { this.deps = deps; }
    get activeResources() { return this.resources.size; }
    check(signal) { if (signal.aborted)
        throw new DOMException('Cancelled', 'AbortError'); }
    schedule(signal, task) {
        return new Promise((resolve, reject) => {
            const cancel = () => { const i = this.queue.indexOf(start); if (i >= 0)
                this.queue.splice(i, 1); reject(new DOMException('Cancelled', 'AbortError')); };
            const start = () => {
                signal.removeEventListener('abort', cancel);
                if (signal.aborted) {
                    cancel();
                    return;
                }
                this.running++;
                Promise.resolve().then(task).then(resolve, reject).finally(() => {
                    this.running--;
                    this.queue.shift()?.();
                });
            };
            if (signal.aborted) {
                cancel();
                return;
            }
            if (this.running < 2)
                start();
            else {
                this.queue.push(start);
                signal.addEventListener('abort', cancel, { once: true });
            }
        });
    }
    lease(key, task) {
        let entry = this.resources.get(key);
        if (!entry) {
            const controller = new AbortController();
            entry = { refs: 0, controller, promise: Promise.resolve().then(async () => { this.check(controller.signal); const result = await task(controller.signal); this.check(controller.signal); return result; }) };
            this.resources.set(key, entry);
        }
        entry.refs++;
        let released = false;
        return { promise: entry.promise, release: () => {
                if (released)
                    return;
                released = true;
                if (--entry.refs === 0) {
                    entry.controller.abort();
                    if (this.resources.get(key) === entry)
                        this.resources.delete(key);
                }
            } };
    }
    cancelAll() { for (const entry of this.resources.values())
        entry.controller.abort(); this.resources.clear(); }
    acquire(videoId, time) {
        const controller = new AbortController(), signal = controller.signal, leases = [];
        const generation = this.deps.cache.captureGeneration?.();
        const keep = (lease) => { if (signal.aborted) {
            lease.release();
            lease.promise.catch(() => { });
            this.check(signal);
        } leases.push(lease); return lease.promise; };
        const usable = (raw) => raw?.watchId === videoId && new StoryboardInfoModel(raw).isAvailable;
        const pageAt = (raw) => new StoryboardInfoModel(raw).getThumbnailPosition(time * 1000).page;
        const promise = (async () => {
            if (!/^(?:sm|so|nm)?\d+$/.test(videoId) || !Number.isFinite(time) || time < 0)
                return null;
            let raw = null;
            for (const type of ['domand', 'dmc']) {
                raw = await keep(this.lease('cache:' + videoId + ':' + type + ':' + time, async () => (this.deps.cache.getPreview?.(videoId + '_' + type, time) || this.deps.cache.get?.(videoId + '_' + type) || Promise.resolve(null)).catch(() => null)));
                this.check(signal);
                if (usable(raw) && time <= raw.duration && raw.storyboard.images[pageAt(raw)]?.buffer)
                    return raw;
            }
            if (!this.deps.enabled() || (this.cooldown.get(videoId) || 0) > Date.now())
                return null;
            raw = await keep(this.lease('meta:' + videoId, s => this.schedule(s, () => this.deps.loadMetadata(videoId, s))));
            this.check(signal);
            if (!this.deps.enabled() || !usable(raw) || time > raw.duration)
                return null;
            const page = pageAt(raw), sheet = raw.storyboard.images[page];
            const buffer = await keep(this.lease('sheet:' + videoId + ':' + sheet.url, s => this.schedule(s, () => this.deps.fetchImage(sheet.url, s))));
            this.check(signal);
            if (!this.deps.enabled())
                return null;
            const result = { ...raw, storyboard: { ...raw.storyboard, images: raw.storyboard.images.map((item, i) => i === page ? { ...item, buffer } : item) } };
            await this.deps.cache.put(videoId + '_' + raw.format, result, generation).catch(() => { });
            this.check(signal);
            this.cooldown.delete(videoId);
            return result;
        })().catch(error => {
            if (!signal.aborted && error?.name !== 'AbortError') {
                this.cooldown.delete(videoId);
                this.cooldown.set(videoId, Date.now() + 60000);
                while (this.cooldown.size > 128)
                    this.cooldown.delete(this.cooldown.keys().next().value);
            }
            throw error;
        });
        return { promise, release: () => { controller.abort(); for (const lease of leases)
                lease.release(); leases.length = 0; } };
    }
}
class Storyboard extends Emitter {
    savedScenes() {
        if (this._savedScenes)
            return this._savedScenes;
        const timed = async (signal, task) => {
            const controller = new AbortController();
            const abort = () => controller.abort();
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted)
                abort();
            const timer = setTimeout(abort, 15000);
            try {
                return await task(controller.signal);
            }
            finally {
                clearTimeout(timer);
                signal.removeEventListener('abort', abort);
            }
        };
        return this._savedScenes = new SavedSceneLoader({
            cache: StoryboardCacheDb,
            enabled: () => this.config?.props?.savedSceneFetch !== false && this.config?.props?.enableStoryboard !== false,
            loadMetadata: (videoId, signal) => timed(signal, async (activeSignal) => {
                const diagnostic = typeof RequestDiagnostics === 'undefined' ? null : RequestDiagnostics.begin('storyboard', videoId, 'response', () => !signal.aborted);
                try {
                    const info = await VideoInfoLoader.loadStoryboardInfo(videoId, { signal: activeSignal });
                    const classes = VideoSessionWorker.createStoryboardClasses({ fetch: (url, options) => netUtil.fetch(url, { ...options, signal: activeSignal, diagnosticActive: () => false }) });
                    const session = await classes.StoryboardSession.create({ videoInfo: info, serverType: 'domand' }).create();
                    const loader = classes.StoryboardInfoLoader.create(session);
                    loader.duration = info.duration;
                    await loader.load();
                    const result = { ...loader.toJSON(), status: 'ok', watchId: videoId, storyboard: loader.getStoryboardWithUrls() };
                    diagnostic?.success();
                    return result;
                }
                catch (error) {
                    diagnostic?.failure(error);
                    throw error;
                }
            }),
            fetchImage: (url, signal) => timed(signal, async (activeSignal) => {
                const parsed = new URL(url);
                if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
                    throw new TypeError('Invalid scene image');
                const response = await fetch(url, { credentials: 'omit', signal: activeSignal });
                if (!response.ok)
                    throw Object.assign(new Error('Scene image unavailable'), { status: response.status });
                const maximum = 8 * 1024 * 1024;
                if (Number(response.headers.get('content-length')) > maximum) {
                    await response.body?.cancel();
                    throw new RangeError('Scene image too large');
                }
                if (!response.body) {
                    const data = await response.arrayBuffer();
                    if (data.byteLength > maximum)
                        throw new RangeError('Scene image too large');
                    return data;
                }
                const reader = response.body.getReader(), chunks = [];
                let size = 0;
                try {
                    for (;;) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        size += value.byteLength;
                        if (size > maximum) {
                            await reader.cancel();
                            throw new RangeError('Scene image too large');
                        }
                        chunks.push(value);
                    }
                }
                finally {
                    reader.releaseLock();
                }
                const result = new Uint8Array(size);
                let offset = 0;
                for (const chunk of chunks) {
                    result.set(chunk, offset);
                    offset += chunk.length;
                }
                return result.buffer;
            })
        });
    }
    /** Independent passive sprite crop; never moves or seeks the live preview canvas.
     * Historical videos use cached bytes only: opening a library must not start
     * video sessions or fetch every storyboard sheet in the user's history. */
    createSavedPreview(host, videoId, time) {
        let disposed = false, revision = 0, releaseImage = null;
        let sceneLease = null;
        const setState = (state) => {
            host.classList.toggle('zw-scene-loading', state === 'loading');
            host.setAttribute('aria-busy', String(state === 'loading'));
            host.setAttribute('aria-label', state === 'loading' ? '場面画像を読み込み中' :
                state === 'ready' ? '保存時刻付近の場面画像' : '場面画像を利用できません');
            if (state !== 'ready')
                host.textContent = state === 'loading' ? '読み込み中' : '画像なし';
        };
        setState('unavailable');
        host.style.position = 'relative';
        host.style.overflow = 'hidden';
        host.setAttribute('role', 'img');
        if (!Number.isFinite(time) || time < 0 || typeof videoId !== 'string' || !videoId ||
            this.config?.props?.enableStoryboard === false)
            return () => { };
        const infos = this._savedPreviewInfo ??= (new Map());
        const bytes = this._savedPreviewBytes ??= (new Map());
        const isCurrent = () => this._currentVideoWatchId === videoId && this.model?.isAvailable === true;
        let infoLease;
        const infoKey = videoId + ':' + time;
        const cached = () => {
            if (infoLease)
                return infoLease.promise;
            infoLease = infos.get(infoKey);
            if (!infoLease) {
                const pending = Promise.resolve().then(async () => {
                    for (const type of ['domand', 'dmc']) {
                        const raw = await (StoryboardCacheDb.getPreview?.(videoId + '_' + type, time) || StoryboardCacheDb.get(videoId + '_' + type)).catch(() => null);
                        if (raw?.watchId === videoId && raw.status === 'ok' && raw.storyboard)
                            return raw;
                    }
                    return null;
                });
                infoLease = { refs: 0, promise: pending };
                infos.set(infoKey, infoLease);
            }
            infoLease.refs++;
            return infoLease.promise;
        };
        const draw = async () => {
            const seq = ++revision;
            sceneLease?.release();
            sceneLease = null;
            releaseImage?.();
            releaseImage = null;
            setState('loading');
            let awaitingImage = false;
            try {
                if (this.config?.props?.enableStoryboard === false)
                    return;
                const live = isCurrent();
                let raw = live ? this.model.rawData : await cached();
                if (!live && !disposed && seq === revision && this.config?.props?.savedSceneFetch !== false) {
                    const candidate = raw && new StoryboardInfoModel(raw);
                    if (!candidate?.isAvailable || !raw.storyboard.images[candidate.getThumbnailPosition(time * 1000).page]?.buffer) {
                        sceneLease = this.savedScenes().acquire(videoId, time);
                        raw = await sceneLease.promise;
                    }
                }
                if (disposed || seq !== revision || !raw || raw.watchId !== videoId)
                    return;
                const model = new StoryboardInfoModel(raw);
                if (!model.isAvailable || model.cellCount <= 0 || time > model.duration)
                    return;
                const pos = model.getThumbnailPosition(time * 1000), page = raw.storyboard.images[pos.page];
                const decoded = model.pageWidth * model.pageHeight * 4;
                if (!Number.isFinite(decoded) || decoded <= 0 || decoded > 32 * 1024 * 1024)
                    return;
                let src;
                if (page?.buffer && Object.prototype.toString.call(page.buffer) === '[object ArrayBuffer]') {
                    const key = page.buffer;
                    let entry = bytes.get(key);
                    if (!entry) {
                        if (!Number.isFinite(decoded) || decoded <= 0 || (this._savedPreviewDecodedBytes || 0) + decoded > 32 * 1024 * 1024)
                            return;
                        entry = { refs: 0, url: URL.createObjectURL(new Blob([page.buffer])) };
                        bytes.set(key, entry);
                        this._savedPreviewDecodedBytes = (this._savedPreviewDecodedBytes || 0) + decoded;
                    }
                    entry.refs++;
                    src = entry.url;
                    releaseImage = () => { if (--entry.refs === 0) {
                        URL.revokeObjectURL(entry.url);
                        bytes.delete(key);
                        this._savedPreviewDecodedBytes = Math.max(0, (this._savedPreviewDecodedBytes || 0) - decoded);
                    } };
                }
                else {
                    // Only the already-open current video may reuse its live URL.
                    if (!live || typeof page?.url !== 'string' || !/^https?:\/\//.test(page.url))
                        return;
                    src = page.url;
                    let entry = bytes.get(src);
                    if (!entry) {
                        if ((this._savedPreviewDecodedBytes || 0) + decoded > 32 * 1024 * 1024)
                            return;
                        entry = { refs: 0, url: src };
                        bytes.set(src, entry);
                        this._savedPreviewDecodedBytes = (this._savedPreviewDecodedBytes || 0) + decoded;
                    }
                    entry.refs++;
                    releaseImage = () => { if (--entry.refs === 0) {
                        bytes.delete(src);
                        this._savedPreviewDecodedBytes = Math.max(0, (this._savedPreviewDecodedBytes || 0) - decoded);
                    } };
                }
                const image = host.ownerDocument.createElement('img');
                image.alt = '';
                image.draggable = false;
                image.crossOrigin = 'anonymous';
                image.style.cssText = `position:absolute;max-width:none;width:${model.cols * 100}%;height:${model.rows * 100}%;left:${-pos.col * 100}%;top:${-pos.row * 100}%;pointer-events:none;`;
                image.onload = () => { if (!disposed && seq === revision) {
                    setState('ready');
                } };
                image.onerror = () => { if (!disposed && seq === revision) {
                    setState('unavailable');
                    releaseImage?.();
                    releaseImage = null;
                } };
                host.style.aspectRatio = String(model.cellWidth) + ' / ' + String(model.cellHeight);
                host.replaceChildren(image);
                awaitingImage = true;
                image.src = src;
            }
            finally {
                // Missing metadata, disabled previews and budget refusals must settle too.
                // Once attached, the image's own load/error event owns the loading state.
                if (!disposed && seq === revision && !awaitingImage)
                    setState('unavailable');
            }
        };
        const update = () => { const pending = draw(), seq = revision; void pending.catch(() => { if (!disposed && seq === revision) {
            setState('unavailable');
            releaseImage?.();
            releaseImage = null;
        } }); };
        this.on?.('update', update);
        this.on?.('reset', update);
        update();
        return () => {
            if (disposed)
                return;
            disposed = true;
            revision++;
            sceneLease?.release();
            sceneLease = null;
            releaseImage?.();
            releaseImage = null;
            this.off?.('update', update);
            this.off?.('reset', update);
            if (infoLease && --infoLease.refs === 0 && infos.get(infoKey) === infoLease)
                infos.delete(infoKey);
            host.classList.remove('zw-scene-loading');
            host.setAttribute('aria-busy', 'false');
            host.replaceChildren();
        };
    }
    constructor(...args) {
        super();
        this.initialize(...args);
    }
    initialize(params) {
        this.config = params.playerConfig;
        this.container = params.container;
        this.state = params.state;
        this.loader = params.loader || StoryboardInfoLoader;
        /** @type {StoryboardInfoModel} */
        this.model = new StoryboardInfoModel({});
        this._currentVideoInfo = null;
        this._currentVideoWatchId = null;
        // Task943: Master thumbnails switch is independent from filmstrip layout.
        // The switch must work for the current video, even if thumbnails were
        // initially disabled before the player emitted loadVideoInfo/canPlay.
        this.config.onkey?.('enableStoryboard', () => this._onStoryboardMasterChange());
        this.config.onkey?.('savedSceneFetch', () => { if (this.config.props.savedSceneFetch === false)
            this._savedScenes?.cancelAll(); });
        global.debug.storyboard = this;
    }
    _initializeStoryboard() {
        if (this.view) {
            return;
        }
        this.view = new StoryboardView({
            model: this.model,
            container: this.container,
            enable: this.config.props.enableStoryboardBar === true &&
                this.config.props.enableStoryboard === true,
            state: this.state
        });
        // Task941: toolbar clicks already update Config, but the advanced setting
        // and TOGGLE_STORYBOARD_BAR shortcut previously changed only the stored flag.
        // Listen after the view is created; pre-load changes are applied above.
        this.config.onkey?.('enableStoryboardBar', () => this._onStoryboardBarVisibilityChange());
        this.emitResolve('dom-ready');
    }
    _onStoryboardBarVisibilityChange() {
        if (!this.view) {
            return;
        }
        // Task942: DataStorage.onkey emits asynchronously. A queued event may
        // represent an older value, including one set before this view existed.
        // Always reconcile with the current Config value, never the event payload.
        const enabled = this.config.props.enableStoryboard === true &&
            this.config.props.enableStoryboardBar === true;
        // A toolbar click sets view.isEnable before it writes Config. Do not
        // toggle the view a second time or restart the animation on that event.
        if (this.view.isEnable === enabled) {
            return;
        }
        if (enabled) {
            this.view.enable();
        }
        else {
            this.view.disable();
        }
    }
    _onStoryboardMasterChange() {
        // DataStorage publishes asynchronously; always read the latest saved
        // value instead of the event payload to avoid stale notifications.
        if (this.config.props.enableStoryboard !== true) {
            this._savedScenes?.cancelAll();
            // Old async master notifications can arrive repeatedly for one OFF.
            // Do not reset workers or fire a synthetic reset on an already empty
            // storyboard; revoke in-flight owners and loaded geometry just once.
            const hadStoryboard = this._loadingWatchId != null ||
                this.state.isStoryboardAvailable === true || this.model.isAvailable === true;
            this._loadingWatchId = null;
            this._requestId = null; // late loader responses no longer own this video
            this.state.isStoryboardAvailable = false;
            if (hadStoryboard) {
                this.model.reset(); // SeekBarThumbnail hides and clears its worker model
                this.emit('reset', this.model);
            }
            this._onStoryboardBarVisibilityChange();
            return;
        }
        this._onStoryboardBarVisibilityChange();
        // Reuse the current videoInfo already delivered by the player, without
        // waiting for a future canPlay or forcing a video/page reload.
        if (this._currentVideoInfo) {
            this.load(this._currentVideoWatchId, this._currentVideoInfo);
        }
    }
    reset() {
        this._currentVideoInfo = null;
        this._currentVideoWatchId = null;
        this._loadingWatchId = null;
        this._requestId = null;
        if (!this.model) {
            return;
        }
        this.state.isStoryboardAvailable = false;
        this.model.reset();
        this.emit('reset', this.model);
    }
    onVideoCanPlay(watchId, videoInfo) {
        this.load(watchId, videoInfo);
    }
    /**
     * Task 070: 一般会員でも取得する（access-rights/storyboard は一般会員でも 201 を返す。2026-09-17実機確認）。
     * 動画情報の取得直後（loadVideoInfo）と canPlay の両方から呼ばれ、同じ動画では1回だけ読み込む。
     */
    load(watchId, videoInfo) {
        // Record only a video with storyboard metadata, including when disabled.
        // reset() clears this ownership on the next player.open event.
        if (videoInfo?.hasStoryboard) {
            const currentKey = videoInfo.watchId || watchId;
            if (typeof currentKey === 'string' && currentKey) {
                this._currentVideoInfo = videoInfo;
                this._currentVideoWatchId = currentKey;
            }
        }
        if (!this.config.props.enableStoryboard || !videoInfo || !videoInfo.hasStoryboard) {
            return;
        }
        const key = videoInfo.watchId || watchId;
        if (this._loadingWatchId === key) {
            return;
        }
        this._loadingWatchId = key;
        this._watchId = watchId;
        const resuestId = this._requestId = Math.random();
        this._initializeStoryboard();
        const startedAt = performance.now();
        this.loader.load(this.config.props.videoServerType, videoInfo)
            .then(async (info) => {
            await this.promise('dom-ready');
            console.log('storyboard loaded: %s %sms%s', watchId, Math.round(performance.now() - startedAt), info && info.fromCache ? ' (cache)' : '');
            return info;
        })
            .then(this._onStoryboardInfoLoad.bind(this, resuestId))
            .catch(this._onStoryboardInfoLoadFail.bind(this, resuestId));
    }
    _onStoryboardInfoLoad(resuestId, rawData) {
        if (resuestId !== this._requestId || this.config?.props?.enableStoryboard === false) {
            return; // video changed or master was disabled before notification
        }
        this.model.update(rawData);
        this.emit('update', this.model);
        // A successful HTTP/Worker reply can still contain malformed storyboard
        // geometry. Never advertise unavailable images or block future retries.
        this.state.isStoryboardAvailable = this.model.isAvailable;
        if (!this.model.isAvailable) {
            this._loadingWatchId = null;
        }
    }
    _onStoryboardInfoLoadFail(resuestId, err) {
        if (resuestId !== this._requestId || this.config?.props?.enableStoryboard === false) {
            return; // obsolete loader failure after reset / feature disabled
        }
        console.warn('onStoryboardInfoFail', this._watchId, err);
        this._loadingWatchId = null; // 次の canPlay で再試行できるように
        this.model.update(null);
        this.emit('update', this.model);
        this.state.isStoryboardAvailable = false;
    }
    setCurrentTime(sec, forceUpdate) {
        if (this.view && this.model.isAvailable) {
            this.view.setCurrentTime(sec, forceUpdate);
        }
    }
    set currentTime(sec) {
        this.setCurrentTime(sec);
    }
    toggle() {
        if (!this.view) {
            return;
        }
        // Task942: when a shortcut has already written Config but its update
        // event has not fired, the view may still show the previous state.
        // A click must toggle the latest preference, not that stale view state.
        const next = this.config.props.enableStoryboardBar !== true;
        const shouldShow = next && this.config.props.enableStoryboard === true;
        if (this.view.isEnable !== shouldShow) {
            this.view.toggle();
        }
        this.config.props.enableStoryboardBar = next;
    }
}
//===END===
export {
  Storyboard,
  SeekBarThumbnail,
  StoryboardWorker,
  SavedSceneLoader
};
