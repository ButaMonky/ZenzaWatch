import * as $ from 'jquery';
import * as _ from 'lodash';
import {global} from './ZenzaWatchIndex';
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
import {VideoHoverMenu} from './VideoHoverMenu';
import {NicoVideoPlayerDialog} from './NicoVideoPlayerDialog';
import {NicoVideoPlayerDialogViewSmallMode} from './NicoVideoPlayerDialogViewSmallMode';
import {NicoVideoPlayerDialogViewBookmarks} from './NicoVideoPlayerDialogViewBookmarks';
import {NicoVideoPlayerDialogViewFeedback} from './NicoVideoPlayerDialogViewFeedback';
import {VariablesMapper} from './VariablesMapper';

// GENERATED FROM tools/typescript-stage1/nico-src/NicoVideoPlayerDialogView.ts (Task1060). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require NicoVideoPlayerDialogViewSmallMode
//@require NicoVideoPlayerDialogViewBookmarks
//@require NicoVideoPlayerDialogViewFeedback
class NicoVideoPlayerDialogView extends Emitter {
    /** Watch errors may contain plain break tags, never trusted HTML. */
    static formatErrorMessage(value) {
        return value == null ? '' : String(value).replace(/<br\s*\/?\s*>/gi, '\n');
    }
    constructor(...args) {
        super();
        this.initialize(...args);
    }
    initialize(params) {
        const dialog = this._dialog = params.dialog;
        this._playerConfig = params.playerConfig;
        this._nicoVideoPlayer = params.nicoVideoPlayer;
        this._state = params.playerState;
        this._currentTimeGetter = params.currentTimeGetter;
        this._aspectRatio = 9 / 16;
        dialog.on('canPlay', this._onVideoCanPlay.bind(this));
        dialog.on('videoCount', this._onVideoCount.bind(this));
        dialog.on('error', this._onVideoError.bind(this));
        dialog.on('play', this._onVideoPlay.bind(this));
        dialog.on('playing', this._onVideoPlaying.bind(this));
        dialog.on('pause', this._onVideoPause.bind(this));
        dialog.on('stalled', this._onVideoStalled.bind(this));
        dialog.on('abort', this._onVideoAbort.bind(this));
        dialog.on('aspectRatioFix', this._onVideoAspectRatioFix.bind(this));
        dialog.on('volumeChange', this._onVolumeChange.bind(this));
        dialog.on('volumeChangeEnd', this._onVolumeChangeEnd.bind(this));
        dialog.on('beforeVideoOpen', this._onBeforeVideoOpen.bind(this));
        dialog.on('loadVideoInfoFail', this._onVideoInfoFail.bind(this));
        dialog.on('videoServerType', this._onVideoServerType.bind(this));
        this._initializeDom();
        this._state.on('update', this._onPlayerStateUpdate.bind(this));
        this._state.onkey('videoInfo', this._onVideoInfoLoad.bind(this));
    }
    async _initializeDom() {
        util.addStyle(NicoVideoPlayerDialogView.__css__);
        const $dialog = this._$dialog = util.$.html(NicoVideoPlayerDialogView.__tpl__.trim());
        const onCommand = this._onCommand.bind(this);
        const config = this._playerConfig;
        const state = this._state;
        this._$body = util.$('body, html');
        const $container = this._$playerContainer = $dialog.find('.zenzaPlayerContainer');
        const container = $container[0];
        const classList = this.classList = ClassList(container);
        this._initializeSmallModeDrag($container);
        this._initializeScreenFilter();
        container.addEventListener('click', (e) => {
            // 画面モード「小」でのドラッグ操作直後は、ドラッグの終了を動画クリックに
            // よる再生/一時停止トグルと誤認しないよう、1回だけこのclickを無視する
            // （_initializeSmallModeDrag参照）。
            if (this._suppressSmallModeClick) {
                this._suppressSmallModeClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            global.emitter.emitAsync('hideHover');
            if (e.target.classList.contains('touchWrapper') &&
                config.props.enableTogglePlayOnClick &&
                !classList.contains('menuOpen')) {
                onCommand('togglePlay');
            }
            e.preventDefault();
            e.stopPropagation();
            classList.remove('menuOpen');
        });
        container.addEventListener('command', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this._onCommand(e.detail.command, e.detail.param);
        });
        container.addEventListener('focusin', (e) => {
            const target = (e.path && e.path.length) ? e.path[0] : e.target;
            if (target.dataset.hasSubmenu) {
                classList.add('menuOpen');
            }
        });
        this._applyState();
        // マウスを動かしてないのにmousemoveが飛んできたらスルー
        let lastX = 0, lastY = 0;
        let onMouseMove = this._onMouseMove.bind(this);
        // is-mouseMoving（400ms）は、ホバーメニューや「小」モードのリサイズ
        // ハンドル等、コントロールバー以外の複数のUI要素の表示タイミングにも
        // 使われている（Task 039でこの400msに揃えられた経緯がある）ため、
        // ここは変更しない。
        let onMouseMoveEnd = _.debounce(this._onMouseMoveEnd.bind(this), 400);
        // コントロールバー専用の自動非表示はマウスメニュー用の400ms判定と
        // 独立させる。小画面だけ3秒、それ以外は従来の0.4秒とする。
        // 一時停止時の表示はTask936で任意設定（Task973以降は小で既定ON、全画面はOFF）。
        // ONにした場合はマウス移動と同じ自動非表示の時間を使う。
        let onControlBarActive = this._onControlBarActive.bind(this);
        // Keep the extended delay exclusively for the floating small player.
        this._onControlBarIdleDebounced = _.debounce(this._onControlBarIdle.bind(this), 3000);
        this._onControlBarIdleDebouncedDefault = _.debounce(this._onControlBarIdle.bind(this), 400);
        // Task938: apply freshly saved hide delays while the toolbar is already
        // active, rather than waiting for another pointer movement.
        if (typeof config.onkey === 'function') {
            for (const key of ['controlBar.hideAfterSeconds.small',
                'controlBar.hideAfterSeconds.fullscreen']) {
                config.onkey(key, () => this._onControlBarTimingConfigChange());
            }
        }
        container.addEventListener('mousemove', _.throttle((e) => {
            if (e.buttons === 0 && lastX === e.screenX && lastY === e.screenY) {
                return;
            }
            lastX = e.screenX;
            lastY = e.screenY;
            onMouseMove(e);
            onMouseMoveEnd(e);
            onControlBarActive(e);
            this._scheduleControlBarIdle();
        }, 100));
        $dialog
            .on('dblclick', (e) => {
            if (!e.target || e.target.id !== 'zenzaVideoPlayerDialog') {
                return;
            }
            if (config.props.enableDblclickClose) {
                this.emit('command', 'close');
            }
        })
            .toggleClass('is-guest', !util.isLogin());
        this.hoverMenu = new VideoHoverMenu({
            playerContainer: container,
            playerState: state,
            playerConfig: config
        });
        this.commentInput = new CommentInputPanel({
            $playerContainer: $container,
            playerConfig: config
        });
        this.commentInput.on('post', (e, chat, cmd) => this.emit('postChat', e, chat, cmd));
        let hasPlaying = false;
        this.commentInput.on('focus', (isAutoPause) => {
            hasPlaying = state.isPlaying;
            if (isAutoPause) {
                this.emit('command', 'pause');
            }
        });
        this.commentInput.on('blur', (isAutoPause) => {
            if (isAutoPause && hasPlaying && state.isOpen) {
                this.emit('command', 'play');
            }
        });
        this.commentInput.on('esc', () => this._escBlockExpiredAt = Date.now() + 1000 * 2);
        // Task 050 (A-4): 「小」モードでのコメント入力欄の位置追従・上下反転・
        // 横クランプは、この時点で.commentInputPanelのDOMが揃って初めて実測できる
        // （_initializeSmallModeDrag実行時点ではまだ存在しないため、関数だけを
        // thisに退避してもらっている）。フォーカスして幅が500pxに広がった時・
        // フォーカスが外れて幅が戻った時にも再計算が必要。
        if (this._updateCommentInputLayout) {
            this._updateCommentInputLayout();
            this.commentInput.on('focus', () => this._updateCommentInputLayout());
            this.commentInput.on('blur', () => this._updateCommentInputLayout());
            // Task 074: 入力欄の幅はアニメーションで変わるようになったため、
            // 幅の変化が終わった時点でもう一度はみ出しを計算し直す
            const panelElm = container.querySelector('.commentInputPanel');
            panelElm && panelElm.addEventListener('transitionend', (e) => {
                if (e.target === panelElm && e.propertyName === 'width') {
                    this._updateCommentInputLayout();
                }
            });
        }
        // this.settingPanel = new SettingPanel({
        //   $parent: $container,
        //   playerConfig: config,
        //   player: this._dialog
        // });
        // this.settingPanel.on('command', onCommand);
        await sleep.idle();
        this.videoControlBar = new VideoControlBar({
            $playerContainer: $container,
            playerConfig: config,
            player: this._dialog,
            playerState: this._state,
            currentTimeGetter: this._currentTimeGetter
        });
        this.videoControlBar.on('command', onCommand);
        this.videoControlBar.on('actionFeedback', this._onActionFeedback.bind(this));
        // SCUI-18: the existing seekbar/worker stays owned by VideoControlBar.
        this.sceneSearchBinding = new SceneSearchPlayerBinding({
            view: this, dialog: this._dialog, document, container,
            events: global.emitter, isFullscreen: () => Fullscreen.now(),
            onError: (code) => console.warn('[SCUI]', code)
        });
        this.sceneSearchBinding.attach();
        this._$errorMessageContainer = $container.find('.errorMessageContainer');
        // Task 049: 「小」モードの読み込み中背景を.loadingMessageContainer側にも
        // 出せるようにするための参照（_setThumbnail参照）。
        this._$loadingMessageContainer = $container.find('.loadingMessageContainer');
        await sleep.idle();
        this._initializeVideoInfoPanel();
        this._initializeResponsive();
        this.selectTab(this._state.currentTab);
        document.documentElement.addEventListener('paste', this._onPaste.bind(this));
        global.emitter.on('showMenu', () => this.addClass('menuOpen'));
        global.emitter.on('hideMenu', () => this.removeClass('menuOpen'));
        global.emitter.on('fullscreenStatusChange', () => this._applyScreenMode(true));
        document.body.append($dialog[0]);
        this.emitResolve('dom-ready');
    }
    _initializeVideoInfoPanel() {
        if (this.videoInfoPanel) {
            // The info panel and bookmark Dock have independent lifetimes.
            // A transient Dock mount failure must not permanently disable the button.
            if (!this.manualBookmarkDock && this._mountManualBookmarkDock()) {
                this._applyPendingVideoInfo();
            }
            return this.videoInfoPanel;
        }
        this._videoInfoPanelMounting = true;
        try {
            this.videoInfoPanel = new VideoInfoPanel({
                dialog: this,
                node: this._$playerContainer
            });
            this.videoInfoPanel.on('command', this._onCommand.bind(this));
            this._mountManualBookmarkDock();
        }
        finally {
            this._videoInfoPanelMounting = false;
            this._applyPendingVideoInfo();
        }
        return this.videoInfoPanel;
    }
    _onCommand(command, param) {
        switch (command) {
            case 'settingPanel':
                this.toggleSettingPanel();
                this._onActionFeedback(command, param);
                break;
            // Task 077: 反転は画面フィルターの設定(screenFilter.flipH/flipV)に統合した。
            // 見た目は今まで通り .is-flipH / .is-flipV クラス（transform）で反映する
            // （_initializeScreenFilter 参照）。
            case 'toggle-flipH':
                this.emit('command', 'toggle-screenFilter.flipH');
                break;
            case 'toggle-flipV':
                this.emit('command', 'toggle-screenFilter.flipV');
                break;
            case 'toggle-screenFilterPanel':
                this.toggleScreenFilterPanel();
                this._onActionFeedback(command, param);
                break;
            default:
                this.emit('command', command, param);
        }
    }
    async _onPaste(e) {
        const isZen = !!e.target.closest('.zenzaVideoPlayerDialog');
        const target = (e.path && e.path[0]) ? e.path[0] : e.target;
        console.log('onPaste', { e, target, isZen });
        if (!isZen && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
            return;
        }
        let text;
        try {
            text = await navigator.clipboard.readText();
        }
        catch (err) {
            window.console.warn(err, navigator.clipboard);
            text = e.clipboardData.getData('text/plain');
        }
        if (!text) {
            return;
        }
        text = text.trim();
        const isOpen = this._state.isOpen;
        // Task 074: ショート動画(ss〜)にも対応
        const watchIdReg = /((?:nm|sm|so|ss)\d+)/.exec(text);
        if (watchIdReg) {
            return this._onCommand('open', watchIdReg[1]);
        }
        if (!isOpen) {
            return;
        }
        const youtubeReg = /^https?:\/\/((www\.|)youtube\.com\/watch|youtu\.be)/.exec(text);
        if (youtubeReg) {
            return this._onCommand('setVideo', text);
        }
        const seekReg = /^(\d+):(\d+)$/.exec(text);
        if (seekReg) {
            return this._onCommand('seek', seekReg[1] * 60 + seekReg[2] * 1);
        }
        const mylistReg = /mylist(\/#\/|\/)(\d+)/.exec(text);
        if (mylistReg) {
            return this._onCommand('playlistSetMylist', mylistReg[2]);
        }
        const seriesReg = /series\/(\d+)/.exec(text);
        if (seriesReg) {
            return this._onCommand('playlistSetSeries', seriesReg[1]);
        }
        const ownerReg = /user\/(\d+)/.exec(text);
        if (ownerReg) {
            return this._onCommand('playlistSetUploadedVideo', ownerReg[1]);
        }
    }
    _initializeResponsive() {
        window.addEventListener('resize', _.debounce(this._updateResponsive.bind(this), 500));
        this.varMapper = new VariablesMapper({ config: this._playerConfig });
        this.varMapper.on('update', () => this._updateResponsive());
    }
    _updateResponsive({ onlyControlBar = false } = {}) {
        if (!this._state.isOpen) {
            return;
        }
        const $container = this._$playerContainer;
        const [header] = $container.find('.zenzaWatchVideoHeaderPanel');
        const config = this._playerConfig;
        // 画面の縦幅にシークバー分の余裕がある時は常時表示
        const update = () => {
            const w = global.innerWidth, h = global.innerHeight;
            const vMargin = h - w * this._aspectRatio;
            const controlBarMode = config.props.fullscreenControlBarMode;
            if (controlBarMode === 'always-hide') {
                this.toggleClass('showVideoControlBar', false);
                return;
            }
            const videoControlBarHeight = this.varMapper.videoControlBarHeight;
            let showVideoControlBar;
            switch (controlBarMode) {
                case 'always-show':
                    showVideoControlBar = true;
                    break;
                case 'auto':
                default:
                    // A-11: この「余白があれば常時表示」の判定は、ブラウザウィンドウ全体の
                    // 高さ/幅と動画のアスペクト比から「ページ内に常時表示できる余白があるか」
                    // を見るものであり、画面上の任意の位置へドラッグして動かす「小」モードの
                    // フローティング表示には意味を持たない（ウィンドウがたまたま縦長なだけで
                    // 常時表示になってしまい、意図した自動非表示が効かなくなる）。
                    // 「小」モードでは常にfalseとし、is-mouseMoving/:hoverベースの
                    // 自動非表示（下記CSS、および.zenzaSmallModeResizeHandle等と同じ仕組み）
                    // に一本化する。
                    // A-12: フルスクリーン（実機のフルスクリーン表示、および同じ`for-full`
                    // スコープのCSSが有効になるワイド/3Dモードも含む）でも、上と同じ理由で
                    // vMargin判定は意味を持たない（ウィンドウ/動画のアスペクト比次第で
                    // 常時表示になってしまい、意図した自動非表示が効かなくなる）。
                    // 2026-09-11のユーザー要望により、「小」モードと同様に常にfalseとし、
                    // is-mouseMoving/:hoverベースの自動非表示に一本化する。
                    showVideoControlBar = (this._state.screenMode === 'small' || this._isFullscreenControlBarScope())
                        ? false
                        : vMargin >= videoControlBarHeight;
            }
            this.toggleClass('showVideoControlBar', showVideoControlBar);
            this._syncActionFeedbackIsolation();
            if (onlyControlBar) {
                return;
            }
            const showVideoHeaderPanel = vMargin >= videoControlBarHeight + header.offsetHeight * 2;
            this.toggleClass('showVideoHeaderPanel', showVideoHeaderPanel);
        };
        update();
    }
    // A-12: コントロールバーの自動非表示CSS（`screenMode for-full`スコープ）が
    // 有効になるのと同じ条件。実機のフルスクリーン表示中に加え、フルスクリーンで
    // なくてもワイド/3Dモードは同じ`for-full`スコープが有効になる
    // （`_updateScreenModeStyle()`参照）ため、ここでも同様に扱う。
    _isFullscreenControlBarScope() {
        return Fullscreen.now() || this._state.screenMode === 'wide' || this._state.screenMode === '3D';
    }
    _onMouseMove() {
        this._releaseActionFeedbackIsolation();
        // Refresh before the existing early return: consecutive movements extend UI idle.
        this._onHoverUiActive();
        if (this._isMouseMoving) {
            return;
        }
        this.addClass('is-mouseMoving');
        this._isMouseMoving = true;
    }
    _onMouseMoveEnd() {
        if (!this._isMouseMoving) {
            return;
        }
        this.removeClass('is-mouseMoving');
        this._isMouseMoving = false;
    }
    // Discussion #36 / Task970: explanatory UI has a separate one-second idle
    // owner. Do not extend the shared 400ms cursor/resize state or toolbar timers.
    _onHoverUiActive() {
        if (this._hoverUiSuppressed) {
            return;
        }
        clearTimeout(this._hoverUiTimer);
        if (!this._isHoverUiActive) {
            this.addClass('is-hoverUiActive');
            this._isHoverUiActive = true;
        }
        this._hoverUiTimer = setTimeout(() => this._clearHoverUiActive(), 1000);
    }
    _clearHoverUiActive() {
        clearTimeout(this._hoverUiTimer);
        this._hoverUiTimer = undefined;
        if (this._isHoverUiActive) {
            this.removeClass('is-hoverUiActive');
        }
        this._isHoverUiActive = false;
    }
    _onControlBarTimingConfigChange() {
        if (this._isControlBarActive) {
            this._scheduleControlBarIdle();
        }
    }
    // Task936: small/fullscreen bar timers can be customized independently.
    // Keep the existing debounce paths for their historical defaults (3s/.4s),
    // and use a single bounded timer for other configured values. Other modes
    // keep their original 400ms behavior. Never affect hover-menu timing.
    _scheduleControlBarIdle() {
        const isSmall = this._state.screenMode === 'small' && !Fullscreen.now();
        const isFull = !isSmall && this._isFullscreenControlBarScope();
        const key = isSmall ? 'controlBar.hideAfterSeconds.small' :
            isFull ? 'controlBar.hideAfterSeconds.fullscreen' : null;
        const raw = key ? this._playerConfig?.props?.[key] : undefined;
        const valid = typeof raw === 'number' && Number.isFinite(raw) &&
            raw >= 0.2 && raw <= 10 && Math.abs(raw * 10 - Math.round(raw * 10)) < 0.000001;
        const ms = valid ? Math.round(raw * 1000) : isSmall ? 3000 : 400;
        const small = this._onControlBarIdleDebounced;
        const regular = this._onControlBarIdleDebouncedDefault;
        clearTimeout(this._controlBarIdleCustomTimer);
        this._controlBarIdleCustomTimer = null;
        if (ms === 3000 && isSmall) {
            regular?.cancel();
            small?.();
        }
        else if (ms === 400 && !isSmall) {
            small?.cancel();
            regular?.();
        }
        else {
            small?.cancel();
            regular?.cancel();
            this._controlBarIdleCustomTimer = setTimeout(() => {
                this._controlBarIdleCustomTimer = null;
                this._onControlBarIdle();
            }, ms);
        }
    }
    // コントロールバー専用の表示トリガー（2026-09-11追加）。is-mouseMovingとは
    // 別に持つ理由は_initializeDom側のコメント参照。
    _onControlBarActive() {
        this._releaseActionFeedbackIsolation();
        if (this._isControlBarActive) {
            return;
        }
        this.addClass('is-controlBarActive');
        this._isControlBarActive = true;
    }
    _onControlBarIdle() {
        if (!this._isControlBarActive) {
            return;
        }
        this.removeClass('is-controlBarActive');
        this._isControlBarActive = false;
        this._syncActionFeedbackIsolation();
    }
    _onVideoCanPlay(watchId, videoInfo, options) {
        this._libraryCanPlayVideo = watchId;
        this._trySavedLibraryRepeat();
        this.emit('canPlay', watchId, videoInfo, options);
    }
    _onVideoCount({ comment, view, mylist } = {}) {
        this.emit('videoCount', { comment, view, mylist });
    }
    _onVideoError(e) {
        this.emit('error', e);
    }
    _onBeforeVideoOpen() {
        this._pendingLibraryRepeat = undefined;
        this._libraryCanPlayVideo = undefined;
        this._pendingVideoInfo = undefined;
        this._bookmarkActivation = undefined;
        this.manualBookmarkDock?.deactivate();
        this._clearActionFeedback();
        this._clearHoverUiActive();
        this._setThumbnail();
    }
    _onVideoInfoLoad(videoInfo) {
        // A failed loader publishes its info through the same state subscription.
        this._pendingVideoInfo = { requestId: this._dialog?._requestId,
            info: videoInfo, failed: !!this._state.isError };
        this._applyPendingVideoInfo();
    }
    _onVideoInfoFail(videoInfo) {
        this._pendingVideoInfo = { requestId: this._dialog?._requestId,
            info: videoInfo, failed: true };
        this._applyPendingVideoInfo();
    }
    _applyPendingVideoInfo() {
        const pending = this._pendingVideoInfo;
        if (!this.videoInfoPanel || this._videoInfoPanelMounting || !pending ||
            pending.requestId !== this._dialog?._requestId) {
            return;
        }
        const { info: videoInfo, requestId } = pending;
        if (pending.failed || this._state.isError) {
            this._bookmarkActivation = undefined;
            this.manualBookmarkDock?.deactivate();
            if (videoInfo) {
                this.videoInfoPanel.update(videoInfo);
            }
            else {
                this.videoInfoPanel.onLoadFail();
            }
            return;
        }
        this.videoInfoPanel.update(videoInfo);
        // Rendering may synchronously open another video or deliver a newer result.
        if (this._pendingVideoInfo !== pending || requestId !== this._dialog?._requestId) {
            return;
        }
        if (this.manualBookmarkDock && typeof videoInfo?.watchId === 'string' &&
            Number.isFinite(videoInfo.duration) && videoInfo.duration > 0) {
            const active = this._bookmarkActivation;
            if (active && active.requestId === requestId && active.videoId === videoInfo.watchId &&
                active.duration === videoInfo.duration) {
                return;
            }
            const activation = { requestId, videoId: videoInfo.watchId, duration: videoInfo.duration };
            this._bookmarkActivation = activation;
            const clearFailedActivation = () => {
                if (this._bookmarkActivation === activation) {
                    this._bookmarkActivation = undefined;
                }
            };
            void this.manualBookmarkDock.activate(videoInfo.watchId, videoInfo.duration).then(result => {
                if (result?.status === 'error') {
                    clearFailedActivation();
                }
                else
                    this._trySavedLibraryRepeat();
            }, () => {
                clearFailedActivation();
                console.warn('Manual bookmark session unavailable');
            });
        }
        else {
            this._bookmarkActivation = undefined;
            this.manualBookmarkDock?.deactivate();
        }
    }
    _onVideoServerType(type, sessionInfo) {
        this.emit('videoServerType', type, sessionInfo);
    }
    _onVideoPlay() {
    }
    _onVideoPlaying() {
    }
    _clearShortcutToggleFeedback() {
        this._clearActionFeedback();
    }
    _onActionFeedback(command, param) {
        // Local consumers keep executing their own actions; this notification is
        // presentation only. The keyboard dispatcher owns its single final cue.
        if (this._keyboardFeedbackCommand) {
            return;
        }
        try {
            this._flashActionFeedback(command, param);
        }
        catch (_) { }
    }
    _releaseActionFeedbackIsolation() {
        this._removeActionFeedbackIsolation(this._shortcutFeedbackBar);
        this._shortcutFeedbackBar = undefined;
        this._shortcutFeedbackKeyboard = false;
    }
    _removeActionFeedbackIsolation(bar) {
        if (!bar?.classList.contains('is-action-feedback-only')) {
            return;
        }
        // Otherwise restoring siblings while opacity fades 1 -> 0 exposes the
        // entire toolbar for one transition after expiry or a different target.
        const transition = bar.style.getPropertyValue('transition');
        const priority = bar.style.getPropertyPriority('transition');
        bar.style.setProperty('transition', 'none', 'important');
        bar.classList.remove('is-action-feedback-only');
        void bar.ownerDocument.defaultView?.getComputedStyle(bar).opacity;
        if (transition) {
            bar.style.setProperty('transition', transition, priority);
        }
        else {
            bar.style.removeProperty('transition');
        }
    }
    _syncActionFeedbackIsolation() {
        const icon = this._shortcutFeedbackIcon;
        const bar = icon?.closest('.videoControlBar');
        if (!bar) {
            return;
        }
        const host = this._$playerContainer?.[0];
        const full = this._isFullscreenControlBarScope();
        const mode = icon.ownerDocument.body.dataset.fullscreenControlBarMode || 'auto';
        const autoHides = full || ['small', 'sideView'].includes(this._state.screenMode);
        const alwaysHide = full && mode === 'always-hide';
        const forcedVisible = host?.classList.contains('showVideoControlBar') ||
            (full && mode === 'always-show');
        const active = !alwaysHide && (this._isControlBarActive ||
            host?.matches('.is-controlBarActive, .volumeChanging'));
        const interacting = bar.matches(':hover, .is-dragging') ||
            (alwaysHide && bar.matches(':focus-within'));
        // Decide from the owners of visibility, not animated opacity. An old
        // opacity:1 frame must not expose all controls on a rapid second shortcut.
        const isolate = autoHides && !forcedVisible && !active && !interacting;
        if (isolate) {
            bar.classList.add('is-action-feedback-only');
        }
        else {
            this._removeActionFeedbackIsolation(bar);
        }
        this._shortcutFeedbackBar = isolate ? bar : undefined;
    }
    _onVideoPause() {
        if (this._keyboardFeedbackCommand || (this._shortcutFeedbackKeyboard &&
            this._shortcutFeedbackIcon?.classList.contains('togglePlay'))) {
            return;
        }
        // Task936 / Issue #8: ordinary pause follows the per-mode preference
        // (Task973 defaults small to ON and fullscreen to OFF). Keyboard action
        // feedback above stays isolated; pointer activity keeps its own timer.
        const isSmall = this._state.screenMode === 'small' && !Fullscreen.now();
        if (isSmall && this._playerConfig?.props?.['controlBar.showOnPause.small'] !== true) {
            return;
        }
        if (!isSmall && this._isFullscreenControlBarScope() &&
            this._playerConfig?.props?.['controlBar.showOnPause.fullscreen'] !== true) {
            return;
        }
        this._onControlBarActive();
        this._scheduleControlBarIdle();
    }
    _onVideoStalled() {
    }
    _onVideoAbort() {
    }
    _onVideoAspectRatioFix(ratio) {
        this._aspectRatio = ratio;
        this._updateResponsive();
    }
    _onVolumeChange( /*vol, mute*/) {
        if (this._keyboardFeedbackCommand || (this._shortcutFeedbackKeyboard &&
            this._shortcutFeedbackIcon?.matches('.volumeControl, .muteSwitch'))) {
            return;
        }
        this.addClass('volumeChanging');
    }
    _onVolumeChangeEnd( /*vol, mute*/) {
        this.removeClass('volumeChanging');
    }
    _onScreenModeChange() {
        this._applyScreenMode();
        if (this._isControlBarActive) {
            this._scheduleControlBarIdle();
        }
    }
    _getStateClassNameTable() {
        // TODO: テーブルなくても対応できるようにcss名を整理
        return this._classNameTable = this._classNameTable || objUtil.toMap({
            isAbort: 'is-abort',
            isBackComment: 'is-backComment',
            isShowComment: 'is-showComment',
            isEnableFilter: 'is-enableFilter',
            isDebug: 'is-debug',
            isDomandAvailable: 'is-domandAvailable',
            isDmcAvailable: 'is-dmcAvailable',
            isError: 'is-error',
            isLoading: 'is-loading',
            isMute: 'is-mute',
            isLoop: 'is-loop',
            isOpen: 'is-open',
            isPlaying: 'is-playing',
            isSeeking: 'is-seeking',
            isPausing: 'is-pausing',
            //      isStalled: 'is-stalled',
            isLiked: 'is-liked',
            isChanging: 'is-changing',
            isUpdatingDeflist: 'is-updatingDeflist',
            isUpdatingMylist: 'is-updatingMylist',
            isPlaylistEnable: 'is-playlistEnable',
            isCommentPosting: 'is-commentPosting',
            isRegularUser: 'is-regularUser',
            isWaybackMode: 'is-waybackMode',
            isNotPlayed: 'is-notPlayed',
            isYouTube: 'is-youTube'
        });
    }
    _onPlayerStateChange(changedState) {
        for (const key of changedState.keys()) {
            this._onPlayerStateUpdate(key, changedState.get(key));
        }
    }
    _onPlayerStateUpdate(key, value) {
        switch (key) {
            case 'thumbnail':
                return this._setThumbnail(value);
            case 'screenMode':
            case 'isOpen':
                if (this._state.isOpen) {
                    this.show();
                    this._onScreenModeChange();
                }
                else {
                    this.hide();
                }
                return;
            case 'errorMessage':
                return this._$errorMessageContainer[0].textContent = NicoVideoPlayerDialogView.formatErrorMessage(value);
            case 'currentTab':
                return this.selectTab(value);
        }
        const table = this._getStateClassNameTable();
        const className = table.get(key);
        if (className) {
            this.toggleClass(className, !!value);
        }
    }
    _applyState() {
        const table = this._getStateClassNameTable();
        const state = this._state;
        for (const [key, className] of table) {
            this.classList.toggle(className, state[key]);
        }
        if (this._state.isOpen) {
            this._applyScreenMode();
        }
    }
    _getScreenModeClassNameTable() {
        return [
            'zenzaScreenMode_3D',
            'zenzaScreenMode_small',
            'zenzaScreenMode_sideView',
            'zenzaScreenMode_normal',
            'zenzaScreenMode_big',
            'zenzaScreenMode_wide'
        ];
    }
    _applyScreenMode(force = false) {
        const screenMode = this._state.isOpen ? `zenzaScreenMode_${this._state.screenMode}` : '';
        const modeKey = screenMode + ':' + util.fullscreen.now();
        if (!force && this._lastScreenMode === modeKey) {
            return;
        }
        this._lastScreenMode = modeKey;
        const modes = this._getScreenModeClassNameTable();
        const isFull = util.fullscreen.now();
        Object.assign(document.body.dataset, {
            screenMode: this._state.screenMode,
            fullscreen: isFull ? 'yes' : 'no'
        });
        modes.forEach(m => this._$body.raf.toggleClass(m, m === screenMode && !isFull));
        this._updateScreenModeStyle();
        this._syncActionFeedbackIsolation();
        // Task 050 (A-4): 他の画面モードから「小」に切り替わった直後は、
        // コメント入力欄の反転・クランプ状態が古いままになるため再計算する。
        // body側のモードclass付与自体がraf.toggleClassで次フレームに遅延するため
        // （直後に測ると切り替え前のレイアウトを読んでしまう）、こちらも1フレーム
        // 遅らせて測る。
        if (this._updateCommentInputLayout) {
            requestAnimationFrame(() => this._updateCommentInputLayout());
        }
        // A-11: 「小」モードへ切り替わった直後に、直前の画面モードで計算された
        // showVideoControlBar（常時表示）が残ったままだと自動非表示が効かない。
        // 画面モード切り替え時に再計算しておく（body側のクラス付与自体は
        // raf.toggleClassで次フレームになるため、こちらも1フレーム遅らせる）。
        if (this.varMapper) {
            requestAnimationFrame(() => this._updateResponsive({ onlyControlBar: true }));
        }
    }
    _updateScreenModeStyle() {
        if (!this._state.isOpen) {
            util.StyleSwitcher.update({ off: 'style.screenMode' });
            return;
        }
        if (Fullscreen.now()) {
            util.StyleSwitcher.update({
                on: 'style.screenMode.for-full, style.screenMode.for-screen-full',
                off: 'style.screenMode:not(.for-full):not(.for-screen-full), link[href*="watch.css"]'
            });
            return;
        }
        let on, off;
        switch (this._state.screenMode) {
            case '3D':
            case 'wide':
                on = 'style.screenMode.for-full, style.screenMode.for-window-full';
                off = 'style.screenMode:not(.for-full):not(.for-window-full), link[href*="watch.css"]';
                break;
            default:
            case 'normal':
            case 'big':
                on = 'style.screenMode.for-dialog, style.screenMode.for-big, style.screenMode.for-normal, link[href*="watch.css"]';
                off = 'style.screenMode:not(.for-dialog):not(.for-big):not(.for-normal)';
                break;
            case 'small':
            case 'sideView':
                on = 'style.screenMode.for-popup, style.screenMode.for-sideView, .style.screenMode.for-small, link[href*="watch.css"]';
                off = 'style.screenMode:not(.for-popup):not(.for-sideView):not(.for-small)';
                break;
        }
        util.StyleSwitcher.update({ on, off });
    }
    show() {
        this._hoverUiSuppressed = false;
        ClassList(this._$dialog[0]).add('is-open');
        if (!Fullscreen.now()) {
            ClassList(document.body).remove('fullscreen');
        }
        this._$body.raf.addClass('showNicoVideoPlayerDialog');
        util.StyleSwitcher.update({ on: 'style.zenza-open' });
        this._updateScreenModeStyle();
    }
    hide() {
        this.manualBookmarkDock?.deactivate();
        this._hoverUiSuppressed = true;
        this._clearHoverUiActive();
        // Detach one-shot keyboard/toolbar timers with the player, not the page.
        this._clearShortcutToggleFeedback();
        clearTimeout(this._controlBarIdleCustomTimer);
        this._controlBarIdleCustomTimer = null;
        this._onControlBarIdleDebounced?.cancel();
        this._onControlBarIdleDebouncedDefault?.cancel();
        this._onControlBarIdle();
        ClassList(this._$dialog[0]).remove('is-open');
        this.settingPanel && this.settingPanel.close();
        this.screenFilterPanel && this.screenFilterPanel.close();
        this._$body.raf.removeClass('showNicoVideoPlayerDialog');
        util.StyleSwitcher.update({ off: 'style.zenza-open, style.screenMode', on: 'link[href*="watch.css"]' });
        this._clearClass();
    }
    _clearClass() {
        const modes = this._getScreenModeClassNameTable().join(' ');
        this._lastScreenMode = '';
        this._$body.raf.removeClass(modes);
    }
    _setThumbnail(thumbnail) {
        // base hrefのせいで変なurlを参照してしまうので、thumbnailが無ければ
        // 適当な黒画像にする
        const url = `url(${thumbnail || CONSTANT.BLANK_PNG})`;
        this.css('background-image', url);
        // Task 049: 「小」モードでドラッグした位置に読み込み中の背景も追従させる
        // ため、.zenzaPlayerContainer自身だけでなく.loadingMessageContainer側にも
        // 同じ画像を設定しておく（該当CSSは.zenzaScreenMode_small配下でのみ有効）。
        if (this._$loadingMessageContainer && this._$loadingMessageContainer[0]) {
            this._$loadingMessageContainer.raf.css('background-image', url);
        }
    }
    focusToCommentInput() {
        // 即フォーカスだと入力欄に"C"が入ってしまうのを雑に対処
        window.setTimeout(() => this.commentInput.focus(), 0);
    }
    toggleSettingPanel() {
        if (!this.settingPanel) {
            this.settingPanel = document.createElement('zenza-setting-panel');
            this.settingPanel.config = this._playerConfig;
            this._$playerContainer.append(this.settingPanel);
        }
        this.settingPanel.toggle();
    }
    // Task 077: 画面フィルターのパネル（動画を見ながら調整できる小さなパネル）
    toggleScreenFilterPanel(open) {
        if (!this.screenFilterPanel) {
            this.screenFilterPanel = new ScreenFilterPanel({ config: this._playerConfig });
        }
        // 大きな設定パネルが開いていると動画が隠れて見比べられないので閉じる
        if (this.settingPanel && this.settingPanel.isOpen) {
            this.settingPanel.close();
        }
        const next = typeof open === 'boolean' ? open : !this.screenFilterPanel.isOpen;
        next ? this.screenFilterPanel.open() : this.screenFilterPanel.close();
    }
    _initializeScreenFilter() {
        const config = this._playerConfig;
        ScreenFilter.initialize(config);
        const applyFlip = () => {
            this.classList.toggle('is-flipH', !!config.props['screenFilter.flipH']);
            this.classList.toggle('is-flipV', !!config.props['screenFilter.flipV']);
        };
        config.onkey('screenFilter.flipH', applyFlip);
        config.onkey('screenFilter.flipV', applyFlip);
        applyFlip();
    }
    get$Container() {
        return this._$playerContainer;
    }
    css(key, val) {
        this._$playerContainer.raf.css(key, val);
    }
    addClass(name) {
        return this.classList.add(name);
    }
    removeClass(name) {
        return this.classList.remove(name);
    }
    toggleClass(name, v) {
        this.classList.toggle(name, v);
    }
    hasClass(name) {
        return this.classList.contains(name);
    }
    appendTab(name, title) {
        return this.videoInfoPanel.appendTab(name, title);
    }
    selectTab(name) {
        if (name === 'notificationHistory') {
            name = 'videoInfoTab';
        }
        if (name === 'relatedVideoTab' &&
            this._playerConfig.getValue('ui.info.relatedTab') === false) {
            name = 'videoInfoTab';
        }
        this._playerConfig.props.videoInfoPanelTab = name;
        this._state.currentTab = name;
        this.videoInfoPanel.selectTab(name);
        global.emitter.emit('tabChange', name);
    }
    execCommand(command, param) {
        this.emit('command', command, param);
    }
    blinkTab(name) {
        this.videoInfoPanel.blinkTab(name);
    }
    clearPanel() {
        this.videoInfoPanel.clear();
    }
}
for (const role of [NicoVideoPlayerDialogViewSmallMode, NicoVideoPlayerDialogViewBookmarks, NicoVideoPlayerDialogViewFeedback]) {
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(role))) {
        Object.defineProperty(NicoVideoPlayerDialogView.prototype, key, { ...descriptor, enumerable: false });
    }
}
util.addStyle(`
  .is-watch .BaseLayout {
    display: none;
  }
  #zenzaVideoPlayerDialog {
    touch-action: manipulation; /* for Safari */
    touch-action: none;
  }
  #zenzaVideoPlayerDialog::before {
    display: none;
  }

  .zenzaPlayerContainer {
    left: 0 !important;
    top:  0 !important;
    width:  100vw !important;
    height: 100vh !important;
    contain: size layout;
  }

  .videoPlayer,
  .commentLayerFrame,
  .resizeObserver {
    top:  0 !important;
    left: 0 !important;
    width:  100vw !important;
    height: 100% !important;
    right:  0 !important;
    border: 0 !important;
    z-index: 100 !important;
    contain: layout style size paint;
    will-change: transform,opacity;
  }
  .resizeObserver {
    z-index: -1;
    opacity: 0;
    pointer-events: none;
  }

  .is-open .videoPlayer>* {
    cursor: none;
  }

  .showVideoControlBar {
    --padding-bottom: ${VideoControlBar.BASE_HEIGHT}px;
    --padding-bottom: var(--zenza-control-bar-height);
  }
  .zenzaStoryboardOpen .showVideoControlBar {
    --padding-bottom: calc(var(--zenza-control-bar-height) + 80px);
  }
  .zenzaStoryboardOpen.is-fullscreen .showVideoControlBar {
    --padding-bottom: calc(var(--zenza-control-bar-height) + 50px);
  }

  .showVideoControlBar .videoPlayer,
  .showVideoControlBar .commentLayerFrame,
  .showVideoControlBar .resizeObserver {
    height: calc(100% - var(--padding-bottom)) !important;
  }

  .showVideoControlBar .videoPlayer {
    z-index: 100 !important;
  }

  .showVideoControlBar .commentLayerFrame {
    z-index: 101 !important;
  }

  /* Task 063: enableCommentPanel(コメントパネル表示ON/OFF、上級設定/ショートカット)
     がfalseの時、動画情報パネルの「コメント」タブ自体をタブボタンごと隠す。
     appendTab()が生成する.tabSelect.<tabName> / .tabs.<tabName>のペアを、
     この時だけまとめて非表示にする。 */
  .hideCommentPanelTab .tabSelect.comment,
  .hideCommentPanelTab .tabs.comment {
    display: none !important;
  }

  body[data-screen-mode="3D"] .zenzaPlayerContainer .videoPlayer {
    transform: perspective(700px) rotateX(10deg);
    margin-top: -5%;
  }

  .zenzaPlayerContainer {
    left: 0;
    width: 100vw;
    height: 100vh;
    box-shadow: none;
  }

  /* Fullscreen / wide-window mode only. Keep the video at its normal size
     and draw comments above the video across the entire player viewport.
     Override the "showVideoControlBar" reduced height so comments also pass
     through the bottom edge; controls retain their own higher UI layer.
     The normal, big, small and side-view stylesheets are unaffected. */
  .zenzaPlayerContainer.is-backComment .commentLayerFrame {
    position: absolute;
    top: 0 !important;
    left: 0 !important;
    right: 0;
    bottom: 0;
    width: 100% !important;
    height: 100% !important;
    z-index: 101 !important;
    pointer-events: none;
  }

  body[data-screen-mode="3D"] .zenzaPlayerContainer .videoPlayer {
    transform: perspective(600px) rotateX(10deg);
    height: 100%;
  }

  body[data-screen-mode="3D"] .zenzaPlayerContainer .commentLayerFrame {
    transform: translateZ(0) perspective(600px) rotateY(30deg) rotateZ(-15deg) rotateX(15deg);
    opacity: 0.9;
    height: 100%;
    margin-left: 20%;
  }

`, { className: 'screenMode for-full', disabled: true });
util.addStyle(`
  body #zenzaVideoPlayerDialog {
    contain: style size;
  }

  #zenzaVideoPlayerDialog::before {
    display: none;
  }

  body.zenzaScreenMode_sideView {
    --sideView-left-margin: ${CONSTANT.SIDE_PLAYER_WIDTH + 24}px;
    --sideView-top-margin: 76px;
    margin-left: var(--sideView-left-margin);
    margin-top: var(--sideView-top-margin);

    width: auto;
  }

  body.zenzaScreenMode_sideView.nofix {
    --sideView-top-margin: 40px;
  }
  body.zenzaScreenMode_sideView:not(.nofix) #siteHeader {
    width: auto;
  }
  body.zenzaScreenMode_sideView:not(.nofix) #siteHeader #siteHeaderInner {
    width: auto;
  }

 .zenzaScreenMode_sideView .zenzaVideoPlayerDialog.is-open,
 .zenzaScreenMode_small .zenzaVideoPlayerDialog.is-open {
    display: block;
    top: 0; left: 0; right: 100%; bottom: 100%;
  }

  .zenzaScreenMode_sideView .zenzaPlayerContainer {
    width: ${CONSTANT.SIDE_PLAYER_WIDTH}px;
    height: ${CONSTANT.SIDE_PLAYER_HEIGHT}px;
  }
  /* 画面モード「小」のサイズは、リサイズ機能（Task 032）を持つため下記で個別に指定する */

  /*
    画面モード「小」では、.videoControlBar（シークバーや各種アイコン）が
    .zenzaPlayerContainerの子要素でありながらposition: fixedで画面下に
    固定される設計になっている。もし.zenzaPlayerContainer自体にtransformを
    掛けると、position: fixedの子要素のcontaining blockがビューポートから
    .zenzaPlayerContainerに変わってしまい（CSSの仕様上、transformを持つ要素は
    position: fixedな子孫のcontaining blockになる）、シークバー等の表示位置と
    クリック判定がずれる不具合になる（Task 031で発覚・修正）。
    このため、ドラッグ分のオフセットは.zenzaPlayerContainer自体にではなく、
    動画本体（.videoPlayer）とコメント描画レイヤー（.commentLayerFrame）に
    だけtransformとして適用する。.videoControlBarを含む
    .zenzaPlayerContainer自身のレイアウトには一切触れないため、シークバーは
    元のスクリプト通り画面下に固定されたままになる。
    他の画面モードのCSS（left/top/right/bottom等）にも一切触れないため、
    通常時（オフセット0）は今まで通り左上に表示され、他の画面モードの
    レイアウトにも影響しない。

    注意（Task 033で追加）: リサイズつまみ・アスペクト比ロックボタン・
    リセットボタン（.zenzaSmallModeResizeHandle等）は.zenzaPlayerContainerの
    直接の子として追加されており、.videoPlayer/.commentLayerFrameの中には
    入っていない。そのため、これらにも同じtransformを適用しておかないと、
    動画だけがドラッグで動いて、これらのボタン・つまみは元の（静的な）
    位置に取り残されてしまう（「画面に何か残ってしまう」不具合の原因）。
    CSSカスタムプロパティは.zenzaPlayerContainerに設定されており子孫に
    継承されるため、同じtransform宣言をこれらの要素にも加えるだけで、
    動画と一緒に追従するようになる。

    注意（Task 035で追加）: いいね・ツイート・マイリスト登録・閉じるボタン等
    （VideoHoverMenuが描画する.hoverMenuContainerとその中の各
    .menuItemContainer、中央の再生/一時停止トグル等すべて含む）も、
    .zenzaPlayerContainerに直接appendされる別コンポーネントで、
    上と全く同じ理由で取り残されていた。

    注意（Task 036で修正）: Task 035では.hoverMenuContainer自体に
    transformを掛けていたが、これは誤りだった。.hoverMenuContainerには
    もともとposition指定がなく（static）、"contain: style size"が
    付いているだけで明示的なwidth/heightも無い。CSSの仕様上、transformを
    持つ要素はposition値によらずabsolute配置された子孫のcontaining block
    になるため、.hoverMenuContainerにtransformを付けた瞬間、中の
    .menuItemContainer（right:0/top:0等で自分自身を配置している）の基準が
    「.zenzaPlayerContainer」から「サイズを持たない.hoverMenuContainer」に
    変わってしまい、各メニューが本来の四隅ではなく原点付近に寄って
    表示される不具合になっていた（「ボタンが変な位置になる」不具合）。
    .menuItemContainer自体はTask 035以前から既にposition: absoluteで
    .zenzaPlayerContainerを基準に配置されているため、代わりに
    .menuItemContainer側へ直接transformを掛ける。この場合は
    「transformを持つ要素が新たなcontaining blockになる」影響を受けるのは
    .menuItemContainerの中身（.menuButton等、既に.menuItemContainer
    自身を基準に配置されている）だけなので、位置がズレる心配はない。

    ただし中央の再生/一時停止トグル（.togglePlayMenu、
    .menuItemContainer.centerでもある）だけは例外で、元々
    "top:50%;left:50%;transform:translate(-50%,-50%) scale(...)"という
    別のtransformで自分自身を中央寄せしている。ここに単純に
    ドラッグ分のtranslateを追加すると、後勝ちのCSSでtransform宣言
    そのものが上書きされ、中央寄せが効かなくなってしまう
    （左上を基準にズレて表示される）。そのため.togglePlayMenuは
    このルールの対象から除外し、直後の別ルールでcalc()を使い
    「中央寄せ＋ドラッグ追従」を1つのtransformに両立させている。

    注意（Task 049で追加）: 読み込み中表示（.loadingMessageContainer）も、
    上と全く同じ理由（.zenzaPlayerContainerの直接の子として追加され、
    videoPlayer/commentLayerFrameとは別に自分自身のright/bottom指定で
    位置決めしている）で取り残されていた。新しい動画を読み込む際、動画本体は
    display:noneになって消え、代わりにこの読み込み中表示が出るが、これに
    ドラッグ分のtransformが掛かっていなかったため、「小」モードで動画を
    移動した状態で新しい動画を開くと、読み込み中の表示だけが常に
    ドラッグ前の初期位置（画面左上）に出てしまっていた。
    （なお.errorMessageContainerも同じ構造だが、こちらは既に
    "top:50%;left:50%;transform:translate(-50%,-50%)"という中央寄せの
    transformを自分で持っており、ここに単純に追加すると
    .togglePlayMenuで起きたのと同じ理由で中央寄せが壊れる。対応するには
    calc()での合成が必要になるため、今回の依頼（読み込み中表示のみ）の
    範囲外として見送った。 → Task 054で対応。.togglePlayMenuと同じ
    calc()合成のルールを別途追加した。） */
  .zenzaScreenMode_small .zenzaPlayerContainer .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer .commentLayerFrame,
  .zenzaScreenMode_small .zenzaPlayerContainer > .zenzaSmallModeResizeHandle,
  .zenzaScreenMode_small .zenzaPlayerContainer > .zenzaSmallModeAspectLockButton,
  .zenzaScreenMode_small .zenzaPlayerContainer > .zenzaSmallModeResetButton,
  .zenzaScreenMode_small .zenzaPlayerContainer > .loadingMessageContainer,
  .zenzaScreenMode_small .zenzaPlayerContainer .hoverMenuContainer .menuItemContainer:not(.togglePlayMenu) {
    transform: translate(var(--zenzaSmallDragX, 0px), var(--zenzaSmallDragY, 0px));
    will-change: transform;
  }
  /* .togglePlayMenu（中央の再生/一時停止トグル）専用: 中央寄せの
     translate(-50%,-50%)にドラッグ分のオフセットをcalc()で合成する。
     :hover/:activeでのscale変化（元のCSSルール）を壊さないよう、
     それぞれの状態ごとに個別に上書きする。 */
  .zenzaScreenMode_small .zenzaPlayerContainer .hoverMenuContainer .togglePlayMenu {
    transform:
      translate(calc(-50% + var(--zenzaSmallDragX, 0px)), calc(-50% + var(--zenzaSmallDragY, 0px)))
      scale(1.5);
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .hoverMenuContainer .togglePlayMenu:hover {
    transform:
      translate(calc(-50% + var(--zenzaSmallDragX, 0px)), calc(-50% + var(--zenzaSmallDragY, 0px)))
      scale(1.6);
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .hoverMenuContainer .togglePlayMenu:active {
    transform:
      translate(calc(-50% + var(--zenzaSmallDragX, 0px)), calc(-50% + var(--zenzaSmallDragY, 0px)))
      scale(2.0, 1.2);
  }
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeDragging .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeDragging .commentLayerFrame {
    transition: none;
  }
  /* .errorMessageContainer（エラー表示）専用: 「小」モードでは他の要素と違い
     単純にtranslate(--zenzaSmallDragX/Y)を追加できない（元々自分自身の中央寄せ
     translate(-50%,-50%)を持っているため）。.togglePlayMenuと同じ要領で
     calc()で合成する（Task 054。ドラッグして動かした状態でエラーが出ると、
     動画本体は追従した位置に表示されるのにエラー表示だけドラッグ前の位置
     （.zenzaPlayerContainerの中央、多くの場合は画面左上寄り）に出てしまう
     不具合があった）。 */
  .zenzaScreenMode_small .zenzaPlayerContainer.is-error .errorMessageContainer {
    transform:
      translate(calc(-50% + var(--zenzaSmallDragX, 0px)), calc(-50% + var(--zenzaSmallDragY, 0px)));
  }
  /* Task 050 (A-4): コメント入力欄（.commentInputPanel）の「小」モード追従。
     通常はposition: fixedでビューポート基準に配置されているため、「小」モードで
     動画をドラッグしても追従しなかった。「小」モードに限り、動画と同じ
     .zenzaPlayerContainerを基準にしたposition: absoluteへ切り替え、動画の直下に
     配置した上で、.togglePlayMenuと同じ要領で中央寄せのtranslate(-50%, 0)と
     ドラッグ分のtransform（--zenzaSmallDragX/Y）をcalc()で合成する。
     画面外にはみ出す場合の「上に回り込ませる」上下反転は、常にtop: 100%を
     基準にしたまま、--zenzaCommentPanelFlipY（px指定のtranslateY加算分）で
     表現する。実際に描画されたコメント欄のサイズが必要なためJS側
     （_initializeSmallModeDrag内のupdateCommentInputLayout）で計算する
     （ドラッグ中は毎フレーム、それ以外はリサイズ・ウィンドウリサイズ・
     フォーカス変化のたびに再計算）。左右にはみ出す場合の補正
     （--zenzaCommentPanelClampX）も同じ関数内で計算する。
     --zenzaCommentPanelFlipYだけを下の@propertyでtransition可能な型として
     登録し、このプロパティにだけtransitionを掛けることで、ドラッグ追従の
     translateX/Y（--zenzaSmallDragX/Y、他の小モード要素と同じく常に即時反映）は
     従来通り一切遅延させずに、上下反転の瞬間だけ「さっと動く」アニメーションに
     している（実機フィードバック: 「はみ出る場合の上部下部移動には
     アニメーションがあるといい」への対応）。
     幅は「動画の幅より狭ければ動画の幅に合わせて縮む」仕様のため、
     min()で.zenzaPlayerContainerの幅（100%）と既定幅を比較している
     （containing blockが.zenzaPlayerContainerになるため、リサイズにも
     追加のJSなしでCSSだけで追従する）。フォーカス時は通常幅まで広がる。
     画面端の余白は実機フィードバックにより16px→8pxへ変更した。 */
  @property --zenzaCommentPanelFlipY {
    syntax: '<length>';
    inherits: true;
    initial-value: 0px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer > .commentInputPanel {
    position: absolute;
    top: 100%;
    bottom: auto;
    left: 50%;
    margin-top: 8px;
    transform:
      translate(
        calc(-50% + var(--zenzaSmallDragX, 0px) + var(--zenzaCommentPanelClampX, 0px)),
        calc(var(--zenzaSmallDragY, 0px) + var(--zenzaCommentPanelFlipY, 0px))
      );
    transition: --zenzaCommentPanelFlipY 0.2s ease, width 0.2s ease;
    width: min(200px, 100%);
    max-width: calc(100vw - 16px);
  }
  .zenzaScreenMode_small .zenzaPlayerContainer > .commentInputPanel:focus-within {
    width: min(500px, calc(100vw - 16px));
  }
  /* 「小」モード限定：動画または入力欄にマウスが重なっている間・入力欄が
     フォーカス中は、既存の:focus-within用の「白背景・黒文字」の配色を
     動画ホバーだけでも先出しする（他の画面モードの見た目・既存の
     :hover/:focus-within挙動そのものは変更しない。D-2の全体デザイン変更を
     妨げないよう、変更はこの.zenzaScreenMode_small配下のみに閉じている）。 */
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .commentInputOuter {
    border: none;
    opacity: 1;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .commentInput {
    opacity: 0.9 !important;
    box-sizing: border-box;
    border: 1px solid var(--zt-border, #888);
    border-radius: 8px;
    background: var(--zt-surface-light, #fff);
    box-shadow: 0 0 8px var(--zt-glow-light, #fff);
    color: var(--zt-text-inverse, #000);
  }
  .zenzaScreenMode_small .zenzaPlayerContainer:hover :where(.commandInput, .commentSubmit) {
    background: var(--zt-surface-light, #fff);
    color: var(--zt-text-inverse, #000);
  }
  /* ドラッグの起点は動画本体全体。掴んでいる間だけカーソルをgrabbingにする。

     Task 039: 「カーソルが十字になるのが遅れる」という報告の原因は、
     別の場所にある次のルールだった。

       .is-mouseMoving .videoPlayer>* { cursor: auto; }

     実際にマウスの下にあるのは.videoPlayer自身ではなく、その子要素の
     .touchWrapper（動画全体を覆う透明なカバー）である。上のルールは
     その子要素に直接cursor:autoを指定するため、.videoPlayerから
     受け継ぐはずのcursor:moveを打ち消してしまう（直接指定は継承に必ず勝つ）。
     さらに.is-mouseMovingは「マウスを動かしている間」付き、動きが止まって
     から400ms後に外れる。つまり、
       マウスを動かしている間＝矢印、止めて400ms待つ＝やっと十字
     という挙動になっていた。これが「遅れて十字になる」の正体。
     小モードでは子要素まで含めてmoveを指定し、常に十字にする。 */
  .zenzaScreenMode_small .zenzaPlayerContainer .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer .videoPlayer>* {
    cursor: move;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeDragging .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeDragging .videoPlayer>* {
    cursor: grabbing;
  }
  /* 読み込み中はカーソルを砂時計に戻す（元のルールと同じ意図） */
  .zenzaScreenMode_small .zenzaPlayerContainer.is-loading .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-loading .videoPlayer>* {
    cursor: wait;
  }

  /*
    画面モード「小」のサイズも、PiPのようにリサイズできるようにする（Task 032）。
    ドラッグの位置と同じ理由（.videoControlBarのposition: fixed）から、サイズを
    決める width/height は.zenzaPlayerContainer自体に適用して問題ない
    （width/height自体はtransformと違い、position: fixedな子孫のcontaining block
    には影響しないため）。--zenzaSmallWidth/--zenzaSmallHeightが未設定の間は
    既定サイズ（CONSTANT.SIDE_PLAYER_WIDTH/HEIGHT）のまま。
  */
  .zenzaScreenMode_small .zenzaPlayerContainer {
    width: var(--zenzaSmallWidth, ${CONSTANT.SIDE_PLAYER_WIDTH}px);
    height: var(--zenzaSmallHeight, ${CONSTANT.SIDE_PLAYER_HEIGHT}px);
  }
  /* Task 050 追加: 実機フィードバックで発見されたバグの修正。
     「小」モードでは.zenzaVideoPlayerDialog自体が
     top:0; left:0; right:100%; bottom:100%;（このファイル内、上の
     ".zenzaScreenMode_sideView .zenzaVideoPlayerDialog.is-open,
     .zenzaScreenMode_small .zenzaVideoPlayerDialog.is-open"参照）により
     幅0・高さ0に潰され、画面左上(0,0)を起点として配置される。ドラッグ・
     リサイズの位置調整は.zenzaPlayerContainer自身にではなくその子要素
     （.videoPlayer/.commentLayerFrame、および本ファイル内で同様に
     transformを合成している他の直接の子要素）にのみtransformとして
     適用しているため（Task 031: .zenzaPlayerContainer自体にtransformを
     掛けるとposition: fixedな.videoControlBar等のcontaining blockが
     ずれてしまうのを避けるため）、.zenzaPlayerContainer自身の実際の
     レイアウト上の位置は動かした後も画面左上(0,0)のまま変わらない
     （見た目上そこには何も描画されないが、要素自体は
     現在の幅・高さ分の透明な当たり判定を持ったまま残る）。
     このため、動画を画面左上以外へドラッグしても、ニコニコ動画側の
     ページ左上のサイドメニュー開閉ボタン等、(0,0)付近にある既存の
     ページUIがこの透明な当たり判定に覆われてクリックを奪われ、
     反応しなくなってしまっていた（実機フィードバックで発見）。
     .zenzaPlayerContainer自身はpointer-events: noneにして当たり判定を
     持たせず、実際に見えている（=transformで正しい位置に移動している）
     直接の子要素だけpointer-events: autoで復元する
     （Task 038の.menuItemContainerでの対処と同じ考え方）。
     .commentLayerFrame（コメント描画レイヤー）・.loadingMessageContainer
     （読み込み中の文字表示、常にクリック不要）は他の画面モード共通で元々
     pointer-events: noneのため、動画本体へのクリックを妨げないよう
     ここでは復元の対象から除外している。 */
  .zenzaScreenMode_small .zenzaPlayerContainer {
    pointer-events: none;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer > :not(.commentLayerFrame):not(.loadingMessageContainer) {
    pointer-events: auto;
  }
  .zenzaSmallModeResizeHandle,
  .zenzaSmallModeAspectLockButton,
  .zenzaSmallModeResetButton {
    display: none;
  }
  .zenzaScreenMode_small .zenzaSmallModeResizeHandle,
  .zenzaScreenMode_small .zenzaSmallModeAspectLockButton,
  .zenzaScreenMode_small .zenzaSmallModeResetButton {
    display: block;
    position: absolute;
    z-index: 20001;
    opacity: 0;
    /* Task 039: 表示・非表示のタイミングを、動画に元からあるホバーメニュー
       （.menuButton）と揃える。以前はこの3つだけが
       「:hoverのみ・0.15秒」で、ホバーメニュー側は
       「.is-mouseMoving（マウスが止まって400ms後に外れる）・0.4秒」だったため、
       同じ動画の上にあるボタンなのに現れる/消える時間がバラバラだった。 */
    transition: opacity 0.4s ease;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .zenzaSmallModeResizeHandle,
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .zenzaSmallModeAspectLockButton,
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .zenzaSmallModeResetButton,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-mouseMoving .zenzaSmallModeResizeHandle,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-mouseMoving .zenzaSmallModeAspectLockButton,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-mouseMoving .zenzaSmallModeResetButton,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeResizing .zenzaSmallModeResizeHandle {
    opacity: 1;
  }

  /*
    Task 039: 画面モード「小」でプレイヤーを小さくすると、右上のホバーメニュー
    （いいね・ツイート・マイリスト・あとで見る・閉じる）が動画の
    左外側にはみ出して、宙に浮いたように表示される問題への対策。

    原因は、この5つのボタンが「幅240pxの箱（.menuItemContainer.rightTop）の
    左端から left: 0 / 40 / 80 / 120px」という**左基準**で並べられていること。
    箱は right: 0 で動画の右端に貼り付くので、動画の幅が240pxより狭いと
    箱の左側がそのまま動画の外へ出てしまい、左寄りのボタン（いいね・ツイート）
    から順に動画の外に飛び出す。さらに設定の「メニューの大きさ」
    （--zenza-ui-scale）を大きくしていると、右端を原点に拡大されるため
    はみ出しはもっと大きくなる。

    小モードでのみ、これらを**右基準**（閉じるボタンから左へ32pxずつ）に
    置き換え、箱の幅も動画の幅までに制限する。これで、動画の幅が
    ボタン5個分（160px × 拡大率）以上ある限り、必ず動画の中に収まる。
    拡大率が大きくて収まらない場合の縮小は、JS側で
    --zenzaSmallUiScale を設定して行う（_initializeSmallModeDrag参照）。
  */
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop {
    width: 100%;
    max-width: 240px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .toggleLikeButton {
    left: auto;
    right: 128px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .zenzaTweetButton {
    left: auto;
    right: 96px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .mylistButton.mylistAddMenu {
    left: auto;
    right: 64px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .mylistButton.deflistAdd {
    left: auto;
    right: 32px;
  }
  /* 動画の幅に対してメニューが大きすぎる場合の自動縮小。
     --zenzaSmallUiScaleはJS側がサイズ変更のたびに更新する。 */
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer .scalingUI {
    transform: scale(calc(var(--zenza-ui-scale, 1) * var(--zenzaSmallUiScale, 1)));
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .scalingUI {
    transform-origin: right top;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.leftBottom .scalingUI {
    transform-origin: left bottom;
  }
  /* コメント表示切り替え（💬）は bottom: 48px に置かれているが、この48pxは
     「動画の下端にコントロールバーがある」ことを前提にした余白。画面モード
     「小」ではコントロールバーは position: fixed で画面下端に出ており、
     プレイヤーの中には無い。そのため、小さくするほど💬だけが動画の
     真ん中あたりに浮いて、他の表示と重なって見えていた。
     小モードでは左下の角に寄せる。右下の3つ（リセット・ロック・つまみ、
     右端から62px）とは横方向に離れているため衝突しない。 */
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.leftBottom {
    left: 2px;
    bottom: 2px;
  }
  .zenzaScreenMode_small .zenzaSmallModeResizeHandle {
    right: 0;
    bottom: 0;
    width: 18px;
    height: 18px;
    cursor: nwse-resize;
    touch-action: none;
    background: linear-gradient(135deg,
      transparent 0 50%,
      rgba(255,255,255,0.8) 50% 60%,
      transparent 60% 70%,
      rgba(255,255,255,0.8) 70% 80%,
      transparent 80% 100%);
  }
  .zenzaSmallModeAspectLockButton,
  .zenzaSmallModeResetButton {
    border: 0;
    background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.6));
    color: var(--zt-text-0, #fff);
    font-size: 11px;
    line-height: 20px;
    width: 20px;
    height: 20px;
    padding: 0;
    text-align: center;
    cursor: pointer;
    border-radius: 3px;
  }
  /* Task 038: 3つのボタンを右下の1列に横並びで固定する。
     以前はリサイズつまみ（右下）・アスペクト比ロック（右下から22px上）・
     リセット（右上から44px下）と、縦方向にバラバラに配置していたため、
     プレイヤーを小さくすると、
       - ロックボタン（下から22〜42px）とリセットボタン（上から44〜64px）が
         高さ106px未満で重なる（最小の高さは90pxなので実際に重なっていた）
       - リセットボタンが、動画に元々ある右上のホバーメニュー
         （.menuItemContainer.rightTop、高さ40px）とも近接する
     という問題が起きていた。
     横並びなら、必要なのは右端から62pxの横幅と下端から20pxの高さだけになり、
     最小サイズ（160x90）でも、右上のホバーメニュー（高さ40px）とも
     左下のコメント表示切り替え（左端から120px・下から48px）とも重ならない。 */
  .zenzaScreenMode_small .zenzaSmallModeAspectLockButton {
    right: 20px;
    bottom: 0;
  }
  .zenzaScreenMode_small .zenzaSmallModeResetButton {
    right: 42px;
    bottom: 0;
  }

  .is-open .zenzaVideoPlayerDialog {
    contain: layout style size;
  }

  .zenzaVideoPlayerDialogInner {
    top: 0;
    left: 0;
    transform: none;
  }


  @media screen and (min-width: 1432px)
  {
    body.zenzaScreenMode_sideView {
      --sideView-left-margin: calc(100vw - 1024px);
    }
    body.zenzaScreenMode_sideView:not(.nofix) #siteHeader {
      width: calc(100vw - (100vw - 1024px));
    }
    .zenzaScreenMode_sideView .zenzaPlayerContainer {
      width: calc(100vw - 1024px);
      height: calc((100vw - 1024px) * 9 / 16);
    }
  }
`, { className: 'screenMode for-popup', disabled: true });
util.addStyle(`
body.zenzaScreenMode_sideView,
body.zenzaScreenMode_small {
  border-bottom: 40px solid;
  margin-top: 0;
}
`, { className: 'domain slack-com', disabled: true });
util.addStyle(`

  .zenzaScreenMode_normal .zenzaPlayerContainer .videoPlayer {
    left: 2.38%;
    width: 95.23%;
  }
  .zenzaScreenMode_big .zenzaPlayerContainer {
    width: ${CONSTANT.BIG_PLAYER_WIDTH}px;
    height: ${CONSTANT.BIG_PLAYER_HEIGHT}px;
  }


`, { className: 'screenMode for-dialog', disabled: true });
util.addStyle(`
  .zenzaScreenMode_3D,
  .zenzaScreenMode_normal,
  .zenzaScreenMode_big,
  .zenzaScreenMode_wide
  {
    overflow-x: hidden !important;
    overflow-y: hidden !important;
    overflow: hidden !important;
  }

  /*
    プレイヤーが動いてる間、裏の余計な物のマウスイベントを無効化
    多少軽量化が期待できる？
  */
  body.zenzaScreenMode_big >*:not(.zen-family) *,
  body.zenzaScreenMode_normal >*:not(.zen-family) *,
  body.zenzaScreenMode_wide >*:not(.zen-family) *,
  body.zenzaScreenMode_3D >*:not(.zen-family) * {
    pointer-events: none;
    user-select: none;
    animation-play-state: paused !important;
    contain: style layout paint;
  }

  body.zenzaScreenMode_big .ZenButton,
  body.zenzaScreenMode_normal .ZenButton,
  body.zenzaScreenMode_wide .ZenButton,
  body.zenzaScreenMode_3D  .ZenButton {
    display: none;
  }

  .ads, .banner, iframe[name^="ads"] {
    visibility: hidden !important;
    pointer-events: none;
  }

  .VideoThumbnailComment {
    display: none !important;
  }

  /* 大百科の奴 */
  #scrollUp {
    display: none !important;
  }

  .SeriesDetailContainer-backgroundInner {
    background-image: none !important;
    filter: none !important;
  }
  .Hidariue-image {
    visibility: hidden !important;
  }
`, { className: 'zenza-open', disabled: true });
NicoVideoPlayerDialogView.__css__ = `

  .zenzaVideoPlayerDialog {
    display: none;
    position: fixed;
    /*background: rgba(0, 0, 0, 0.8);*/
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: ${CONSTANT.BASE_Z_INDEX};
    font-size: 13px;
    text-align: left;
    box-sizing: border-box;
    contain: size style layout;
  }

  .zenzaVideoPlayerDialog::before {
    content: ' ';
    background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.8));
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    will-change: transform;
  }

  .is-regularUser  .forPremium {
    display: none !important;
  }

  .zenzaVideoPlayerDialog * {
    box-sizing: border-box;
  }

  .zenzaVideoPlayerDialog.is-open {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .zenzaVideoPlayerDialog li {
    text-align: left;
  }

  .zenzaVideoPlayerDialogInner {
    background: var(--zt-surface-0, #000);
    box-sizing: border-box;
    z-index: 1;
    box-shadow: 4px 4px 4px var(--zt-shadow, #000);
  }

  .zenzaPlayerContainer {
    position: relative;
    background: var(--zt-surface-0, #000);
    width: 672px;
    height: 384px;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center center;
  }
  .zenzaPlayerContainer.is-loading {
    cursor: wait;
  }
  .zenzaPlayerContainer:not(.is-loading):not(.is-error) {
    background-image: none !important;
    background: none !important;
  }
  .zenzaPlayerContainer.is-loading .videoPlayer,
  .zenzaPlayerContainer.is-loading .commentLayerFrame,
  .zenzaPlayerContainer.is-error .videoPlayer,
  .zenzaPlayerContainer.is-error .commentLayerFrame {
    display: none;
  }

  .zenzaPlayerContainer .videoPlayer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    right: 0;
    bottom: 0;
    height: 100%;
    border: 0;
    z-index: 100;
    background: var(--zt-surface-0, #000);
    will-change: transform, opacity;
    user-select: none;
  }

  .is-mouseMoving .videoPlayer>* {
    cursor: auto;
  }

  .is-loading .videoPlayer>* {
    cursor: wait;
  }

  .zenzaPlayerContainer .commentLayerFrame {
    position: absolute;
    border: 0;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    z-index: 101;
    pointer-events: none;
    cursor: none;
    user-select: none;
    opacity: var(--zenza-comment-layer-opacity);
  }

  .loadingMessageContainer {
    display: none;
    pointer-events: none;
  }
  .zenzaPlayerContainer.is-loading .loadingMessageContainer {
    display: inline-block;
    position: absolute;
    z-index: 10000;
    right: 8px;
    bottom: 8px;
    font-size: 24px;
    color: var(--base-fore-color);
    text-shadow: 0 0 8px var(--zt-info-strong, #003);
    font-family: serif;
    letter-spacing: 2px;
  }

  @keyframes spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(-1800deg); }
  }

  .zenzaPlayerContainer.is-loading .loadingMessageContainer::before,
  .zenzaPlayerContainer.is-loading .loadingMessageContainer::after {
    display: inline-block;
    text-align: center;
    content: '${'\\00272A'}';
    font-size: 18px;
    line-height: 24px;
    animation-name: spin;
    animation-iteration-count: infinite;
    animation-duration: 5s;
    animation-timing-function: linear;
  }
  .zenzaPlayerContainer.is-loading .loadingMessageContainer::after {
    animation-direction: reverse;
  }

  /*
    Task 049（追記）: 読み込み中の見た目の主体は、実はこのテキスト
    （"動画読込中"）ではなく、.zenzaPlayerContainer自身が持つ黒背景／
    サムネイル画像（_setThumbnail()がJSで.zenzaPlayerContainerに
    直接background-imageを設定している）だった。このテキストにだけ
    ドラッグのtransformを追加しても、背景の黒い箱自体は
    .zenzaPlayerContainer自身の位置（＝ドラッグしても動かない静的な位置）に
    残ったままになり、「小」モードで動画を移動してから新しい動画を開くと、
    大きな黒い箱だけが元の位置に出続けてしまう（ユーザー提供のスクリーン
    ショットで確認）。

    .zenzaPlayerContainer自体には他の子要素（videoControlBar等、
    position: fixedな子孫を持つ）の都合上transformを掛けられないため
    （Task 031参照）、「小」モードでは読み込み中に限り、背景の役目を
    .zenzaPlayerContainer自身から.loadingMessageContainer（transform対象に
    含めた要素）へ肩代わりさせる。.loadingMessageContainerをコンテナ全面に
    広げ、同じ背景スタイルを持たせた上で、.zenzaPlayerContainer自身の背景は
    非表示にする（JSが設定するインラインstyleより優先させるため!important）。
    背景画像そのもの（サムネイルURL）は_setThumbnail()側で
    .loadingMessageContainerにも同じ値を設定するよう対応済み。
  */
  .zenzaScreenMode_small .zenzaPlayerContainer.is-loading {
    background: none !important;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer.is-loading .loadingMessageContainer {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 8px;
    background: var(--zt-surface-0, #000);
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center center;
  }

  .errorMessageContainer {
    display: none;
    pointer-events: none;
    user-select: none;
  }

  .zenzaPlayerContainer.is-error .errorMessageContainer {
    display: block;
    position: absolute;
    z-index: 10000;
    /* The existing recovery actions start at 60%; reserve space above them. */
    top: 40%;
    left: 50%;
    box-sizing: border-box;
    width: min(680px, calc(100% - 32px));
    max-height: calc(40% - 32px);
    padding: 10px 14px;
    transform: translate(-50%, -50%);
    background: var(--zt-special-strong, #481e29);
    color: var(--zt-text-0, #ffe8e9);
    border: 1px solid var(--zt-danger, #ad6b79);
    border-radius: 6px;
    font-size: clamp(14px, 2vw, 20px);
    line-height: 1.5;
    box-shadow: 0 4px 16px var(--zt-shadow, #0008);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    overflow: auto;
    overscroll-behavior: contain;
    pointer-events: auto;
    user-select: text;
  }
  .errorMessageContainer:empty {
    display: none !important;
  }

  .popupMessageContainer {
    top: 50px;
    left: 50px;
    z-index: 25000;
    position: absolute;
    pointer-events: none;
    transform: translateZ(0);
    user-select: none;
  }

  /*
    Task 049: 画面モード「小」専用のリサイズつまみ・アスペクト比ロック・
    リセットボタン（.zenzaSmallModeResizeHandle/.zenzaSmallModeAspectLockButton/
    .zenzaSmallModeResetButton）を、既定で非表示にしておく。

    これらを「小」モードでだけ表示する制御自体は、下の"screenMode for-popup"の
    <style>ブロック（画面モードが small/sideView の時だけ有効化される）の中に
    「display: none」→「.zenzaScreenMode_small の中でだけ display: block」という
    形で入っている。しかしそのブロックは、他の画面モード（通常・大・ワイド・3D）
    の時は _updateScreenModeStyle() によって<style>要素ごとdisabledにされる。
    ブロックごと無効化されると、"display: none"という既定の非表示ルールまで
    一緒に失われてしまうため、他の画面モードではこの3つの要素を隠すCSSが
    一切存在しない状態になり、ブラウザの既定表示（<button>は枠付きで見える、
    位置はcontainer内の通常のフロー＝左上寄り）で見えてしまっていた
    （「アスペクト比ロックボタンが他の画面サイズでも左上に表示される」不具合）。

    このブロック（__css__）は画面モードに関わらず常に有効なので、ここに同じ
    既定の非表示ルールを重ねておけば、"screenMode for-popup"ブロックが
    無効化された状態でも常に非表示になる。"small"モードでは、"screenMode
    for-popup"ブロック側の.zenzaScreenMode_small配下の上書き
    （display: block）がクラス数の多さでこちらに優先するため、従来通り表示される。
  */
  .zenzaSmallModeResizeHandle,
  .zenzaSmallModeAspectLockButton,
  .zenzaSmallModeResetButton {
    display: none;
  }


  @media screen {
    /* 右パネル分の幅がある時は右パネルを出す */
    @media (min-width: 992px) {
      .zenzaScreenMode_normal .zenzaVideoPlayerDialogInner {
        padding-right: ${CONSTANT.RIGHT_PANEL_WIDTH}px;
        background: none;
      }
    }

    @media (min-width: 1216px) {
      .zenzaScreenMode_big .zenzaVideoPlayerDialogInner {
        padding-right: ${CONSTANT.RIGHT_PANEL_WIDTH}px;
        background: none;
      }
    }

    /*
      縦長モニター（情報パネルを動画の下に出す）。
      Task1039: 幅が足りないだけの横長の画面（例: Firefox 100% で 1212x715）は縦長として扱わない。
      以前は幅 1216px 未満・高さ 700px 以上なら横長でも下パネルの配置になり、動画が小さく情報パネルが
      下に回って崩れていた。横長（縦横比 4:3 以上）の時は下の「高さが足りない時」と同じく、
      情報パネルを右に置いたまま動画を縮める。
    */
    @media
      (width < 992px) and (min-height: 700px) and (aspect-ratio < 4/3)
    {
      .zenzaScreenMode_normal .zenzaVideoPlayerDialogInner {
        padding-bottom: 240px;
        background: none;
      }
    }

    @media
      (width < 1216px) and (min-height: 700px) and (aspect-ratio < 4/3)
    {
      .zenzaScreenMode_big .zenzaVideoPlayerDialogInner {
        padding-bottom: 240px;
        background: none;
      }
    }

    /*
      Short viewport fallback for the native normal/big layouts. The existing
      information and comment tabs stay adjacent to the movie. Resize only
      the video frame at its native aspect ratio, reserving header/toolbar room.
    */
    @media (min-width: 640px) and (width < 992px) and ((height < 700px) or (aspect-ratio >= 4/3)) {
      body.zenzaScreenMode_normal .zenzaVideoPlayerDialogInner {
        padding-right: ${CONSTANT.RIGHT_PANEL_WIDTH}px;
        background: none;
      }
      body.zenzaScreenMode_normal .zenzaPlayerContainer {
        width: min(672px, calc(100vw - ${CONSTANT.RIGHT_PANEL_WIDTH}px), calc((100vh - 150px) * 1.75));
        height: auto;
        aspect-ratio: 7 / 4;
      }
    }
    @media (min-width: 640px) and (width < 1216px) and ((height < 700px) or (aspect-ratio >= 4/3)) {
      body.zenzaScreenMode_big .zenzaVideoPlayerDialogInner {
        padding-right: ${CONSTANT.RIGHT_PANEL_WIDTH}px;
        background: none;
      }
      body.zenzaScreenMode_big .zenzaPlayerContainer {
        width: min(896px, calc(100vw - ${CONSTANT.RIGHT_PANEL_WIDTH}px), calc((100vh - 150px) * 1.8666667));
        height: auto;
        aspect-ratio: 28 / 15;
      }
    }
    /* Below 640px preserve the legacy lower tab panel rather than making
       the movie unwatchably narrow next to a 320px sidebar. */
    @media (width < 640px) and (height < 700px) {
      body.zenzaScreenMode_normal .zenzaVideoPlayerDialogInner,
      body.zenzaScreenMode_big .zenzaVideoPlayerDialogInner {
        padding-right: 0;
        padding-bottom: min(${CONSTANT.BOTTOM_PANEL_HEIGHT}px, 35vh);
        background: none;
      }
      body.zenzaScreenMode_normal .zenzaPlayerContainer {
        width: min(672px, 100vw, max(180px, calc((100vh - min(${CONSTANT.BOTTOM_PANEL_HEIGHT}px, 35vh) - 200px) * 1.75)));
        height: auto;
        aspect-ratio: 7 / 4;
      }
      body.zenzaScreenMode_big .zenzaPlayerContainer {
        width: min(896px, 100vw, max(180px, calc((100vh - min(${CONSTANT.BOTTOM_PANEL_HEIGHT}px, 35vh) - 200px) * 1.8666667)));
        height: auto;
        aspect-ratio: 28 / 15;
      }
    }
    /* Reserve 200px outside a lower panel/video stack for the native header
       and fixed toolbar; the header placement algorithm may shift the stack.
       The legacy below-video layout also exceeded the viewport at 700px
       high when its fixed-size movie was wider/taller than the available
       window. Keep the native bottom panel and scale the movie into it. */
    @media (width < 992px) and (min-height: 700px) and (aspect-ratio < 4/3) {
      body.zenzaScreenMode_normal .zenzaPlayerContainer {
        width: min(672px, 100vw, calc((100vh - ${CONSTANT.BOTTOM_PANEL_HEIGHT}px - 200px) * 1.75));
        height: auto;
        aspect-ratio: 7 / 4;
      }
    }
    @media (width < 1216px) and (min-height: 700px) and (aspect-ratio < 4/3) {
      body.zenzaScreenMode_big .zenzaPlayerContainer {
        width: min(896px, 100vw, calc((100vh - ${CONSTANT.BOTTOM_PANEL_HEIGHT}px - 200px) * 1.8666667));
        height: auto;
        aspect-ratio: 28 / 15;
      }
    }
    /*
      Task1038: 大モードの固定サイズ（960x540 など）は、画面の高さがその段のぎりぎり（例: 高さ 700〜740px）だと
      上のタイトル・タグ欄と下の再生バーが入りきらず、ヘッダーが動画に重なったり箱ごと押し下げられて崩れていた。
      Firefox は 100% 表示のときにちょうどこの高さになりやすい（90%/110% では別の段になるので起きない）。
      どの段でも「画面の高さ − 200px（ヘッダーと再生バーの分）」を超えない大きさに縮める（比率 28:15 は同じ）。
      高さが十分ある時は従来と同じ大きさになるので、他のブラウザ・他の倍率の見た目は変わらない。
    */
    /* 960x540 */
    @media
      (min-width: 1328px) and (min-height: 700px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: min(calc(960px * 1.05), calc((100vh - 200px) * 1.8666667));
        height: auto;
        aspect-ratio: 28 / 15;
      }
    }

    /* 1152x648 */
    @media
      (min-width: 1530px) and (min-height: 900px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: min(calc(1152px * 1.05), calc((100vh - 200px) * 1.8666667));
        height: auto;
        aspect-ratio: 28 / 15;
      }
    }

    /* 1280x720 */
    @media
      (min-width: 1664px) and (min-height: 900px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: min(calc(1280px * 1.05), calc((100vh - 200px) * 1.8666667));
        height: auto;
        aspect-ratio: 28 / 15;
      }
    }

    /* 1920x1080 */
    @media
      (min-width: 2336px) and (min-height: 1200px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: min(calc(1920px * 1.05), calc((100vh - 200px) * 1.8666667));
        height: auto;
        aspect-ratio: 28 / 15;
      }
    }

    /* 2560x1440 */
    @media
      (min-width: 2976px) and (min-height: 1660px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: min(calc(2560px * 1.05), calc((100vh - 200px) * 1.8666667));
        height: auto;
        aspect-ratio: 28 / 15;
      }
    }
  }

  `.trim();
NicoVideoPlayerDialogView.__tpl__ = (`
    <div id="zenzaVideoPlayerDialog" class="zenzaVideoPlayerDialog zen-family zen-root">
      <div class="zenzaVideoPlayerDialogInner">
        <div class="menuContainer"></div>
        <div class="zenzaPlayerContainer">

          <div class="popupMessageContainer"></div>
          <div class="errorMessageContainer"></div>
          <div class="loadingMessageContainer">動画読込中</div>
        </div>
      </div>
    </div>
  `).trim();
//===END===
export {
  NicoVideoPlayerDialogView
};
