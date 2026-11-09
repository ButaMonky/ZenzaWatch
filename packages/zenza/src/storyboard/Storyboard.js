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
//@require StoryboardInfoModel
//@require StoryboardView
//@require SeekBarThumbnail
//@require StoryboardWorker
class Storyboard extends Emitter {
    /** Independent passive sprite crop; never moves or seeks the live preview canvas.
     * Historical videos use cached bytes only: opening a library must not start
     * video sessions or fetch every storyboard sheet in the user's history. */
    createSavedPreview(host, videoId, time) {
        let disposed = false, revision = 0, releaseImage = null;
        host.textContent = '画像なし';
        host.style.position = 'relative';
        host.style.overflow = 'hidden';
        host.setAttribute('role', 'img');
        host.setAttribute('aria-label', '場面画像を利用できません');
        if (!Number.isFinite(time) || time < 0 || typeof videoId !== 'string' || !videoId ||
            this.config?.props?.enableStoryboard === false)
            return () => { };
        const infos = this._savedPreviewInfo ??= (new Map());
        const bytes = this._savedPreviewBytes ??= (new Map());
        const isCurrent = () => this._currentVideoWatchId === videoId && this.model?.isAvailable === true;
        let infoLease;
        const cached = () => {
            if (infoLease)
                return infoLease.promise;
            infoLease = infos.get(videoId);
            if (!infoLease) {
                const pending = Promise.resolve().then(async () => {
                    for (const type of ['domand', 'dmc']) {
                        const raw = await StoryboardCacheDb.get(videoId + '_' + type).catch(() => null);
                        if (raw?.watchId === videoId && raw.status === 'ok' && raw.storyboard)
                            return raw;
                    }
                    return null;
                });
                infoLease = { refs: 0, promise: pending };
                infos.set(videoId, infoLease);
            }
            infoLease.refs++;
            return infoLease.promise;
        };
        const draw = async () => {
            const seq = ++revision;
            releaseImage?.();
            releaseImage = null;
            host.textContent = '画像なし';
            if (this.config?.props?.enableStoryboard === false)
                return;
            const live = isCurrent(), raw = live ? this.model.rawData : await cached();
            if (disposed || seq !== revision || !raw || raw.watchId !== videoId)
                return;
            const model = new StoryboardInfoModel(raw);
            if (!model.isAvailable || model.cellCount <= 0 || time > model.duration)
                return;
            const pos = model.getThumbnailPosition(time * 1000), page = raw.storyboard.images[pos.page];
            let src;
            if (page?.buffer && Object.prototype.toString.call(page.buffer) === '[object ArrayBuffer]') {
                const key = page.buffer;
                let entry = bytes.get(key);
                if (!entry) {
                    entry = { refs: 0, url: URL.createObjectURL(new Blob([page.buffer])) };
                    bytes.set(key, entry);
                }
                entry.refs++;
                src = entry.url;
                releaseImage = () => { if (--entry.refs === 0) {
                    URL.revokeObjectURL(entry.url);
                    bytes.delete(key);
                } };
            }
            else {
                // Only the already-open current video may reuse its live URL.
                if (!live || typeof page?.url !== 'string' || !/^https?:\/\//.test(page.url))
                    return;
                src = page.url;
            }
            const image = host.ownerDocument.createElement('img');
            image.alt = '';
            image.draggable = false;
            image.crossOrigin = 'anonymous';
            image.style.cssText = `position:absolute;max-width:none;width:${model.cols * 100}%;height:${model.rows * 100}%;left:${-pos.col * 100}%;top:${-pos.row * 100}%;pointer-events:none;`;
            image.onload = () => { if (!disposed && seq === revision) {
                host.setAttribute('aria-label', '保存時刻付近の場面画像');
            } };
            image.onerror = () => { if (!disposed && seq === revision) {
                host.textContent = '画像なし';
                releaseImage?.();
                releaseImage = null;
            } };
            host.style.aspectRatio = String(model.cellWidth) + ' / ' + String(model.cellHeight);
            host.replaceChildren(image);
            image.src = src;
        };
        const update = () => { void draw().catch(() => { if (!disposed)
            host.textContent = '画像なし'; }); };
        this.on?.('update', update);
        this.on?.('reset', update);
        update();
        return () => {
            if (disposed)
                return;
            disposed = true;
            revision++;
            releaseImage?.();
            releaseImage = null;
            this.off?.('update', update);
            this.off?.('reset', update);
            if (infoLease && --infoLease.refs === 0 && infos.get(videoId) === infoLease)
                infos.delete(videoId);
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
  StoryboardWorker
};
