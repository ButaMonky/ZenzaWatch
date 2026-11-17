import {ZenzaWatch, global} from './ZenzaContext';
import {CONSTANT} from './constant';
import {Config} from './Config';
import {UaaLoader} from '../packages/lib/src/nico/loader';
import {RelatedVideoList} from '../packages/zenza/src/Playlist/RelatedVideoList';
import {TagListView} from './TagListView';
import {parseVideoSearchSortValue, NicoSearchApiV2Loader} from '../packages/lib/src/nico/VideoSearch';
import {TagSuggestLoader} from '../packages/lib/src/nico/TagSuggestLoader';
import {ThumbInfoLoader} from '../packages/lib/src/nico/ThumbInfoLoader';
import {BaseViewComponent} from '../packages/zenza/src/parts/BaseViewComponent';
import {Emitter} from '../packages/lib/src/Emitter';
import {sleep} from '../packages/lib/src/infra/sleep';
import {Fullscreen} from '../packages/lib/src/dom/Fullscreen';
import {textUtil} from '../packages/lib/src/text/textUtil';
import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';
import {css, cssUtil} from '../packages/lib/src/css/css';
import {uq} from '../packages/lib/src/uQuery';
import {domEvent} from '../packages/lib/src/dom/domEvent';
import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';
import {MylistPocketDetector} from '../packages/zenza/src/init/MylistPocketDetector';
import {RelatedMenuActions} from '../packages/zenza/src/menu/RelatedMenuActions';
import {RelatedMenuOrder} from './RelatedMenuOrder';
import {UiVisibilityRegistry} from './UiVisibilityRegistry';
import {OfficialPlayerRoute} from '../packages/zenza/src/menu/OfficialPlayerRoute';
const VideoItemObserver = {
  observe: () => {}
};
// GENERATED FROM tools/typescript-stage1/nico-src/RelatedInfoMenu.ts (Task1063). Edit the .ts and run npm run nico:sync.
//===BEGIN===
class RelatedInfoMenu extends BaseViewComponent {
    constructor({ parentNode, isHeader }) {
        super({
            parentNode,
            name: 'RelatedInfoMenu',
            template: '<div class="RelatedInfoMenu" tabindex="-1"></div>',
            shadow: RelatedInfoMenu._shadow_,
            css: RelatedInfoMenu.__css__
        });
        this._state = {};
        this._bound.update = this.update.bind(this);
        this._bound._onBodyClick = _.debounce(this._onBodyClick.bind(this), 0);
        this._unwatchCustomActions = RelatedMenuActions.onChange(() => this._renderCustomMenu());
        Config.onkey(RelatedMenuActions.CONFIG_KEY, () => this._renderCustomMenu());
        Config.onkey(RelatedMenuOrder.CONFIG_KEY, () => this._renderCustomMenu());
        Config.onkey(RelatedMenuOrder.HIDDEN_KEY, () => this._renderCustomMenu());
        Config.onkey(RelatedMenuOrder.OPTIONS_KEY, () => this._renderCustomMenu());
        // Config and the advanced-settings userscript each hold their own
        // DataStorage instance. Local updates use onkey above; another browser
        // tab uses storage events, which DataStorage itself does not subscribe to.
        this._relatedStorageKeys = [
            RelatedMenuActions.CONFIG_KEY, RelatedMenuOrder.CONFIG_KEY,
            RelatedMenuOrder.HIDDEN_KEY, RelatedMenuOrder.OPTIONS_KEY, 'ui.relatedMenu'
        ];
        if (typeof Config.getStorageKey === 'function' && typeof Config.refresh === 'function') {
            this._onRelatedStorage = (event) => {
                if (event.storageArea && event.storageArea !== Config.storage) {
                    return;
                }
                const key = this._relatedStorageKeys.find((k) => Config.getStorageKey(k) === event.key);
                if (key) {
                    this._refreshRelatedStorageKey(key, event.newValue === null);
                }
            };
            this._onAdvancedSettingsSaved = (event) => {
                const keys = Array.isArray(event.detail?.keys) ? event.detail.keys : [];
                for (const key of keys) {
                    if (this._relatedStorageKeys.includes(key)) {
                        this._refreshRelatedStorageKey(key);
                    }
                }
            };
            window.addEventListener('storage', this._onRelatedStorage);
            window.addEventListener('ZenzaWatch-advanced-settings-saved', this._onAdvancedSettingsSaved);
        }
        this.setState({ isHeader });
    }
    _refreshRelatedStorageKey(key, removed = false) {
        const storageKey = Config.getStorageKey(key);
        // A deleted key should return to the saved default without writing a new
        // localStorage value (which would cause cross-tab feedback).
        const missing = removed && Config.storage?.[storageKey] == null;
        if (missing && Object.prototype.hasOwnProperty.call(Config.default || {}, key)) {
            Config.refresh(key, { [storageKey]: JSON.stringify(Config.default[key]) });
        }
        else {
            Config.refresh(key);
        }
        if (key === 'ui.relatedMenu') {
            this._visibility?.apply('ui.relatedMenu');
        }
        else {
            this._renderCustomMenu();
        }
    }
    _initDom(...args) {
        super._initDom(...args);
        ClassList(this._view).toggle('is-Edge', /edge/i.test(navigator.userAgent));
        const shadow = this._shadow || this._view;
        this._elm.body = shadow.querySelector('.RelatedInfoMenuBody');
        this._elm.summary = shadow.querySelector('summary');
        shadow.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        this._elm.summary.addEventListener('click', _.debounce(() => {
            if (shadow.open) {
                document.body.addEventListener('mouseup', this._bound._onBodyClick, { once: true });
                this.emit('open');
            }
        }, 100));
        this._ginzaLink = shadow.querySelector('.ginzaLink');
        // Use native anchor navigation rather than reopening a named watch tab.
        // In particular, the official route must not trigger another Zenza reload.
        this._ginzaLink.addEventListener('click', (e) => {
            if (!this._currentWatchId) {
                e.preventDefault();
                return;
            }
            this._ginzaLink.href = OfficialPlayerRoute.makeUrl(this._currentWatchId, this._builtinOptions('official').includePosition === false ?
                0 : this._relatedContext().currentTime);
            const options = this._builtinOptions('official');
            if (options.openMode && options.openMode !== 'default' && !e.ctrlKey && !e.metaKey && !e.shiftKey &&
                (!Number.isInteger(e.button) || e.button === 0)) {
                e.preventDefault();
                this._openBuiltinUrl('official', this._ginzaLink.href);
            }
            this._onBodyClick();
            super._onCommand('pause');
        });
        this._originalLink = shadow.querySelector('.originalLink');
        this._twitterLink = shadow.querySelector('.twitterHashLink');
        this._parentVideoLink = shadow.querySelector('.parentVideoLink');
        this._uadLink = shadow.querySelector('.uadLink');
        // Real anchors keep Ctrl/middle-click and the browser context menu usable.
        for (const [id, link] of [['twitter', this._twitterLink], ['tree', this._parentVideoLink], ['ad', this._uadLink]]) {
            if (!link) {
                continue;
            }
            link.removeAttribute('data-command');
            link.rel = 'noopener noreferrer';
            const refresh = () => this._refreshBuiltinLink(id, link);
            link.addEventListener('auxclick', refresh);
            link.addEventListener('contextmenu', refresh);
            link.addEventListener('click', (e) => {
                refresh();
                if (!link.hasAttribute('href')) {
                    e.preventDefault();
                    return;
                }
                const modified = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button > 0;
                const mode = this._builtinOptions(id).openMode || 'default';
                if (!modified && (mode === 'new-window' || (id === 'ad' && mode === 'default'))) {
                    e.preventDefault();
                    this._openBuiltinUrl(id, link.href);
                }
                this._onBodyClick();
            });
        }
        this._customRelatedGroup = shadow.querySelector('.customRelatedGroup');
        this._customRelatedItems = shadow.querySelector('.customRelatedItems');
        this._builtinRelatedItems = new Map([...shadow.querySelectorAll('.relatedMenuItems > li[data-related-order-key]')].map(li => [
            li.dataset.relatedOrderKey, li
        ]));
        this._builtinOriginalLabels = new Map([...this._builtinRelatedItems].map(([key, li]) => [key, li.querySelector('.command')?.textContent || '']));
        this._customLinkById = new Map();
        this._elm.summary.addEventListener('click', () => {
            this._renderCustomMenu();
            if (this._currentWatchId) {
                this._ginzaLink.href = OfficialPlayerRoute.makeUrl(this._currentWatchId, this._builtinOptions('official').includePosition === false ?
                    0 : this._relatedContext().currentTime);
            }
        });
        this._visibility = UiVisibilityRegistry.connect(Config, this._view, 'related', {
            beforeHide: () => {
                const details = this._shadow || this._view;
                if (details.open) {
                    this._onBodyClick();
                }
            }
        });
        shadow.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-related-link-id]');
            if (!link) {
                return;
            }
            const item = this._customLinkById.get(link.dataset.relatedLinkId);
            const result = item && RelatedMenuActions.resolveUrl(item.url, this._relatedContext());
            if (!result || !result.url) {
                e.preventDefault();
                return;
            }
            link.href = result.url;
            if (item.openMode === 'new-window' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                const features = 'noopener,noreferrer,width=' + (item.popupWidth || 760) + ',height=' + (item.popupHeight || 650);
                window.open(result.url, '_blank', features);
            }
            shadow.open = false;
            this.emit('close');
        });
    }
    _applyMenuVisibility() {
        return this._visibility?.apply('ui.relatedMenu');
    }
    _onBodyClick() {
        const shadow = this._shadow || this._view;
        shadow.open = false;
        document.body.removeEventListener('mouseup', this._bound._onBodyClick);
        this.emit('close');
    }
    update(videoInfo) {
        const shadow = this._shadow || this._view;
        shadow.open = false;
        this._currentWatchId = videoInfo.watchId;
        this._currentVideoId = videoInfo.videoId;
        this._currentVideoInfo = videoInfo;
        this.setState({
            // Task172 (F01): show the entries when the tree may exist (V4 unknown) too.
            isParentVideoExist: videoInfo.canOpenContentTree === true,
            isCommunity: videoInfo.isCommunityVideo,
            isMymemory: videoInfo.isMymemory
        });
        const vid = this._currentVideoId;
        const wid = this._currentWatchId;
        this._ginzaLink.setAttribute('href', OfficialPlayerRoute.makeUrl(wid));
        this._originalLink.setAttribute('href', `//www.nicovideo.jp/watch/${vid}`);
        this._twitterLink.setAttribute('href', this._resolveBuiltinUrl('twitter', `https://twitter.com/hashtag/${vid}`));
        // Task 043: commons.nicovideo.jp/tree/{id} は廃止された。
        // 現在の親作品・子作品の表示先は /works/{id} 。クエリはニコニコ動画の
        // 視聴ページからコンテンツツリーを開いた時と同じもの（流入元の記録用）。
        this._parentVideoLink.setAttribute('href', this._resolveBuiltinUrl('tree', `https://commons.nicovideo.jp/works/${vid}?transit_from=pcvideo_watch_contentstree&rf=nvpc&rp=watch&ra=content_tree`));
        this._renderCustomMenu();
        this.emit('close');
    }
    _relatedContext() {
        // Only explicitly approved metadata reaches registered actions.
        const currentTime = ZenzaWatch.debug?.videoControlBar?.player?.currentTime;
        return RelatedMenuActions.makeContext(this._currentVideoInfo, currentTime);
    }
    _builtinOptions(id) {
        return RelatedMenuOrder.getOption(Config.getValue(RelatedMenuOrder.OPTIONS_KEY), id);
    }
    _resolveBuiltinUrl(id, original) {
        const template = this._builtinOptions(id).urlTemplate;
        if (!template) {
            return original;
        }
        const resolved = RelatedMenuActions.resolveUrl(template, this._relatedContext());
        return resolved.url || null;
    }
    _refreshBuiltinLink(id, link) {
        if (!link || !this._currentVideoInfo) {
            return;
        }
        const vid = this._currentVideoId, wid = this._currentWatchId;
        const defaults = {
            twitter: `https://twitter.com/hashtag/${vid}`,
            tree: `https://commons.nicovideo.jp/works/${vid}?transit_from=pcvideo_watch_contentstree&rf=nvpc&rp=watch&ra=content_tree`,
            ad: `https://nicoad.nicovideo.jp/video/publish/${wid}?frontend_id=6&frontend_version=0&zenza_watch`
        };
        const url = this._resolveBuiltinUrl(id, defaults[id]);
        if (url) {
            link.href = url;
            link.target = this._builtinOptions(id).openMode === 'same-tab' ? '_self' : '_blank';
            link.removeAttribute('aria-disabled');
            link.removeAttribute('title');
        }
        else {
            link.removeAttribute('href');
            link.setAttribute('aria-disabled', 'true');
            link.title = 'リンクに必要な動画・投稿者情報を取得できませんでした';
        }
    }
    _openBuiltinUrl(id, url) {
        return RelatedMenuOrder.openUrl(id, url, this._builtinOptions(id), (...args) => window.open(...args));
    }
    _renderCustomMenu() {
        if (!this._customRelatedGroup || !this._customRelatedItems) {
            return;
        }
        const links = RelatedMenuActions.getLinks(Config.getValue(RelatedMenuActions.CONFIG_KEY))
            .filter((item) => item.enabled);
        const context = this._relatedContext();
        const actions = RelatedMenuActions.getActions(context);
        const nodes = new Map(this._builtinRelatedItems || []);
        let customCount = 0;
        this._customLinkById.clear();
        for (const [key, li] of this._builtinRelatedItems || []) {
            const id = key.slice(8);
            const element = li.querySelector('.command');
            const label = this._builtinOptions(id).label;
            if (element) {
                element.textContent = label || this._builtinOriginalLabels?.get(key) || '';
            }
        }
        const officialMode = this._builtinOptions('official').openMode;
        if (this._ginzaLink) {
            this._ginzaLink.target = officialMode === 'same-tab' ? '_self' : '_blank';
        }
        for (const [id, link] of [['twitter', this._twitterLink], ['tree', this._parentVideoLink], ['ad', this._uadLink]]) {
            this._refreshBuiltinLink(id, link);
        }
        if (this._currentVideoInfo) {
            for (const item of links) {
                const li = document.createElement('li');
                if (RelatedMenuActions.isCopy(item)) {
                    const resolved = RelatedMenuActions.resolveCopy(item.copyTemplate, context);
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'command customRelatedAction';
                    button.textContent = item.label;
                    button.dataset.command = 'copy-custom-related-item';
                    button.dataset.param = item.id;
                    button.disabled = resolved.text === null;
                    if (button.disabled) {
                        button.title = '未取得: ' + (resolved.missing || []).join(', ');
                    }
                    li.dataset.relatedOrderKey = 'link:' + item.id;
                    li.append(button);
                    this._customLinkById.set(item.id, item);
                    nodes.set('link:' + item.id, li);
                    customCount++;
                    continue;
                }
                const resolved = RelatedMenuActions.resolveUrl(item.url, context);
                const link = document.createElement(resolved.url ? 'a' : 'span');
                link.className = resolved.url ? 'command customRelatedLink' : 'command customRelatedDisabled';
                link.textContent = item.label;
                if (resolved.url) {
                    link.href = resolved.url;
                    link.target = item.openMode === 'same-tab' ? '_self' :
                        item.openMode === 'new-tab' || item.openMode === 'new-window' ? '_blank' :
                            item.openInNewTab ? '_blank' : '_self';
                    link.rel = 'noopener noreferrer';
                    link.dataset.relatedLinkId = item.id;
                    this._customLinkById.set(item.id, item);
                }
                else {
                    link.setAttribute('aria-disabled', 'true');
                    link.title = resolved.missing?.length ?
                        '未取得: ' + resolved.missing.join(', ') : 'URLを開けません';
                }
                li.appendChild(link);
                const key = 'link:' + item.id;
                li.dataset.relatedOrderKey = key;
                nodes.set(key, li);
                customCount++;
            }
            for (const action of actions) {
                const li = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'command customRelatedAction';
                button.textContent = action.label;
                button.dataset.command = 'run-custom-related-action';
                button.dataset.param = action.id;
                button.disabled = !action.enabled;
                li.appendChild(button);
                const key = 'action:' + action.id;
                li.dataset.relatedOrderKey = key;
                nodes.set(key, li);
                customCount++;
            }
        }
        // Move the original nodes, do not clone their command handlers or replace
        // eligibility classes (community/mymemory/tree availability).
        const order = RelatedMenuOrder.orderedKeys(Config.getValue(RelatedMenuOrder.CONFIG_KEY), [...nodes.keys()]);
        const hiddenItems = Config.getValue(RelatedMenuOrder.HIDDEN_KEY);
        for (const [key, node] of nodes) {
            node.hidden = RelatedMenuOrder.isHidden(key, hiddenItems);
        }
        this._customRelatedItems.replaceChildren(...order.map((key) => nodes.get(key)), ...(this._customRelatedGroup ? [this._customRelatedGroup] : []));
        // Legacy marker remains for existing consumers, but contributes no row.
        if (this._customRelatedGroup) {
            this._customRelatedGroup.hidden = customCount === 0;
        }
    }
    _onCommand(command, param) {
        let url;
        const shadow = this._shadow || this._view;
        shadow.open = false;
        switch (command) {
            case 'watch-ginza': {
                const currentTime = this._builtinOptions('official').includePosition === false ?
                    0 : this._relatedContext().currentTime;
                const officialUrl = OfficialPlayerRoute.makeUrl(this._currentWatchId, currentTime);
                this._ginzaLink.href = officialUrl;
                this._openBuiltinUrl('official', officialUrl);
                super._onCommand('pause');
                break;
            }
            case 'open-uad':
                url = `//nicoad.nicovideo.jp/video/publish/${this._currentWatchId}?frontend_id=6&frontend_version=0&zenza_watch`;
                this._openBuiltinUrl('ad', url);
                break;
            case 'open-twitter-hash':
                this._openBuiltinUrl('twitter', this._resolveBuiltinUrl('twitter', this._twitterLink.href));
                break;
            case 'open-parent-video':
                this._openBuiltinUrl('tree', this._resolveBuiltinUrl('tree', this._parentVideoLink.href));
                break;
            case 'copy-video-watch-url':
                super._onCommand(command, param);
                super._onCommand('notify', 'コピーしました');
                break;
            case 'open-original-video':
                super._onCommand('openNow', this._currentVideoId);
                break;
            case 'copy-custom-related-item': {
                const item = this._customLinkById.get(param);
                if (!item || !item.enabled || !RelatedMenuActions.isCopy(item)) {
                    break;
                }
                const result = RelatedMenuActions.resolveCopy(item.copyTemplate, this._relatedContext());
                if (result.text !== null) {
                    super._onCommand('copy-related-text', result.text);
                }
                break;
            }
            case 'run-custom-related-action':
                RelatedMenuActions.invoke(param, this._relatedContext());
                break;
            default:
                super._onCommand(command, param);
        }
        this.emit('close');
    }
}
RelatedInfoMenu._css_ = ('').trim();
RelatedInfoMenu._shadow_ = (`
    <style>
      .RelatedInfoMenu,
      .RelatedInfoMenu * {
        box-sizing: border-box;
        user-select: none;
      }

      .RelatedInfoMenu {
        display: inline-block;
        padding: 8px;
        font-size: 16px;
        cursor: pointer;
      }

      .RelatedInfoMenu summary {
        display: inline-block;
        background: transparent;
        color: var(--zt-text-inverse, #333);
        padding: 4px 8px;
        border-radius: 4px;
        outline: none;
        border: 1px solid var(--zt-border-light, #ccc);
      }

      .RelatedInfoMenu ul {
        list-style-type: none;
        padding-left: 32px;
      }

      .RelatedInfoMenu li {
        padding: 4px;
      }

      .RelatedInfoMenu li > .command {
        display: inline-block;
        text-decoration: none;
        color: var(--zt-text-1, #ccc);
      }

      .RelatedInfoMenu li > .command:hover {
        text-decoration: underline;
      }

      .RelatedInfoMenu li > .command:hover::before {
        content: '▷';
        position: absolute;
        transform: translate(-100%, 0);
      }
      .RelatedInfoMenu .customRelatedGroup { display: none !important; }
      .RelatedInfoMenu [data-related-order-key][hidden] { display: none !important; }
      .RelatedInfoMenu .customRelatedHeading {
        display: block;
        font-size: 0.85em;
        opacity: 0.75;
      }
      .RelatedInfoMenu .customRelatedItems { padding-left: 32px; }
      .RelatedInfoMenu .customRelatedDisabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .RelatedInfoMenu .customRelatedAction {
        background: none;
        border: 0;
        padding: 0;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .RelatedInfoMenu .customRelatedAction:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }


        .RelatedInfoMenu .originalLinkMenu,
        .RelatedInfoMenu .parentVideoMenu {
          display: none;
        }

        .RelatedInfoMenu.is-Community        .originalLinkMenu,
        .RelatedInfoMenu.is-Mymemory         .originalLinkMenu,
        .RelatedInfoMenu.is-ParentVideoExist .parentVideoMenu {
          display: block;
        }


      .zenzaScreenMode_sideView .is-fullscreen .RelatedInfoMenu summary{
        background: var(--zt-surface-3, #888);
      }

      :host-context(.zenzaScreenMode_sideView .is-fullscreen) .RelatedInfoMenu summary {
        background: var(--zt-surface-3, #888);
      }

      /* :host-contextで分けたいけどFirefox対応のため */
      .RelatedInfoMenu.is-Header {
        font-size: 13px;
        padding: 0 8px;
      }
      .RelatedInfoMenu.is-Header summary {
        background: var(--zt-surface-3, #666);
        color: var(--zt-text-1, #ccc);
        padding: 0 8px;
        border: none;
      }
      .RelatedInfoMenu.is-Header[open] {
        background: var(--zt-overlay-dark, rgba(80, 80, 80, 0.9));
      }
      .RelatedInfoMenu.is-Header ul {
        font-size: 16px;
        line-height: 20px;
      }

      :host-context(.zenzaWatchVideoInfoPanel) .RelatedInfoMenu li > .command {
        color: var(--zt-text-inverse, #222);
      }

      .zenzaWatchVideoInfoPanel .RelatedInfoMenu li > .command {
        color: var(--zt-text-inverse, #222);
      }

        /* for Edge */
        .is-Edge .RelatedInfoMenuBody {
          display: none;
          color: var(--zt-text-1, #ccc);
          background: var(--zt-overlay-dark, rgba(80, 80, 80, 0.9));
        }
        .RelatedInfoMenu[open] .RelatedInfoMenuBody,
        .RelatedInfoMenu:focus .RelatedInfoMenuBody,
        .RelatedInfoMenuBody:hover {
          display: block;
        }
    </style>
    <details class="root RelatedInfoMenu">
      <summary class="RelatedInfoMenuSummary clickable">関連メニュー</summary>
      <div class="RelatedInfoMenuBody">
        <ul class="relatedMenuItems customRelatedItems">
          <li class="ginzaMenu" data-related-order-key="builtin:official">
            <a class="ginzaLink command noHoverMenu" target="_blank"
              rel="noopener noreferrer">公式プレイヤーで開く</a>
          </li>
          <li class="uadMenu" data-related-order-key="builtin:ad">
            <a class="uadLink command" target="_blank"
              rel="noopener noreferrer">ニコニ広告で宣伝</a>
          </li>
          <li class="twitterHashMenu" data-related-order-key="builtin:twitter">
            <a class="twitterHashLink command"
              rel="noopener" data-command="open-twitter-hash">twitterの反応を見る</a>
          </li>
          <li class="originalLinkMenu" data-related-order-key="builtin:original">
            <a class="originalLink command"
              rel="noopener" data-command="open-original-video">元動画を開く</a>
          </li>
          <li class="parentVideoMenu" data-related-order-key="builtin:tree">
            <a class="parentVideoLink command"
              rel="noopener" data-command="open-parent-video">親作品・コンテンツツリー</a>
          </li>
          <li class="parentVideoMenu" data-related-order-key="builtin:tree-playlist">
            <span class="command"
              data-command="playlistSetCommonsTree">親作品・子作品をプレイリストに追加</span>
          </li>
          <li class="copyVideoWatchUrlMenu" data-related-order-key="builtin:copy-url">
            <span class="copyVideoWatchUrlLink command"
              rel="noopener" data-command="copy-video-watch-url">動画URLをコピー</span>
          </li>
          <li class="customRelatedGroup" hidden aria-hidden="true"></li>
        </ul>
      </div>
    </details>
  `).trim();
//===END===
export {
  RelatedInfoMenu
};
