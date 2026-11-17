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
// GENERATED FROM tools/typescript-stage1/nico-src/CommentPreview.ts (Task1063). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require HeatMapWorker
class CommentPreviewModel extends Emitter {
    reset() {
        this._chatReady = false;
        this._vpos = -1;
        this.emit('reset');
    }
    set chatList(chatList) {
        const list = chatList
            .top
            .concat(chatList.naka, chatList.bottom)
            .sort((a, b) => a.vpos - b.vpos);
        this._chatList = list;
        this._chatReady = true;
        this.update();
    }
    get chatList() {
        return this._chatList || [];
    }
    set currentTime(sec) {
        this.vpos = sec * 100;
    }
    set vpos(vpos) {
        if (this._vpos !== vpos) {
            this._vpos = vpos;
            this.emit('vpos', vpos);
        }
    }
    get currentIndex() {
        if (this._vpos < 0 || !this._chatReady) {
            return -1;
        }
        return this.getVposIndex(this._vpos);
    }
    getVposIndex(vpos) {
        // chatList setter already sorts by vpos. The old reverse scan was O(N)
        // per mousemove (twice for each CommentPreviewView._onVpos).
        const list = this._chatList;
        if (!list || !list.length) {
            return -1;
        }
        const threshold = vpos - 400;
        let low = 0, high = list.length;
        while (low < high) {
            const middle = low + Math.floor((high - low) / 2);
            if (list[middle].vpos <= threshold) {
                low = middle + 1;
            }
            else {
                high = middle;
            }
        }
        // The original returns -1 when no item satisfies vpos<=threshold.
        return low > 0 ? low : -1;
    }
    get currentChatList() {
        if (this._vpos < 0 || !this._chatReady) {
            return [];
        }
        return this.getItemByVpos(this._vpos);
    }
    getItemByVpos(vpos) {
        const list = this._chatList;
        const result = [];
        for (let i = 0, len = list.length; i < len; i++) {
            const chat = list[i], cv = chat.vpos, diff = vpos - cv;
            if (diff >= -100 && diff <= 400) {
                result.push(chat);
            }
        }
        return result;
    }
    getItemByUniqNo(uniqNo) {
        return this._chatList.find((chat) => chat.uniqNo === uniqNo);
    }
    update() {
        this.emit('update');
    }
}
class CommentPreviewView {
    constructor(params) {
        const model = this._model = params.model;
        this._$parent = params.$container;
        this._disposed = false;
        this._disposeComplete = false;
        this._disposeRunning = false;
        this._disposePending = null;
        this._disposeFailures = [];
        this._viewId = CommentPreviewView._nextId = (CommentPreviewView._nextId || 0) + 1;
        this._inviewTable = new Map;
        this._chatList = [];
        this._initializeDom(this._$parent);
        this._subscriptions = [
            ['reset', this._onReset.bind(this)],
            ['update', _.debounce(this._onUpdate.bind(this), 10)],
            ['vpos', this._onVpos.bind(this)]
        ];
        for (const [event, handler] of this._subscriptions) {
            model.on(event, handler);
        }
        this._mode = 'hover';
        this._view.dataset.commentPreviewMode = 'hover';
        this._left = 0;
        this.update = _.throttle(this.update.bind(this), 200);
        this.applyView = throttle.raf(this.applyView.bind(this));
    }
    _initializeDom($parent) {
        cssUtil.registerProps({ name: '--buffer-range-left', syntax: '<percentage>', initialValue: '0%', inherits: false }, { name: '--buffer-range-scale', syntax: '<number>', initialValue: 0, inherits: false });
        const $view = util.$.html(CommentPreviewView.__tpl__);
        const view = this._view = $view[0];
        this._list = view.querySelector('.listContainer');
        this._domListeners = [
            ['click', this._onClick.bind(this)],
            ['wheel', (e) => e.stopPropagation(), { passive: true }],
            ['scroll', _.throttle(this._onScroll.bind(this), 50, { trailing: false }), { passive: true }]
        ];
        for (const [event, handler, options] of this._domListeners) {
            view.addEventListener(event, handler, options);
        }
        $parent.append($view);
    }
    set mode(v) {
        if (this._disposed) {
            return;
        }
        v = v === 'list' ? 'list' : 'hover';
        // A mode belongs to one view. UI02 has two native views at once.
        this._view.dataset.commentPreviewMode = v;
        const previous = this._mode;
        this._mode = v;
        if (previous !== v && this._chatList?.length) {
            // Switching hover/list changes the virtual row window. Recalculate
            // immediately on the existing seek position; users must not need
            // another mouse movement just to see their comments.
            const vpos = this._model?._vpos;
            if (Number.isFinite(vpos) && vpos >= 0) {
                this._onVpos(vpos);
            }
            else if (v === 'list') {
                this._refreshInviewElements(0);
            }
        }
    }
    _onClick(e) {
        if (this._disposed) {
            return;
        }
        e.stopPropagation();
        const target = e.target.closest('[data-command]');
        const view = this._view;
        const command = target ? target.dataset.command : '';
        const nicoChatElement = e.target.closest('.nicoChat');
        if (!nicoChatElement) {
            return;
        }
        const uniqNo = nicoChatElement.dataset.nicochatUniqNo;
        const nicoChat = this._model.getItemByUniqNo(uniqNo);
        if (command && nicoChat) {
            view.classList.add('is-updating');
            window.clearTimeout(this._updatingTimer);
            this._updatingTimer = window.setTimeout(() => {
                if (!this._disposed) {
                    view.classList.remove('is-updating');
                }
            }, 3000);
            switch (command) {
                case 'addUserIdFilter':
                    util.dispatchCommand(e.target, command, nicoChat.userId);
                    break;
                case 'addWordFilter':
                    util.dispatchCommand(e.target, command, nicoChat.text);
                    break;
                case 'addCommandFilter':
                    util.dispatchCommand(e.target, command, nicoChat.cmd);
                    break;
            }
            return;
        }
        const vpos = nicoChatElement.dataset.vpos;
        if (vpos !== undefined) {
            util.dispatchCommand(e.target, 'seek', vpos / 100);
        }
    }
    _onUpdate() {
        // reset retains the model cache until the next video's comments arrive.
        // A new list or a pending debounce must not hydrate that stale cache.
        if (this._disposed || this._model._chatReady === false) {
            return;
        }
        this.updateList();
        // Comments can arrive after the mouse stops on the seekbar. Previously
        // updateList only resized the virtual list; rows stayed empty until the
        // next vpos event (another mouse move).
        const vpos = this._model && this._model._vpos;
        if (Number.isFinite(vpos) && vpos >= 0) {
            this._onVpos(vpos);
        }
        else if (this._mode === 'list') {
            this._refreshInviewElements(0);
        }
    }
    _onVpos(vpos) {
        if (this._disposed) {
            return;
        }
        const itemHeight = CommentPreviewView.ITEM_HEIGHT;
        const index = this._currentStartIndex = Math.max(0, this._model.currentIndex);
        this._currentEndIndex = Math.max(0, this._model.getVposIndex(vpos + 400));
        this._scrollTop = itemHeight * index;
        this._currentTime = vpos / 100;
        this._refreshInviewElements(this._scrollTop);
        this.applyView();
    }
    _onResize() {
        if (this._disposed) {
            return;
        }
        this._refreshInviewElements();
    }
    _onScroll() {
        if (this._disposed) {
            return;
        }
        this._scrollTop = -1;
        this._refreshInviewElements();
    }
    _onReset() {
        this._list.textContent = '';
        this._inviewTable.clear();
        this._scrollTop = 0;
        this._newListElements = null;
        this._chatList = [];
    }
    updateList() {
        const chatList = this._chatList = this._model.chatList;
        if (!chatList.length) {
            this._isListUpdated = false;
            return;
        }
        const itemHeight = CommentPreviewView.ITEM_HEIGHT;
        this._list.style.height = `${(chatList.length + 2) * itemHeight}px`;
        this._isListUpdated = false;
    }
    _refreshInviewElements(scrollTop) {
        if (!this._view) {
            return;
        }
        const itemHeight = CommentPreviewView.ITEM_HEIGHT;
        scrollTop = _.isNumber(scrollTop) ? scrollTop : this._view.scrollTop;
        const viewHeight = CommentPreviewView.MAX_HEIGHT;
        const viewBottom = scrollTop + viewHeight;
        const chatList = this._chatList;
        if (!chatList || chatList.length < 1) {
            return;
        }
        const startIndex = this._mode === 'list' ?
            Math.max(0, Math.floor(scrollTop / itemHeight) - 5) :
            this._currentStartIndex;
        const endIndex = this._mode === 'list' ?
            Math.min(chatList.length, Math.floor(viewBottom / itemHeight) + 5) :
            Math.min(this._currentEndIndex, this._currentStartIndex + 15);
        const newItems = [], inviewTable = this._inviewTable;
        for (let i = startIndex; i < endIndex; i++) {
            const chat = chatList[i];
            if (inviewTable.has(i) || !chat) {
                continue;
            }
            const listItem = CommentPreviewChatItem.create(chat, i);
            listItem.id = 'commentPreview' + this._viewId + '-item' + i;
            newItems.push(listItem);
            inviewTable.set(i, listItem);
        }
        // Remove stale virtual rows even when the new range introduces no new
        // items; otherwise old comments can remain visible after navigation.
        for (const i of inviewTable.keys()) {
            if (i >= startIndex && i < endIndex) {
                continue;
            }
            inviewTable.get(i).remove();
            inviewTable.delete(i);
        }
        if (newItems.length < 1) {
            return;
        }
        this._newListElements = this._newListElements || document.createDocumentFragment();
        this._newListElements.append(...newItems);
        this.applyView();
    }
    get isEmpty() {
        return this._chatList.length < 1;
    }
    update(left) {
        if (this._disposed) {
            return;
        }
        if (this._isListUpdated) {
            this.updateList();
        }
        if (this.isEmpty) {
            return;
        }
        const width = this._mode === 'list' ?
            CommentPreviewView.WIDTH : CommentPreviewView.HOVER_WIDTH;
        // Resize and mode switches must use the current viewport and preview width.
        const containerWidth = global.innerWidth;
        const maxLeft = Math.max(0, containerWidth - width);
        left = Math.min(Math.max(0, left - width / 2), maxLeft);
        this._left = left;
        this.applyView();
    }
    applyView() {
        if (this._disposed) {
            return;
        }
        const view = this._view;
        cssUtil.setProps([view, '--current-time', cssUtil.s(this._currentTime)], [view, '--scroll-top', cssUtil.px(this._scrollTop)], [view, '--trans-x-pp', cssUtil.px(this._left)]);
        if (this._newListElements && this._newListElements.childElementCount) {
            this._list.append(this._newListElements);
        }
        if (this._scrollTop > 0 && this._mode === 'list') {
            this._view.scrollTop = this._scrollTop;
            this._scrollTop = -1;
        }
    }
    hide() {
    }
    dispose() {
        if (this._disposeComplete || this._disposeRunning) {
            return;
        }
        this._disposeRunning = true;
        try {
            // Block late callbacks immediately, but only declare disposal complete when
            // every independent cleanup has succeeded. Failed tasks survive for retry.
            this._disposed = true;
            let pending = this._disposePending;
            if (!pending) {
                pending = new Map();
                const model = this._model, view = this._view;
                for (const [index, [event, handler]] of (this._subscriptions || []).entries()) {
                    pending.set(`model.off:${event}:${index}`, () => model.off(event, handler));
                    pending.set(`model.cancel:${event}:${index}`, () => handler.cancel?.());
                }
                for (const [index, [event, handler, options]] of (this._domListeners || []).entries()) {
                    pending.set(`dom.off:${event}:${index}`, () => view.removeEventListener(event, handler, options));
                    pending.set(`dom.cancel:${event}:${index}`, () => handler.cancel?.());
                }
                pending.set('update.cancel', () => this.update.cancel?.());
                pending.set('applyView.cancel', () => this.applyView.cancel?.());
                pending.set('timer.clearTimeout', () => window.clearTimeout(this._updatingTimer));
                pending.set('list.reset', () => this._onReset());
                pending.set('dom.remove', () => view.remove());
                this._disposePending = pending;
            }
            const failures = [];
            for (const [step, cleanup] of pending) {
                try {
                    cleanup();
                    pending.delete(step);
                }
                catch (error) {
                    failures.push({ step, error });
                }
            }
            // Keep the remaining step names and original causes inspectable after
            // failure; do not silently treat a partially disposed view as complete.
            this._disposeFailures = failures;
            if (pending.size === 0) {
                this._disposeComplete = true;
                this._disposePending = null;
                this._subscriptions = [];
                this._domListeners = [];
            }
            if (failures.length === 1) {
                throw failures[0].error;
            }
            if (failures.length > 1) {
                throw new AggregateError(failures.map(item => item.error), 'Native comment view disposal incomplete: ' +
                    failures.map(item => item.step).join(', '));
            }
        }
        finally {
            this._disposeRunning = false;
        }
    }
}
class CommentPreviewChatItem {
    static get html() {
        return `
       <li class="nicoChat">
         <span class="vposTime"></span>
         <span class="text"></span>
         <span class="addFilter addUserIdFilter"
           data-command="addUserIdFilter" title="NGユーザー">NGuser</span>
         <span class="addFilter addWordFilter"
           data-command="addWordFilter" title="NGワード">NGword</span>
       </li>
      `.trim();
    }
    static get template() {
        if (!this._template) {
            const t = document.createElement('template');
            t.id = `${this.name}_${Date.now()}`;
            t.innerHTML = this.html;
            const content = t.content;
            this._template = {
                clone: () => document.importNode(t.content, true),
                chat: content.querySelector('.nicoChat'),
                time: content.querySelector('.vposTime'),
                text: t.content.querySelector('.text')
            };
        }
        return this._template;
    }
    /**
     * @param {NicoChatViewModel} chat
     */
    static create(chat, idx) {
        const itemHeight = CommentPreviewView.ITEM_HEIGHT;
        const text = chat.text;
        const date = (new Date(chat.date * 1000)).toLocaleString();
        const vpos = chat.vpos;
        const no = chat.no;
        const uniqNo = chat.uniqNo;
        const oe = idx % 2 === 0 ? 'even' : 'odd';
        const title = `${no} : 投稿日 ${date}\nID:${chat.userId}\n${text}\n`;
        const color = chat.color || '#fff';
        const shadow = color === '#fff' ? '' : `text-shadow: 0 0 1px ${color};`;
        const vposToTime = (vpos) => util.secToTime(Math.floor(vpos / 100));
        const t = this.template;
        t.chat.className = `nicoChat fork${chat.fork} ${oe}`;
        t.chat.id = `commentPreviewItem${idx}`;
        t.chat.dataset.vpos = vpos;
        t.chat.dataset.nicochatUniqNo = uniqNo;
        t.time.textContent = `${vposToTime(vpos)}: `;
        t.text.title = title;
        t.text.style = shadow;
        t.text.textContent = text;
        t.chat.style.cssText = `
        top: ${idx * itemHeight}px;
        --duration: ${chat.duration}s;
        --vpos-time: ${chat.vpos / 100}s;
      `;
        return t.clone().firstElementChild;
    }
}
CommentPreviewView.MAX_HEIGHT = 200;
CommentPreviewView.WIDTH = 350;
CommentPreviewView.HOVER_WIDTH = 180;
CommentPreviewView.ITEM_HEIGHT = 20;
CommentPreviewView.__tpl__ = (`
  <div class="zenzaCommentPreview">
    <div class="listContainer"></div>
  </div>
  `).trim();
