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
// GENERATED FROM tools/typescript-stage1/nico-src/SeekBarToolTip.ts (Task1063). Edit the .ts and run npm run nico:sync.
//===BEGIN===
class SeekBarToolTip {
    constructor(params) {
        this._$container = params.$container;
        this._storyboard = params.storyboard;
        this._initializeDom(params.$container);
        this._boundOnRepeat = this._onRepeat.bind(this);
        this._boundOnMouseUp = this._onMouseUp.bind(this);
    }
    _initializeDom($container) {
        util.addStyle(SeekBarToolTip.__css__);
        const $view = this._$view = util.$.html(SeekBarToolTip.__tpl__);
        this._currentTime = $view.find('.currentTime')[0];
        this.currentTimeLabel = TextLabel.create({
            container: this._currentTime,
            name: 'currentTimeLabel',
            text: '00:00',
            style: {
                widthPx: 50,
                heightPx: 16,
                fontFamily: 'monospace',
                fontWeight: '',
                fontSizePx: 12,
                color: '#ccc'
            }
        });
        $view
            .on('mousedown', this._onMouseDown.bind(this))
            .on('click', (e) => { e.stopPropagation(); e.preventDefault(); });
        this._seekBarThumbnail = new SeekBarThumbnail({
            storyboard: this._storyboard,
            container: $view.find('.seekBarThumbnailContainer')[0]
        });
        $container.append($view);
    }
    _onMouseDown(e) {
        e.stopPropagation();
        const target = e.target.closest('[data-command]');
        if (!target) {
            return;
        }
        const { command, param, repeat } = target.dataset;
        if (!command || target.getAttribute('aria-disabled') === 'true') {
            return;
        }
        util.dispatchCommand(e.target, command, param);
        if (repeat === 'on') {
            this._beginRepeat(command, param);
        }
    }
    _onMouseUp(e) {
        e.preventDefault();
        this._endRepeat();
    }
    _beginRepeat(command, param) {
        this._repeatCommand = command;
        this._repeatParam = param;
        util.$('body')
            .on('mouseup.zenzaSeekbarToolTip', this._boundOnMouseUp);
        this._$view
            .on('mouseleave', this._boundOnMouseUp)
            .on('mouseup', this._boundOnMouseUp);
        if (this._repeatTimer) {
            window.clearInterval(this._repeatTimer);
        }
        this._repeatTimer = window.setInterval(this._boundOnRepeat, 200);
        this._isRepeating = true;
    }
    _endRepeat() {
        this._isRepeating = false;
        if (this._repeatTimer) {
            window.clearInterval(this._repeatTimer);
            this._repeatTimer = null;
        }
        util.$('body').off('mouseup.zenzaSeekbarToolTip');
        this._$view.off('mouseleave').off('mouseup');
    }
    _onRepeat() {
        if (!this._isRepeating) {
            this._endRepeat();
            return;
        }
        util.dispatchCommand(this._$view[0], this._repeatCommand, this._repeatParam);
    }
    update(sec, left) {
        const timeText = util.secToTime(sec);
        if (this._timeText !== timeText) {
            this._timeText = timeText;
            this.currentTimeLabel && (this.currentTimeLabel.text = timeText);
        }
        // Update on every mousemove, even within the same displayed second.
        // Follow the pointer 1:1 in the middle; stop at the visible edges.
        const container = this._$container[0];
        const bounds = container.getBoundingClientRect();
        const containerWidth = container.offsetWidth || bounds.width;
        const scale = bounds.width && containerWidth ? bounds.width / containerWidth : 1;
        const tooltipWidth = this._$view[0].offsetWidth;
        const visibleLeft = Math.max(0, -bounds.left / scale);
        const visibleRight = Math.max(visibleLeft, Math.min(containerWidth, (window.innerWidth - bounds.left) / scale));
        const visibleWidth = visibleRight - visibleLeft;
        let tooltipLeft;
        if (visibleWidth < tooltipWidth) {
            // Very narrow players cannot contain the tooltip: center within the viewport.
            const viewportLeft = -bounds.left / scale;
            const viewportRight = Math.max(viewportLeft, (window.innerWidth - bounds.left) / scale - tooltipWidth);
            tooltipLeft = Math.max(viewportLeft, Math.min(left - tooltipWidth / 2, viewportRight));
        }
        else {
            tooltipLeft = Math.max(visibleLeft, Math.min(left - tooltipWidth / 2, visibleRight - tooltipWidth));
        }
        cssUtil.setProps([this._$view[0], '--trans-x-pp', cssUtil.px(tooltipLeft)]);
        this._seekBarThumbnail.currentTime = sec;
    }
}
SeekBarToolTip.__css__ = (`
    .seekBarToolTip {
      position: absolute;
      display: inline-block;
      visibility: hidden;
      z-index: 300;
      position: absolute;
      box-sizing: border-box;
      bottom: 24px;
      left: 0;
      width: 180px;
      white-space: nowrap;
      font-size: 10px;
      background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.3));
      z-index: 150;
      opacity: 0;
      border: 1px solid var(--zt-border, #666);
      border-radius: 8px;
      padding: 8px 4px 0;
      will-change: transform;
      transform: translate(var(--trans-x-pp), 0);
      pointer-events: none;
    }

    .is-wheelSeeking .seekBarToolTip,
    .is-dragging .seekBarToolTip,
    .seekBarContainer:hover  .seekBarToolTip {
      opacity: 1;
      visibility: visible;
    }

    .seekBarToolTipInner {
      padding-bottom: 10px;
      pointer-events: auto;
      display: flex;
      text-align: center;
      vertical-align: middle;
      width: 100%;
    }
    .is-wheelSeeking .seekBarToolTipInner,
    .is-dragging .seekBarToolTipInner {
      pointer-events: none;
    }

    .seekBarToolTipInner>* {
      flex: 1;
    }

    .seekBarToolTip .currentTime {
      display: inline-block;
      height: 16px;
      margin: 4px 0;
    }

    .seekBarToolTip .controlButton {
      display: inline-block;
      width: 40px;
      height: 28px;
      line-height: 22px;
      font-size: 20px;
      border-radius: 50%;
      margin: 0;
      cursor: pointer;
    }

    .seekBarToolTip .controlButton * {
      cursor: pointer;
    }

    .seekBarToolTip .controlButton:hover {
      text-shadow: 0 0 8px var(--zt-accent, #fe9);
      box-shadow: 0 0 8px var(--zt-accent, #fe9);
    }

    .seekBarToolTip .controlButton:active {
      font-size: 16px;
    }

    .seekBarToolTip .controlButton.toggleCommentPreview {
      opacity: 0.5;
    }

    .enableCommentPreview .seekBarToolTip .controlButton.toggleCommentPreview {
      opacity: 1;
      background: var(--zt-overlay-dark, rgba(0,0,0,0.01));
    }

    .is-fullscreen .seekBarToolTip {
      bottom: 10px;
    }
  `).trim();
SeekBarToolTip.__tpl__ = (`
    <div class="seekBarToolTip">
      <div class="seekBarThumbnailContainer"></div>
      <div class="seekBarToolTipInner">
        <div class="seekBarToolTipButtonContainer">
          <div class="controlButton backwardSeek" data-command="seekBy" data-param="-5" title="5秒戻る" data-repeat="on">
            <div class="controlButtonInner">⇦</div>
          </div>

          <div class="currentTime"></div>

          <div class="controlButton toggleCommentPreview" data-command="toggleConfig" data-param="enableCommentPreview" title="コメントのプレビュー表示">
            <div class="menuButtonInner">💬</div>
          </div>


          <div class="controlButton forwardSeek" data-command="seekBy" data-param="5" title="5秒進む" data-repeat="on">
            <div class="controlButtonInner">⇨</div>
          </div>
        </div>
      </div>
    </div>
  `).trim();
//===END===
export {
  SeekBarToolTip
};
