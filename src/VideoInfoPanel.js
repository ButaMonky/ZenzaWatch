import {ZenzaWatch, global} from './ZenzaWatchIndex';
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
import {VideoHeaderPanel} from './VideoHeaderPanel';
import {UaaView} from './UaaView';
import {RelatedInfoMenu} from './RelatedInfoMenu';
import {VideoMetaInfo} from './VideoMetaInfo';
// GENERATED FROM tools/typescript-stage1/nico-src/VideoInfoPanel.ts (Task964). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RelatedMenuActions
//@require RelatedMenuOrder
//@require UiVisibilityRegistry
//@require OfficialPlayerRoute
class VideoInfoPanel extends Emitter {
    constructor(params) {
        super();
        this._videoHeaderPanel = new VideoHeaderPanel(params);
        this._dialog = params.dialog;
        this._config = Config;
        this._dialog.on('canplay', this._onVideoCanPlay.bind(this));
        this._dialog.on('videoCount', this._onVideoCountUpdate.bind(this));
        // Task 074: いいね！のお礼メッセージ（URLが書かれていることがあるので、
        // 消えるポップアップだけでなくパネルにも残して選択・コピーできるようにする）
        this._dialog.on('likeThanksMessage', this._onLikeThanksMessage.bind(this));
        if (params.node) {
            this.appendTo(params.node);
        }
    }
    _initializeDom() {
        if (this._isInitialized) {
            return;
        }
        this._isInitialized = true;
        const $view = this._$view = uq.html(VideoInfoPanel.__tpl__);
        const view = this._view = $view[0];
        const classList = this.classList = ClassList(view);
        const $icon = this._$ownerIcon = $view.find('.ownerIcon');
        this._$ownerName = $view.find('.ownerName');
        this._$ownerPageLink = $view.find('.ownerPageLink');
        this._description = view.querySelector('.videoDescription');
        this._seriesList = view.querySelector('.seriesList');
        this._tagListView = new TagListView({
            parentNode: view.querySelector('.videoTagsContainer')
        });
        this._relatedInfoMenu = new RelatedInfoMenu({
            parentNode: view.querySelector('.relatedInfoMenuContainer')
        });
        this._videoMetaInfo = new VideoMetaInfo({
            parentNode: view.querySelector('.videoMetaInfoContainer')
        });
        this._likeMessageContainer = view.querySelector('.likeMessageContainer');
        this._uaaContainer = view.querySelector('.uaaContainer');
        this._uaaView = new UaaView({ parentNode: this._uaaContainer });
        this._visibility = UiVisibilityRegistry.connect(Config, view, 'info', {
            beforeHide: (entry) => {
                if (entry.key !== 'ui.info.relatedTab' || this._activeTabName !== 'relatedVideoTab') {
                    return;
                }
                const containerView = this._dialog?._view;
                if (typeof containerView?.selectTab === 'function') {
                    containerView.selectTab('videoInfoTab');
                }
                else {
                    this.selectTab('videoInfoTab');
                }
            }
        });
        view.addEventListener('mousemove', (e) => e.stopPropagation());
        // Task1042: ▶ にマウスを乗せたら「動画」「ショート」のボタンを横に出す。小さいので一度出したら出したままにする。
        const ownerVideoButton = view.querySelector('.playlistSetUploadedVideo');
        const revealOwnerVideoKinds = () => view.querySelector('.ownerVideoKinds')?.classList.add('is-revealed');
        // Task1043: ボタンの形・位置は上級者設定「画面・映像 › プレイヤーの操作表示」で選ぶ（CSS の data-kinds-style で切り替え）
        const applyOwnerVideoKindsStyle = () => {
            const value = Config.props['videoInfo.ownerVideoKindsStyle'];
            const style = ['row', 'stack', 'square', 'shape', 'below', 'off'].includes(value) ? value : 'row';
            view.querySelector('.ownerVideoKinds')?.setAttribute('data-kinds-style', style);
            // 名前の下の段に出すときは、投稿者名の欄にその段の場所を空ける
            view.querySelector('.videoOwnerInfoContainer .owner')?.setAttribute('data-kinds-style', style);
        };
        applyOwnerVideoKindsStyle();
        Config.onkey('videoInfo.ownerVideoKindsStyle', applyOwnerVideoKindsStyle);
        ownerVideoButton?.addEventListener('mouseenter', revealOwnerVideoKinds);
        ownerVideoButton?.addEventListener('focus', revealOwnerVideoKinds);
        view.addEventListener('keydown', (e) => {
            const kind = e.target?.closest?.('.ownerVideoKind');
            if (kind && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                kind.click();
            }
        });
        view.addEventListener('command', this._onCommandEvent.bind(this));
        view.addEventListener('click', this._onClick.bind(this));
        view.addEventListener('keydown', this._onTabKeyDown.bind(this));
        this._syncTabAccessibility();
        view.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
        $icon.on('load', () => $icon.raf.removeClass('is-loading'));
        classList.add(Fullscreen.now() ? 'is-fullscreen' : 'is-notFullscreen');
        global.emitter.on('fullscreenStatusChange', (isFull) => {
            classList.toggle('is-fullscreen', isFull);
            classList.toggle('is-notFullscreen', !isFull);
        });
        view.addEventListener('touchenter', () => classList.add('is-slideOpen'), { passive: true });
        global.emitter.on('hideHover', () => classList.remove('is-slideOpen'));
        cssUtil.registerProps({ name: '--base-description-color', syntax: '<color>', initialValue: '#888', inherits: true });
        MylistPocketDetector.detect().then((pocket) => {
            this._pocket = pocket;
            classList.add('is-pocketReady');
        });
        if (window.customElements) {
            VideoItemObserver.observe({ container: this._description });
        }
    }
    update(videoInfo) {
        this._videoInfo = videoInfo;
        this._videoHeaderPanel.update(videoInfo);
        const owner = videoInfo.owner;
        this._$ownerIcon.attr('src', owner.icon);
        this._$ownerPageLink.attr('href', owner.url);
        this._$ownerName.text(owner.name);
        this._videoMetaInfo.update(videoInfo);
        this._tagListView.update({
            tagList: videoInfo.tagList,
            watchId: videoInfo.watchId,
            videoId: videoInfo.videoId,
            token: videoInfo.csrfToken,
            tagEdit: videoInfo.tagEdit,
        });
        this._seriesList.textContent = '';
        if (videoInfo.series) {
            const label = document.createElement('zenza-video-series-label');
            Object.assign(label.dataset, videoInfo.series);
            this._seriesList.append(label);
        }
        this._updateVideoDescription(videoInfo.description, videoInfo.series);
        const classList = this.classList;
        classList.remove('userVideo', 'channelVideo', 'initializing', 'is-loadFailed');
        classList.toggle('is-community', this._videoInfo.isCommunityVideo);
        classList.toggle('is-mymemory', this._videoInfo.isMymemory);
        classList.add(videoInfo.isChannel ? 'channelVideo' : 'userVideo');
        this._clearLikeThanksMessage();
        this._uaaView.clear();
        this._uaaView.update(videoInfo);
        this._relatedInfoMenu.update(videoInfo);
    }
    /**
     * 説明文中のurlの自動リンク等の処理
     */
    static _readDescriptionSeries(value) {
        if (!value || typeof value !== 'object')
            return null;
        const raw = value;
        if (!raw.video || typeof raw.video !== 'object' || typeof raw.title !== 'string')
            return null;
        const videos = raw.video;
        const read = (item) => {
            if (!item || typeof item !== 'object')
                return null;
            const id = item.id;
            return typeof id === 'string' && /^(?:(?:sm|nm|so|ss)\d+|\d+)$/.test(id) ? { id } : null;
        };
        return { title: raw.title, video: { prev: read(videos.prev), next: read(videos.next) } };
    }
    async _updateVideoDescription(input, rawSeries = null) {
        let html = typeof input === 'string' ? input : '';
        const series = VideoInfoPanel._readDescriptionSeries(rawSeries);
        // Task 090（監査v2 ZW-053）: 更新の世代。await の後で、もっと新しい更新や clear() があったら、この結果は捨てる
        const generation = this._descriptionGeneration = (this._descriptionGeneration || 0) + 1;
        const owner = { descriptionGeneration: generation, videoInfo: this._videoInfo };
        this._description.textContent = '';
        this._zenTubeUrl = null;
        if (series) {
            if (series.video.prev || series.video.next) {
                html += `<br><br>「${textUtil.escapeHtml(series.title)}」 シリーズ前後の動画`;
            }
            if (series.video.prev) {
                html += `<br>前の動画 <a class="watch" href="https://www.nicovideo.jp/watch/${textUtil.escapeHtml(series.video.prev.id)}">${textUtil.escapeHtml(series.video.prev.id)}</a>`;
            }
            if (series.video.next) {
                html += `<br>次の動画 <a class="watch" href="https://www.nicovideo.jp/watch/${textUtil.escapeHtml(series.video.next.id)}">${textUtil.escapeHtml(series.video.next.id)}</a>`;
            }
        }
        /*
         * Task 074: 以前はリンクの「文字」から動画IDを取っていたため、
         * 説明文に https://www.nicovideo.jp/watch/sm39257413 のようなフルURLが
         * 書かれている場合（本家がclass="watch"を付けないただのリンクにする）に
         * 動画情報のカードが出ず、クリックしてもZenzaで開けなかった。
         * リンク先(href)のホストとパスから動画IDを取るようにして、
         * フルURL・スマホ版URL・nico.ms・ショート動画(ss〜)にも対応する。
         */
        const watchIdFromLink = (link) => {
            const host = (link.hostname || '').replace(/^(www|sp|embed)\./, '');
            const path = link.pathname || '';
            if (host === 'nico.ms') {
                const m = /^\/((?:sm|nm|so|ss)[0-9]+)/.exec(path);
                return m ? m[1] : null;
            }
            if (host !== 'nicovideo.jp') {
                return null;
            }
            const m = /^\/(?:watch|shorts)\/((?:sm|nm|so|ss)[0-9]+)/.exec(path);
            return m ? m[1] : null;
        };
        const decorateWatchLink = (watchLink) => {
            const videoId = watchIdFromLink(watchLink);
            if (!videoId) {
                return;
            }
            watchLink.classList.add('noHoverMenu');
            Object.assign(watchLink.dataset, { command: 'open', param: videoId });
            if (!window.customElements) {
                const $watchLink = uq(watchLink);
                const thumbnail = nicoUtil.getThumbnailUrlByVideoId(videoId);
                if (thumbnail) {
                    const $img = uq('<img class="videoThumbnail">').attr('src', thumbnail);
                    $watchLink.append($img);
                }
                const buttons = uq(`<zenza-playlist-append
          class="playlistAppend clickable-item" title="プレイリストで開く"
          data-command="playlistAppend" data-param="${videoId}"
        >▶</zenza-playlist-append><div
          class="deflistAdd" title="あとで見る"
          data-command="deflistAdd" data-param="${videoId}"
        >&#x271A;</div
        ><div class="pocket-info" title="動画情報"
          data-command="pocket-info" data-param="${videoId}"
        >？</div>`);
                $watchLink.append(buttons);
            }
            else {
                const vitem = document.createElement('zenza-video-item');
                vitem.dataset.videoId = videoId;
                watchLink.after(vitem);
                watchLink.classList.remove('watch');
            }
        };
        const seekTime = (seek) => {
            const [min, sec] = (seek.dataset.seektime || '0:0').split(':');
            Object.assign(seek.dataset, { command: 'seek', type: 'number', param: min * 60 + sec * 1 });
        };
        /*
         * Task 088（監査v2 ZW-052）: 以前はリンクの文字（link.textContent）から取った ID を、
         * そのまま HTML の文字列へ埋め込んで要素を作り直していたため、引用符や < > を含むリンクの文字が
         * 新しい属性・要素として解釈されてしまった。ID はリンク先(href)から取り（取れない時だけ文字から）、
         * 数字だけであることを確かめてから、createElement と dataset で組み立てる。元のリンクはそのまま中へ移す。
         */
        const playlistLinkId = (link, kind) => {
            const host = (link.hostname || '').replace(/^(www|sp)\./, '');
            if (host === 'nicovideo.jp') {
                const m = new RegExp(`^(?:/user/[0-9]+)?/${kind}/([0-9]+)/?$`).exec(link.pathname || '');
                if (m) {
                    return m[1];
                }
            }
            const t = new RegExp(`^${kind}/([0-9]+)$`).exec((link.textContent || '').trim());
            return t ? t[1] : null;
        };
        const playlistLink = (link, { kind, tag, idKey, command }) => {
            const id = playlistLinkId(link, kind);
            if (!id) {
                return;
            }
            link.classList.add(`${kind}Link`);
            const wrapper = document.createElement(tag);
            wrapper.dataset[idKey] = id;
            const button = document.createElement('zenza-playlist-append');
            button.className = `${command} clickable-item`;
            button.title = 'プレイリストで開く';
            Object.assign(button.dataset, { command, param: id });
            button.textContent = '▶';
            link.replaceWith(wrapper);
            wrapper.append(link, button);
        };
        /*
         * Task1037: 大百科の記事（動画記事 /v/… ・単語記事 /a/…）へのリンクにも「プレイリストで開く」を付ける。
         * ランキング動画などは「全ランクイン動画リスト」を大百科の記事に載せていることがある。
         */
        const nicodicArticleUrl = (link) => {
            try {
                const url = new URL(link.href);
                if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                    return null;
                }
                if (url.hostname !== 'dic.nicovideo.jp') {
                    return null;
                }
                if (!/^\/(?:v|a)\/[^/]+\/?$/.test(url.pathname)) {
                    return null;
                }
                return 'https://dic.nicovideo.jp' + url.pathname;
            }
            catch (_) {
                return null;
            }
        };
        const nicodicLink = (link) => {
            const url = nicodicArticleUrl(link);
            if (!url) {
                return;
            }
            link.classList.add('nicodicLink');
            const wrapper = document.createElement('zenza-nicodic-link');
            wrapper.dataset.nicodicUrl = url;
            const button = document.createElement('zenza-playlist-append');
            button.className = 'playlistSetNicodic clickable-item';
            button.title = 'この大百科記事に載っている動画をプレイリストで開く';
            Object.assign(button.dataset, { command: 'playlistSetNicodic', param: url });
            button.textContent = '▶';
            link.replaceWith(wrapper);
            wrapper.append(link, button);
        };
        const mylistLink = (link) => playlistLink(link, { kind: 'mylist', tag: 'zenza-mylist-link', idKey: 'mylistId', command: 'playlistSetMylist' });
        const seriesLink = (link) => playlistLink(link, { kind: 'series', tag: 'zenza-series-link', idKey: 'seriesId', command: 'playlistSetSeries' });
        /*
         * Task 088（監査v2 ZW-052）: 説明文の本文はニコニコが返す HTML をそのまま表示している。
         * 念のため、表示する前にスクリプトとして動き得るもの（script 等の要素、on〜 の属性、
         * javascript: / data: / vbscript: の URL）だけを取り除く。文字の装飾や普通のリンクはそのまま。
         */
        const UNSAFE_ELEMENTS = 'script,iframe,frame,object,embed,base,meta,link,form';
        const UNSAFE_URL = /^[\s\u0000-\u001f]*(javascript|data|vbscript):/i;
        const sanitizeDescription = (root) => {
            for (const e of root.querySelectorAll(UNSAFE_ELEMENTS)) {
                e.remove();
            }
            for (const e of root.querySelectorAll('*')) {
                for (const { name, value } of [...e.attributes]) {
                    const n = name.toLowerCase();
                    if (n.startsWith('on') ||
                        (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(n) && UNSAFE_URL.test(value))) {
                        e.removeAttribute(name);
                    }
                }
            }
        };
        const youtube = (link) => {
            const btn = uq(`<zentube-button
        class="zenzaTubeButton"
        title="ZenzaWatchで開く(実験中)"
        accesskey="z"
        data-command="setVideo;"
        >▷Zen<span>Tube</span></zentube-button>`)[0];
            Object.assign(btn.dataset, {
                command: 'setVideo',
                param: link.href
            });
            link.parentNode.insertBefore(btn, link);
        };
        await sleep.promise();
        if (owner.descriptionGeneration !== this._descriptionGeneration || owner.videoInfo !== this._videoInfo) {
            return;
        }
        const $description = uq(`<zenza-video-description>${html}</zenza-video-description>`);
        sanitizeDescription($description[0]);
        for (const a of $description.query('a')) {
            a.classList.add('noHoverMenu');
            const href = a.href;
            if (a.classList.contains('watch') || watchIdFromLink(a)) {
                decorateWatchLink(a);
            }
            else if (a.classList.contains('seekTime')) {
                seekTime(a);
            }
            else if (/^mylist\//.test(a.textContent)) {
                mylistLink(a);
            }
            else if (/^series\//.test(a.textContent)) {
                seriesLink(a);
            }
            else if (nicodicArticleUrl(a)) {
                nicodicLink(a);
            }
            else if (/^https?:\/\/((www\.|)youtube\.com\/watch|youtu\.be)/.test(href)) {
                youtube(a);
                this._zenTubeUrl = href;
            }
        }
        for (const e of $description.query('[style*="color: #000000;"],[style*="color: black;"]')) {
            e.dataset.originalCss = e.cssText;
            e.style.color = '#FFF';
        }
        for (const e of $description.query('span')) {
            e.classList.add('videoDescription-font');
        }
        // 装飾は切り離した要素の上で済ませてあるので、最新の結果だけで置き換える
        this._description.replaceChildren($description[0]);
    }
    /*
     * Task 074: いいね！のお礼メッセージをパネルに残す。
     * 本文はテキストとして選択でき、中のURLは自動でリンクになる。
     * 「コピー」ボタンで本文全体をクリップボードへコピーできる。
     */
    _onLikeThanksMessage({ message = '', videoId = '' } = {}) {
        const container = this._likeMessageContainer;
        if (!container) {
            return;
        }
        container.textContent = '';
        if (!message) {
            return;
        }
        const box = document.createElement('div');
        box.className = 'likeThanksMessage';
        const head = document.createElement('div');
        head.className = 'likeThanksMessage-head';
        const title = document.createElement('span');
        title.className = 'likeThanksMessage-title';
        title.textContent = `\u2665 いいね！のお礼メッセージ${videoId ? `（${videoId}）` : ''}`;
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'likeThanksMessage-copy';
        copy.textContent = 'コピー';
        const flash = (text) => {
            copy.textContent = text;
            window.setTimeout(() => { copy.textContent = 'コピー'; }, 2000);
        };
        copy.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(message)
                    .then(() => flash('コピーしました'))
                    .catch(() => flash('コピーできませんでした'));
            }
            else {
                flash('コピーできませんでした');
            }
        });
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'likeThanksMessage-close';
        close.textContent = '\u2715';
        close.title = '閉じる';
        close.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            this._clearLikeThanksMessage();
        });
        head.append(title, copy, close);
        const body = document.createElement('div');
        body.className = 'likeThanksMessage-body';
        // URLだけリンクにする（他の部分はテキストのまま＝HTMLとして解釈しない）
        const reg = /(https?:\/\/[^\s<>"']+)/g;
        let last = 0;
        let m;
        while ((m = reg.exec(message)) !== null) {
            if (m.index > last) {
                body.append(document.createTextNode(message.slice(last, m.index)));
            }
            const a = document.createElement('a');
            const url = m[1];
            a.href = url;
            a.textContent = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'noHoverMenu';
            body.append(a);
            last = m.index + url.length;
        }
        if (last < message.length) {
            body.append(document.createTextNode(message.slice(last)));
        }
        box.append(head, body);
        container.append(box);
    }
    _clearLikeThanksMessage() {
        if (this._likeMessageContainer) {
            this._likeMessageContainer.textContent = '';
        }
    }
    async _onVideoCanPlay(watchId, videoInfo, options) {
        // 動画の再生を優先するため、比較的どうでもいい要素はこのタイミングで初期化するのがよい
        if (!this._relatedVideoList) {
            this._relatedVideoList = new RelatedVideoList({
                container: this._$view.find('.relatedVideoContainer')[0],
                enableAdDecoration: this._config.props.enableAdDecoration,
                debugCheckAdDecoration: this._config.props.debugCheckAdDecoration
            });
            this._relatedVideoList.on('command', this._onCommand.bind(this));
        }
        // A newer canplay/video/description invalidates earlier queued switches.
        const timerGeneration = this._autoZenTubeTimerGeneration =
            (this._autoZenTubeTimerGeneration || 0) + 1;
        if (this._config.props.autoZenTube && this._zenTubeUrl && !options.isAutoZenTubeDisabled) {
            const zenTubeUrl = this._zenTubeUrl;
            const descriptionGeneration = this._descriptionGeneration;
            sleep(100).then(() => {
                if (timerGeneration !== this._autoZenTubeTimerGeneration ||
                    this._videoInfo !== videoInfo ||
                    this._descriptionGeneration !== descriptionGeneration ||
                    this._zenTubeUrl !== zenTubeUrl) {
                    return;
                }
                console.info('%cAuto ZenTube', zenTubeUrl);
                this.emit('command', 'setVideo', zenTubeUrl);
            });
        }
        await sleep.idle();
        // The previously scheduled canplay can resume after a different video
        // has become active. Never start an obsolete recommendation request.
        if (this._videoInfo !== videoInfo) {
            return;
        }
        this._relatedVideoList.fetchRecommend(videoInfo.videoId, watchId, videoInfo);
    }
    _onVideoCountUpdate(...args) {
        if (!this._videoHeaderPanel) {
            return;
        }
        this._videoMetaInfo.updateVideoCount(...args);
        this._videoHeaderPanel.updateVideoCount(...args);
    }
    _onClick(e) {
        e.stopPropagation();
        if ((e.button !== 0 || e.metaKey || e.shiftKey || e.altKey || e.ctrlKey)) {
            return true;
        }
        const target = e.target.closest('[data-command]');
        if (!target) {
            global.emitter.emitAsync('hideHover'); // 手抜き
            return;
        }
        let { command, param, type } = target.dataset;
        if (param && (type === 'bool' || type === 'json')) {
            param = JSON.parse(param);
        }
        e.preventDefault();
        domEvent.dispatchCommand(e.target, command, param);
        return undefined;
    }
    _onCommand(command, param) {
        switch (command) {
            default:
                domEvent.dispatchCommand(this._view, command, param);
                break;
        }
    }
    _onCommandEvent(e) {
        const { command, param } = e.detail;
        switch (command) {
            case 'pocket-info':
                this._pocket.external.info(param);
                break;
            case 'ownerVideo':
                domEvent.dispatchCommand(this._view, 'playlistSetUploadedVideo', this._videoInfo.owner.id);
                break;
            // Task1042: ▶ の横の「動画」「ショート」。種類を絞って投稿動画一覧を開く
            case 'ownerVideoLong':
            case 'ownerVideoShort':
                domEvent.dispatchCommand(this._view, 'playlistSetUploadedVideo', { id: this._videoInfo.owner.id, contentType: command === 'ownerVideoShort' ? 'short' : 'long' });
                break;
            default:
                return;
        }
        e.stopPropagation();
    }
    appendTo(node) {
        this._initializeDom();
        this._$view.appendTo(node);
        this._videoHeaderPanel.appendTo(node);
    }
    hide() {
        this._videoHeaderPanel.hide();
    }
    close() {
        this._videoHeaderPanel.close();
    }
    clear() {
        this._videoHeaderPanel.clear();
        this.classList.remove('is-loadFailed');
        this.classList.add('initializing');
        this._$ownerIcon.raf.addClass('is-loading');
        this._descriptionGeneration = (this._descriptionGeneration || 0) + 1;
        this._description.textContent = '';
    }
    onLoadFail() {
        // A failed metadata request is finished, not still initializing.
        // Hide stale data from the previous video instead of revealing it.
        this._videoInfo = null;
        this._videoHeaderPanel.clear();
        this._descriptionGeneration = (this._descriptionGeneration || 0) + 1;
        this._description.textContent = '';
        this.classList.remove('initializing');
        this.classList.add('is-loadFailed');
        this._$ownerIcon.raf.removeClass('is-loading');
        const root = this._view || this._$view?.[0];
        if (root?.querySelector('.tabSelect.playlist')) {
            this.selectTab('playlist');
        }
    }
    _syncTabAccessibility() {
        const root = (this._view || this._$view?.[0]);
        if (!root) {
            return;
        }
        root.querySelector('.tabSelectContainer')?.setAttribute('role', 'tablist');
        root.querySelectorAll('.tabSelect').forEach((tab) => {
            const name = tab.dataset.param;
            if (!name) {
                return;
            }
            const selected = tab.classList.contains('activeTab');
            tab.id = `zenza-info-tab-${name}`;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
            const panel = Array.from(root.querySelectorAll('.tabs')).find((node) => node.classList.contains(name));
            if (panel) {
                panel.id = `zenza-info-panel-${name}`;
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', tab.id);
                tab.setAttribute('aria-controls', panel.id);
            }
        });
    }
    _onTabKeyDown(event) {
        const root = (this._view || this._$view?.[0]);
        const target = event.target;
        const tab = target?.closest?.('.tabSelect');
        if (!root || !tab || !root.contains(tab) || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const available = (node) => {
            if (node.getAttribute('aria-disabled') === 'true') {
                return false;
            }
            for (let current = node; current && current !== root; current = current.parentElement) {
                const style = window.getComputedStyle(current);
                if (current.hidden || style.display === 'none' || style.visibility === 'hidden') {
                    return false;
                }
            }
            return true;
        };
        if (!available(tab)) {
            return;
        }
        const tabs = Array.from(root.querySelectorAll('.tabSelect')).filter(available);
        const index = tabs.indexOf(tab);
        let next;
        switch (event.key) {
            case 'ArrowRight':
                next = (index + 1) % tabs.length;
                break;
            case 'ArrowLeft':
                next = (index + tabs.length - 1) % tabs.length;
                break;
            case 'Home':
                next = 0;
                break;
            case 'End':
                next = tabs.length - 1;
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                event.stopPropagation();
                domEvent.dispatchCommand(tab, 'selectTab', tab.dataset.param);
                return;
            default: return;
        }
        event.preventDefault();
        event.stopPropagation();
        root.querySelectorAll('.tabSelect').forEach((node) => { node.tabIndex = -1; });
        tabs[next].tabIndex = 0;
        tabs[next].focus();
    }
    selectTab(tabName) {
        const $view = this._$view;
        const $target = $view.find(`.tabs.${tabName}, .tabSelect.${tabName}`);
        this._activeTabName = tabName;
        $view.find('.activeTab').removeClass('activeTab');
        $target.addClass('activeTab');
        this._syncTabAccessibility();
    }
    blinkTab(tabName) {
        const $view = this._$view;
        const $target = $view.find(`.tabs.${tabName}, .tabSelect.${tabName}`);
        if (!$target.length) {
            return;
        }
        $target.addClass('blink');
        window.setTimeout(() => $target.removeClass('blink'), 50);
    }
    appendTab(tabName, title, content) {
        const $view = this._$view;
        const $select = uq('<div class="tabSelect"/>')
            .addClass(tabName)
            .attr('data-command', 'selectTab')
            .attr('data-param', tabName)
            .text(title);
        const $body = uq('<div class="tabs"/>').addClass(tabName);
        if (content) {
            $body.append(content);
        }
        $view.find('.tabSelectContainer').append($select);
        $view.append($body);
        if (tabName === 'playlist' && this.classList.contains('is-loadFailed')) {
            this.selectTab('playlist');
        }
        if (this._activeTabName === tabName) {
            $select.addClass('activeTab');
            $body.addClass('activeTab');
        }
        this._syncTabAccessibility();
        return $body;
    }
}
css.addStyle(`
  .zenzaWatchVideoInfoPanel .tabs:not(.activeTab) {
    display: none;
    pointer-events: none;
    overflow: hidden;
  }

  .zenzaWatchVideoInfoPanel .tabs.activeTab {
    margin-top: 32px;
    box-sizing: border-box;
    position: relative;
    width: 100%;
    height: calc(100% - 32px);
    overflow-x: hidden;
    overflow-y: visible;
    overscroll-behavior: none;
    text-align: left;
  }
  .zenzaWatchVideoInfoPanel .tabs.relatedVideoTab.activeTab {
    overflow: hidden;
  }

  .zenzaWatchVideoInfoPanel .tabs:not(.activeTab) {
    display: none !important;
    pointer-events: none;
    opacity: 0;
  }

  .zenzaWatchVideoInfoPanel .tabSelectContainer {
    position: absolute;
    display: flex;
    height: 32px;
    z-index: 100;
    width: 100%;
    white-space: nowrap;
    user-select: none;
  }

  .zenzaWatchVideoInfoPanel .tabSelect {
    flex: 1;
    box-sizing: border-box;
    display: inline-block;
    height: 32px;
    font-size: 12px;
    letter-spacing: 0;
    line-height: 32px;
    color: var(--zt-text-inverse, #666);
    background: var(--zt-surface-1, #222);
    cursor: pointer;
    text-align: center;
    transition: text-shadow 0.2s ease, color 0.2s ease;
  }
  .zenzaWatchVideoInfoPanel .tabSelect:focus-visible {
    outline: 2px solid var(--zt-info, #9cf);
    outline-offset: -2px;
  }

  .zenzaWatchVideoInfoPanel .tabSelect.activeTab {
    font-size: 14px;
    letter-spacing: 0.1em;
    color: var(--zt-text-1, #ccc);
    background: var(--zt-surface-2, #333);
  }

  .zenzaWatchVideoInfoPanel .tabSelect.blink:not(.activeTab) {
    color: var(--zt-text-0, #fff);
    text-shadow: 0 0 4px var(--zt-accent, #ff9);
    transition: none;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel.is-notFullscreen .tabSelect.blink:not(.activeTab) {
    color: var(--zt-text-0, #fff);
    text-shadow: 0 0 4px var(--zt-info-strong, #006);
    transition: none;
  }

  .zenzaWatchVideoInfoPanel .tabSelect:not(.activeTab):hover {
    background: var(--zt-surface-3, #888);
  }

  .zenzaWatchVideoInfoPanel.initializing {
  }

  .zenzaWatchVideoInfoPanel>* {
    transition: opacity 0.4s ease;
    pointer-events: none;
  }

  .is-mouseMoving .zenzaWatchVideoInfoPanel>*,
                .zenzaWatchVideoInfoPanel:hover>* {
    pointer-events: auto;
  }


  .zenzaWatchVideoInfoPanel.initializing>* {
    opacity: 0;
    color: var(--zt-text-inverse, #333);
    transition: none;
  }

  /* A failed video's metadata must stay hidden, but the saved playlist is
     independent of that video and remains a route to another item. */
  .zenzaWatchVideoInfoPanel.is-loadFailed>:not(.tabSelectContainer):not(.playlist),
  .zenzaWatchVideoInfoPanel.is-loadFailed .tabSelect:not(.playlist) {
    display: none !important;
  }
  .zenzaWatchVideoInfoPanel.is-loadFailed>.tabSelectContainer,
  .zenzaWatchVideoInfoPanel.is-loadFailed>.playlist {
    pointer-events: auto;
  }

  .zenzaWatchVideoInfoPanel {
    position: absolute;
    top: 0;
    width: 320px;
    height: 100%;
    box-sizing: border-box;
    z-index: 25000;
    background: var(--zt-surface-2, #333);
    color: var(--zt-text-1, #ccc);
    overflow-x: hidden;
    overflow-y: hidden;
    transition: opacity 0.4s ease;
  }

  .zenzaWatchVideoInfoPanel .ownerPageLink {
    display: block;
    margin: 0 auto 8px;
    width: 104px;
  }

  .zenzaWatchVideoInfoPanel .ownerIcon {
    width: 96px;
    height: 96px;
    border: none;
    border-radius: 4px;
    transition: opacity 1s ease;
    vertical-align: middle;
  }
  .zenzaWatchVideoInfoPanel .ownerIcon.is-loading {
    opacity: 0;
  }

  .zenzaWatchVideoInfoPanel .ownerName {
    font-size: 20px;
    word-break: break-all;
  }

  .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer {
    padding: 16px;
    display: table;
    width: 100%;
  }

  .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer>*{
    display: block;
    vertical-align: middle;
    text-align: center;
  }

  .zenzaWatchVideoInfoPanel .videoDescription {
    padding: 8px 8px 8px;
    margin: 4px 0px;
    word-break: break-all;
    line-height: 1.5;
  }

  .zenzaWatchVideoInfoPanel .videoDescription a {
    display: inline-block;
    font-weight: bold;
    text-decoration: none;
    color: var(--zt-accent, #ff9);
    padding: 2px;
  }
  .zenzaWatchVideoInfoPanel .videoDescription a:visited {
    color: var(--zt-accent-soft, #ffd);
  }

  .zenzaWatchVideoInfoPanel .videoDescription .watch {
    display: block;
    position: relative;
    line-height: 60px;
    box-sizing: border-box;
    padding: 4px 16px;;
    min-height: 60px;
    width: 272px;
    margin: 8px 10px;
    background: var(--zt-surface-2, #444);
    border-radius: 4px;
  }
  .zenzaWatchVideoInfoPanel .videoDescription .watch:hover {
    background: var(--zt-info-strong, #446);
  }

  .videoDescription-font[style*="color"] {
    text-shadow:
      0 -1px 2px var(--base-description-color, #888),
      1px 0 2px var(--base-description-color, #888),
      0 1px 2px var(--base-description-color, #888),
      -1px 0 2px var(--base-description-color, #888);
  }

  .zenzaWatchVideoInfoPanel .videoDescription .mylistLink,
  .zenzaWatchVideoInfoPanel .videoDescription .seriesLink {
    white-space: nowrap;
    display: inline-block;
  }

  .zenzaWatchVideoInfoPanel:not(.is-pocketReady) .pocket-info {
    display: none !important;
  }
  .pocket-info {
    font-family: Menlo;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend,
  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetMylist,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetSeries,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetNicodic,
  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetUploadedVideo {
    display: inline-block;
    font-size: 16px;
    line-height: 20px;
    width: 24px;
    height: 24px;
    background: var(--zt-surface-3, #666);
    color: var(--zt-text-1, #ccc) !important;
    background: var(--zt-surface-3, #666);
    text-decoration: none;
    border: 1px outset;
    cursor: pointer;
    text-align: center;
    user-select: none;
    margin-left: 8px;
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend,
  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info,
  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd {
    display: none;
  }
  /*
   * Task1042/1043: ▶ の横の「投稿動画だけ」「ショートだけ」。▶ にマウスを乗せると出てきて、そのまま残る。
   * ボタンは ▶ を基準に重ねて置く（position:absolute）ので、出る前も出た後も名前の行の幅・位置は変わらない。
   * 形と位置は data-kinds-style で切り替える（stack / square / shape / below / off）。案を増やす時はここに1組足す。
   */
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoAnchor {
    position: relative;
    display: inline-block;
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds {
    position: absolute;
    z-index: 2;
    display: flex;
    gap: 4px;
    left: calc(100% + 6px);
    top: 50%;
    transform: translate(-6px, -50%);
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease, visibility 0s linear 0.2s;
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds.is-revealed {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
    transform: translate(0, -50%);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="off"] { display: none; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKind {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 24px;
    height: 24px;
    background: var(--zt-surface-2, #444);
    color: var(--zt-text-1, #ddd);
    border: 1px solid var(--zt-border, #777);
    border-radius: 3px;
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    user-select: none;
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKind:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKind:focus-visible {
    background: var(--zt-surface-3, #666);
    color: var(--zt-text-0, #fff);
    border-color: var(--zt-border-light, #bbb);
    outline: none;
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKind:active { transform: scale(0.92); }
  /* 中身の記号（文字は出さない）。投稿動画=映画、ショート=縦長の画面 */
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKind.is-long::before { content: '🎬'; font-size: 12px; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKind.is-short::before { content: '📱'; font-size: 12px; }
  /* stack（既定）: ▶ の右に小さく縦2段。見た目は小さいが、押せる範囲は ::after で上下左右に広げる */
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="stack"] { flex-direction: column; gap: 2px; left: calc(100% + 4px); }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="stack"] .ownerVideoKind { width: 20px; height: 12px; border-radius: 2px; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="stack"] .ownerVideoKind::after {
    content: ''; position: absolute; inset: -2px -6px;
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="stack"] .ownerVideoKind.is-long::before { content: '▶'; font-size: 7px; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="stack"] .ownerVideoKind.is-short::before { content: '▯'; font-size: 9px; }
  /* shape: 横長の枠=投稿動画、縦長の枠=ショート */
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="shape"] { align-items: center; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="shape"] .ownerVideoKind.is-long { width: 30px; height: 18px; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="shape"] .ownerVideoKind.is-short { width: 16px; height: 26px; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="shape"] .ownerVideoKind::before { content: '▶'; font-size: 8px; }
  /* row（既定）: 名前の下の段の中央に「動画」「ショート」の札。段の場所は最初から空けておき、出ても下の内容は動かない */
  .zenzaWatchVideoInfoPanel .videoInfoTab .owner[data-kinds-style="row"] { position: relative; padding-bottom: 30px; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .owner[data-kinds-style="row"] .ownerVideoAnchor { position: static; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="row"] {
    left: 50%; top: auto; bottom: 2px; gap: 6px; transform: translate(-50%, -4px);
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="row"].is-revealed { transform: translate(-50%, 0); }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="row"] .ownerVideoKind {
    width: auto; height: 22px; padding: 0 10px; border-radius: 11px; font-size: 12px; white-space: nowrap;
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="row"] .ownerVideoKind.is-long::before { content: '▭ 動画'; font-size: 12px; }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="row"] .ownerVideoKind.is-short::before { content: '▯ ショート'; font-size: 12px; }
  /* below: ▶ の真下に丸いボタン（横にはみ出さない） */
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="below"] { left: 50%; top: calc(100% + 6px); transform: translate(-50%, -6px); }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="below"].is-revealed { transform: translate(-50%, 0); }
  .zenzaWatchVideoInfoPanel .videoInfoTab .ownerVideoKinds[data-kinds-style="below"] .ownerVideoKind { border-radius: 50%; }

  .zenzaWatchVideoInfoPanel .videoInfoTab .owner:hover .playlistAppend,
  .zenzaWatchVideoInfoPanel .videoInfoTab .watch:hover .playlistAppend,
  .zenzaWatchVideoInfoPanel .videoInfoTab .watch:hover .pocket-info,
  .zenzaWatchVideoInfoPanel .videoInfoTab .watch:hover .deflistAdd {
    display: inline-block;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend {
    position: absolute;
    bottom: 4px;
    left: 16px;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info {
    position: absolute;
    bottom: 4px;
    left: 48px;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd {
    position: absolute;
    bottom: 4px;
    left: 80px;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetMylist:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetSeries:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetNicodic:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetUploadedVideo:hover {
    transform: scale(1.5);
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetMylist:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetSeries:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetNicodic:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetUploadedVideo:active {
    transform: scale(1.2);
    border: 1px inset;
  }


  .zenzaWatchVideoInfoPanel .videoDescription .watch .videoThumbnail {
    position: absolute;
    right: 16px;
    height: 60px;
    pointer-events: none;
  }
  .zenzaWatchVideoInfoPanel .videoDescription:hover .watch .videoThumbnail {
    filter: none;
  }



  .zenzaWatchVideoInfoPanel .publicStatus,
  .zenzaWatchVideoInfoPanel .videoTagsContainer {
    display: none;
  }

  .zenzaWatchVideoInfoPanel .publicStatus {
    display: none;
    position: relative;
    margin: 8px 0;
    padding: 8px;
    line-height: 150%;
    text-align: center;
    color: var(--zt-text-inverse, #333);
  }

  .zenzaWatchVideoInfoPanel .videoMetaInfoContainer {
    display: inline-block;
    padding: 0 8px;
  }

  .zenzaWatchVideoInfoPanel .relatedVideoTab .relatedVideoContainer {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    height: 100%;
    margin: 0;
    user-select: none;
  }

  .zenzaWatchVideoInfoPanel .videoListFrame,
  .zenzaWatchVideoInfoPanel .commentListFrame {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 0;
    background: var(--zt-surface-2, #333);
  }

  .zenzaWatchVideoInfoPanel .nowLoading {
    display: none;
    opacity: 0;
    pointer-events: none;
  }
  .zenzaWatchVideoInfoPanel.initializing .nowLoading {
    display: block !important;
    opacity: 1 !important;
    color: var(--zt-text-2, #888);
  }
  .zenzaWatchVideoInfoPanel .nowLoading {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }
  .zenzaWatchVideoInfoPanel .kurukuru {
    position: absolute;
    display: inline-block;
    font-size: 96px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }

  @keyframes loadingRolling {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(1800deg); }
  }
  .zenzaWatchVideoInfoPanel.initializing .kurukuruInner {
    display: inline-block;
    pointer-events: none;
    text-align: center;
    text-shadow: 0 0 4px var(--zt-glow-light, #888);
    animation-name: loadingRolling;
    animation-iteration-count: infinite;
    animation-duration: 4s;
  }
  .zenzaWatchVideoInfoPanel .nowLoading .loadingMessage {
    position: absolute;
    display: inline-block;
    font-family: Impact;
    font-size: 32px;
    text-align: center;
    top: calc(50% + 48px);
    left: 0;
    width: 100%;
  }

  ${CONSTANT.SCROLLBAR_CSS}

  .zenzaWatchVideoInfoPanel .zenzaWatchVideoInfoPanelInner {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
    .zenzaWatchVideoInfoPanelContent {
      flex: 1;
    }

  .zenzaTubeButton {
    display: inline-block;
    padding: 4px 8px;
    cursor: pointer;
    background: var(--zt-surface-3, #666);
    color: var(--zt-text-1, #ccc);
    border-radius: 4px;
    border: 1px outset;
    margin: 0 8px;
  }
  .zenzaTubeButton:hover {
    box-shadow: 0 0 8px var(--zt-glow-light, #fff), 0 0 4px var(--zt-glow-light, #ccc);
  }
    .zenzaTubeButton span {
      pointer-events: none;
      display: inline-block;
      background: var(--zt-surface-mid, #ccc);
      color: var(--zt-text-inverse, #333);
      border-radius: 4px;
    }
    .zenzaTubeButton:hover span {
      background: var(--zt-danger, #f33);
      color: var(--zt-text-1, #ccc);
    }
  .zenzaTubeButton:active {
    box-shadow:  0 0 2px var(--zt-glow-light, #ccc), 0 0 4px var(--zt-shadow, #000) inset;
    border: 1px inset;
  }

  .zenzaWatchVideoInfoPanel .relatedInfoMenuContainer {
    text-align: left;
  }

  .zenzaWatchVideoInfoPanel .seriesList {
    padding: 0 8px;
  }

  /* Task 074: いいね！のお礼メッセージ */
  .zenzaWatchVideoInfoPanel .likeThanksMessage {
    margin: 8px;
    padding: 8px 10px;
    border: 1px solid var(--zt-danger, #a66);
    border-radius: 8px;
    background: var(--zt-special-translucent, rgba(60, 30, 40, 0.6));
    color: var(--zt-text-0, #eee);
    font-size: 13px;
    user-select: text;
    -webkit-user-select: text;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-title {
    flex: 1 1 auto;
    color: var(--zt-danger, #f9a);
    font-weight: bold;
    font-size: 12px;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-copy,
  .zenzaWatchVideoInfoPanel .likeThanksMessage-close {
    flex: 0 0 auto;
    padding: 2px 8px;
    border: 1px solid var(--zt-border, #888);
    border-radius: 6px;
    background: var(--zt-surface-2, #333);
    color: var(--zt-text-1, #ddd);
    font-size: 12px;
    cursor: pointer;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-copy:hover,
  .zenzaWatchVideoInfoPanel .likeThanksMessage-close:hover {
    background: var(--zt-surface-3, #555);
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-body {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-body a {
    color: var(--zt-info, #9cf);
  }

  zenza-video-item,
  zenza-video-series-label,
  zenza-vieo-description,
  .UaaView {
    content-visibility: auto;
  }

  `, { className: 'videoInfoPanel' });
css.addStyle(`
  .is-open .zenzaWatchVideoInfoPanel>* {
    display: none;
    pointer-events: none;
  }
  .zenzaWatchVideoInfoPanel:hover>* {
    display: inherit;
    pointer-events: auto;
  }
  .zenzaWatchVideoInfoPanel:hover .tabSelectContainer {
    display: flex;
  }

  .zenzaWatchVideoInfoPanel {
    top: 20%;
    right: calc(32px - 320px);
    left: auto;
    width: 320px;
    height: 60%;
    border: 1px solid transparent;
    background: none;
    opacity: 0;
    box-shadow: none;
    transition: opacity 0.4s ease, transform 0.4s ease 1s;
    will-change: opacity, transform;
  }

  .is-mouseMoving  .zenzaWatchVideoInfoPanel {
    border: 1px solid var(--zt-border, #888);
    opacity: 0.5;
  }

  .zenzaWatchVideoInfoPanel.is-slideOpen,
  .zenzaWatchVideoInfoPanel:hover {
    background: var(--zt-surface-2, #333);
    box-shadow: 4px 4px 4px var(--zt-shadow, #000);
    border: none;
    opacity: 0.9;
    transform: translate3d(-288px, 0, 0);
    transition: opacity 0.4s ease, transform 0.4s ease 1s;
  }

`, { className: 'screenMode for-full videoInfoPanel' });
css.addStyle(`
  .zenzaScreenMode_small .zenzaWatchVideoInfoPanel {
    display: none;
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .tabSelectContainer {
    width: calc(100% - 16px);
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .tabSelect {
    background: var(--zt-surface-mid, #ccc);
    color: var(--zt-text-2, #888);
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .tabSelect.activeTab {
    background: var(--zt-surface-light, #ddd);
    color: black;
    border: none;
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel {
    top: 230px;
    left: 0;
    width: ${CONSTANT.SIDE_PLAYER_WIDTH}px;
    height: calc(100vh - 296px);
    bottom: 48px;
    padding: 8px;
    box-shadow: none;
    background: var(--zt-surface-light, #f0f0f0);
    color: var(--zt-text-inverse, #000);
    border: 1px solid var(--zt-border-dark, #333);
    margin: 4px 2px;
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .publicStatus {
    display: block;
    text-align: center;
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoDescription a {
    color: var(--zt-info-strong, #006699);
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoDescription a:visited {
    color: var(--zt-text-inverse, #666666);
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoTagsContainer {
    display: block;
    bottom: 48px;
    width: 364px;
    margin: 0 auto;
    padding: 8px;
    background: var(--zt-surface-mid, #ccc);
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoDescription .watch {
    background: var(--zt-surface-light, #ddd);
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoDescription .watch:hover {
    background: var(--zt-info-soft, #ddf);
  }

  .zenzaScreenMode_sideView .videoInfoTab::-webkit-scrollbar {
    background: var(--zt-surface-light, #f0f0f0);
  }

  .zenzaScreenMode_sideView .videoInfoTab::-webkit-scrollbar-thumb {
    border-radius: 0;
    background: var(--zt-surface-mid, #ccc);
  }
`, { className: 'screenMode for-popup videoInfoPanel' });
uq.ready().then(() => {
    if (document.body.classList.contains('MatrixRanking-body')) {
        css.addStyle(`
      body.zenzaScreenMode_sideView.MatrixRanking-body .RankingRowRank {
        line-height: 48px;
        height: 48px;
        pointer-events: none;
        user-select: none;
      }
      body.zenzaScreenMode_sideView.MatrixRanking-body .RankingRowRank {
        position: sticky;
        left: calc(var(--sideView-left-margin) - 8px);
        z-index: 100;
        transform: none;
        padding-right: 16px;
        width: 64px;
        overflow: visible;
        text-align: right;
        mix-blend-mode: difference;
        text-shadow:
          1px  1px 0 #fff,
          1px -1px 0 #fff,
          -1px  1px 0 #fff,
          -1px -1px 0 #fff;
      }
      body.zenzaScreenMode_sideView.MatrixRanking-body .BaseLayout-block {
        width: ${1024 + 64 * 2}px;
      }
      .RankingMainContainer-decorateChunk+.RankingMainContainer-decorateChunk,
      .RankingMainContainer-decorateChunk>*+* {
        margin-top: 0;
      }
      body.zenzaScreenMode_sideView .RankingMainContainer {
        width: ${1024}px;
      }
      body.zenzaScreenMode_sideView.MatrixRanking-body .RankingMatrixVideosRow {
        width: ${1024 + 64}px;
        margin-left: ${-64}px;
      }
        .RankingGenreListContainer-categoryHelp {
          position: static;
        }
        .RankingMatrixNicoadsRow>*+*,
        .RankingMatrixVideosRow>:nth-child(n+3) {
          margin-left: 13px;
        }
        .RankingBaseItem {
          width: 160px;
          height: 196px;
        }
          body.zenzaScreenMode_sideView .RankingBaseItem .Card-link {
            grid-template-rows: 90px auto;
          }
          .VideoItem.RankingBaseItem .VideoThumbnail {
            border-radius: 3px 3px 0 0;
          }

          [data-nicoad-grade] .Thumbnail.VideoThumbnail .Thumbnail-image {
            margin: 3px;
            background-size: calc(100% + 6px);
          }
          [data-nicoad-grade] .Thumbnail.VideoThumbnail:after {
            width: 40px;
            height: 40px;
            background-size: 80px 80px;
          }
          .Thumbnail.VideoThumbnail .VideoLength {
            bottom: 3px;
            right: 3px;
          }
          .VideoThumbnailComment {
            transform: scale(0.8333);
          }
          .RankingBaseItem-meta {
            position: static;
            padding: 0 4px 8px;
          }
          .VideoItem.RankingBaseItem .VideoItem-metaCount>.VideoMetaCount {
            white-space: nowrap;
          }
      .RankingMainContainer .ToTopButton {
        transform: translateX(calc(100vw / 2 - 100% - 36px));
        user-select: none;
      }
    `, { className: 'screenMode for-sideView MatrixRanking', disabled: true });
    }
});
css.addStyle(`
  .is-open .zenzaWatchVideoInfoPanel {
    display: none;
    left: calc(100%);
    top: 0;
  }

  @media screen {
    @media (min-width: 992px) {
      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanel {
        display: inherit;
      }
    }

    @media (min-width: 1216px) {
      .zenzaScreenMode_big .zenzaWatchVideoInfoPanel {
        display: inherit;
      }
    }

    /* 縦長モニター */
    @media
      (width < 992px) and (min-height: 700px) and (aspect-ratio < 4/3)
    {
      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanel {
        display: inherit;
        top: 100%;
        left: 0;
        width: 100%;
        height: ${CONSTANT.BOTTOM_PANEL_HEIGHT}px;
        z-index: 20000;
      }

      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanelFoot .infoPanelFootSpacer {
        height: 96px;
      }

      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer {
        display: table;
      }
      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer>* {
        display: table-cell;
        text-align: left;
      }
      .zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel {
        width: 100% !important;
      }
    }

    @media
      (width < 1216px) and (min-height: 700px) and (aspect-ratio < 4/3) {
      .zenzaScreenMode_big .zenzaWatchVideoInfoPanel {
        display: inherit;
        top: 100%;
        left: 0;
        width: 100%;
        height: ${CONSTANT.BOTTOM_PANEL_HEIGHT}px;
        z-index: 20000;
      }

      .zenzaScreenMode_big .zenzaWatchVideoInfoPanelFoot .infoPanelFootSpacer {
        height: 96px;
      }

      .zenzaScreenMode_big .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer {
        display: table;
      }
      .zenzaScreenMode_big .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer>* {
        display: table-cell;
        text-align: left;
      }

      .zenzaScreenMode_big .zenzaWatchVideoHeaderPanel {
        width: 100% !important;
      }
    }
  }

  /* Task1039: 幅が足りないだけの横長の画面でも、情報パネルは動画の右に置く（下パネルにしない） */
  @media screen and (min-width: 640px) and (aspect-ratio >= 4/3) {
    @media (width < 992px) {
      body.zenzaScreenMode_normal .zenzaWatchVideoInfoPanel {
        display: inherit;
      }
    }
    @media (width < 1216px) {
      body.zenzaScreenMode_big .zenzaWatchVideoInfoPanel {
        display: inherit;
      }
    }
  }

  /* Short viewports: retain the native video information/comment tabs
     beside the proportionally resized player, without introducing a drawer. */
  @media screen and (height < 700px) {
    @media (min-width: 640px) and (width < 992px) {
      body.zenzaScreenMode_normal .zenzaWatchVideoInfoPanel {
        display: inherit;
      }
    }
    @media (min-width: 640px) and (width < 1216px) {
      body.zenzaScreenMode_big .zenzaWatchVideoInfoPanel {
        display: inherit;
      }
    }
    @media (width < 640px) {
      body.zenzaScreenMode_normal .zenzaWatchVideoInfoPanel,
      body.zenzaScreenMode_big .zenzaWatchVideoInfoPanel {
        display: inherit;
        top: 100%;
        left: 50%;
        width: min(480px, 100vw);
        height: min(240px, 35vh);
        transform: translateX(-50%);
        z-index: 20000;
      }
      body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel,
      body.zenzaScreenMode_big .zenzaWatchVideoHeaderPanel {
        width: 100% !important;
      }
    }
  }
`, { className: 'screenMode for-dialog videoInfoPanel' });
css.addStyle(`
  .zenzaWatchVideoInfoPanel .comment {
    padding-left: 0;
  }
`, { className: 'domain slack-com', disabled: true });
VideoInfoPanel.__tpl__ = (`
    <div class="zenzaWatchVideoInfoPanel show initializing">
      <div class="nowLoading">
        <div class="kurukuru"><span class="kurukuruInner">&#x262F;</span></div>
        <div class="loadingMessage">Loading...</div>
      </div>

      <div class="tabSelectContainer"><div class="tabSelect videoInfoTab activeTab" data-command="selectTab" data-param="videoInfoTab">動画情報</div><div class="tabSelect relatedVideoTab" data-command="selectTab" data-param="relatedVideoTab">関連動画</div></div>

      <div class="tabs videoInfoTab activeTab">
        <div class="zenzaWatchVideoInfoPanelInner">
          <div class="zenzaWatchVideoInfoPanelContent">
            <div class="videoOwnerInfoContainer">
              <a class="ownerPageLink" rel="noopener" target="_blank">
                <img class="ownerIcon loading"/>
              </a>
              <span class="owner">
                <span class="ownerName"></span>
                <span class="ownerVideoAnchor">
                  <zenza-playlist-append class="playlistSetUploadedVideo userVideo"
                    data-command="ownerVideo"
                    title="投稿動画一覧をプレイリストで開く（動画とショートの両方。投稿日時の順）">▶</zenza-playlist-append>
                  <span class="ownerVideoKinds" data-kinds-style="row" role="group" aria-label="種類を選んで投稿動画一覧を開く">
                    <span class="ownerVideoKind is-long" data-command="ownerVideoLong" role="button" tabindex="0"
                      title="投稿動画だけをプレイリストで開く（ショートを除く）" aria-label="投稿動画だけ"></span>
                    <span class="ownerVideoKind is-short" data-command="ownerVideoShort" role="button" tabindex="0"
                      title="投稿ショート動画だけをプレイリストで開く" aria-label="投稿ショート動画だけ"></span>
                  </span>
                </span>
              </span>
            </div>
            <div class="publicStatus">
              <div class="videoMetaInfoContainer"></div>
              <div class="relatedInfoMenuContainer"></div>
            </div>
            <div class="seriesList"></div>
            <div class="videoDescription"></div>
          </div>
          <div class="zenzaWatchVideoInfoPanelFoot">
            <div class="uaaContainer"></div>

            <div class="likeMessageContainer"></div>

            <div class="infoPanelFootSpacer"></div>

            <div class="videoTagsContainer sideTab"></div>
          </div>
        </div>
      </div>

      <div class="tabs relatedVideoTab">
        <div class="relatedVideoContainer"></div>
      </div>

    </div>
  `).trim();
//===END===
export {
  VideoInfoPanel
};
