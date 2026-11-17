// import * as _ from 'lodash';
import {ZenzaWatch, global} from './ZenzaWatchIndex';
import {CONSTANT} from './constant';
import {SeekBarThumbnail, Storyboard} from './StoryBoard';
import {util, BaseViewComponent} from './util';
import {Emitter} from './baselib';
import {throttle, bounce} from '../packages/lib/src/infra/bounce';
import {HeatMapWorker, heatMapCacheEntry} from '../packages/zenza/src/heatMap/HeatMapWorker';
import {WatchInfoCacheDb} from '../packages/lib/src/nico/WatchInfoCacheDb';
import {TextLabel} from '../packages/lib/src/ui/TextLabel';
import {cssUtil} from '../packages/lib/src/css/css';
import {RequestAnimationFrame} from '../packages/lib/src/infra/RequestAnimationFrame';
import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';
import {VideoControlState} from './State';
import {WindowResizeObserver} from '../packages/lib/src/infra/Observable';
import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';
import {ZenzaCommentHistoryCore} from '../packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js';
import {UiVisibilityRegistry} from './UiVisibilityRegistry';
import {TimelineGeometry} from '../packages/zenza/src/sceneSearch/TimelineGeometry';
import {SceneResumeMarkerPresenter} from '../packages/zenza/src/sceneSearch/SceneResumeMarkerPresenter';
import {CommentPreview} from './CommentPreview';
import {SeekBarToolTip} from './SeekBarToolTip';
import {SmoothSeekBarPointer, WheelSeeker} from './SmoothSeekBarPointer';
// GENERATED FROM tools/typescript-stage1/nico-src/VideoControlBar.ts (Task964). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require ZenzaCommentHistoryCore
//@require UiVisibilityRegistry
//@require TimelineGeometry
//@require SceneResumeMarkerPresenter
const historyTriggerKeyGuard = (event) => {
    if (['Enter', ' ', 'Spacebar'].includes(event.key)) {
        event.stopPropagation();
    }
};
class VideoControlBar extends Emitter {
    constructor(...args) {
        super();
        this.initialize(...args);
    }
    initialize(params) {
        this._playerConfig = params.playerConfig;
        this._$playerContainer = params.$playerContainer;
        this._playerState = params.playerState;
        this._currentTimeGetter = params.currentTimeGetter;
        const player = this.player = params.player;
        this.state = new VideoControlState();
        player.on('open', this._onPlayerOpen.bind(this));
        player.on('canPlay', this._onPlayerCanPlay.bind(this));
        player.on('durationChange', this._onPlayerDurationChange.bind(this));
        player.on('close', this._onPlayerClose.bind(this));
        player.on('progress', this._onPlayerProgress.bind(this));
        player.on('loadVideoInfo', this._onLoadVideoInfo.bind(this));
        this._commentParsedHandler = _.debounce(this._onCommentParsed.bind(this), 500);
        this._commentChangeHandler = _.debounce(this._onCommentChange.bind(this), 100);
        player.on('commentParsed', this._commentParsedHandler);
        player.on('commentChange', this._commentChangeHandler);
        Promise.all([
            player.promise('firstVideoInitialized'), this.promise('dom-ready')
        ]).then(() => this._onFirstVideoInitialized());
        this._initializeDom();
        this._initializePlaybackRateSelectMenu();
        this._initializeVolumeControl();
        this._initializeVideoServerTypeSelectMenu();
        global.debug.videoControlBar = this;
    }
    _initializeDom() {
        const $view = this._$view = util.$.html(VideoControlBar.__tpl__);
        const $container = this._$playerContainer;
        const config = this._playerConfig;
        this._view = $view[0];
        const classList = this.classList = ClassList(this._view);
        const mq = $view.mapQuery({
            _seekBarContainer: '.seekBarContainer',
            _seekBar: '.seekBar',
            _currentTime: '.currentTime',
            _duration: '.duration',
            _playbackRateMenu: '.playbackRateMenu',
            _playbackRateSelectMenu: '.playbackRateSelectMenu',
            _videoServerTypeMenu: '.videoServerTypeMenu',
            _videoServerTypeSelectMenu: '.videoServerTypeSelectMenu',
            _resumePointer: 'zenza-seekbar-label',
            _bufferRange: '.bufferRange',
            _seekRange: '.seekRange',
            _seekBarPointer: '.seekBarPointer',
            resumePointers: 'zenza-seekbar-label',
        });
        Object.assign(this, mq.e, { _currentTime: 0 });
        Object.assign(this, mq.$);
        // Native marker nodes remain owned by the bar. Delete is deliberately a
        // separate explicit action; ordinary marker clicks still seek as before.
        this._view.addEventListener('contextmenu', this._onResumeMarkerDelete.bind(this), true);
        this._view.addEventListener('keydown', this._onResumeMarkerDelete.bind(this), true);
        // Task 077c: 画面フィルターのボタン。フィルターが効いている間は光らせる
        const historyButton = $view.find('.commentHistorySwitch')[0];
        if (historyButton) {
            historyButton.addEventListener('keydown', historyTriggerKeyGuard);
            historyButton.addEventListener('keyup', historyTriggerKeyGuard);
        }
        const pointsButton = $view.find('.playbackPointsSwitch')[0];
        if (pointsButton) {
            pointsButton.addEventListener('keydown', historyTriggerKeyGuard);
            pointsButton.addEventListener('keyup', historyTriggerKeyGuard);
            const visibility = () => { pointsButton.hidden = this._playerConfig.getValue('bookmark.showToolbarButton') === false; };
            visibility();
            this._playerConfig.onkey?.('bookmark.showToolbarButton', visibility);
        }
        const notificationButton = $view.find('.notificationHistorySwitch')[0];
        if (notificationButton) {
            notificationButton.addEventListener('keydown', historyTriggerKeyGuard);
            notificationButton.addEventListener('keyup', historyTriggerKeyGuard);
        }
        const screenFilterButton = $view.find('.screenFilterSwitch')[0];
        const updateScreenFilterButton = () => {
            screenFilterButton && screenFilterButton.classList.toggle('is-active', ScreenFilter.isActive());
        };
        ScreenFilter.onChange(updateScreenFilterButton);
        updateScreenFilterButton();
        util.$(this._seekRange)
            .on('input', this._onSeekRangeInput.bind(this))
            .on('change', (e) => e.target.blur());
        this._pointer = new SmoothSeekBarPointer({
            pointer: this._seekBarPointer,
            getTimelineGeometry: () => this._getTimelineGeometry(),
            playerState: this._playerState
        });
        const timeStyle = {
            widthPx: 44,
            heightPx: 18,
            fontFamily: '\'Yu Gothic\', \'YuGothic\', \'Courier New\', Osaka-mono, \'ＭＳ ゴシック\', monospace',
            fontWeight: '',
            fontSizePx: 12,
            color: '#fff'
        };
        this.currentTimeLabel = TextLabel.create({
            container: $view.find('.currentTimeLabel')[0],
            name: 'currentTimeLabel',
            text: '--:--',
            style: timeStyle
        });
        this.durationLabel = TextLabel.create({
            container: $view.find('.durationLabel')[0],
            name: 'durationLabel',
            text: '--:--',
            style: timeStyle
        });
        this._$seekBar
            .on('mousedown', this._onSeekBarMouseDown.bind(this))
            .on('mousemove', this._onSeekBarMouseMove.bind(this));
        $view
            .on('click', this._onClick.bind(this))
            .on('command', this._onCommandEvent.bind(this));
        HeatMapWorker.init({ container: this._seekBar })
            .then((hm) => this._onHeatMapReady(hm))
            .catch(() => { window.console.warn('HeatMap initialization unavailable'); });
        const updateHeatMapVisibility = (v) => this._$seekBarContainer.raf.toggleClass('noHeatMap', !v);
        updateHeatMapVisibility(this._playerConfig.props.enableHeatMap);
        this._playerConfig.onkey('enableHeatMap', updateHeatMapVisibility);
        // Task187（監査v2 F13）: 通知に付いた動画IDが今の動画と一致する時だけ、その動画IDで保存する
        global.emitter.on('heatMapUpdate', (payload) => {
            const entry = heatMapCacheEntry(payload, this.player.watchId);
            entry && WatchInfoCacheDb.putBestEffort(entry.watchId, { heatMap: entry.heatMap });
        });
        this.storyboard = new Storyboard({
            playerConfig: config,
            player: this.player,
            state: this.state,
            container: $view[0]
        });
        this.state.onkey('isStoryboardAvailable', (v) => classList.toggle('is-storyboardAvailable', v));
        this._seekBarToolTip = new SeekBarToolTip({
            $container: this._$seekBarContainer,
            storyboard: this.storyboard
        });
        this._commentPreview = new CommentPreview({
            $container: this._$seekBarContainer
        });
        const updateEnableCommentPreview = () => {
            const v = config.resolveSceneSearch?.()?.listOpen ?? config.props.enableCommentPreview;
            this._$seekBarContainer.raf.toggleClass('enableCommentPreview', v);
            this._commentPreview.mode = v ? 'list' : 'hover';
        };
        updateEnableCommentPreview(config.props.enableCommentPreview);
        config.onkey('enableCommentPreview', updateEnableCommentPreview);
        config.onkey('sceneSearch.commentPreviewVisible', updateEnableCommentPreview);
        config.onkey('sceneSearch.commentListVisible', updateEnableCommentPreview);
        const watchElement = $container[0].closest('#zenzaVideoPlayerDialog');
        this._wheelSeeker = new WheelSeeker({
            parentNode: $view[0],
            watchElement
        });
        watchElement.addEventListener('mousedown', (e) => {
            if (['A', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                return;
            }
            if (e.buttons !== 3 && !(e.button === 0 && e.shiftKey)) {
                return;
            }
            if (e.buttons === 3) {
                watchElement.addEventListener('contextmenu', (e) => {
                    window.console.log('contextmenu', e);
                    e.preventDefault();
                    e.stopPropagation();
                }, { once: true, capture: true });
            }
            this._onSeekBarMouseDown(e);
        });
        global.emitter.on('hideHover', () => {
            this._hideMenu();
            this._commentPreview.hide();
        });
        $container.append($view);
        this._visibility = UiVisibilityRegistry.connect(config, this._view, 'bar');
        this.emitResolve('dom-ready');
    }
    _initializePlaybackRateSelectMenu() {
        const config = this._playerConfig;
        const $menu = this._$playbackRateSelectMenu;
        const $rates = $menu.find('.playbackRate');
        const style = {
            widthPx: 48,
            heightPx: 30,
            fontFamily: '"ヒラギノ角ゴ Pro W3", "Hiragino Kaku Gothic Pro", "メイリオ", Meiryo, Osaka, "ＭＳ Ｐゴシック", "MS PGothic", sans-serif',
            fontWeight: '',
            fontSizePx: 18,
            color: '#fff'
        };
        const rateLabel = TextLabel.create({
            container: this._$playbackRateMenu.find('.controlButtonInner')[0],
            name: 'currentTimeLabel',
            text: '',
            style
        });
        const updatePlaybackRate = (rate) => {
            rateLabel.text = `x${Math.round(rate * 100) / 100}`;
            $menu.find('.selected').removeClass('selected');
            const fr = Math.floor(parseFloat(rate, 10) * 100) / 100;
            $rates.forEach((item) => {
                const r = parseFloat(item.dataset.param, 10);
                if (fr === r) {
                    ClassList(item).add('selected');
                }
            });
            this._pointer.playbackRate = rate;
        };
        updatePlaybackRate(config.props.playbackRate);
        config.onkey('playbackRate', updatePlaybackRate);
    }
    _initializeVolumeControl() {
        const $vol = this._$view.find('zenza-range-bar input[type="range"]');
        const [vol] = $vol;
        const setVolumeBar = this._setVolumeBar = (v) => (vol.view || vol).value = v;
        $vol.on('input', (e) => util.dispatchCommand(e.target, 'volume', e.target.value));
        setVolumeBar(this._playerConfig.props.volume);
        this._playerConfig.onkey('volume', setVolumeBar);
    }
    _initializeVideoServerTypeSelectMenu() {
        const config = this._playerConfig;
        const $button = this._$videoServerTypeMenu;
        const $select = this._$videoServerTypeSelectMenu;
        const updateDomandVideoQuality = (value) => {
            const $dq = $select.find('.domandVideoQuality > li');
            $dq.removeClass('selected');
            $select.find('.select-domand-' + value).addClass('selected');
        };
        const updateDmcVideoQuality = (value) => {
            const $dq = $select.find('.dmcVideoQuality > li');
            $dq.removeClass('selected');
            $select.find('.select-dmc-' + value).addClass('selected');
        };
        // Task 079b: 画質「自動」の時、以前は用意された中で一番上の画質名（例: 720p）を
        // そのまま出していたため、実際は360pで再生していても「720p」と表示されていた。
        // 自動の時は「自動（最大720p）」と、実際に選ばれる上限であることが分かる表記にする。
        const videoQualityLabel = (type, info) => {
            const label = (info && info.video && info.video.label) || '';
            const setting = type === 'dmc' ? config.props.dmcVideoQuality : config.props.domandVideoQuality;
            return setting === 'auto' && label ? `自動（最大${label}）` : label;
        };
        const onVideoServerType = (type, videoSessionInfo) => {
            $button.raf.removeClass('is-domand-playing is-dmc-playing')
                .raf.addClass(`is-${type === 'dmc' ? 'dmc' : 'domand'}-playing`);
            $select.find('.serverType').removeClass('selected');
            const $selectServer = $select.find(`.select-server-${type === 'dmc' ? 'dmc' : 'domand'}`);
            $selectServer.addClass('selected');
            $selectServer.find('.currentVideoQuality')
                .raf.text(videoQualityLabel(type, videoSessionInfo));
        };
        updateDomandVideoQuality(config.props.domandVideoQuality);
        updateDmcVideoQuality(config.props.dmcVideoQuality);
        config.onkey('domandVideoQuality', updateDomandVideoQuality);
        config.onkey('dmcVideoQuality', updateDmcVideoQuality);
        this.player.on('videoServerType', onVideoServerType);
    }
    _onCommandEvent(e) {
        const command = e.detail.command;
        switch (command) {
            case 'toggleStoryboard':
                this.storyboard.toggle();
                this.emit('actionFeedback', command, e.detail.param);
                break;
            case 'wheelSeek-start':
                window.console.log('start-seek-start');
                this.state.isWheelSeeking = true;
                this._wheelSeeker.currentTime = this.player.currentTime;
                this.classList.add('is-wheelSeeking');
                break;
            case 'wheelSeek-end':
                window.console.log('start-seek-end');
                this.state.isWheelSeeking = false;
                this.classList.remove('is-wheelSeeking');
                break;
            case 'wheelSeek':
                this._onWheelSeek(e.detail.param);
                break;
            default:
                return;
        }
        e.stopPropagation();
    }
    _onClick(e) {
        e.preventDefault();
        const target = e.target.closest('[data-command]');
        if (!target) {
            return;
        }
        let { command, param, type } = target.dataset;
        if (param && (type === 'bool' || type === 'json')) {
            param = JSON.parse(param);
        }
        switch (command) {
            case 'toggleStoryboard':
                this.storyboard.toggle();
                this.emit('actionFeedback', command, param);
                break;
            default:
                util.dispatchCommand(target, command, param);
                break;
        }
        e.stopPropagation();
    }
    _getTimelineGeometry() {
        const element = this._seekBar;
        const rect = element?.getBoundingClientRect?.();
        if (!rect) {
            return null;
        }
        return TimelineGeometry.create({
            clientLeft: rect.left,
            clientWidth: rect.width,
            localWidth: element.offsetWidth
        });
    }
    // These legacy helpers keep their local CSS-pixel contract, never clientX.
    _posToTime(localX) {
        const ratio = this._getTimelineGeometry()?.localXToRatio(localX);
        return ratio == null ? null : TimelineGeometry.ratioToTime(ratio, this._duration);
    }
    _timeToPos(time) {
        const ratio = TimelineGeometry.timeToRatio(time, this._duration);
        return ratio === null ? null : this._getTimelineGeometry()?.ratioToLocalX(ratio) ?? null;
    }
    _timeToPer(time) {
        const ratio = TimelineGeometry.timeToRatio(time, this._duration);
        return ratio === null ? 0 : ratio * 100;
    }
    _onPlayerOpen(watchId) {
        this._clearTimelinePresentation(typeof watchId === 'string' ? watchId : null);
        this._commentParsedHandler?.cancel?.();
        this._commentChangeHandler?.cancel?.();
        this._startTimer();
        this.duration = 0;
        this.currentTime = 0;
        this._heatMapWatchId = typeof watchId === 'string' ? watchId : null;
        this.heatMap && this.heatMap.reset({ watchId: this._heatMapWatchId });
        this.storyboard.reset();
        this.resetBufferedRange();
    }
    _onPlayerCanPlay(watchId, videoInfo) {
        const duration = this.player.duration;
        this.duration = duration;
        this.storyboard.onVideoCanPlay(watchId, videoInfo);
        this._syncCommentHeatMap();
    }
    _onHeatMapReady(hm) {
        this.heatMap = hm;
        if (this._heatMapWatchId) {
            this.heatMap.reset({ watchId: this._heatMapWatchId });
        }
        this._syncCommentHeatMap();
    }
    _syncCommentHeatMap() {
        if (!this._heatMapWatchId || this._heatMapWatchId !== this.player.watchId) {
            return;
        }
        const chatList = this.player.chatList;
        if (!chatList) {
            return;
        }
        if (this.heatMap) {
            this.heatMap.setData({ watchId: this._heatMapWatchId, duration: this.player.duration, chatList });
        }
        if (this._commentPreview) {
            this._commentPreview.chatList = chatList;
        }
    }
    _onCommentParsed() { this._syncCommentHeatMap(); }
    _onCommentChange() { this._syncCommentHeatMap(); }
    _onPlayerDurationChange() {
        this._pointer.duration = this._playerState.videoInfo.duration;
        this._wheelSeeker.duration = this._playerState.videoInfo.duration;
        this._syncCommentHeatMap();
    }
    _onPlayerClose() {
        this._clearTimelinePresentation(null, true);
        this._cancelStoryboardLongPress();
        // Task944: closing (without opening a successor) must release Task943's
        // current videoInfo and revoke outstanding thumbnail loader responses.
        // The existing open-time reset alone cannot protect this close window.
        this.storyboard?.reset?.();
        this._commentParsedHandler?.cancel?.();
        this._commentChangeHandler?.cancel?.();
        this._heatMapWatchId = null;
        this.heatMap && this.heatMap.reset();
        this._stopTimer();
    }
    _onPlayerProgress(range, currentTime) {
        this.setBufferedRange(range, currentTime);
    }
    _startTimer() {
        this._timerCount = 0;
        this._raf = this._raf || new RequestAnimationFrame(this._onTimer.bind(this));
        this._raf.enable();
    }
    _stopTimer() {
        this._raf && this._raf.disable();
    }
    _onSeekRangeInput(e) {
        // The native range value owns dragging and keyboard input; clientX is not required.
        const duration = Number(e.target.max);
        const sec = TimelineGeometry.clampTime(Number(e.target.value), duration);
        if (sec === null) {
            return;
        }
        const ratio = TimelineGeometry.timeToRatio(sec, duration);
        const left = this._getTimelineGeometry()?.ratioToLocalX(ratio);
        util.dispatchCommand(e.target, 'seek', sec);
        if (left != null) {
            const pinned = this._sceneSearchPinnedTime?.();
            this._seekBarToolTip.update(Number.isFinite(pinned) ? pinned : sec, left);
        }
        this.storyboard.setCurrentTime(sec, true);
    }
    _onSeekBarMouseDown(e) {
        // Native point labels now share the track containing block, but retain
        // their own click command rather than beginning a track drag/long press.
        if (e.target?.closest?.('.resumePointer,.manualBookmarkMarker'))
            return;
        // e.preventDefault();
        e.stopPropagation();
        this._beginMouseDrag(e);
        // Keep seeking immediate, but only reveal the large storyboard after a
        // deliberate 200ms primary-button hold on the seek bar itself.
        if (e.button === 0 && this._seekBar?.contains(e.target)) {
            this._scheduleStoryboardLongPress();
        }
    }
    _scheduleStoryboardLongPress() {
        this._cancelStoryboardLongPress();
        this._storyboardLongPressTimer = window.setTimeout(() => {
            this._storyboardLongPressTimer = null;
            if (this.state.isDragging) {
                this.classList.add('is-storyboardLongPress');
            }
        }, 200);
    }
    _cancelStoryboardLongPress() {
        if (this._storyboardLongPressTimer != null) {
            window.clearTimeout(this._storyboardLongPressTimer);
            this._storyboardLongPressTimer = null;
        }
        this.classList?.remove('is-storyboardLongPress');
    }
    _onSeekBarMouseMove(e) {
        if (!this.state.isDragging) {
            e.stopPropagation();
        }
        const pinned = this._sceneSearchPinnedTime?.();
        let left;
        let sec;
        if (Number.isFinite(pinned)) {
            sec = pinned;
            // Pinning freezes the existing local anchor as well as the preview time.
            left = Number.isFinite(this._seekBarMouseX) ? this._seekBarMouseX : this._timeToPos(pinned);
        }
        else {
            const geometry = this._getTimelineGeometry();
            const ratio = geometry?.clientXToRatio(e.clientX);
            if (ratio == null) {
                return;
            }
            left = geometry.ratioToLocalX(ratio);
            sec = TimelineGeometry.ratioToTime(ratio, this._duration);
        }
        if (left === null || sec === null) {
            return;
        }
        this._seekBarMouseX = left;
        this._commentPreview.currentTime = sec;
        this._commentPreview.update(left);
        this._seekBarToolTip.update(sec, left);
    }
    _onWheelSeek(sec) {
        if (!this.state.isWheelSeeking) {
            return;
        }
        sec = TimelineGeometry.clampTime(Number(sec), this._duration);
        if (sec === null) {
            return;
        }
        const left = this._timeToPos(sec);
        if (left !== null) {
            this._seekBarMouseX = left;
            const pinned = this._sceneSearchPinnedTime?.();
            const previewTime = Number.isFinite(pinned) ? pinned : sec;
            this._commentPreview.currentTime = previewTime;
            this._commentPreview.update(left);
            this._seekBarToolTip.update(previewTime, left);
        }
        this.storyboard.setCurrentTime(sec, true);
    }
    _beginMouseDrag() {
        this._bindDragEvent();
        this.classList.add('is-dragging');
        this.state.isDragging = true;
    }
    _endMouseDrag() {
        this._cancelStoryboardLongPress();
        this._unbindDragEvent();
        this.classList.remove('is-dragging');
        this.state.isDragging = false;
    }
    _onBodyMouseUp(e) {
        if ((e.button === 0 && e.shiftKey)) {
            this._cancelStoryboardLongPress();
            return;
        }
        this._endMouseDrag();
    }
    _onWindowBlur() {
        this._endMouseDrag();
    }
    _bindDragEvent() {
        util.$('body')
            .on('mouseup.ZenzaWatchSeekBar', this._onBodyMouseUp.bind(this));
        util.$(window).on('blur.ZenzaWatchSeekBar', this._onWindowBlur.bind(this), { once: true });
    }
    _unbindDragEvent() {
        util.$('body')
            .off('mouseup.ZenzaWatchSeekBar');
        util.$(window).off('blur.ZenzaWatchSeekBar');
    }
    _onTimer() {
        this._timerCount++;
        const player = this.player;
        const currentTime = this.state.isWheelSeeking ?
            this._wheelSeeker.currentTime : player.currentTime;
        if (this._timerCount % 6 === 0) {
            this.currentTime = currentTime;
        }
        this.storyboard.currentTime = currentTime;
    }
    _onLoadVideoInfo(videoInfo) {
        if (this._timelineVideoId && this._timelineVideoId !== videoInfo.watchId) {
            this._clearTimelinePresentation(videoInfo.watchId, this._timelineClosed);
        }
        this._timelineVideoId = videoInfo.watchId;
        this.duration = videoInfo.duration;
        // Task 070: canPlay を待たずに、動画情報が揃った時点でシークバーのサムネイルを読み始める
        this.storyboard.load(videoInfo.watchId, videoInfo);
        const [view] = this._$view;
        this.refreshAutoResumePointers(videoInfo);
    }
    /** An explicit user action, independent of the native marker's seek click. */
    _onResumeMarkerDelete(event) {
        if (event.type !== 'contextmenu' && event.type !== 'keydown')
            return;
        const node = event.target?.closest?.('zenza-seekbar-label.resumePointer');
        if (!node || node.hidden)
            return;
        if (event.type === 'keydown' &&
            !['Delete', 'Backspace'].includes(event.key))
            return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof window.confirm === 'function' &&
            window.confirm('この動画の「ここまで見た」を削除しますか？')) {
            this.emit('command', 'deleteAutomaticResume');
        }
    }
    /** Refresh markers only, without restarting storyboard or stealing seek DOM. */
    refreshAutoResumePointers(videoInfo) {
        if (!videoInfo || this._timelineClosed)
            return;
        // Preserve native instances/listeners while giving them the real track's
        // containing block. Their presenter-supplied ratio opts out of legacy vw.
        for (const pointer of this.$resumePointers || []) {
            if (this._seekBar && pointer instanceof HTMLElement && pointer.parentElement !== this._seekBar) {
                this._seekBar.append(pointer);
            }
        }
        SceneResumeMarkerPresenter.render(this.$resumePointers, videoInfo.resumePoints, videoInfo.duration, (...tasks) => cssUtil.setProps(...tasks));
        for (const pointer of this.$resumePointers || []) {
            pointer.setAttribute('tabindex', '0');
            pointer.setAttribute('title', '右クリックまたはDeleteキーで「ここまで見た」を削除');
        }
    }
    /** One ownership gate for every timeline presentation source. */
    _canPresentTimeline(videoId) {
        return !this._timelineClosed && typeof videoId === 'string' && !!videoId &&
            this._playerState?.videoInfo?.watchId === videoId &&
            (!this._timelineVideoId || this._timelineVideoId === videoId);
    }
    /** Open/close/video replacement invalidate all point and interval owners. */
    _clearTimelinePresentation(videoId = null, closed = false) {
        this._clearABRepeatRange();
        this._clearManualBookmarkMarkers();
        if (this.$resumePointers)
            SceneResumeMarkerPresenter.clearNative(this.$resumePointers);
        this._timelineVideoId = videoId;
        this._timelineClosed = closed;
    }
    /** Passive decoration in the same local coordinate space as the native range. */
    setABRepeatRange(range, duration, videoId) {
        // A late result from a previous video must not replace the current overlay.
        if (typeof videoId === 'string' && !this._canPresentTimeline(videoId))
            return;
        this._clearABRepeatRange();
        const host = this._seekBar;
        if (!host || !range || this._timelineClosed || typeof videoId !== 'string' || !videoId ||
            !Number.isFinite(duration) || duration <= 0)
            return;
        let layer = this._abRepeatRangeLayer;
        if (!layer) {
            layer = SceneResumeMarkerPresenter.createLayer(host, 'abRepeatRangeLayer');
            layer.setAttribute('aria-hidden', 'true');
            this._abRepeatRangeLayer = layer;
        }
        const projection = SceneResumeMarkerPresenter.projectInterval(range.a, range.b, duration, { clamp: true });
        layer.classList.toggle('is-active', !!projection.band && range.active === true);
        if (projection.band) {
            const band = host.ownerDocument.createElement('div');
            band.className = 'timelineInterval abRepeatRangeBand';
            SceneResumeMarkerPresenter.placeInterval(band, projection.band);
            layer.append(band);
        }
        for (const [name, point] of [['A', projection.start], ['B', projection.end]]) {
            if (!point)
                continue;
            const marker = host.ownerDocument.createElement('span');
            marker.className = `abRepeatMarker abRepeatMarker${name}`;
            marker.textContent = name;
            SceneResumeMarkerPresenter.placePoint(marker, point);
            layer.append(marker);
        }
        this._timelineVideoId = videoId;
    }
    _clearABRepeatRange() {
        this._abRepeatRangeLayer?.replaceChildren();
        this._abRepeatRangeLayer?.classList.remove('is-active');
    }
    /** Manual markers have their own narrow hit targets; native range stays untouched. */
    setManualBookmarkMarkers(bookmarks, duration, videoId) {
        if (typeof videoId === 'string' && !this._canPresentTimeline(videoId))
            return;
        const host = this._seekBar;
        if (!host)
            return;
        let layer = this._manualBookmarkMarkerLayer;
        if (!layer) {
            layer = SceneResumeMarkerPresenter.createLayer(host, 'manualBookmarkMarkerLayer');
            layer.setAttribute('aria-label', '手動しおり');
            this._manualBookmarkMarkerLayer = layer;
        }
        layer.replaceChildren();
        if (typeof videoId !== 'string' || !Number.isFinite(duration) || duration <= 0 ||
            !Array.isArray(bookmarks) || this._playerState?.videoInfo?.watchId !== videoId)
            return;
        const fragment = host.ownerDocument.createDocumentFragment();
        const seen = new Set();
        for (const bookmark of bookmarks) {
            if (!bookmark || typeof bookmark.id !== 'string' || seen.has(bookmark.id) ||
                typeof bookmark.label !== 'string')
                continue;
            const point = SceneResumeMarkerPresenter.projectPoint(bookmark.time, duration, { includeEnd: false });
            if (!point)
                continue;
            seen.add(bookmark.id);
            const interval = SceneResumeMarkerPresenter.projectInterval(bookmark.time, bookmark.endTime, duration);
            if (interval.band) {
                const band = host.ownerDocument.createElement('div');
                band.className = 'timelineInterval manualBookmarkRangeBand';
                band.setAttribute('aria-hidden', 'true');
                SceneResumeMarkerPresenter.placeInterval(band, interval.band);
                fragment.append(band);
            }
            const marker = host.ownerDocument.createElement('button');
            marker.type = 'button';
            marker.className = 'manualBookmarkMarker';
            marker.dataset.bookmarkId = bookmark.id;
            SceneResumeMarkerPresenter.placePoint(marker, point);
            marker.title = `${bookmark.label}（${Math.floor(bookmark.time)}秒）へ移動`;
            marker.setAttribute('aria-label', marker.title);
            const expectedVideo = videoId;
            const time = bookmark.time;
            marker.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (this._playerState?.videoInfo?.watchId === expectedVideo) {
                    this.emit('command', 'seekTo', time);
                }
            });
            marker.addEventListener('pointerdown', (event) => event.stopPropagation());
            marker.addEventListener('mousedown', (event) => event.stopPropagation());
            fragment.append(marker);
        }
        layer.append(fragment);
        this._timelineVideoId = videoId;
    }
    _clearManualBookmarkMarkers() {
        this._manualBookmarkMarkerLayer?.replaceChildren();
    }
    async _onFirstVideoInitialized(watchId) {
        const [view] = this._$view;
        const handler = (command, param) => this.emit('command', command, param);
        const ge = global.emitter; // emitAsync は互換用に残してる
        ge.emitResolve('videoControBar.addonMenuReady', { container: view.querySelector('.controlItemContainer.left .addonMenuContainer'), handler }).then(({ container, handler }) => ge.emitAsync('videoControBar.addonMenuReady', container, handler));
        ge.emitResolve('seekBar.addonMenuReady', { container: view.querySelector('.seekBar'), handler }).then(({ container, handler }) => ge.emitAsync('seekBar.addonMenuReady', container, handler));
    }
    get currentTime() {
        return this._currentTime;
    }
    setCurrentTime(sec) {
        this.currentTime = sec;
    }
    set currentTime(sec) {
        if (this._currentTime === sec) {
            // Refresh paused geometry without rewriting the unchanged time label.
            this._pointer.currentTime = sec;
            return;
        }
        this._currentTime = sec;
        const currentTimeText = util.secToTime(sec);
        if (this._currentTimeText !== currentTimeText) {
            this._currentTimeText = currentTimeText;
            this.currentTimeLabel.text = currentTimeText;
        }
        this._pointer.currentTime = sec;
    }
    get duration() {
        return this._duration;
    }
    set duration(sec) {
        if (sec === this._duration) {
            return;
        }
        this._duration = sec;
        this._pointer.currentTime = -1;
        this._pointer.duration = sec;
        this._wheelSeeker.duration = sec;
        this._seekRange.max = sec;
        if (sec === 0 || isNaN(sec)) {
            this.durationLabel.text = '--:--';
        }
        else {
            this.durationLabel.text = util.secToTime(sec);
        }
        this.emit('durationChange');
    }
    setBufferedRange(range, currentTime) {
        const bufferRange = this._bufferRange;
        if (!range || !range.length || !this._duration) {
            return;
        }
        for (let i = 0, len = range.length; i < len; i++) {
            try {
                const start = range.start(i);
                const end = range.end(i);
                const width = end - start;
                if (start <= currentTime && end >= currentTime) {
                    if (this._bufferStart !== start ||
                        this._bufferEnd !== end) {
                        const perLeft = (this._timeToPer(start) - 1);
                        const scaleX = (this._timeToPer(width) + 2) / 100;
                        cssUtil.setProps([bufferRange, '--buffer-range-left', cssUtil.percent(perLeft)], [bufferRange, '--buffer-range-scale', scaleX]);
                        this._bufferStart = start;
                        this._bufferEnd = end;
                    }
                    break;
                }
            }
            catch (e) { }
        }
    }
    resetBufferedRange() {
        this._bufferStart = 0;
        this._bufferEnd = 0;
        cssUtil.setProps([this._bufferRange, '--buffer-range-scale', 0]);
    }
    _hideMenu() {
        document.body.focus();
    }
}
VideoControlBar.BASE_HEIGHT = CONSTANT.CONTROL_BAR_HEIGHT;
VideoControlBar.BASE_SEEKBAR_HEIGHT = 10;
util.addStyle(`
  .videoControlBar {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100vw;
    height: var(--zenza-control-bar-height, ${VideoControlBar.BASE_HEIGHT}px);
    z-index: 150000;
    background: var(--zt-surface-0, #000);
    transition: opacity 0.3s ease, transform 0.3s ease;
    user-select: none;
    contain: layout style size;
    will-change: transform;
  }

  .videoControlBar * {
    box-sizing: border-box;
    user-select: none;
    line-break: auto;
  }

  .videoControlBar.is-wheelSeeking {
    pointer-events: none;
  }


  .controlItemContainer {
    position: absolute;
    top: 10px;
    height: 40px;
    z-index: 200;
  }

  .controlItemContainer:hover,
  .controlItemContainer:focus-within,
  .videoControlBar.is-menuOpen .controlItemContainer {
    z-index: 260;
  }

  .controlItemContainer.left {
    left: 0;
    height: 40px;
    white-space: nowrap;
    overflow: visible;
    transition: transform 0.2s ease, left 0.2s ease;
  }
  .controlItemContainer.left .scalingUI {
    padding: 0 8px 0;
  }
  .controlItemContainer.left .scalingUI:empty {
    display: none;
  }
  .controlItemContainer.left .scalingUI>* {
    background: var(--zt-surface-1, #222);
    display: inline-block;
  }

  .controlItemContainer.center {
    left: 50%;
    height: 40px;
    transform: translate(-50%, 0);
    white-space: nowrap;
    overflow: visible;
    transition: transform 0.2s ease, left 0.2s ease;
  }

  .controlItemContainer.center .scalingUI {
    transform-origin: top center;
  }
  .controlItemContainer.center .scalingUI > div{
    display: flex;
    align-items: center;
    background:
      linear-gradient(to bottom,
      transparent, transparent 4px, #222 0, #222 30px, transparent 0, transparent);
    height: 32px;
  }

  .controlItemContainer.right {
    right: 0;
  }

  .is-mouseMoving .controlItemContainer.right .controlButton{
    background: var(--zt-surface-2, #333);
  }
  .controlItemContainer.right .scalingUI {
    transform-origin: top right;
  }

  .controlButton {
    position: relative;
    display: inline-block;
    transition: opacity 0.4s ease;
    font-size: 20px;
    width: 32px;
    height: 32px;
    line-height: 30px;
    box-sizing: border-box;
    text-align: center;
    cursor: pointer;
    color: var(--zt-text-0, #fff);
    opacity: 0.8;
    min-width: 32px;
    vertical-align: middle;
    outline: none;
  }
  .controlButton:hover {
    cursor: pointer;
    opacity: 1;
  }
  .controlButton:active .controlButtonInner,
  .controlButton.is-feedback-pressed .controlButtonInner {
    transform: translate(0, 2px) scale(0.8);
  }

  /* Discussion #36: press/release is shared with pointer activation. */
  .controlButtonInner { transition: transform 0.18s ease; }
  .volumeControl { transition: filter 0.18s ease; }
  .volumeControl:active,
  .volumeControl.is-feedback-pressed { filter: brightness(1.35); }
  .controlButton.is-shortcut-feedback,
  .volumeControl.is-shortcut-feedback { opacity: 1 !important; }

  /* Preserve geometry, but expose only the actual target through the hidden
     bar's parent opacity. The target's configured display/hidden is untouched. */
  body .videoControlBar.is-action-feedback-only {
    opacity: 1 !important;
    background: transparent !important;
    transition: none !important;
    pointer-events: none;
  }
  .videoControlBar.is-action-feedback-only * {
    visibility: hidden !important;
    pointer-events: none !important;
  }
  .videoControlBar.is-action-feedback-only .seekBarContainer-mainControl {
    background: none !important;
  }
  .videoControlBar.is-action-feedback-only .is-shortcut-feedback,
  .videoControlBar.is-action-feedback-only .is-shortcut-feedback * {
    visibility: visible !important;
    pointer-events: auto !important;
  }
  .videoControlBar.is-action-feedback-only .is-shortcut-feedback .tooltip,
  .videoControlBar.is-action-feedback-only .is-shortcut-feedback .tooltip *,
  .videoControlBar.is-action-feedback-only .is-shortcut-feedback .controlMenu,
  .videoControlBar.is-action-feedback-only .is-shortcut-feedback .controlMenu *,
  .videoControlBar.is-action-feedback-only .is-shortcut-feedback .zenzaPopupMenu,
  .videoControlBar.is-action-feedback-only .is-shortcut-feedback .zenzaPopupMenu * {
    visibility: hidden !important;
    pointer-events: none !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .controlButton.is-shortcut-feedback,
    .controlButton.is-shortcut-feedback .controlButtonInner,
    .volumeControl.is-shortcut-feedback {
      transition: none !important;
      animation: none !important;
      scale: none !important;
    }
    .controlButton.is-feedback-pressed .controlButtonInner { transform: none !important; }
    .controlButton.is-feedback-pressed { transform: none !important; }
    .prevVideo.is-feedback-pressed .controlButtonInner { transform: scaleX(-1) !important; }
  }

  .is-abort   .playControl,
  .is-error   .playControl:not(.prevVideo):not(.nextVideo),
  .is-loading .playControl {
    opacity: 0.4 !important;
    pointer-events: none;
  }


  .controlButton .tooltip {
    display: none;
    pointer-events: none;
    position: absolute;
    left: 16px;
    top: -30px;
    transform:  translate(-50%, 0);
    font-size: 12px;
    line-height: 16px;
    padding: 2px 4px;
    border: 1px solid var(--zt-border-dark, #000);
    background: var(--zt-accent-soft, #ffc);
    color: var(--zt-text-inverse, #000);
    text-shadow: none;
    white-space: nowrap;
    z-index: 100;
    opacity: 0.8;
  }
  .is-hoverUiActive .controlButton:hover .tooltip {
    display: block;
    opacity: 1;
  }
  .videoControlBar:hover .controlButton {
    opacity: 1;
    pointer-events: auto;
  }

  .videoControlBar .controlButton:focus-within {
    pointer-events: none;
  }
  .videoControlBar .controlButton:focus-within .zenzaPopupMenu,
  .videoControlBar .controlButton              .zenzaPopupMenu:hover {
    pointer-events: auto;
    visibility: visible;
    opacity: 0.99;
    pointer-events: auto;
    transition: opacity 0.3s;
  }
  .videoControlBar .controlButton:focus-within .tooltip {
    display: none;
  }

  .settingPanelSwitch {
    width: 32px;
  }
  .settingPanelSwitch:hover {
    text-shadow: 0 0 8px var(--zt-accent, #ff9);
  }
  .settingPanelSwitch .tooltip {
    left: 0;
  }
  .videoControlBar .zenzaSubMenu {
    left: 50%;
    transform: translate(-50%, 0);
    bottom: 44px;
    white-space: nowrap;
  }

  .videoControlBar .triangle {
    transform: translate(-50%, 0) rotate(-45deg);
    bottom: -8.5px;
    left: 50%;
  }

  .videoControlBar .zenzaSubMenu::after {
    content: '';
    position: absolute;
    display: block;
    width: 110%;
    height: 16px;
    left: -5%;
  }

  .controlButtonInner {
    display: inline-block;
  }


  .seekTop {
    left: 0px;
    width: 32px;
    transform: scale(1.1);
  }

  .togglePlay {
    width: 36px;
    transition: transform 0.2s ease;
    transform: scale(1.1);
  }
  .togglePlay:active,
  .togglePlay.is-feedback-pressed {
    transform: scale(0.75);
  }

  .togglePlay .play,
  .togglePlay .pause {
    display: inline-block;
    position: absolute;
    top: 50%;
    left: 50%;
    transition: transform 0.1s linear, opacity 0.1s linear;
    user-select: none;
    pointer-events: none;
  }
  .togglePlay .play {
    width: 100%;
    height: 100%;
    transform: scale(1.2) translate(-50%, -50%) translate(10%, 10%);
  }
  .is-playing .togglePlay .play {
    opacity: 0;
  }
  .togglePlay>.pause {
    width: 24px;
    height: 16px;
    background-image: linear-gradient(
      to right,
      transparent 0, transparent 12.5%,
      currentColor 0, currentColor 43.75%,
      transparent 0, transparent 56.25%,
      currentColor 0, currentColor 87.5%,
      transparent 0);
    opacity: 0;
    transform: scaleX(0);
  }
  .is-playing .togglePlay>.pause {
    opacity: 1;
    transform: translate(-50%, -50%);
  }

  .seekBarContainer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    cursor: pointer;
    z-index: 250;
  }
  /* 見えないマウス判定 */
  .seekBarContainer .seekBarShadow {
    position: absolute;
    background: transparent;
    opacity: 0;
    width: 100vw;
    height: 8px;
    top: -8px;
  }
  .is-mouseMoving .seekBarContainer:hover .seekBarShadow {
    height: 48px;
    top: -48px;
  }

  .is-abort   .seekBarContainer,
  .is-loading .seekBarContainer,
  .is-error   .seekBarContainer {
    pointer-events: none;
  }
  .is-abort   .seekBarContainer *,
  .is-error   .seekBarContainer * {
    display: none;
  }

  .seekBar {
    position: relative;
    width: 100%;
    height: 10px;
    margin: 2px 0 2px;
    border-top:    1px solid var(--zt-border-dark, #333);
    border-bottom: 1px solid var(--zt-border-dark, #333);
    cursor: pointer;
    transition: height 0.2s ease 1s, margin-top 0.2s ease 1s;
  }

  .seekBar:hover {
    height: 24px;
    /* このmargin-topは見えないマウスオーバー判定を含む */
    margin-top: -14px;
    transition: none;
    background-color: var(--zt-overlay-dark, rgba(0, 0, 0, 0.5));
  }

  .seekBarContainer .seekBar * {
    pointer-events: none;
  }

  .bufferRange {
    position: absolute;
    --buffer-range-left: 0;
    --buffer-range-scale: 0;
    width: 100%;
    height: 110%;
    left: 0px;
    top: 0px;
    box-shadow: 0 0 6px var(--zt-accent, #ff9) inset, 0 0 4px var(--zt-accent, #ff9);
    z-index: 190;
    background: var(--zt-accent, #ff9);
    transform-origin: left;
    transform:
      translateX(var(--buffer-range-left))
      scaleX(var(--buffer-range-scale));
    transition: transform 0.2s;
    mix-blend-mode: overlay;
    will-change: transform, opacity;
    opacity: 0.6;
  }

  .is-youTube .bufferRange {
    width: 100% !important;
    height: 110% !important;
    background: var(--zt-danger, #f99);
    transition: transform 0.5s ease 1s;
    transform: translate3d(0, 0, 0) scaleX(1) !important;
  }

  .seekBarPointer {
    /*--width-pp: 12px;
    --trans-x-pp: 0;*/
    position: absolute;
    display: inline-block;
    top: -1px;
    left: 0;
    width: 12px;
    background: var(--zt-overlay-light, rgba(255, 255, 255, 0.7));
    height: calc(100% + 2px);
    z-index: 200;
    box-shadow: 0 0 4px var(--zt-accent-soft, #ffc) inset;
    pointer-events: none;
    transform: translateX(-6px);
    /*transform: translate(calc(var(--trans-x-pp) - var(--width-pp) / 2), -50%);*/
    will-change: transform;
    mix-blend-mode: lighten;
  }

  .is-loading .seekBarPointer {
    display: none !important;
  }

  .is-dragging .seekBarPointer.is-notSmooth {
    transition: none;
  }
  .is-dragging .seekBarPointer::after,
  .is-wheelSeeking .seekBarPointer::after {
    content: '';
    position: absolute;
    width: 36px;
    height: 36px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    border-radius: 100%;
    box-shadow: 0 0 8px var(--zt-accent-soft, #ffc) inset, 0 0 8px var(--zt-accent-soft, #ffc);
    pointer-events: none;
  }

  .seekBarContainer .seekBar .seekRange {
    -webkit-appearance: none;
    position: absolute;
    width: 100vw;
    height: 100%;
    cursor: pointer;
    opacity: 0;
    pointer-events: auto;
  }
  .seekRange::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 10px;
    width: 2px;
  }
  .seekRange::-moz-range-thumb {
    height: 10px;
    width: 2px;
  }

  .videoControlBar .videoTime {
    display: inline-flex;
    top: 0;
    padding: 0;
    width: 96px;
    height: 18px;
    line-height: 18px;
    contain: strict;
    color: var(--zt-text-0, #fff);
    font-size: 12px;
    white-space: nowrap;
    vertical-align: middle;
    background: var(--zt-overlay-dark, rgba(33, 33, 33, 0.5));
    border: 0;
    pointer-events: none;
    user-select: none;
  }

  .videoControlBar .videoTime .currentTimeLabel,
  .videoControlBar .videoTime .currentTime,
  .videoControlBar .videoTime .duration {
    position: relative;
    display: inline-block;
    color: var(--zt-text-0, #fff);
    text-align: center;
    background: inherit;
    border: 0;
    width: 44px;
    font-family: 'Yu Gothic', 'YuGothic', 'Courier New', Osaka-mono, 'ＭＳ ゴシック', monospace;
  }
  .videoControlBar.is-loading .videoTime {
    display: none;
  }

  .seekBarContainer .tooltip {
    position: absolute;
    padding: 1px;
    bottom: 12px;
    left: 0;
    transform: translate(-50%, 0);
    white-space: nowrap;
    font-size: 10px;
    opacity: 0;
    border: 1px solid var(--zt-border-dark, #000);
    background: var(--zt-surface-light, #fff);
    color: var(--zt-text-inverse, #000);
    z-index: 150;
  }

  .is-dragging .seekBarContainer .tooltip,
  .seekBarContainer:hover .tooltip {
    opacity: 0.8;
  }

  /* The native seekBar owns normal/hover/fullscreen height and scaling.
     Inset percentages follow that exact rectangle, including its transition. */
  .timelineMarkerLayer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .timelineMarkerLayer * {pointer-events: none;}
  .timelineInterval {
    position: absolute;
    top: 0;
    height: 100%;
  }
  .abRepeatRangeLayer {
    z-index: 195;
    color: var(--zt-accent-soft, #fce8a6);
  }
  .abRepeatRangeBand {
    background: var(--zt-accent-translucent, rgba(255, 211, 105, 0.22));
    box-shadow: inset 0 1px var(--zt-accent-translucent, rgba(255, 227, 151, 0.55)), inset 0 -1px var(--zt-accent-translucent, rgba(255, 227, 151, 0.55));
  }
  .abRepeatRangeLayer.is-active .abRepeatRangeBand {
    background: var(--zt-accent-translucent, rgba(255, 211, 105, 0.48));
    box-shadow: inset 0 1px var(--zt-accent, #ffe397), inset 0 -1px var(--zt-accent, #ffe397);
  }
  .abRepeatMarker {
    position: absolute;
    top: 0;
    height: 100%;
    width: 2px;
    transform: translateX(-1px);
    background: currentColor;
    font: bold 9px/10px sans-serif;
    text-indent: 3px;
    text-shadow: 0 1px 2px var(--zt-shadow, #000), 0 0 2px var(--zt-shadow, #000);
  }
  .abRepeatMarkerB {text-indent: -10px;}
  .is-loading .timelineMarkerLayer {display:none;}
  /* Saved points have narrow hit targets; range bands remain passive. */
  .manualBookmarkMarkerLayer {z-index: 205;}
  .manualBookmarkRangeBand {background: rgba(255, 211, 105, 0.12);}
  .manualBookmarkMarker {
    position: absolute;
    top: 0;
    width: 6px;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 1px solid var(--zt-accent, #eac66b);
    border-radius: 3px;
    background: var(--zt-accent, #ffd86b);
    transform: translateX(-50%);
    box-shadow: 0 0 0 1px var(--zt-shadow, #171e2a);
    cursor: pointer;
    pointer-events: auto;
  }
  .manualBookmarkMarker:hover,.manualBookmarkMarker:focus-visible {
    outline: 2px solid var(--zt-border-light, #fff);
    outline-offset: 1px;
  }
  .seekBarContainer .seekBar .manualBookmarkMarker,
  .seekBarContainer .seekBar .resumePointer {pointer-events: auto;}
  .resumePointer {
    position: absolute;
    mix-blend-mode: color-dodge;
    will-change: transform;
    top: 0;
    z-index: 200;
  }

  .zenzaHeatMap {
    position: absolute;
    pointer-events: none;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    transform-origin: 0 0 0;
    will-change: transform;
    opacity: 0.5;
    z-index: 110;
  }
  .noHeatMap .zenzaHeatMap {
    display: none;
  }

  .loopSwitch {
    width:  32px;
    height: 32px;
    line-height: 30px;
    font-size: 20px;
    color: var(--zt-text-2, #888);
  }
  .loopSwitch:active,
  .loopSwitch.is-feedback-pressed {
    font-size: 15px;
  }

  .is-loop .loopSwitch {
    color: var(--enabled-button-color);
  }
  .loopSwitch .controlButtonInner {
    font-family: STIXGeneral;
  }

  .playbackRateMenu {
    bottom: 0;
    width: auto;
    width: 48px;
    height: 32px;
    line-height: 30px;
    font-size: 18px;
    white-space: nowrap;
    margin-right: 0;
  }

  /* Task947: long configured key combinations must not escape a narrow player.
   * Keep the existing tooltip anchor on normal screens; center only the text
   * tooltip (not the button or submenu) across the control bar when narrow. */
  .videoControlBar .playbackRateMenu .tooltip {
    width: max-content;
    max-width: min(90vw, 360px);
    white-space: normal;
    text-align: center;
  }
  @media (max-width: 560px) {
    .videoControlBar .playbackRateMenu .tooltip {
      position: fixed;
      left: 50%;
      top: auto;
      bottom: 40px;
      transform: translateX(-50%);
    }
  }

  .playbackRateSelectMenu {
    width: 180px;
    text-align: left;
    line-height: 20px;
    font-size: 18px !important;
  }

  .playbackRateSelectMenu ul {
    margin: 2px 8px;
  }

  .playbackRateSelectMenu li {
    padding: 3px 4px;
  }

  .screenModeMenu:focus-within {
    background: var(--zt-surface-3, #888);
  }
  .screenModeMenu:focus-within .tooltip {
    display: none;
  }

  .screenModeSelectMenu {
    width: 148px;
    padding: 2px 4px;
    font-size: 12px;
    line-height: 15px;
  }

  .screenModeSelectMenu ul {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .screenModeSelectMenu ul li {
    display: inline-block;
    text-align: center;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .screenModeSelectMenu ul li span {
    border: 1px solid var(--zt-border-light, #ccc);
    width: 50px;
    margin: 2px 8px;
    padding: 4px 0;
  }

  body[data-screen-mode="3D"]       .screenModeSelectMenu li.mode3D span,
  body[data-screen-mode="sideView"] .screenModeSelectMenu li.sideView span,
  body[data-screen-mode="small"]    .screenModeSelectMenu li.small span,
  body[data-screen-mode="normal"]   .screenModeSelectMenu li.normal span,
  body[data-screen-mode="big"]      .screenModeSelectMenu li.big span,
  body[data-screen-mode="wide"]     .screenModeSelectMenu li.wide span {
    color: var(--zt-accent, #ff9);
    border-color: var(--zt-accent, #ff0);
  }

  .fullscreenControlBarModeMenu {
    display: none;
    font-size: 16px;
    white-space: nowrap;
  }
  .fullscreenControlBarModeMenu .controlButtonInner {
    filter: grayscale(100%);
  }
  .fullscreenControlBarModeMenu:focus-within .controlButtonInner,
  .fullscreenControlBarModeMenu:hover .controlButtonInner {
    filter: grayscale(50%);
  }


           .is-fullscreen  .fullscreenSwitch .controlButtonInner .toFull,
  body:not(.is-fullscreen) .fullscreenSwitch .controlButtonInner .returnFull {
    display: none;
  }

  .videoControlBar .muteSwitch {
    margin-right: 0;
  }
  .videoControlBar .muteSwitch:active,
  .videoControlBar .muteSwitch.is-feedback-pressed {
    font-size: 15px;
  }

  .zenzaPlayerContainer:not(.is-mute) .muteSwitch .mute-on,
                            .is-mute  .muteSwitch .mute-off {
    display: none;
  }

  .videoControlBar .volumeControl {
    display: inline-block;
    position: relative;
  }
  /* Task939: show separate configured volume up/down keys. Keep the hint
     out of the input hit area and the control bar's layout. */
  .videoControlBar .volumeControl .tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 5px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    box-sizing: border-box;
    width: max-content;
    max-width: min(90vw, 360px);
    padding: 2px 5px;
    font-size: 12px;
    line-height: 16px;
    text-align: center;
    white-space: normal;
    color: var(--zt-text-inverse, #111);
    background: var(--zt-accent-soft, #fffbd2);
    border: 1px solid var(--zt-border-dark, #000);
    pointer-events: none;
  }
  .is-hoverUiActive .videoControlBar .volumeControl:hover .tooltip,
  .videoControlBar .volumeControl:focus-within .tooltip {
    display: block;
  }
  .videoControlBar .volumeRange {
    width: 64px;
    height: 8px;
    position: relative;
    vertical-align: middle;
    --back-color: #333;
    --fore-color: #ccc;
  }
  .is-mute .videoControlBar .volumeRange  {
    --fore-color: var(--back-color);
    pointer-events: none;
  }

  .prevVideo.playControl,
  .nextVideo.playControl {
    display: none;
  }
  .is-playlistEnable .prevVideo.playControl,
  .is-playlistEnable .nextVideo.playControl {
    display: inline-block;
  }

  .prevVideo,
  .nextVideo {
    font-size: 23px;
  }
  .prevVideo .controlButtonInner {
    transform: scaleX(-1);
  }
  .prevVideo:active .controlButtonInner,
  .prevVideo.is-feedback-pressed .controlButtonInner {
    transform: translate(0, 2px) scale(-0.8, 0.8);
  }


  .toggleStoryboard {
    visibility: hidden;
    pointer-events: none;
  }
  .is-storyboardAvailable .toggleStoryboard {
    visibility: visible;
    pointer-events: auto;
  }
  .zenzaStoryboardOpen .is-storyboardAvailable .toggleStoryboard {
    color: var(--enabled-button-color);
  }

  .toggleStoryboard .controlButtonInner {
    position: absolute;
    width: 20px;
    height: 20px;
    top: 50%;
    left: 50%;
    border-radius: 75% 16%;
    border: 1px solid;
    transform: translate(-50%, -50%) rotate(45deg);
    pointer-events: none;
    background:
      radial-gradient(
        currentColor,
        currentColor 6px,
        transparent 0
      );
  }
  .toggleStoryboard:active .controlButtonInner,
  .toggleStoryboard.is-feedback-pressed .controlButtonInner {
    transform: translate(-50%, -50%) scaleY(0.1) rotate(45deg);
  }

  .toggleStoryboard:active,
  .toggleStoryboard.is-feedback-pressed {
    transform: scale(0.75);
  }

  /* Task 077c: 画面フィルターのボタン（「画」の左）。効いている時は水色に光る */
  .screenFilterSwitch .controlButtonInner,
  .commentHistorySwitch .controlButtonInner {
    width: 26px;
    height: 26px;
    vertical-align: middle;
  }
  .screenFilterSwitch svg,
  .commentHistorySwitch svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
  .playbackPointsSwitch[hidden]{display:none!important}
  .playbackPointsSwitch:focus-visible{outline:2px solid #8ecbff;outline-offset:-2px}
  .playbackPointsSwitch,
  .notificationHistorySwitch,
  .commentHistorySwitch { border: 0; padding: 0; background: transparent; }
  /* Native action buttons receive focus on mouse-down. Keep their hit targets active,
     while preserving focus-within suppression for existing popup-menu containers. */
  .videoControlBar .playbackPointsSwitch:focus-within,
  .videoControlBar .notificationHistorySwitch:focus-within,
  .videoControlBar .commentHistorySwitch:focus-within { pointer-events: auto; }
  .notificationHistorySwitch:focus-visible,
  .commentHistorySwitch:focus-visible { outline: 2px solid var(--enabled-button-color, #9cf); outline-offset: -2px; }
  .notificationHistorySwitch:focus-visible .tooltip,
  .commentHistorySwitch:focus-visible .tooltip { display: block; }
  .screenFilterSwitch.is-active {
    color: var(--enabled-button-color);
    opacity: 1;
  }
  .screenFilterSwitch.is-active svg {
    filter: drop-shadow(0 0 3px var(--enabled-button-color));
  }
  .is-youTube .screenFilterSwitch,
  .is-youTube .commentHistorySwitch {
    display: none;
  }

  .videoServerTypeMenu {
    min-width: 40px;
    font-size: 16px;
    white-space: nowrap;
  }
  .videoServerTypeMenu.is-dmc-playing  {
    text-shadow:
      0px 0px 8px var(--enabled-button-color),
      0px 0px 6px var(--enabled-button-color),
      0px 0px 4px var(--enabled-button-color),
      0px 0px 2px var(--enabled-button-color);
  }
  .is-mouseMoving .videoServerTypeMenu.is-dmc-playing {
    background: var(--zt-info-strong, #336);
  }
  .is-youTube .videoServerTypeMenu {
    text-shadow:
      0px 0px 8px #fc9, 0px 0px 6px #fc9, 0px 0px 4px #fc9, 0px 0px 2px #fc9 !important;
  }
  .is-youTube .videoServerTypeMenu:not(.forYouTube),
  .videoServerTypeMenu.forYouTube {
    display: none;
  }
  .is-youTube .videoServerTypeMenu.forYouTube {
    display: inline-block;
  }


  .videoServerTypeMenu:focus-within {
    background: var(--zt-surface-3, #888);
  }
  .videoServerTypeMenu:focus-within .tooltip {
    display: none;
  }

  .videoServerTypeSelectMenu  {
    bottom: 44px;
    left: 50%;
    transform: translate(-50%, 0);
    width: 180px;
    text-align: left;
    line-height: 20px;
    font-size: 16px !important;
    text-shadow: none !important;
    cursor: default;
  }

  .videoServerTypeSelectMenu > ul {
    margin: 2px 8px;
  }

  .videoServerTypeSelectMenu > ul > li.selected:hover {
    background: none;
  }

  .videoServerTypeSelectMenu li:not(.selected) {
    font-weight: initial;
  }

  .videoServerTypeSelectMenu li.selected > span {
    pointer-events: none;
    text-shadow: 0 0 4px var(--zt-info, #99f), 0 0 8px var(--zt-info, #99f) !important;
  }

  .videoServerTypeSelectMenu .domandVideoQuality,
  .videoServerTypeSelectMenu .dmcVideoQuality {
    font-size: 80%;
  }

  .videoServerTypeSelectMenu .currentVideoQuality {
    color: var(--zt-info-soft, #ccf);
    font-size: 80%;
    text-align: center;
  }

  .videoServerTypeSelectMenu .domandVideoQuality > li,
  .videoServerTypeSelectMenu .dmcVideoQuality > li {
    margin-right: 0;
    margin-left: 0;
    padding-right: 12px;
    padding-left: 12px;
  }

  .videoServerTypeSelectMenu .domandVideoQuality > li > span,
  .videoServerTypeSelectMenu .dmcVideoQuality > li > span {
    margin-left: 12px;
  }

  .videoServerTypeSelectMenu .domandVideoQuality > li.selected > span::before,
  .videoServerTypeSelectMenu .dmcVideoQuality > li.selected > span::before {
    left: 12px;
  }

  /* domandを使用不能の時はdomand画質選択を薄く */
  .zenzaPlayerContainer:not(.is-domandAvailable) .serverType.select-server-domand {
    opacity: 0.4;
    pointer-events: none;
    text-shadow: none !important;
  }

  /* dmcを使用不能の時はdmc画質選択を薄く */
  .zenzaPlayerContainer:not(.is-dmcAvailable) .serverType.select-server-dmc {
    opacity: 0.4;
    pointer-events: none;
    text-shadow: none !important;
  }


  /* 選択していないシステムの画質選択を隠す */
  .videoServerTypeMenu:not(.is-domand-playing) .domandVideoQuality,
  .videoServerTypeMenu:not(.is-domand-playing) .serverType.select-server-domand .currentVideoQuality,
  .videoServerTypeMenu:not(.is-dmc-playing) .dmcVideoQuality,
  .videoServerTypeMenu:not(.is-dmc-playing) .serverType.select-server-dmc .currentVideoQuality {
    display: none;
  }



  @media screen and (max-width: 768px) {
    .controlItemContainer.center {
      left: 0%;
      transform: translate(0, 0);
    }
  }

  .ZenzaWatchVer {
    display: none;
  }
  .ZenzaWatchVer[data-env="DEV"] {
    display: inline-block;
    color: var(--zt-text-2, #999);
    position: absolute;
    right: 0;
    background: transparent !important;
    transform: translate(100%, 0);
    font-size: 12px;
    line-height: 32px;
    pointer-events: none;
  }

  .progressWave {
    display: none;
  }
  .is-stalled .progressWave,
  .is-loading .progressWave {
    display: inline-block;
    position: absolute;
    left: 0;
    top: 1px;
    z-index: 400;
    width: 40%;
    height: calc(100% - 2px);
    background: linear-gradient(
      to right,
      rgba(0,0,0,0),
      ${util.toRgba('#ffffcc', 0.3)},
      rgba(0,0,0)
    );
    mix-blend-mode: lighten;
    animation-name: progressWave;
    animation-iteration-count: infinite;
    animation-duration: 4s;
    animation-timing-function: linear;
    animation-delay: -1s;
  }
  @keyframes progressWave {
    0%   { transform: translate3d(-100%, 0, 0) translate3d(-5vw, 0, 0); }
    100% { transform: translate3d(100%, 0, 0) translate3d(150vw, 0, 0); }
  }
  .is-seeking .progressWave {
    display: none;
  }


`, { className: 'videoControlBar' });
util.addStyle(`
  .videoControlBar {
    width: 100% !important; /* 100vwだと縦スクロールバーと被る */
  }

  /* Task 051 (A-11): 「小」「サイドビュー」モード（screenMode for-popup）向けの
     コントロールバー自動非表示。
     この自動非表示CSS自体（body .videoControlBar{opacity:0}〜
     is-mouseMoving/:hoverでの表示切り替え）は、従来"screenMode for-full"の
     <style>ブロック内にしか無く、フルスクリーン/ワイド/3D等の画面モードでしか
     有効化されていなかった（_updateScreenModeStyle()が<style>要素ごとオン/オフを
     切り替える設計のため）。「小」「サイドビュー」モードではその<style>ブロック
     自体が無効化されており、.videoControlBarにはCSSの既定値（opacity:1）が
     そのまま適用され続けていたため、is-mouseMoving等のクラス操作に関わらず
     常時表示になっていた（NicoVideoPlayerDialog.js側のshowVideoControlBar
     強制表示の修正だけではこの根本原因は解消しない）。ここに同じ仕組みを追加し、
     「小」「サイドビュー」モードでも既存のis-mouseMoving/:hoverベースの
     自動非表示が機能するようにする。
     ※ for-fullブロックにある「position: absolute !important（Firefoxのバグ対策）」
     はここには含めない。「小」モードの.videoControlBarはposition: fixedのまま
     画面下に固定される設計（Task 031）のため、position上書きは不要かつ有害。 */
  body .videoControlBar {
    opacity: 0;
    background: none;
  }
  .showVideoControlBar .videoControlBar {
    opacity: 1 !important;
    background: var(--zt-surface-0, #000) !important;
  }
  /* 2026-09-11: ユーザー要望により、次の2点を修正。
     1. 半透明の中間状態（旧: is-mouseMoving等でopacity:0.7、背景rgba(0,0,0,0.5)）
        を廃止し、「はっきり不透明表示⇔完全に透明」の2段階のみにした。加えて
        「はっきり表示」側の背景もrgba(0,0,0,0.9)（わずかに透けていた）から
        完全な不透明（#000）に変更し、透け方を一切残さないようにした。
     2. 表示トリガーをis-mouseMovingから、コントロールバー専用のis-controlBarActive
        に変更（NicoVideoPlayerDialog.jsの_initializeDom内コメント参照）。
        is-mouseMoving（400ms）はホバーメニュー等、他のUI要素と共有の
        タイミングのため変更できず、コントロールバーだけをもっと長く
        （3000ms）表示させたいという要望に応えるため専用化した。
        Task936では一時停止時の再表示を設定可能（小・全画面は既定OFF）にした。
        ONのときはマウス移動と同じ自動非表示タイマーを使い、秒数は
        小・全画面で独立して設定できる（Task938の分類整理）。 */
  .volumeChanging .videoControlBar,
  .is-controlBarActive .videoControlBar,
  .videoControlBar.is-dragging,
  .videoControlBar:hover {
    opacity: 1;
    background: var(--zt-surface-0, #000);
  }
`, { className: 'screenMode for-popup videoControlBar', disabled: true });
util.addStyle(`
  body .videoControlBar {
    position: absolute !important; /* firefoxのバグ対策 */
    opacity: 0;
    background: none;
  }

  .showVideoControlBar .videoControlBar {
    opacity: 1 !important;
    background: var(--zt-surface-0, #000) !important;
  }

  /* 2026-09-11: ユーザー要望により、次の2点を修正。for-popupブロック側と揃えた。
     1. 半透明の中間状態（旧: is-mouseMoving等でopacity:0.7、背景rgba(0,0,0,0.5)）
        を廃止し、「はっきり不透明表示⇔完全に透明」の2段階のみにした。加えて
        「はっきり表示」側の背景もrgba(0,0,0,0.9)（わずかに透けていた）から
        完全な不透明（#000）に変更し、透け方を一切残さないようにした。
     2. 表示トリガーをis-mouseMovingから、コントロールバー専用のis-controlBarActive
        に変更（NicoVideoPlayerDialog.jsの_initializeDom内コメント参照）。
        is-mouseMoving（400ms）はホバーメニュー等、他のUI要素と共有の
        タイミングのため変更できず、コントロールバーだけをもっと長く
        （3000ms）表示させたいという要望に応えるため専用化した。
        Task936では一時停止時の再表示を設定可能（小・全画面は既定OFF）にした。
        ONのときはマウス移動と同じ自動非表示タイマーを使い、秒数は
        小・全画面で独立して設定できる（Task938の分類整理）。 */
  .volumeChanging .videoControlBar,
  .is-controlBarActive .videoControlBar,
  .videoControlBar.is-dragging,
  .videoControlBar:hover {
    opacity: 1;
    background: var(--zt-surface-0, #000);
  }

  /* "Always hide" must take precedence over the activity timer. Keep the
     directly hovered/focused control strip reachable so users can change back. */
  body[data-fullscreen-control-bar-mode="always-hide"] .is-controlBarActive .videoControlBar,
  body[data-fullscreen-control-bar-mode="always-hide"] .volumeChanging .videoControlBar {
    opacity: 0;
    background: none;
  }
  body[data-fullscreen-control-bar-mode="always-hide"] .videoControlBar:hover,
  body[data-fullscreen-control-bar-mode="always-hide"] .videoControlBar:focus-within {
    opacity: 1;
    background: var(--zt-surface-0, #000);
  }

  .fullscreenControlBarModeMenu {
    display: inline-block;
  }

  .fullscreenControlBarModeSelectMenu {
    padding: 2px 4px;
    font-size: 12px;
    line-height: 15px;
    font-size: 16px !important;
    text-shadow: none !important;
  }

  .fullscreenControlBarModeSelectMenu ul {
    margin: 2px 8px;
  }

  .fullscreenControlBarModeSelectMenu li {
    padding: 3px 4px;
  }

  .fullscreenControlBarModeMenu li:focus-within,
  body[data-fullscreen-control-bar-mode="auto"] .fullscreenControlBarModeMenu [data-param="auto"],
  body[data-fullscreen-control-bar-mode="always-show"] .fullscreenControlBarModeMenu [data-param="always-show"],
  body[data-fullscreen-control-bar-mode="always-hide"] .fullscreenControlBarModeMenu [data-param="always-hide"] {
    color: var(--zt-accent, #ff9);
    outline: none;
  }

`, { className: 'screenMode for-full videoControlBar', disabled: true });
util.addStyle(`
  .screenModeSelectMenu {
    display: none;
  }

  .controlItemContainer.left {
    top: auto;
    transform-origin: top left;
  }
  .seekBarContainer {
    top: auto;
    bottom: 0;
    z-index: 300;
  }
  .seekBarContainer:hover .seekBarShadow {
    height: 14px;
    top: -12px;
  }
  .seekBar {
    margin-top: 0px;
    margin-bottom: -14px;
    height: 24px;
    transition: none;
  }
  .screenModeMenu {
    display: none;
  }
  .controlItemContainer.center {
    top: auto;
  }
  .zenzaStoryboardOpen .controlItemContainer.center {
    background: transparent;
  }
  .zenzaStoryboardOpen .controlItemContainer.center .scalingUI {
    background: var(--zt-overlay-dark, rgba(32, 32, 32, 0.5));
  }
  .zenzaStoryboardOpen .controlItemContainer.center .scalingUI:hover {
    background: var(--zt-overlay-dark, rgba(32, 32, 32, 0.8));
  }
  .controlItemContainer.right {
    top: auto;
    z-index: 310;
  }
  .videoControlBar.is-menuOpen .controlItemContainer.right {
    z-index: 320;
  }

  /* Issue #3 / Task951: let the transparent right-controls wrapper and its
     scaling element pass the seekbar mouse input through. Real buttons retain
     their z-index:310/320 and their own click/focus/child-menu behavior.
     Keep this rule in the same fullscreen stylesheet as the seekbar geometry;
     it must never depend on a separately initialized global CSS module. */
  .videoControlBar .controlItemContainer.right,
  .videoControlBar .controlItemContainer.right > .scalingUI {
    pointer-events: none;
  }
  :where(.videoControlBar .controlItemContainer.right > .scalingUI) > .controlButton {
    pointer-events: auto;
  }

`, { className: 'screenMode for-screen-full videoControlBar', disabled: true });
VideoControlBar.__tpl__ = (`
    <div class="videoControlBar" data-command="nop">

      <div class="seekBarContainer">
        <div class="seekBarShadow"></div>
        <div class="seekBar">
          <div class="seekBarPointer"></div>
          <div class="bufferRange"></div>
          <div class="progressWave"></div>
          <input type="range" class="seekRange" min="0" step="any">
          <canvas width="200" height="10" class="heatMap zenzaHeatMap"></canvas>
        </div>
        <zenza-seekbar-label class="resumePointer" data-command="seekTo" data-text="ここまで見た"></zenza-seekbar-label>
        <zenza-seekbar-label class="resumePointer" data-command="seekTo" data-text="ここまで見た"></zenza-seekbar-label>
        <zenza-seekbar-label class="resumePointer" data-command="seekTo" data-text="ここまで見た"></zenza-seekbar-label>
        <zenza-seekbar-label class="resumePointer" data-command="seekTo" data-text="ここまで見た"></zenza-seekbar-label>
        <zenza-seekbar-label class="resumePointer" data-command="seekTo" data-text="ここまで見た"></zenza-seekbar-label>
      </div>

      <div class="controlItemContainer left">
        <div class="scalingUI">
          <div class="ZenzaWatchVer" data-env="${ZenzaWatch.env}" title="build: ${ZenzaWatch.build || '-'}">ver ${ZenzaWatch.version}${ZenzaWatch.env === 'DEV' ? '(Dev)' : ''}</div>
          <span class="addonMenuContainer"></span>
          <button type="button" class="playbackPointsSwitch controlButton" data-command="toggle-playbackPoints"
            aria-label="しおり・ABリピート" aria-expanded="false">
            <span class="controlButtonInner" aria-hidden="true">▱</span>
            <span class="tooltip">しおり・ABリピート</span>
          </button>
          <button type="button" class="notificationHistorySwitch controlButton" data-command="toggle-notificationHistory"
            aria-label="通知履歴" aria-expanded="false" aria-controls="zenzaNotificationHistoryDock">
            <span class="controlButtonInner" aria-hidden="true">☷</span>
            <span class="tooltip">通知履歴</span>
          </button>
        </div>
      </div>
      <div class="controlItemContainer center">
        <div class="scalingUI">
          <div class="seekBarContainer-mainControl">
            <div class="prevVideo controlButton playControl" data-command="playPreviousVideo" data-param="0">
              <div class="controlButtonInner">&#x27A0;</div>
              <div class="tooltip">前の動画</div>
            </div>

            <div class="toggleStoryboard controlButton playControl" data-command="toggleStoryboard">
              <div class="controlButtonInner"></div>
              <div class="tooltip">シーンサーチ</div>
            </div>

            <div class="loopSwitch controlButton playControl" data-command="toggle-loop">
              <div class="controlButtonInner">&#8635;</div>
              <div class="tooltip">リピート</div>
            </div>

            <div class="seekTop controlButton playControl" data-command="seek" data-param="0">
              <div class="controlButtonInner">&#8676;</div>
              <div class="tooltip">先頭</div>
            </div>

            <div class="togglePlay controlButton playControl" data-command="togglePlay">
              <span class="pause"></span>
              <span class="play">▶</span>
              <span class="tooltip">再生・一時停止</span>
            </div>

            <div class="playbackRateMenu controlButton" tabindex="-1" data-has-submenu="1" data-shortcut-hint="speed">
              <div class="controlButtonInner"></div>
              <div class="tooltip">再生速度</div>
              <div class="playbackRateSelectMenu zenzaPopupMenu zenzaSubMenu">
                <div class="triangle"></div>
                <p class="caption">再生速度</p>
                <ul>
                  <li class="playbackRate" data-command="playbackRate" data-param="10"><span>10倍</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="5"  ><span>5倍</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="4"  ><span>4倍</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="3"  ><span>3倍</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="2"  ><span>2倍</span></li>

                  <li class="playbackRate" data-command="playbackRate" data-param="1.75"><span>1.75倍</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="1.5"><span>1.5倍</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="1.25"><span>1.25倍</span></li>

                  <li class="playbackRate" data-command="playbackRate" data-param="1.0"><span>標準速度(x1)</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="0.75"><span>0.75倍</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="0.5"><span>0.5倍</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="0.25"><span>0.25倍</span></li>
                  <li class="playbackRate" data-command="playbackRate" data-param="0.1"><span>0.1倍</span></li>
                </ul>
              </div>
            </div>

            <div class="videoTime">
              <span class="currentTimeLabel"></span>/<span class="durationLabel"></span>
            </div>

            <div class="muteSwitch controlButton" data-command="toggle-mute">
              <div class="tooltip">ミュート</div>
              <div class="menuButtonInner mute-off">&#x1F50A;</div>
              <div class="menuButtonInner mute-on">&#x1F507;</div>
            </div>

            <div class="volumeControl" data-shortcut-hint="volume">
              <zenza-range-bar><input class="volumeRange" type="range" value="0.5" min="0.01" max="1" step="any" aria-label="音量調整"></zenza-range-bar>
              <span class="tooltip">音量調整</span>
            </div>

            <div class="nextVideo controlButton playControl" data-command="playNextVideo" data-param="0">
              <div class="controlButtonInner">&#x27A0;</div>
              <div class="tooltip">次の動画</div>
            </div>

          </div>
        </div>
      </div>

      <div class="controlItemContainer right">

        <div class="scalingUI">

          <button type="button" class="commentHistorySwitch controlButton" data-command="toggle-commentHistoryPanel" aria-label="コメント増量" aria-expanded="false">
            <span class="controlButtonInner">${ZenzaCommentHistoryCore.HISTORY_ICON}</span>
            <span class="tooltip">コメント増量</span>
          </button>

          <div class="screenFilterSwitch controlButton" data-command="toggle-screenFilterPanel">
            <div class="controlButtonInner"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M15 10Q15 19 24 19Q15 19 15 28Q15 19 6 19Q15 19 15 10ZM26 5.5Q26 10 30.5 10Q26 10 26 14.5Q26 10 21.5 10Q26 10 26 5.5Z"/></svg></div>
            <div class="tooltip">画面フィルター（明るさ・色）</div>
          </div>

          <div class="videoServerTypeMenu controlButton forYouTube" data-command="reload" title="ZenTube解除">
            <div class="controlButtonInner">画</div>
          </div>
          <div class="videoServerTypeMenu controlButton" tabindex="-1" data-has-submenu="1">
            <div class="controlButtonInner">画</div>

            <div class="tooltip">動画サーバー・画質</div>
            <div class="videoServerTypeSelectMenu zenzaPopupMenu zenzaSubMenu">
              <div class="triangle"></div>
              <p class="caption">動画サーバー・画質</p>
              <ul>
                <li class="serverType select-server-domand selected" data-command="update-videoServerType" data-param="domand">
                  <span>新システムを使用</span>
                  <p class="currentVideoQuality"></p>
                  <ul class="domandVideoQuality">
                    <li class="select-domand-auto"  data-command="update-domandVideoQuality" data-param="auto"><span>自動(auto)</span></li>
                    <li class="select-domand-1080p" data-command="update-domandVideoQuality" data-param="1080p"><span>1080p 優先</span></li>
                    <li class="select-domand-720p"  data-command="update-domandVideoQuality" data-param="720p"><span>720p</span></li>
                    <li class="select-domand-480p"  data-command="update-domandVideoQuality" data-param="480p"><span>480p</span></li>
                    <li class="select-domand-360p"  data-command="update-domandVideoQuality" data-param="360p"><span>360p</span></li>
                    <li class="select-domand-144p"  data-command="update-domandVideoQuality" data-param="144p"><span>144p</span></li>
                  </ul>
                </li>

                <li class="serverType select-server-dmc" data-command="update-videoServerType" data-param="dmc">
                  <span>旧システムを使用</span>
                  <p class="currentVideoQuality"></p>
                  <ul class="dmcVideoQuality">
                    <li class="select-dmc-auto"     data-command="update-dmcVideoQuality" data-param="auto"><span>自動(auto)</span></li>
                    <li class="select-dmc-veryhigh" data-command="update-dmcVideoQuality" data-param="veryhigh"><span>超(1080) 優先</span></li>
                    <li class="select-dmc-high"     data-command="update-dmcVideoQuality" data-param="high"><span>高(720) 優先</span></li>
                    <li class="select-dmc-mid"      data-command="update-dmcVideoQuality" data-param="mid"><span>中(480-540)</span></li>
                    <li class="select-dmc-low"      data-command="update-dmcVideoQuality" data-param="low"><span>低(360)</span></li>
                  </ul>
                </li>
             </ul>
            </div>
          </div>

          <div class="screenModeMenu controlButton" tabindex="-1" data-has-submenu="1">
            <div class="tooltip">画面サイズ・モード変更</div>
            <div class="controlButtonInner">&#9114;</div>
            <div class="screenModeSelectMenu zenzaPopupMenu zenzaSubMenu">
              <div class="triangle"></div>
              <p class="caption">画面モード</p>
              <ul>
                <li class="screenMode mode3D"   data-command="screenMode" data-param="3D"><span>3D</span></li>
                <li class="screenMode small"    data-command="screenMode" data-param="small"><span>小</span></li>
                <li class="screenMode sideView" data-command="screenMode" data-param="sideView"><span>横</span></li>
                <li class="screenMode normal"   data-command="screenMode" data-param="normal"><span>中</span></li>
                <li class="screenMode wide"     data-command="screenMode" data-param="wide"><span>WIDE</span></li>
                <li class="screenMode big"      data-command="screenMode" data-param="big"><span>大</span></li>
              </ul>
            </div>
          </div>

          <div class="fullscreenControlBarModeMenu controlButton" tabindex="-1" data-has-submenu="1">
            <div class="tooltip">ツールバーの表示</div>
            <div class="controlButtonInner">&#128204;</div>
            <div class="fullscreenControlBarModeSelectMenu zenzaPopupMenu zenzaSubMenu">
              <div class="triangle"></div>
              <p class="caption">ツールバーの表示</p>
              <ul>
                <li tabindex="-1" data-command="update-fullscreenControlBarMode" data-param="always-show"><span>常に固定</span></li>
                <li tabindex="-1" data-command="update-fullscreenControlBarMode" data-param="always-hide"><span>常に隠す</span></li>
                <li tabindex="-1" data-command="update-fullscreenControlBarMode" data-param="auto"><span>画面サイズ自動</span></li>
              </ul>
            </div>
          </div>

          <div class="fullscreenSwitch controlButton" data-command="fullscreen">
            <div class="tooltip">フルスクリーン</div>
            <div class="controlButtonInner">
              <!-- TODO: YouTubeと同じにする -->
              <span class="toFull">&#8690;</span>
              <span class="returnFull">&#8689;</span>
            </div>
          </div>

          <div class="settingPanelSwitch controlButton" data-command="settingPanel">
            <div class="controlButtonInner">&#x2699;</div>
            <div class="tooltip">設定</div>
          </div>

        </div>
      </div>

    </div>
  `).trim();
//===END===
export {
  VideoControlBar,
  HeatMapWorker
};
