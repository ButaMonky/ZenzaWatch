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

// GENERATED FROM tools/typescript-stage1/nico-src/NicoVideoPlayerDialogViewFeedback.ts (Task1063). Edit the .ts and run npm run nico:sync.
//===BEGIN===
// legacy-to-ts: names provided by other bundled modules
/** コマンドやショートカットを実行した時に、対応するボタンを光らせる表示。 */
const NicoVideoPlayerDialogViewFeedback = {
    _clearActionFeedback() {
        this._shortcutFeedbackToken = undefined;
        clearTimeout(this._shortcutFeedbackTimer);
        clearTimeout(this._shortcutFeedbackPressTimer);
        this._shortcutFeedbackTimer = null;
        this._shortcutFeedbackPressTimer = undefined;
        const icon = this._shortcutFeedbackIcon;
        if (icon) {
            // Do not leave a retired hover button visible during its normal .4s
            // opacity transition when the next shortcut selects a different target.
            const transition = icon.style.getPropertyValue('transition');
            const transitionPriority = icon.style.getPropertyPriority('transition');
            icon.style.setProperty('transition', 'none', 'important');
            icon.classList.remove('is-shortcut-feedback', 'is-feedback-pressed');
            void icon.ownerDocument.defaultView?.getComputedStyle(icon).opacity;
            if (transition) {
                icon.style.setProperty('transition', transition, transitionPriority);
            }
            else {
                icon.style.removeProperty('transition');
            }
            const saved = this._shortcutFeedbackRestore;
            for (const [name, { previous, value }] of Object.entries(saved?.attributes || {})) {
                if (icon.getAttribute(name) !== value) {
                    continue;
                }
                if (previous == null) {
                    icon.removeAttribute(name);
                }
                else {
                    icon.setAttribute(name, previous);
                }
            }
            const animation = saved?.animation;
            if (animation && icon.style.getPropertyValue('--zenza-feedback-animation') === animation.value &&
                !icon.style.getPropertyPriority('--zenza-feedback-animation')) {
                if (animation.previous) {
                    icon.style.setProperty('--zenza-feedback-animation', animation.previous, animation.priority);
                }
                else {
                    icon.style.removeProperty('--zenza-feedback-animation');
                }
            }
        }
        this._shortcutFeedbackIcon = null;
        this._shortcutFeedbackRestore = undefined;
        this._releaseActionFeedbackIsolation();
    },
    _flashShortcutToggleFeedback(type, enabled) {
        // Compatibility entry point; all feedback now has the same owner/lifetime.
        const command = type === 'comment' ? 'toggle-showComment' :
            type === 'ng' ? 'toggle-enableFilter' : null;
        if (command) {
            this._flashActionFeedback(command, undefined, enabled);
        }
    },
    _findActionFeedbackTarget(command, param, allowUnavailable = false) {
        const host = this._$playerContainer?.[0];
        if (!host || typeof command !== 'string') {
            return null;
        }
        // Only aliases/grouped controls need an entry. A future button with the
        // same data-command is discovered automatically, including addon buttons.
        const aliases = {
            'toggle-showComment': '.showCommentSwitch',
            'toggle-enableFilter': '.ngFilterSwitch',
            'toggle-like': '.toggleLikeButton',
            deflistAdd: '.mylistButton.deflistAdd', deflistRemove: '.mylistButton.deflistAdd',
            mylistAdd: '.mylistButton.mylistAddMenu', mylistRemove: '.mylistButton.mylistAddMenu',
            play: '.videoControlBar .togglePlay', pause: '.videoControlBar .togglePlay',
            togglePlay: '.videoControlBar .togglePlay',
            playNextVideo: '.videoControlBar .nextVideo',
            playPreviousVideo: '.videoControlBar .prevVideo',
            fullscreen: '.fullscreenSwitch', 'toggle-fullscreen': '.fullscreenSwitch',
            volume: '.volumeControl', volumeBy: '.volumeControl',
            volumeUp: '.volumeControl', volumeDown: '.volumeControl',
            playbackRate: '.playbackRateMenu', shiftUp: '.playbackRateMenu', shiftDown: '.playbackRateMenu',
            screenMode: '.screenModeMenu',
            'toggle-enableStoryboardBar': '.toggleStoryboard', toggleStoryboard: '.toggleStoryboard'
        };
        if (['nop', 'close'].includes(command)) {
            return null;
        }
        let selector = aliases[command];
        if (command === 'seek' || command === 'seekTo') {
            if (param !== 0 && param !== '0') {
                return null;
            }
            selector = '.videoControlBar .seekTop';
        }
        const buttons = host.querySelectorAll(selector || '.menuButton[data-command], .controlButton[data-command]');
        for (const button of buttons) {
            if (!selector && (button.dataset.command !== command ||
                (button.hasAttribute('data-param') && button.dataset.param !== String(param)))) {
                continue;
            }
            if (allowUnavailable || this._isActionFeedbackTargetAvailable(button)) {
                return button;
            }
        }
        return null;
    },
    _isActionFeedbackTargetAvailable(icon) {
        const host = this._$playerContainer[0];
        const win = icon.ownerDocument.defaultView;
        // opacity:0 is an idle cue, whereas hidden/display:none/visibility:hidden
        // is a deliberate preference or unavailable control. Never override it.
        for (let node = icon; node; node = node.parentElement) {
            const style = win?.getComputedStyle(node);
            if (node.hidden || node.getAttribute('aria-hidden') === 'true' ||
                style?.display === 'none' || style?.visibility === 'hidden') {
                return false;
            }
            if (node === host) {
                break;
            }
        }
        if (icon.matches(':disabled, [aria-disabled="true"]') ||
            (icon.classList.contains('playControl') &&
                (host.matches('.is-abort, .is-loading') ||
                    (host.classList.contains('is-error') && !icon.matches('.prevVideo, .nextVideo'))))) {
            return false;
        }
        return true;
    },
    _flashActionFeedback(command, param, enabledOverride) {
        if (this._hoverUiSuppressed || this._state?.isOpen === false) {
            return;
        }
        // A later alert/result command has no button and must not shorten the
        // triggering action's cue. Ignore isolation only for this existence probe.
        if (!this._findActionFeedbackTarget(command, param, true)) {
            return;
        }
        const keyboard = !!this._keyboardFeedbackCommand;
        // Restore the previous isolation before checking the new target's normal
        // visibility; the isolation itself temporarily hides all other controls.
        this._clearActionFeedback();
        const icon = this._findActionFeedbackTarget(command, param);
        if (!icon) {
            return;
        }
        const token = this._shortcutFeedbackToken = {};
        this._shortcutFeedbackIcon = icon;
        this._shortcutFeedbackKeyboard = keyboard;
        const saved = this._shortcutFeedbackRestore = { attributes: {} };
        const states = {
            'toggle-showComment': ['showComment', 'コメント表示'],
            'toggle-enableFilter': ['enableFilter', 'NGフィルター'],
            'toggle-mute': ['mute', 'ミュート'], 'toggle-loop': ['loop', 'リピート']
        };
        const state = states[command];
        if (state) {
            const enabled = enabledOverride ?? (this._playerConfig?.props?.[state[0]] === true);
            const status = enabled ? 'ON' : 'OFF';
            // A visible ON/OFF badge helps shortcuts, but is redundant on a mouse click.
            // Keep the accessible label updated for either input method.
            const labels = keyboard || enabledOverride !== undefined ?
                [['data-shortcut-state', status], ['aria-label', `${state[1]} ${status}`]] :
                [['aria-label', `${state[1]} ${status}`]];
            for (const [name, value] of labels) {
                saved.attributes[name] = { previous: icon.getAttribute(name), value };
                icon.setAttribute(name, value);
            }
        }
        this._syncActionFeedbackIsolation();
        const animation = icon.dataset.feedbackAnimation;
        if (animation && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(animation)) {
            saved.animation = {
                previous: icon.style.getPropertyValue('--zenza-feedback-animation'),
                priority: icon.style.getPropertyPriority('--zenza-feedback-animation'), value: animation
            };
            icon.style.setProperty('--zenza-feedback-animation', animation);
        }
        // Flush the released state before replaying, including consecutive presses.
        void icon.offsetWidth;
        icon.classList.add('is-shortcut-feedback', 'is-feedback-pressed');
        this._shortcutFeedbackPressTimer = setTimeout(() => {
            if (this._shortcutFeedbackToken !== token) {
                return;
            }
            icon.classList.remove('is-feedback-pressed');
            this._shortcutFeedbackPressTimer = undefined;
        }, 90);
        // Individual animations may outlast the standard one-second cue. In
        // particular Like has a delayed 1s + 0.2s release transition.
        const configuredMs = Number(icon.dataset.feedbackVisibleMs);
        const visibleMs = Number.isInteger(configuredMs) && configuredMs >= 1000 && configuredMs <= 5000 ?
            configuredMs : 1000;
        this._shortcutFeedbackTimer = setTimeout(() => {
            if (this._shortcutFeedbackToken === token) {
                this._clearActionFeedback();
            }
        }, visibleMs);
    },
};
//===END===
export {NicoVideoPlayerDialogViewFeedback};