util.addStyle(`
  .zenzaCommentPreview {
    display: none;
    position: absolute;
    bottom: 16px;
    opacity: 0.8;
    max-height: ${CommentPreviewView.MAX_HEIGHT}px;
    width: ${CommentPreviewView.WIDTH}px;
    box-sizing: border-box;
    color: var(--zt-text-1, #ccc);
    overflow: hidden;
    transform: translate(var(--trans-x-pp), 0);
    transition: --trans-x-pp 0.2s;
    will-change: transform;
  }
  .zenzaCommentPreview * {
    box-sizing: border-box;
  }
  .is-wheelSeeking .zenzaCommentPreview,
  .seekBarContainer:hover .zenzaCommentPreview {
    display: block;
  }

`, { className: 'commentPreview' });
util.addStyle(`
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) {
    border-bottom: 24px solid transparent;
    background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.4));
    z-index: 100;
    overflow: auto;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]):hover {
    background: black;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]).is-updating {
    transition: opacity 0.2s ease;
    opacity: 0.3;
    cursor: wait;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]).is-updating * {
    pointer-events: none;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer {
    bottom: auto;
    padding: 4px;
    pointer-events: none;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]):hover .listContainer {
    pointer-events: auto;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat {
    position: absolute;
    left: 0;
    display: block;
    width: 100%;
    height: ${CommentPreviewView.ITEM_HEIGHT}px;
    padding: 2px 4px;
    cursor: pointer;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    animation-duration: var(--duration);
    animation-delay: calc(var(--vpos-time) - var(--current-time) - 1s);
    animation-name: preview-text-inview;
    animation-timing-function: linear;
    animation-play-state: paused !important;
  }
  @keyframes preview-text-inview {
    0% {
      color: var(--zt-accent-soft, #ffc);
    }
    100% {
      color: var(--zt-accent-soft, #ffc);
    }
  }

  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer:hover .nicoChat.odd {
    background: var(--zt-surface-2, #333);
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat.fork1 .vposTime {
    color: var(--zt-success, #6f6);
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat:where(.fork2, .fork3) .vposTime {
    color: var(--zt-info, #66f);
  }

  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat .no,
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat .date,
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat .userId {
    display: none;
  }

  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat:hover .no,
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat:hover .date,
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat:hover .userId {
    display: inline-block;
    white-space: nowrap;
  }

  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat .text {
    color: inherit !important;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat:hover .text {
    color: var(--zt-text-0, #fff) !important;
  }

  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat .text:hover {
    text-decoration: underline;
  }

  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat .addFilter {
    display: none;
    position: absolute;
    font-size: 10px;
    color: var(--zt-text-0, #fff);
    background: var(--zt-surface-3, #666);
    cursor: pointer;
    top: 0;
  }

  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat:hover .addFilter {
    display: inline-block;
    border: 1px solid var(--zt-border-light, #ccc);
    box-shadow: 2px 2px 2px var(--zt-shadow, #333);
  }

  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat .addFilter.addUserIdFilter {
    right: 8px;
    width: 48px;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat .addFilter.addWordFilter {
    right: 64px;
    width: 48px;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="list"]) .listContainer .nicoChat .addFilter:active {
    transform: translateY(2px);
  }

  .zenzaScreenMode_sideView .zenzaCommentPreview:where([data-comment-preview-mode="list"]),
  .zenzaScreenMode_small .zenzaCommentPreview:where([data-comment-preview-mode="list"]) {
    background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.9));
  }
`, { className: 'commentPreview list' });
util.addStyle(`
  .zenzaCommentPreview:where([data-comment-preview-mode="hover"]) {
    bottom: 24px;
    box-sizing: border-box;
    height: 140px;
    z-index: 160;
    transition: none;
    color: var(--zt-text-0, #fff);
    opacity: 0.6;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
    contain: layout style size paint;
    filter: drop-shadow(0 0 1px var(--zt-shadow, #000));
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="hover"]) .listContainer {
    bottom: auto;
    width: 100%;
    height: 100% !important;
    margin: auto;
    border: none;
    contain: layout style size paint;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="hover"]) .listContainer .nicoChat {
    display: block;
    top: auto !important;
    font-size: 16px;
    line-height: 18px;
    height: 18px;
    white-space: nowrap;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="hover"]) .listContainer .nicoChat:nth-child(n + 8) {
    transform: translateY(-144px);
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="hover"]) .listContainer .nicoChat:nth-child(n + 16) {
    transform: translateY(-288px);
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="hover"]) .listContainer .nicoChat .text {
    display: inline-block;
    text-shadow: 1px 1px 1px var(--zt-glow-light, #fff);

    transform: translateX(260px);
    visibility: hidden;
    will-change: transform;
    animation-duration: var(--duration);
    animation-delay: calc(var(--vpos-time) - var(--current-time) - 1s);
    animation-play-state: paused !important;
    animation-name: preview-text-moving;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }
  .zenzaCommentPreview:where([data-comment-preview-mode="hover"]) .listContainer .nicoChat .vposTime,
  .zenzaCommentPreview:where([data-comment-preview-mode="hover"]) .listContainer .nicoChat .addFilter {
    display: none !important;
  }

  @keyframes preview-text-moving {
    0% {
      visibility: visible;
    }
    100% {
      visibility: hidden;
      transform: translateX(85px) translateX(-100%);
    }
  }

`, { className: 'commentPreview hover' });
class CommentPreview {
    constructor(params) {
        this._model = new CommentPreviewModel({});
        this._view = new CommentPreviewView({
            model: this._model,
            $container: params.$container
        });
        this.reset();
    }
    reset() {
        this._model.reset();
        this._view.hide();
    }
    set chatList(chatList) {
        this._model.chatList = chatList;
    }
    set currentTime(sec) {
        this._model.currentTime = sec;
    }
    update(left) {
        this._view.update(left);
    }
    hide() {
    }
    set mode(v) {
        if (v === this._mode) {
            return;
        }
        this._mode = v;
        this._view.mode = this._twinList ? 'hover' : v;
    }
    createListView(container) {
        if (this._twinList) {
            return this._twinList;
        }
        const view = new CommentPreviewView({
            model: this._model, $container: util.$(container)
        });
        view.mode = 'list';
        view._onUpdate();
        this._view._onUpdate();
        this._view.mode = 'hover';
        let disposed = false, viewDisposed = false, modeRestored = false, disposing = false;
        const handle = {
            element: view._view,
            disposeFailures: [],
            dispose: () => {
                if (disposed || disposing) {
                    return;
                }
                disposing = true;
                try {
                    const failures = [];
                    if (!viewDisposed) {
                        try {
                            view.dispose();
                            // A reentrant call can return early while the view is still
                            // cleaning up. Only a completed child can release its handle.
                            if (!view._disposeComplete) {
                                throw new Error('Native comment view disposal still in progress');
                            }
                            viewDisposed = true;
                        }
                        catch (error) {
                            failures.push({ step: 'view.dispose', error });
                        }
                    }
                    // Restore the owner's configured mode only after the child view is
                    // fully torn down; keep the handle reachable while either step fails.
                    // A failed handle release can leave the owner in hover mode if its
                    // preference changed meanwhile. Reapply only when the desired mode differs.
                    const desiredMode = this._mode === 'list' ? 'list' : 'hover';
                    if (viewDisposed && (!modeRestored ||
                        (this._twinList === handle && this._view._mode !== desiredMode))) {
                        try {
                            if (this._twinList === handle) {
                                this._view.mode = this._mode;
                            }
                            modeRestored = true;
                        }
                        catch (error) {
                            failures.push({ step: 'restore.mode', error });
                        }
                    }
                    if (viewDisposed && modeRestored) {
                        try {
                            if (this._twinList === handle) {
                                this._twinList = null;
                            }
                            disposed = true;
                        }
                        catch (error) {
                            failures.push({ step: 'release.handle', error });
                        }
                    }
                    handle.disposeFailures = failures;
                    if (failures.length === 1) {
                        throw failures[0].error;
                    }
                    if (failures.length > 1) {
                        throw new AggregateError(failures.map(item => item.error), 'Native comment list disposal incomplete: ' +
                            failures.map(item => item.step).join(', '));
                    }
                }
                finally {
                    disposing = false;
                }
            }
        };
        this._twinList = handle;
        return handle;
    }
    get mode() {
        return this._mode;
    }
}
//===END===
export {
  CommentPreviewModel,
  CommentPreviewView,
  CommentPreview
};
