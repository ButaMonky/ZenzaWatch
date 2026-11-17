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
// GENERATED FROM tools/typescript-stage1/nico-src/SmoothSeekBarPointer.ts (Task1063). Edit the .ts and run npm run nico:sync.
//===BEGIN===
class SmoothSeekBarPointer {
    constructor(params) {
        this._pointer = params.pointer;
        this._getTimelineGeometry = params.getTimelineGeometry;
        this._currentTime = 0;
        this._duration = 1;
        this._playbackRate = 1;
        // this._isSmoothMode = (!!this._pointer.animate && 'registerProperty' in CSS);
        this._isSmoothMode = false;
        this._isPausing = true;
        this._isSeeking = false;
        this._isStalled = false;
        this.refresh = throttle.raf(this.refresh.bind(this));
        this.transformLeft = 0;
        this.applyTransform = throttle.raf(() => {
            const ratio = TimelineGeometry.timeToRatio(this._currentTime, this._duration);
            if (ratio === null) {
                return;
            }
            const left = this._getTimelineGeometry()?.ratioToLocalX(ratio);
            if (left != null) {
                this._pointer.style.transform = `translateX(${left - 6}px)`;
            }
        });
        this._pointer.classList.toggle('is-notSmooth', !this._isSmoothMode);
        params.playerState.onkey('isPausing', (v) => this.isPausing = v);
        params.playerState.onkey('isSeeking', (v) => this.isSeeking = v);
        params.playerState.onkey('isStalled', (v) => this.isStalled = v);
        if (this._isSmoothMode) {
            WindowResizeObserver.subscribe(() => this.refresh());
        }
    }
    get currentTime() {
        return this._currentTime;
    }
    set currentTime(v) {
        if (!this._isSmoothMode) {
            this._currentTime = v;
            this.applyTransform();
            return;
        }
        if (document.hidden) {
            return;
        }
        if (this._currentTime === v) {
            if (this.isPlaying) {
                this._animation.currentTime = v;
                this.isStalled = true;
                return;
            }
        }
        else {
            if (this.isStalled) {
                this.isStalled = false;
            }
        }
        this._currentTime = v;
        // 誤差が一定以上になったときのみ補正する
        // videoのcurrentTimeは秒. Animation APIのcurrentTimeはミリ秒
        if (this._animation &&
            Math.abs(v * 1000 - this._animation.currentTime) > 300) {
            this._animation.currentTime = v * 1000;
        }
    }
    _timeToPer(time) {
        const ratio = TimelineGeometry.timeToRatio(time, this._duration);
        return ratio === null ? 0 : ratio * 100;
    }
    set duration(v) {
        if (this._duration === v) {
            return;
        }
        this._duration = v;
        this.refresh();
    }
    set playbackRate(v) {
        if (this._playbackRate === v) {
            return;
        }
        this._playbackRate = v;
        if (!this._animation) {
            return;
        }
        this._animation.playbackRate = v;
    }
    get isPausing() {
        return this._isPausing;
    }
    set isPausing(v) {
        if (this._isPausing === v) {
            return;
        }
        this._isPausing = v;
        this._updatePlaying();
    }
    get isSeeking() {
        return this._isSeeking;
    }
    set isSeeking(v) {
        if (this._isSeeking === v) {
            return;
        }
        this._isSeeking = v;
        this._updatePlaying();
    }
    get isStalled() {
        return this._isStalled;
    }
    set isStalled(v) {
        if (this._isStalled === v) {
            return;
        }
        this._isStalled = v;
        this._updatePlaying();
    }
    get isPlaying() {
        return !this.isPausing && !this.isStalled && !this.isSeeking;
    }
    _updatePlaying() {
        if (!this._animation) {
            return;
        }
        if (this.isPlaying) {
            this._animation.play();
        }
        else {
            this._animation.pause();
        }
    }
    refresh() {
        if (!this._isSmoothMode) {
            return;
        }
        const right = this._getTimelineGeometry()?.ratioToLocalX(1);
        if (right == null) {
            return;
        }
        if (this._animation) {
            this._animation.finish();
        }
        this._animation = this._pointer.animate([
            { transform: 'translateX(-6px)' },
            { transform: `translateX(${right - 6}px)` }
        ], { duration: this._duration * 1000, fill: 'backwards' });
        this._animation.currentTime = this._currentTime * 1000;
        this._animation.playbackRate = this._playbackRate;
        if (this.isPlaying) {
            this._animation.play();
        }
        else {
            this._animation.pause();
        }
    }
}
class WheelSeeker extends BaseViewComponent {
    static get template() {
        return `
        <div class="root" style="display: none;">
        </div>
      `;
    }
    constructor(params) {
        super({
            parentNode: params.parentNode,
            name: 'WheelSeeker',
            template: '<div class="WheelSeeker"></div>',
            shadow: WheelSeeker.template
        });
        Object.assign(this._props, {
            watchElement: params.watchElement,
            isActive: false,
            pos: 0,
            ax: 0,
            lastWheelTime: 0,
            duration: 1
        });
        this._bound.onWheel = _.throttle(this.onWheel.bind(this), 50);
        this._bound.onMouseUp = this.onMouseUp.bind(this);
        this._bound.dispatchSeek = this.dispatchSeek.bind(this);
        this._props.watchElement.addEventListener('wheel', this._bound.onWheel, { passive: false });
    }
    _initDom(...args) {
        super._initDom(...args);
        this._elm = Object.assign({}, this._elm, {
            root: this._shadow || this._view,
            // pointer: (this._shadow || this._view).querySelector('.pointer')
        });
        this._shadow.addEventListener('contextmenu', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
    }
    enable() {
        document.addEventListener('mouseup', this._bound.onMouseUp, { capture: true, once: true });
        this.refresh();
        this.dispatchCommand('wheelSeek-start');
        this._elm.root.style.display = '';
        this._props.isActive = true;
        this._props.ax = 0;
        this._props.lastWheelTime = performance.now();
    }
    disable() {
        document.removeEventListener('mouseup', this._bound.onMouseUp);
        this.dispatchCommand('wheelSeek-end');
        this.dispatchCommand('seek', this.currentTime);
        this._props.isActive = false;
        setTimeout(() => {
            this._elm.root.style.display = 'none';
        }, 300);
    }
    onWheel(e) {
        let { buttons, deltaY } = e;
        if (!deltaY) {
            return;
        }
        deltaY = Math.abs(deltaY) >= 100 ? deltaY / 50 : deltaY;
        if (this.isActive) {
            e.preventDefault();
            e.stopPropagation();
            if (!buttons && !e.shiftKey) {
                return this.disable();
            }
            let pos = this._props.pos;
            let ax = this._props.ax;
            const deltaReversed = ax * deltaY < 0; //lastDelta * deltaY < 0;
            const now = performance.now();
            const seconds = ((now - this._props.lastWheelTime) / 1000);
            this._props.lastWheelTime = now;
            if (deltaReversed) {
                ax = deltaY > 0 ? 0.5 : -0.5;
            }
            else {
                ax =
                    ax *
                        Math.pow(1.15, Math.abs(deltaY)) * // speedup
                        Math.pow(0.8, Math.floor(seconds / 0.1)) // speeddown
                ;
                ax = Math.min(20, Math.abs(ax)) * (ax > 0 ? 1 : -1);
                pos += ax; // / 100;
            }
            pos = Math.min(100, Math.max(0, pos));
            this._props.ax = ax;
            this.pos = pos;
            this._bound.dispatchSeek();
        }
        else if (buttons || e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            this.enable();
            this._props.ax = deltaY > 0 ? 0.5 : -0.5;
        }
    }
    onMouseUp(e) {
        if (!this.isActive) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.disable();
    }
    dispatchSeek() {
        this.dispatchCommand('wheelSeek', this.currentTime);
    }
    refresh() {
        // this._elm.pointer.style.transform = `translateX(${this._props.pos}%)`;
    }
    get isActive() {
        return this._props.isActive;
    }
    get duration() {
        return this._props.duration;
    }
    set duration(v) {
        this._props.duration = v;
    }
    get pos() {
        return this._props.pos;
    }
    set pos(v) {
        this._props.pos = v;
        if (this.isActive) {
            this.refresh();
        }
    }
    get currentTime() {
        return this.duration * this.pos / 100;
    }
    set currentTime(v) {
        this.pos = v / this.duration * 100;
    }
}
//===END===
export {
  SmoothSeekBarPointer,
  WheelSeeker
};
