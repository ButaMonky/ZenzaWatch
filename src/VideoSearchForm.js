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
// GENERATED FROM tools/typescript-stage1/nico-src/VideoSearchForm.ts (Task1063). Edit the .ts and run npm run nico:sync.
//===BEGIN===
class VideoSearchForm extends Emitter {
    constructor(...args) {
        super();
        this._config = Config.namespace('videoSearch');
        this._initDom(...args);
    }
    _initDom({ parentNode }) {
        let tpl = document.getElementById('zenzaVideoSearchPanelTemplate');
        if (!tpl) {
            cssUtil.addStyle(VideoSearchForm.__css__);
            tpl = document.createElement('template');
            tpl.innerHTML = VideoSearchForm.__tpl__;
            tpl.id = 'zenzaVideoSearchPanelTemplate';
        }
        const view = document.importNode(tpl.content, true);
        this._view = view.querySelector('*');
        this._form = view.querySelector('form');
        this._word = view.querySelector('.searchWordInput');
        this._videoIdBox = view.querySelector('.searchVideoIdResult');
        this._videoIdList = view.querySelector('.searchVideoIdResult-list');
        // Task 068: 並び順は「キー」と「昇順/降順」の2つのselectに分けた（本家と同じ9種類）。
        // 保存形式は従来通り videoSearch.sort に "キー" または "キー,a|d"（"playlist"は自動）。
        this._sortKey = view.querySelector('.searchSortKeySelect');
        this._sortOrder = view.querySelector('.searchOrderSelect');
        this._mode = view.querySelector('.searchMode') || 'tag';
        this._form.addEventListener('submit', this._onSubmit.bind(this));
        const config = this._config;
        const form = this._form;
        // Task 073: 「再生中の動画の投稿者の動画のみ」。以前はdisabledのまま（取り消し線付きで
        // チェックできない状態）だった。誤って絞り込んだまま検索し続けないよう、開くたびにOFFへ戻す。
        // 将来この項目をテンプレートから削除しても動くよう、要素が無い場合は何もしない。
        config.props.ownerOnly = false;
        const ownerOnlyInput = this._ownerOnlyInput;
        if (ownerOnlyInput) {
            ownerOnlyInput.checked = false;
        }
        const confMode = config.props.mode;
        if (typeof confMode === 'string' && ['tag', 'keyword'].includes(confMode)) {
            form['mode'].value = confMode;
        }
        else if (typeof confMode === 'boolean') {
            form['mode'].value = confMode ? 'tag' : 'keyword';
        }
        else {
            form['mode'].value = 'tag';
        }
        form['word'].value = config.props.word;
        this._applySortValue(config.props.sort);
        form['f_range'].value = `${config.props.f_range || 0}`;
        form['l_range'].value = `${config.props.l_range || 0}`;
        form['selectContentType'].value = config.props.selectContentType === 'short' ? 'short' : 'long';
        this._syncContentTypeControls();
        config.on?.('selectContentType', (value) => {
            form['selectContentType'].value = value === 'short' ? 'short' : 'long';
            this._syncContentTypeControls();
            this._refreshWordCountsAfterFilterChange();
        });
        form['genre'].value = config.props.genre || 'all';
        if (!form['genre'].value) {
            form['genre'].value = 'all';
        }
        // Task 073: 以前の「入力欄の下に出る小さなタグ候補リスト」(_initSuggest)は廃止し、
        // 普通の単語でも動画ID入力時と同じ「検索（件数）＋タグ予測」の枠で表示する。
        this._initVideoIdPreview();
        this._view.addEventListener('click', this._onClick.bind(this));
        // Task 071: 以前は DocumentFragment（view）に付けていたため一度も発火せず、
        // 検索欄への貼り付けがプレイヤー全体の貼り付け処理（動画IDならすぐ開く）へ伝わっていた。
        // 検索欄の中の貼り付けは、ここで止めて検索欄の下に動画を表示する。
        this._view.addEventListener('paste', (e) => e.stopPropagation());
        const submit = _.debounce(this.submit.bind(this), 500);
        Array.from(view.querySelectorAll('input, select')).forEach(item => {
            if (item.type === 'checkbox') {
                item.addEventListener('change', () => {
                    this._word.focus();
                    config.props[item.name] = item.checked;
                    submit();
                });
            }
            else if (item.type === 'radio') {
                item.addEventListener('change', () => {
                    this._word.focus();
                    config.props[item.name] = this._form[item.name].value;
                    if (item.name === 'selectContentType') {
                        this._syncContentTypeControls();
                        this._refreshWordCountsAfterFilterChange();
                    }
                    // Task1039: 「キーワード／タグ」「動画／ショート」の切り替えだけでは検索しない
                    // （語を入れ直す前に勝手に検索されて困るため）。検索ボタンか Enter で検索する。
                    if (item.name === 'mode' || item.name === 'selectContentType') {
                        return;
                    }
                    submit();
                });
            }
            else if (item.name === 'sortKey' || item.name === 'sortOrder') {
                item.addEventListener('change', () => {
                    config.props.sort = this._composeSortValue();
                    this._updateOrderState();
                    submit();
                });
            }
            else {
                item.addEventListener('change', () => {
                    config.props[item.name] = item.value;
                    if (item.name === 'selectContentType') {
                        this._syncContentTypeControls();
                    }
                    if (item.tagName === 'SELECT') {
                        submit();
                    }
                });
            }
        });
        // Task 074: ヘッダーのジャンルバッジから、検索欄のジャンル絞り込みを設定する
        global.emitter.on('setSearchGenre', (key) => {
            const genreSelect = this._form.elements.namedItem('genre');
            if (!genreSelect) {
                return;
            }
            const value = key && Array.from(genreSelect.options).some(o => o.value === key) ? key : 'all';
            genreSelect.value = value;
            config.props.genre = value;
            const label = genreSelect.options[genreSelect.selectedIndex];
            domEvent.dispatchCommand(this._view, 'notify', value === 'all' ?
                'ジャンルの絞り込みを解除しました' :
                `検索のジャンルを「${label ? label.textContent : value}」に設定しました`);
            this._word.focus();
            this._refreshWordCountsAfterFilterChange();
        });
        global.emitter.on('searchVideo', ({ word }) => {
            form['word'].value = word;
            // Task 073: 検索が実行された語は、次に入力を変えるまで予測枠を出さない
            // （タグのクリック等で検索した時に、裏で予測や件数の問い合わせが走らないように）
            this._videoIdDismissedKey = this._videoIdKeyOf(word);
            this._updateVideoIdPreview();
        });
        if (parentNode) {
            parentNode.appendChild(view);
        }
        // Keep one viewport-bounded scroll container, including the filters.
        const fitSearch = () => this._updateFocus();
        this._view.addEventListener('focusin', fitSearch);
        // Task1040: マウスを乗せた時点で、画面の上にはみ出していないか確かめる
        this._view.addEventListener('pointerenter', () => this._keepSearchPanelInView());
        // A label's mousedown normally blurs the input before activating its radio.
        // Keep focus within the panel through that native click, without hover-opening it.
        this._view.querySelector('.searchInputHead').addEventListener('mousedown', (event) => {
            if (event.button === 0 && event.target.closest('.searchModeLabel')) {
                event.preventDefault();
            }
        });
        window.addEventListener('resize', fitSearch);
        window.visualViewport?.addEventListener('resize', fitSearch);
        if (parentNode) {
            parentNode.addEventListener('transitionend', fitSearch);
            if (typeof ResizeObserver !== 'undefined') {
                const observer = new ResizeObserver(fitSearch);
                observer.observe(parentNode);
            }
        }
        global.debug.searchForm = this;
    }
    /*
     * Task 071: 検索欄に動画ID（sm/nm/so + 数字、視聴URL、nico.ms 短縮URL）を入力・貼り付けすると、
     * すぐに開くのではなく、検索欄の下にその動画のカードをアニメーション付きで表示する。
     * - 手入力でも貼り付けでも動く（input イベントで判定）
     * - 空白・読点・改行区切りで最大5件まで同時に表示（全部が動画IDの時だけ。1つでも普通の語があれば通常の検索扱い）
     * - カードのクリック/▶再生/Enter で開く。次に再生・末尾に追加・あとで見るも可能
     * - ↑↓でカードを選択、Esc で閉じる（入力を変えると再表示）
     */
    static parseVideoIds(text) {
        return VideoSearchForm.parseVideoIdInput(text).ids;
    }
    /*
     * Task 071 追加: sm114514 のように「動画IDでありながらタグ（検索語）としても使われる単語」がある。
     * そのため、URLを含まない素の動画IDだけの入力（bare）は、動画カードを出しつつ検索語としても扱う
     * （Enter/▶ は通常の検索、カードのクリックや ↓ で選んで Enter / Shift+Enter で再生）。
     * 視聴URL・nico.ms など検索語になり得ない形が含まれる時だけ、Enter で動画を開く。
     */
    static parseVideoIdInput(text) {
        const src = String(text || '').trim();
        const empty = { ids: [], bare: false };
        if (!src) {
            return empty;
        }
        const tokens = src.split(/[\s,、，　]+/).filter(Boolean);
        const ids = [];
        let bare = true;
        for (const token of tokens) {
            const m = VideoSearchForm.VIDEO_ID_REG.exec(token);
            if (!m) {
                return empty;
            }
            if (token.length !== m[1].length) {
                bare = false;
            }
            const id = m[1].toLowerCase();
            ids.includes(id) || ids.push(id);
        }
        return { ids: ids.slice(0, VideoSearchForm.MAX_VIDEO_ID_CARDS), bare };
    }
    _initVideoIdPreview() {
        this._videoIdKey = '';
        this._videoIdDismissedKey = '';
        this._videoIdCards = new Map();
        this._videoIdBare = false;
        this._videoIdNavKey = '';
        this._videoIdTagWord = '';
        this._videoIdTagSeq = 0;
        this._videoIdTagsElm = this._videoIdBox ? this._videoIdBox.querySelector('.searchVideoIdResult-tags') : null;
        this._wordCountCache = new Map();
        this._wordCountSeq = 0;
        this._autoTagCountGeneration = 0;
        const input = this._word, box = this._videoIdBox;
        if (!input || !box) {
            return;
        }
        const update = _.debounce(() => this._updateVideoIdPreview(), 120);
        input.addEventListener('input', () => update());
        input.addEventListener('compositionend', () => update());
        input.addEventListener('paste', () => window.setTimeout(() => this._updateVideoIdPreview(), 0));
        input.addEventListener('keydown', (e) => this._onVideoIdKeyDown(e), true);
        /*
         * Task 074: 「入力欄を触っているのに予測が出ない」ことがある件の対処。
         * 検索を実行した語・Escで閉じた語は、入力を変えるまで再表示しない作りにしていた
         * （裏で予測や件数を何度も取りに行かないようにするため）。そのため
         * 「検索した後にもう一度入力欄をクリックした」「起動直後で前回の語が入っている」
         * 場合に何も出ず、分かりづらかった。
         * 入力欄にフォーカスし直した時と、↓キーを押した時は、もう一度出すようにする。
         */
        input.addEventListener('focus', () => {
            if (this._videoIdDismissedKey && this.word) {
                this._videoIdDismissedKey = '';
                this._videoIdKey = '';
                this._updateVideoIdPreview();
            }
        });
        // ボタンを押しても入力欄からフォーカスが外れない（外れるとパネルごと閉じる）ようにする
        box.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                e.preventDefault();
            }
        });
        // Hover is an explicit request in low-traffic mode; the default search-row
        // selection during ordinary typing does not trigger a count request.
        box.addEventListener('mouseover', (e) => {
            const tag = e.target.closest?.('.searchVideoIdResult-tag:not(.is-leaving)');
            if (tag) {
                const key = `tag:${tag.dataset.word}`;
                if (key !== this._videoIdNavKey) {
                    this._videoIdNavKey = key;
                    this._updateVideoIdSelection();
                }
                return;
            }
            const row = e.target.closest?.('.searchVideoIdResult-search');
            if (row && !row.contains(e.relatedTarget)) {
                this._videoIdNavKey = 'search';
                this._updateVideoIdSelection();
                this._updateVideoIdSearchRow(false, true);
            }
        });
        box.addEventListener('mouseout', (e) => {
            const row = e.target.closest?.('.searchVideoIdResult-search');
            if (row && !row.contains(e.relatedTarget) && this.wordCountMode === 'on-demand') {
                this._cancelSearchRowCount();
            }
        });
        box.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target.closest('.searchVideoIdResult-search')) {
                this._submitVideoIdAsWord();
                return;
            }
            const tag = e.target.closest('.searchVideoIdResult-tag');
            if (tag) {
                this._selectVideoIdTag(tag.dataset.word);
                return;
            }
            const card = e.target.closest('.searchVideoCard');
            if (!card) {
                return;
            }
            const button = e.target.closest('[data-action]');
            const action = button ? button.dataset.action : 'open';
            this._execVideoIdAction(action, card.dataset.watchId, button || card);
        });
        Array.from(this._form.querySelectorAll('.searchMode')).forEach(radio => radio.addEventListener('change', () => this._refreshWordCountsAfterFilterChange()));
        // Task 073: 件数は期間・長さ・ジャンルの絞り込みも反映するので、変えたら数え直す
        ['f_range', 'l_range', 'genre', 'ownerOnly'].forEach(name => {
            const elm = this._form.elements.namedItem(name);
            elm && elm.addEventListener && elm.addEventListener('change', () => {
                this._refreshWordCountsAfterFilterChange();
            });
        });
        // 起動直後（前回の検索語が入った状態）は、入力を変えるまで予測枠を出さない
        this._videoIdDismissedKey = this._videoIdKeyOf(input.value);
        // Task 072: タグ予測の表示方式（A/B/C）
        this._applyVideoIdSuggestMode();
        this._config.onkey('videoIdSuggestMode', () => {
            this._applyVideoIdSuggestMode();
            this._videoIdKey = '';
            this._updateVideoIdPreview();
        });
        this._config.onkey('wordCountMode', () => {
            this._cancelPendingWordCounts();
            this._clearVisibleWordCounts();
            if (!this._videoIdBox.classList.contains('is-open')) {
                return;
            }
            this._updateVideoIdSearchRow(true);
            this._scheduleAutomaticTagCounts();
        });
        this._updateVideoIdPreview();
    }
    get videoIdSuggestMode() {
        const mode = this._config.props.videoIdSuggestMode;
        return VideoSearchForm.VIDEO_ID_SUGGEST_MODES.includes(mode) ? mode : 'merged';
    }
    get wordCountMode() {
        const mode = this._config?.props?.wordCountMode;
        return ['on-demand', 'auto', 'off'].includes(mode) ? mode : 'auto';
    }
    _applyVideoIdSuggestMode() {
        const box = this._videoIdBox;
        if (!box) {
            return;
        }
        const mode = this.videoIdSuggestMode;
        VideoSearchForm.VIDEO_ID_SUGGEST_MODES.forEach((m) => box.classList.toggle(`is-mode-${m}`, m === mode));
    }
    _videoIdKeyOf(text) {
        const { ids, bare } = VideoSearchForm.parseVideoIdInput(text);
        if (!ids.length) {
            // Task 073: 普通の単語（語ごとに別のキー。空なら空）
            const word = String(text || '').trim();
            return word ? `k:${word}` : '';
        }
        return `${bare ? 'w' : 'u'}:${ids.join(',')}`;
    }
    _updateVideoIdPreview() {
        const { ids, bare: idBare } = VideoSearchForm.parseVideoIdInput(this._word.value);
        // Task 073: 動画IDではない普通の単語でも、同じ枠で「検索（件数）＋タグ予測」を出す
        const wordOnly = !ids.length && !!this.word;
        const bare = idBare || wordOnly;
        const key = this._videoIdKeyOf(this._word.value);
        if (key !== this._videoIdDismissedKey) {
            this._videoIdDismissedKey = '';
        }
        const visible = (ids.length > 0 || wordOnly) && !this._videoIdDismissedKey;
        if (key === this._videoIdKey && visible === this._videoIdBox.classList.contains('is-open')) {
            return;
        }
        const reopening = visible && !this._videoIdBox.classList.contains('is-open');
        const keyChanged = this._videoIdKey !== key;
        this._videoIdKey = key;
        this._videoIdBare = bare;
        this._view.classList.toggle('is-videoIdMode', ids.length > 0);
        window.clearTimeout(this._videoIdCleanupTimer);
        if (!visible) {
            this._videoIdBox.classList.remove('is-open');
            this._cancelPendingWordCounts();
            this._videoIdNavKey = '';
            window.clearTimeout(this._videoIdWaitTimer);
            this._videoIdTagSeq++;
            this._videoIdTagWord = ''; // A cancelled suggestion request must restart on reopening.
            // 閉じるアニメーションの後にカードを片付ける（次に表示した時も登場アニメーションから始まるように）
            this._videoIdCleanupTimer = window.setTimeout(() => {
                if (this._videoIdBox.classList.contains('is-open')) {
                    return;
                }
                this._videoIdCards.clear();
                this._videoIdList.textContent = '';
                this._videoIdTagsElm && (this._videoIdTagsElm.textContent = '');
                this._videoIdTagWord = '';
                this._videoIdKey = '';
            }, 400);
            return;
        }
        const list = this._videoIdList;
        const cards = this._videoIdCards;
        for (const [id, card] of cards) {
            if (!ids.includes(id)) {
                cards.delete(id);
                this._removeVideoCard(card);
            }
        }
        let delay = 0;
        ids.forEach((id, i) => {
            let card = cards.get(id);
            if (!card) {
                card = this._createVideoCard(id);
                card.style.setProperty('--card-delay', `${delay++ * 70}ms`);
                cards.set(id, card);
            }
            // 並び順を入力順に合わせる（退場中のカードより前に置く）
            const current = list.querySelectorAll('.searchVideoCard:not(.is-leaving)')[i];
            if (current !== card) {
                list.insertBefore(card, current || null);
            }
        });
        const box = this._videoIdBox;
        // Task 072: C（delayed）は入力が止まってから動画カードを出す。カードの情報取得は先に始めておく
        if (this.videoIdSuggestMode === 'delayed' && !wordOnly) {
            if (keyChanged) {
                box.classList.add('is-cardsWaiting');
                window.clearTimeout(this._videoIdWaitTimer);
                this._videoIdWaitTimer = window.setTimeout(() => {
                    box.classList.remove('is-cardsWaiting');
                    this._updateVideoIdSelection();
                }, VideoSearchForm.VIDEO_ID_CARD_DELAY_MS);
            }
        }
        else {
            window.clearTimeout(this._videoIdWaitTimer);
            box.classList.remove('is-cardsWaiting');
        }
        // Task 072: 素の動画ID（検索語にもなる入力）の時は、本家と同じタグ予測も出す
        if (bare) {
            this._requestVideoIdTags(this.word);
        }
        else {
            this._videoIdTagSeq++;
            this._renderVideoIdTags([], '');
        }
        // 検索語としても使える入力（bare）は、最初は「検索」行を選ぶ（Enterは通常の検索）。URLは先頭の動画
        if (keyChanged || !this._findVideoIdNavItem(this._videoIdNavKey)) {
            this._videoIdNavKey = this._defaultVideoIdNavKey();
        }
        this._updateVideoIdSelection();
        box.classList.toggle('is-multi', ids.length > 1);
        box.classList.toggle('is-bare', bare);
        box.classList.toggle('is-word', wordOnly);
        box.querySelector('.searchVideoIdResult-label').textContent =
            wordOnly ? '検索予測' : (ids.length > 1 ? `動画ID ${ids.length}件` : '動画ID');
        const hint = box.querySelector('.searchVideoIdResult-hint');
        if (wordOnly) {
            hint.textContent = 'Enter 検索・↑↓ 選択・Esc 閉じる';
            hint.title = 'Enter: 選んでいる行を実行（検索／タグで検索）　↑↓: 選択　Esc: 閉じる';
        }
        else if (bare) {
            hint.textContent = 'Enter 検索・↑↓ 選択・Shift+Enter 再生';
            hint.title = 'Enter: 選んでいる行を実行（検索／タグで検索／動画を再生）　↑↓: 選択　Shift+Enter: 動画を再生　Esc: 閉じる';
        }
        else {
            hint.textContent = ids.length > 1 ? '↑↓ 選択・Enter 再生・Esc 閉じる' : 'Enter 再生・Esc 閉じる';
            hint.title = 'クリック/Enter: 再生　Shift+Enter: 次に再生　↑↓: 選択(複数の時)　Esc: 閉じる';
        }
        this._videoIdBox.classList.add('is-open');
        this._updateVideoIdSearchRow(reopening);
        if (reopening) {
            this._scheduleAutomaticTagCounts();
        }
    }
    _removeVideoCard(card) {
        card.classList.add('is-leaving');
        const remove = () => card.remove();
        card.addEventListener('animationend', (e) => e.target === card && remove());
        window.setTimeout(remove, 400);
    }
    _createVideoCard(watchId) {
        const card = document.createElement('div');
        card.className = 'searchVideoCard is-loading';
        card.dataset.watchId = watchId;
        card.setAttribute('role', 'button');
        card.title = `${watchId} を再生`;
        card.innerHTML = `
      <div class="searchVideoCard-main">
        <div class="searchVideoCard-thumb">
          <img class="searchVideoCard-image" alt="" decoding="async">
          <span class="searchVideoCard-duration"></span>
          <span class="searchVideoCard-play">&#x25B6;</span>
        </div>
        <div class="searchVideoCard-body">
          <div class="searchVideoCard-id"></div>
          <div class="searchVideoCard-title"><span class="skeleton"></span><span class="skeleton short"></span></div>
          <div class="searchVideoCard-meta"><span class="skeleton tiny"></span></div>
        </div>
      </div>
      <div class="searchVideoCard-actions">
        <button type="button" class="searchVideoCard-button is-primary" data-action="open" title="今すぐ再生">&#x25B6; 再生</button>
        <button type="button" class="searchVideoCard-button" data-action="playlistInsert" title="プレイリストの次に入れる">次に再生</button>
        <button type="button" class="searchVideoCard-button" data-action="playlistAdd" title="プレイリストの最後に追加">末尾に追加</button>
        <button type="button" class="searchVideoCard-button" data-action="deflistAdd" title="あとで見るに登録">あとで見る</button>
      </div>
    `.trim();
        card.querySelector('.searchVideoCard-id').textContent = watchId;
        const image = card.querySelector('.searchVideoCard-image');
        image.addEventListener('load', () => card.classList.add('is-imageLoaded'), { once: true });
        image.addEventListener('error', () => card.classList.add('is-imageError'), { once: true });
        ThumbInfoLoader.load(watchId)
            .then((info) => this._fillVideoCard(card, watchId, info))
            .catch((err) => this._failVideoCard(card, watchId, err));
        return card;
    }
    _fillVideoCard(card, watchId, info) {
        if (!info || info.status === 'fail') {
            return this._failVideoCard(card, watchId, info);
        }
        const title = info.title || watchId;
        card.title = `${title}\n(${watchId})`;
        const image = card.querySelector('.searchVideoCard-image');
        const thumbnail = String(info.thumbnail_url || info.thumbnail || '').replace(/^http:/, 'https:');
        if (thumbnail) {
            image.src = thumbnail;
        }
        else {
            card.classList.add('is-imageError');
        }
        const duration = info.duration * 1;
        card.querySelector('.searchVideoCard-duration').textContent =
            isNaN(duration) ? '' : textUtil.secToTime(duration);
        const titleElm = card.querySelector('.searchVideoCard-title');
        titleElm.textContent = title;
        const meta = card.querySelector('.searchVideoCard-meta');
        meta.textContent = '';
        const addComma = (n) => (typeof n === 'number' && n.toLocaleString) ? n.toLocaleString() : (n || 0);
        const posted = info.postedAt ? new Date(info.postedAt) : null;
        const pad = (n) => `${n}`.padStart(2, '0');
        const items = [
            posted && !isNaN(posted.getTime()) ?
                `${posted.getFullYear()}/${pad(posted.getMonth() + 1)}/${pad(posted.getDate())} ${pad(posted.getHours())}:${pad(posted.getMinutes())}` : '',
            `再生 ${addComma(info.viewCount * 1)}`,
            `コメ ${addComma(info.commentCount * 1)}`,
            `マイ ${addComma(info.mylistCount * 1)}`
        ].filter(Boolean);
        items.forEach(text => {
            const span = document.createElement('span');
            span.textContent = text;
            meta.append(span);
        });
        const ownerName = info.owner && info.owner.name;
        if (ownerName) {
            const owner = document.createElement('span');
            owner.className = 'searchVideoCard-owner';
            owner.textContent = info.isChannel || (info.owner.type === 'channel') ? `ch: ${ownerName}` : ownerName;
            meta.append(owner);
        }
        card.classList.remove('is-loading');
        card.classList.add('is-loaded');
    }
    _failVideoCard(card, watchId, err) {
        const code = err && err.code;
        const message = code === 'DELETED' ? '削除された動画です' :
            code === 'NOT_FOUND' ? '動画が見つかりません' :
                code === 'COMMUNITY' ? 'コミュニティ限定などで情報を取得できません' :
                    '動画情報を取得できませんでした';
        card.querySelector('.searchVideoCard-title').textContent = message;
        const meta = card.querySelector('.searchVideoCard-meta');
        meta.textContent = code === 'DELETED' || code === 'NOT_FOUND' ? '' : '再生は試せます';
        card.classList.remove('is-loading');
        card.classList.add('is-failed', 'is-imageError');
        if (code === 'DELETED' || code === 'NOT_FOUND') {
            card.classList.add('is-unavailable');
            card.setAttribute('aria-disabled', 'true');
            Array.from(card.querySelectorAll('.searchVideoCard-button')).forEach(button => {
                button.disabled = true;
                button.setAttribute('aria-disabled', 'true');
            });
        }
    }
    // Task 072: ↑↓で移動する対象を「検索行 → タグ予測 → 動画カード」の1列にまとめて扱う（A/B/C共通）
    _videoIdNavItems() {
        const box = this._videoIdBox;
        const items = [];
        if (!box) {
            return items;
        }
        if (this._videoIdBare) {
            items.push({ key: 'search', type: 'search', el: box.querySelector('.searchVideoIdResult-search') });
            Array.from(box.querySelectorAll('.searchVideoIdResult-tag:not(.is-leaving)')).forEach(el => items.push({ key: `tag:${el.dataset.word}`, type: 'tag', el, word: el.dataset.word }));
        }
        if (!box.classList.contains('is-cardsWaiting')) {
            Array.from(this._videoIdList.querySelectorAll('.searchVideoCard:not(.is-leaving)')).forEach(el => items.push({ key: `card:${el.dataset.watchId}`, type: 'card', el, watchId: el.dataset.watchId }));
        }
        return items;
    }
    _findVideoIdNavItem(key) {
        return key ? this._videoIdNavItems().find((item) => item.key === key) : null;
    }
    _defaultVideoIdNavKey() {
        if (this._videoIdBare) {
            return 'search';
        }
        const first = VideoSearchForm.parseVideoIds(this._word.value)[0];
        return first ? `card:${first}` : '';
    }
    _updateVideoIdSelection(requestCount = true) {
        const items = this._videoIdNavItems();
        if (!this._findVideoIdNavItem(this._videoIdNavKey)) {
            this._videoIdNavKey = this._defaultVideoIdNavKey();
        }
        const highlight = this._videoIdBare || items.length > 1;
        const box = this._videoIdBox;
        box && Array.from(box.querySelectorAll('.is-selected')).forEach(el => el.classList.remove('is-selected'));
        const selected = items.find((item) => item.key === this._videoIdNavKey);
        if (!selected || !highlight || !selected.el) {
            return;
        }
        selected.el.classList.add('is-selected');
        if (selected.type !== 'search' && selected.el.scrollIntoView) {
            selected.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        if (selected.type === 'tag' && requestCount && this.wordCountMode === 'on-demand') {
            this._requestTagCount(selected.el, selected.word);
        }
        else if (this.wordCountMode === 'on-demand') {
            window.clearTimeout(this._tagCountTimer);
            this._tagCountGeneration = (this._tagCountGeneration || 0) + 1;
            this._tagCountPendingElm?.classList.remove('is-counting');
            this._tagCountPendingElm = null;
        }
    }
    // Task 073: ↑↓やマウスで選んでいるタグ候補の件数（入力語と同じく、絞り込み条件を反映）
    _requestTagCount(li, word) {
        if (this.wordCountMode === 'off' || this.wordCountMode === 'auto') {
            return;
        }
        window.clearTimeout(this._tagCountTimer);
        const generation = (this._tagCountGeneration = (this._tagCountGeneration || 0) + 1);
        // 問い合わせ前に別の候補へ移った場合、前の候補の「数えています」表示を消す
        const pending = this._tagCountPendingElm;
        if (pending && pending.classList.contains('is-counting')) {
            pending.classList.remove('is-counting');
        }
        this._tagCountPendingElm = null;
        const countElm = li && li.querySelector('.searchVideoIdResult-tagCount');
        if (!countElm || !word) {
            return;
        }
        const mode = this.searchType === 'tag' ? 'tag' : 'keyword';
        const cacheKey = this._wordCountCacheKey(word, mode);
        const render = (count) => {
            if (generation !== this._tagCountGeneration) {
                return;
            }
            countElm.classList.remove('is-counting');
            countElm.textContent = typeof count === 'number' ? `${count.toLocaleString()}件` : '';
            countElm.classList.toggle('is-empty', count === 0);
        };
        if (!cacheKey) {
            render(null);
            return;
        }
        if (this._wordCountCache.has(cacheKey)) {
            render(this._wordCountCache.get(cacheKey));
            return;
        }
        countElm.textContent = '';
        countElm.classList.add('is-counting');
        this._tagCountPendingElm = countElm;
        // 候補を↑↓で素早く移動している間は問い合わせない（止まった候補だけ数える）
        this._tagCountTimer = window.setTimeout(() => {
            this._tagCountPendingElm = null;
            VideoSearchForm.fetchWordCount(word, mode, this.filterOptions)
                .then(count => {
                this._setWordCountCache(cacheKey, count);
                render(count);
            })
                .catch(() => render(null));
        }, VideoSearchForm.WORD_COUNT_DELAY_MS);
    }
    // 件数キャッシュのキー。「投稿者の動画のみ」は本家の検索APIで数えられないので件数を出さない(null)
    _wordCountCacheKey(word, mode) {
        if (this.isOwnerOnly) {
            return null;
        }
        return `${mode}:${JSON.stringify(this.filterOptions)}:${word}`;
    }
    _setWordCountCache(key, count) {
        const cache = this._wordCountCache;
        cache.set(key, count);
        // 長時間使っても増え続けないよう、古いものから捨てる
        while (cache.size > VideoSearchForm.WORD_COUNT_CACHE_SIZE) {
            cache.delete(cache.keys().next().value);
        }
    }
    _cancelSearchRowCount() {
        window.clearTimeout(this._wordCountTimer);
        this._wordCountSeq = (this._wordCountSeq || 0) + 1;
        this._videoIdBox?.querySelector('.searchVideoIdResult-search')
            ?.classList.remove('is-counting');
    }
    _cancelPendingWordCounts() {
        this._cancelSearchRowCount();
        window.clearTimeout(this._tagCountTimer);
        window.clearTimeout(this._autoTagCountTimer);
        this._tagCountGeneration = (this._tagCountGeneration || 0) + 1;
        this._autoTagCountGeneration = (this._autoTagCountGeneration || 0) + 1;
        this._tagCountPendingElm?.classList.remove('is-counting');
        this._tagCountPendingElm = null;
    }
    _clearVisibleWordCounts() {
        const box = this._videoIdBox;
        if (!box) {
            return;
        }
        const row = box.querySelector('.searchVideoIdResult-search');
        const count = row?.querySelector('.searchVideoIdResult-searchCount');
        if (count) {
            count.textContent = '';
        }
        row?.classList.remove('is-counting');
        row?.classList.remove('is-empty');
        box.querySelectorAll('.searchVideoIdResult-tagCount').forEach((el) => {
            el.textContent = '';
            el.classList.remove('is-counting');
            el.classList.remove('is-empty');
        });
    }
    _refreshWordCountsAfterFilterChange() {
        this._cancelPendingWordCounts();
        this._clearVisibleWordCounts();
        this._updateVideoIdSearchRow(true);
        this._updateVideoIdSelection(false);
        this._scheduleAutomaticTagCounts();
    }
    _scheduleAutomaticTagCounts() {
        window.clearTimeout(this._autoTagCountTimer);
        const generation = (this._autoTagCountGeneration =
            (this._autoTagCountGeneration || 0) + 1);
        if (this.wordCountMode !== 'auto' || !this._videoIdBox || this.isOwnerOnly) {
            return;
        }
        const items = Array.from(this._videoIdBox.querySelectorAll('.searchVideoIdResult-tag:not(.is-leaving)')).slice(0, VideoSearchForm.MAX_VIDEO_ID_TAGS);
        if (!items.length) {
            return;
        }
        const inputWord = this.word, mode = this.searchType, filters = this.filterOptions;
        const valid = () => generation === this._autoTagCountGeneration &&
            this.wordCountMode === 'auto' && !this.isOwnerOnly &&
            this.word === inputWord && this.searchType === mode &&
            this._videoIdBox.classList.contains('is-open');
        const render = (li, count) => {
            if (!valid()) {
                return;
            }
            const elm = li.querySelector('.searchVideoIdResult-tagCount');
            if (!elm || li.classList.contains('is-leaving')) {
                return;
            }
            elm.classList.remove('is-counting');
            elm.textContent = typeof count === 'number' ? count.toLocaleString() + '件' : '';
            elm.classList.toggle('is-empty', count === 0);
        };
        const runNext = async (index) => {
            if (!valid()) {
                return;
            }
            for (let i = index; i < items.length; i++) {
                const li = items[i], word = li.dataset.word;
                const cacheKey = word && this._wordCountCacheKey(word, mode);
                if (!cacheKey || li.classList.contains('is-leaving')) {
                    continue;
                }
                if (this._wordCountCache.has(cacheKey)) {
                    render(li, this._wordCountCache.get(cacheKey));
                    continue;
                }
                const elm = li.querySelector('.searchVideoIdResult-tagCount');
                elm?.classList.add('is-counting');
                try {
                    const count = await VideoSearchForm.fetchWordCount(word, mode, filters);
                    this._setWordCountCache(cacheKey, count);
                    render(li, count);
                }
                catch (_) {
                    render(li, null);
                }
                if (valid() && i + 1 < items.length) {
                    this._autoTagCountTimer = window.setTimeout(() => runNext(i + 1), VideoSearchForm.WORD_COUNT_DELAY_MS);
                }
                return;
            }
        };
        this._autoTagCountTimer = window.setTimeout(() => runNext(0), VideoSearchForm.WORD_COUNT_DELAY_MS);
    }
    _onVideoIdKeyDown(e) {
        if (e.isComposing || e.keyCode === 229) {
            return;
        }
        if (!this._videoIdBox.classList.contains('is-open')) {
            // Task 074: 閉じている時に↓キーを押したら、もう一度予測を出す
            if (e.key === 'ArrowDown' && this.word) {
                e.preventDefault();
                e.stopPropagation();
                this._videoIdDismissedKey = '';
                this._videoIdKey = '';
                this._updateVideoIdPreview();
            }
            return;
        }
        const { ids, bare: idBare } = VideoSearchForm.parseVideoIdInput(this._word.value);
        const wordOnly = !ids.length && !!this.word;
        if (!ids.length && !wordOnly) {
            return;
        }
        const bare = idBare || wordOnly;
        const items = this._videoIdNavItems();
        const current = items.find((item) => item.key === this._videoIdNavKey);
        const selectedCardId = current && current.type === 'card' ? current.watchId : ids[0];
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey && selectedCardId) {
                    this._execVideoIdAction(idBare ? 'open' : 'playlistInsert', selectedCardId);
                    break;
                }
                if (!current || current.type === 'search') {
                    bare ? this._submitVideoIdAsWord() : this._execVideoIdAction('open', ids[0]);
                }
                else if (current.type === 'tag') {
                    this._selectVideoIdTag(current.word);
                }
                else {
                    this._execVideoIdAction('open', current.watchId);
                }
                break;
            case 'ArrowDown':
            case 'ArrowUp': {
                if (items.length < 2) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                const delta = e.key === 'ArrowDown' ? 1 : -1;
                const index = Math.max(0, items.indexOf(current));
                this._videoIdNavKey = items[(index + delta + items.length) % items.length].key;
                this._updateVideoIdSelection();
                if (this._videoIdNavKey === 'search') {
                    this._updateVideoIdSearchRow(false, true);
                }
                else if (this.wordCountMode === 'on-demand') {
                    this._cancelSearchRowCount();
                }
                break;
            }
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                this._videoIdDismissedKey = this._videoIdKey;
                this._updateVideoIdPreview();
                break;
        }
    }
    // Task 072: 本家と同じタグ予測（sug.search）を、動画IDの入力でも取得する
    async _requestVideoIdTags(word) {
        if (word === this._videoIdTagWord) {
            return;
        }
        this._videoIdTagWord = word;
        const seq = ++this._videoIdTagSeq;
        let items = [];
        try {
            items = await TagSuggestLoader.load(word);
        }
        catch (err) {
            window.console.warn('タグ予測の取得に失敗', word, err);
        }
        if (seq !== this._videoIdTagSeq || this.word !== word) {
            return;
        }
        this._renderVideoIdTags(items || [], word);
    }
    _renderVideoIdTags(items, word) {
        const ul = this._videoIdTagsElm;
        if (!ul) {
            return;
        }
        const lower = String(word || '').toLowerCase();
        // 入力と同じ語は「検索」行と重複するので出さない
        const words = items.filter((w) => String(w).toLowerCase() !== lower).slice(0, VideoSearchForm.MAX_VIDEO_ID_TAGS);
        const current = new Map(Array.from(ul.querySelectorAll('.searchVideoIdResult-tag:not(.is-leaving)'))
            .map(li => [li.dataset.word, li]));
        current.forEach((li, w) => {
            if (!words.includes(w)) {
                li.classList.add('is-leaving');
                window.setTimeout(() => li.remove(), 200);
            }
        });
        let delay = 0;
        words.forEach((w, i) => {
            let li = current.get(w);
            if (!li) {
                li = document.createElement('li');
                li.className = 'searchVideoIdResult-tag';
                li.setAttribute('role', 'option');
                li.dataset.word = w;
                li.title = `「${w}」で検索`;
                const icon = document.createElement('span');
                icon.className = 'searchVideoIdResult-tagIcon';
                icon.textContent = '#';
                const text = document.createElement('span');
                text.className = 'searchVideoIdResult-tagText';
                text.textContent = w;
                // Task 073: 選択中の候補だけ件数を問い合わせて表示する（取得済みの件数はそのまま残す）
                const count = document.createElement('span');
                count.className = 'searchVideoIdResult-tagCount';
                li.append(icon, text, count);
                li.style.setProperty('--tag-delay', `${delay++ * 35}ms`);
            }
            const at = ul.querySelectorAll('.searchVideoIdResult-tag:not(.is-leaving)')[i];
            if (at !== li) {
                ul.insertBefore(li, at || null);
            }
        });
        this._videoIdBox.classList.toggle('has-tags', words.length > 0);
        this._updateVideoIdSelection();
        this._scheduleAutomaticTagCounts();
    }
    _selectVideoIdTag(word) {
        if (!word) {
            return;
        }
        this._word.value = word;
        this._config.props.word = word;
        // 選んだタグ自体が動画IDの形（例: sm9708985）でも、カードを出し直さずにそのまま検索する
        this._videoIdDismissedKey = this._videoIdKeyOf(word);
        this._updateVideoIdPreview();
        this.submit();
    }
    // 素の動画IDを検索語として検索する行（タグ/キーワードのヒット件数も表示）
    _updateVideoIdSearchRow(force = false, requestOnDemand = false) {
        const row = this._videoIdBox.querySelector('.searchVideoIdResult-search');
        if (!row) {
            return;
        }
        const word = this.word;
        // Task 073: 普通の単語（動画IDではない入力）でも表示する
        if (!word || !this._videoIdBare) {
            return;
        }
        const mode = this.searchType === 'tag' ? 'tag' : 'keyword';
        const label = mode === 'tag' ? `タグ「${word}」で検索` : `キーワード「${word}」で検索`;
        const labelElm = row.querySelector('.searchVideoIdResult-searchLabel');
        const countElm = row.querySelector('.searchVideoIdResult-searchCount');
        if (!force && !requestOnDemand && labelElm.textContent === label) {
            return;
        }
        labelElm.textContent = label;
        const countMode = this.wordCountMode;
        const cacheKey = this._wordCountCacheKey(word, mode);
        row.title = countMode === 'off' ? `${label}（件数表示はOFF）` :
            cacheKey ? label : `${label}（「投稿者の動画のみ」の時は件数を表示しません）`;
        const seq = ++this._wordCountSeq;
        window.clearTimeout(this._wordCountTimer);
        const render = (count) => {
            if (seq !== this._wordCountSeq) {
                return;
            }
            row.classList.remove('is-counting');
            row.classList.toggle('is-empty', count === 0);
            countElm.textContent = typeof count === 'number' ? `${count.toLocaleString()}件` : '';
            if (typeof count === 'number') {
                countElm.classList.remove('is-pop');
                void countElm.offsetWidth;
                countElm.classList.add('is-pop');
            }
        };
        if (!cacheKey || countMode === 'off') {
            render(null);
            return;
        }
        if (this._wordCountCache.has(cacheKey)) {
            render(this._wordCountCache.get(cacheKey));
            return;
        }
        // On-demand does not start a count request just because a word was typed
        // or filters changed; the explicit hover/keyboard selection starts it.
        if (countMode !== 'auto' && !requestOnDemand) {
            render(null);
            return;
        }
        row.classList.add('is-counting');
        row.classList.remove('is-empty');
        countElm.textContent = '';
        const filters = this.filterOptions;
        this._wordCountTimer = window.setTimeout(() => {
            if (seq !== this._wordCountSeq ||
                !this._videoIdBox.classList.contains('is-open') ||
                this.wordCountMode === 'off') {
                return;
            }
            VideoSearchForm.fetchWordCount(word, mode, filters)
                .then(count => {
                this._setWordCountCache(cacheKey, count);
                render(count);
            })
                .catch(() => render(null));
        }, VideoSearchForm.WORD_COUNT_DELAY_MS);
    }
    // nvapi /v2/search/video で件数だけ取る（本家の検索と同じ条件: 人気順・sensitiveContents=mask）
    // Task 073: 期間・長さ・ジャンルの絞り込み(filters)も、実際の検索と同じ組み立て方(buildQuery)で反映する
    static async fetchWordCount(word, mode, filters = {}) {
        const nvapi = NicoSearchApiV2Loader && NicoSearchApiV2Loader.nvapi;
        const params = Object.assign({}, filters, { searchType: mode === 'tag' ? 'tag' : 'keyword' });
        const base = nvapi ? nvapi.buildQuery(word, params) : {
            [mode === 'tag' ? 'tag' : 'keyword']: word,
            sortKey: 'hot', sortOrder: 'none', sensitiveContents: 'mask'
        };
        const q = new URLSearchParams(Object.assign(base, { pageSize: 1, page: 1 }));
        const res = await fetch(`https://nvapi.nicovideo.jp/v2/search/video?${q}`, {
            credentials: 'include',
            headers: { 'X-Frontend-Id': '6', 'X-Frontend-Version': '0' }
        });
        const json = await res.json();
        if (!json || !json.meta || json.meta.status !== 200 || !json.data) {
            throw new Error('count failed');
        }
        return json.data.totalCount * 1 || 0;
    }
    _submitVideoIdAsWord() {
        this._videoIdDismissedKey = this._videoIdKey;
        this._updateVideoIdPreview();
        this.submit();
    }
    _execVideoIdAction(action, watchId, feedbackTarget) {
        if (!watchId) {
            return;
        }
        const card = this._videoIdCards.get(watchId);
        if (card && card.classList.contains('is-unavailable')) {
            return;
        }
        switch (action) {
            case 'open':
                card && card.classList.add('is-opening');
                domEvent.dispatchCommand(this._view, 'open', watchId);
                // 開いたらカードは閉じる（入力はそのまま。入力を変えるとまた出る）
                window.setTimeout(() => {
                    this._videoIdDismissedKey = this._videoIdKey;
                    this._updateVideoIdPreview();
                    card && card.classList.remove('is-opening');
                }, 260);
                break;
            case 'playlistInsert':
            case 'playlistAdd':
            case 'deflistAdd': {
                domEvent.dispatchCommand(this._view, action, watchId);
                const target = feedbackTarget && feedbackTarget.classList.contains('searchVideoCard-button') ?
                    feedbackTarget : (card && card.querySelector(`[data-action="${action}"]`));
                if (target) {
                    target.classList.remove('is-done');
                    void target.offsetWidth;
                    target.classList.add('is-done');
                    window.setTimeout(() => target.classList.remove('is-done'), 900);
                }
                break;
            }
        }
    }
    _onClick(e) {
        e.stopPropagation();
        const tagName = (e.target.tagName || '').toLowerCase();
        const target = e.target.closest('.command');
        if (!['input', 'select'].includes(tagName)) {
            this._word.focus();
        }
        if (!target) {
            return;
        }
        const command = target.dataset.command;
        if (!command) {
            return;
        }
        e.preventDefault();
        const type = target.getAttribute('data-type') || 'string';
        let param = target.getAttribute('data-param');
        if (type !== 'string') {
            param = JSON.parse(param);
        }
        switch (command) {
            case 'clear':
                this._word.value = '';
                break;
            default:
                domEvent.dispatchCommand(e.target, command, param);
        }
    }
    _onSubmit(e) {
        e.stopPropagation();
        // Task 071: 動画IDが入っている時の▶/Enterは、検索ではなくその動画を再生する
        // 検索語になり得ないURL形式の時だけ動画を開く（sm114514 のような素のIDは検索語として検索）
        const { ids, bare } = VideoSearchForm.parseVideoIdInput(this.word);
        if (ids.length && !bare) {
            const current = this._findVideoIdNavItem(this._videoIdNavKey);
            this._execVideoIdAction('open', current && current.type === 'card' ? current.watchId : ids[0]);
            return;
        }
        // Task 073: ▶ボタンで検索した時も予測枠を閉じる（入力を変えるとまた出る）
        if (this._videoIdBox && this._videoIdBox.classList.contains('is-open')) {
            this._videoIdDismissedKey = this._videoIdKey;
            this._updateVideoIdPreview();
        }
        this.submit();
    }
    submit() {
        const word = this.word;
        if (!word) {
            return;
        }
        // Task 071: URL形式の動画IDは検索しない（並び順などを変えた時の自動検索も含む）。
        // sm114514 のような素のIDはタグ・キーワードとしても存在し得るので通常通り検索する
        const parsed = VideoSearchForm.parseVideoIdInput(word);
        if (parsed.ids.length && !parsed.bare) {
            return;
        }
        domEvent.dispatchCommand(this._view, 'playlistSetSearchVideo', {
            word,
            option: Object.assign({
                searchType: this.searchType,
                sort: this.sort,
                order: this.order,
                owner: this.isOwnerOnly,
                playlistSort: this.isPlaylistSort
            }, this.filterOptions)
        });
    }
    _hasFocus() {
        return !!document.activeElement?.closest('#zenzaVideoSearchPanel');
    }
    /**
     * Task1040: 検索欄が画面の上にはみ出したら、はみ出した分だけ下げる（ブラウザ名では分けない）。
     * Firefox ではヘッダーの位置が数px上になり、検索欄の上段（キーワード/タグ・動画/ショート）が欠けていた。
     * 位置は CSS 変数 --search-top-offset（margin-top）だけで調整するので、配置の CSS 自体は変えない。
     * 実際の位置を測って決めるため、ブラウザ・拡大率・ヘッダー配置が変わっても同じ処理で収まる。
     */
    _keepSearchPanelInView() {
        const panel = this._view;
        if (!panel?.isConnected) {
            return;
        }
        const current = parseFloat(panel.style.getPropertyValue('--search-top-offset')) || 0;
        const rect = panel.getBoundingClientRect();
        if (!rect.height) {
            return;
        }
        const scale = panel.offsetHeight > 0 ? rect.height / panel.offsetHeight : 1;
        const viewportTop = (window.visualViewport ? window.visualViewport.offsetTop : 0) + 2; // 画面の上端との最小の間隔（px）
        // はみ出し量（正）または余裕（負）。余裕があるときは下げた分を戻す。
        const next = Math.max(0, Math.round(current + (viewportTop - rect.top) / (scale || 1)));
        if (next !== current) {
            next ? panel.style.setProperty('--search-top-offset', next + 'px') : panel.style.removeProperty('--search-top-offset');
        }
    }
    _updateFocus() {
        this._keepSearchPanelInView();
        const panel = this._view;
        if (!panel?.isConnected || !panel.matches(':focus-within')) {
            return;
        }
        const rect = panel.getBoundingClientRect();
        // Account for player/menu scaling; viewport coordinates are physical CSS pixels.
        const scale = panel.offsetHeight > 0 ? rect.height / panel.offsetHeight : 1;
        const viewport = window.visualViewport;
        const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
        const available = Math.max(0, bottom - rect.top - 8) / (scale || 1);
        panel.style.setProperty('--search-available-height', available + 'px');
    }
    get word() {
        return (this._word.value || '').trim();
    }
    get searchType() {
        return this._form.mode.value;
    }
    // Task0xx: 解釈ロジックをVideoSearch.jsのparseVideoSearchSortValue()へ集約。
    // タグ検索(TagListView)側もこれと全く同じ関数でvideoSearch.sortを解釈する。
    get sort() {
        return parseVideoSearchSortValue(this._composeSortValue()).sort;
    }
    get order() {
        return parseVideoSearchSortValue(this._composeSortValue()).order;
    }
    get isPlaylistSort() {
        return parseVideoSearchSortValue(this._composeSortValue()).playlistSort;
    }
    // Task 068: 並び順キーと昇降順のselectから、保存用の値("playlist" / "f" / "l,a" 等)を作る
    _composeSortValue() {
        const key = this._sortKey.value || 'playlist';
        if (key === 'playlist') {
            return 'playlist';
        }
        if (VideoSearchForm.UNORDERABLE.includes(key)) {
            return key;
        }
        return `${key},${this._sortOrder.value === 'a' ? 'a' : 'd'}`;
    }
    _applySortValue(raw) {
        const value = raw || 'playlist';
        const [key, order] = value.split(',');
        this._sortKey.value = key;
        if (this._sortKey.value !== key) {
            this._sortKey.value = 'playlist'; // 知らない値(古い設定等)は自動に戻す
        }
        this._sortOrder.value = order === 'a' ? 'a' : 'd';
        this._updateOrderState();
    }
    _updateOrderState() {
        const key = this._sortKey.value;
        this._sortOrder.disabled = key === 'playlist' || VideoSearchForm.UNORDERABLE.includes(key);
    }
    _syncContentTypeControls() {
        const input = this._ownerOnlyInput;
        if (!input) {
            return;
        }
        const shorts = this._form.elements.namedItem('selectContentType')?.value === 'short';
        input.disabled = shorts;
        input.closest('label')?.setAttribute('title', shorts ?
            'ショート検索では投稿者による絞り込みは利用できません。通常動画に戻すと利用できます。' : '');
    }
    get filterOptions() {
        const form = this._form;
        const result = { selectContentType: form.elements?.namedItem('selectContentType')?.value === 'short' ? 'short' : 'long' };
        const fRange = form['f_range'].value * 1;
        const lRange = form['l_range'].value * 1;
        const genre = form['genre'].value;
        if (fRange) {
            result.f_range = fRange;
        }
        if (lRange) {
            result.l_range = lRange;
        }
        if (genre && genre !== 'all') {
            result.genre = genre;
        }
        return result;
    }
    // Task 073: 項目を削除しても例外にならないよう、要素が無ければ常にfalse
    get _ownerOnlyInput() {
        const form = this._form;
        const input = form && form.elements && form.elements.namedItem('ownerOnly');
        return (input && input.type === 'checkbox') ? input : null;
    }
    get isOwnerOnly() {
        const input = this._ownerOnlyInput;
        return !!(input && input.checked && !input.disabled);
    }
}
// 本家で昇順/降順を選べない並び順（ニコニコで人気・あなたへのおすすめ）
VideoSearchForm.UNORDERABLE = ['h', 'p'];
css.addStyle(`
  .is-open .zenzaWatchVideoHeaderPanel .zenzaVideoSearchPanel {
    top: 120px;
    right: 32px;
  }
`, { className: 'screenMode for-popup videoSearchPanel', disabled: true });
// Task 074: ショート動画(ss〜)と /shorts/ 形式のURLにも対応
VideoSearchForm.VIDEO_ID_REG =
    /^(?:https?:\/\/)?(?:(?:www\.|sp\.|embed\.)?nicovideo\.jp\/(?:watch|shorts)\/|nico\.ms\/)?((?:sm|nm|so|ss)\d+)(?:[\/?#&].*)?$/i;
VideoSearchForm.MAX_VIDEO_ID_CARDS = 5;
// Task 072
VideoSearchForm.VIDEO_ID_SUGGEST_MODES = ['merged', 'side', 'delayed'];
VideoSearchForm.MAX_VIDEO_ID_TAGS = 10;
VideoSearchForm.VIDEO_ID_CARD_DELAY_MS = 500;
// Task 073: 件数の問い合わせは、入力・選択が止まってからこの時間後に行う
VideoSearchForm.WORD_COUNT_DELAY_MS = 300;
VideoSearchForm.WORD_COUNT_CACHE_SIZE = 200;
VideoSearchForm.__css__ = (`
    .zenzaVideoSearchPanel {
      pointer-events: auto;
      position: absolute;
      top: 32px;
      right: 8px;
      padding: 0 8px;
      width: 320px;
      max-width: calc(100% - 16px);
      box-sizing: border-box;
      z-index: 1000;
      --search-controls-height: 32px;
      /* Task1040: --search-top-offset は画面の上にはみ出した分（_keepSearchPanelInView が実測して設定）。
         transform は中の固定配置の基準を変えるので使わず、margin で下げる。 */
      margin-top: calc(var(--search-top-offset, 0px) - var(--search-controls-height));
      max-height: var(--search-available-height, calc(100dvh - 80px));
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }

    .zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-onscreen .zenzaVideoSearchPanel {
      top: 36px;
      right: 8px;
    }
    .zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-onscreen .zenzaVideoSearchPanel,
    .zenzaScreenMode_3D    .zenzaVideoSearchPanel,
    .zenzaScreenMode_wide  .zenzaVideoSearchPanel,
    .zenzaWatchVideoHeaderPanel.is-fullscreen .zenzaVideoSearchPanel {
      top: 64px;
    }

    .zenzaVideoSearchPanel:has(.searchVideoIdResult.is-open.is-mode-side.is-bare:not(.is-word)) {
      width: 560px;
    }

    .zenzaVideoSearchPanel:focus-within {
      background: var(--zt-overlay-dark, rgba(50, 50, 50, 0.8));
    }

    .zenzaVideoSearchPanel:not(:focus-within) .focusOnly {
      opacity: 0;
    }

    .zenzaVideoSearchPanel .searchInputHead {
      /* Reserve the controls above the original input position without layout jumps. */
      height: var(--search-controls-height);
      box-sizing: border-box;
      display: flex;
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 4px 0;
      font-size: 14px;
    }
    .zenzaVideoSearchPanel:focus-within .searchInputHead {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }
    .zenzaVideoSearchPanel .searchModeRow {
      display: flex;
      align-items: center;
      gap: 0;
      min-width: 0;
    }
    .zenzaVideoSearchPanel .searchContentRow {
      margin-left: auto;
      padding-left: 6px;
      border-left: 1px solid var(--zt-border, #666);
    }
    .zenzaVideoSearchPanel .searchModeRow .searchModeLabel {
      flex: 0 0 auto;
      text-align: center;
      white-space: nowrap;
    }
    .zenzaVideoSearchPanel .searchModeLabel input:focus-visible + span {
      outline: 2px solid var(--zt-info, #8acbff);
      outline-offset: 1px;
    }
      .zenzaVideoSearchPanel .searchMode,
      .zenzaVideoSearchPanel .searchContentType {
        position: absolute;
        opacity: 0;
      }

      .zenzaVideoSearchPanel .searchModeLabel {
        cursor: pointer;
      }

     .zenzaVideoSearchPanel .searchModeLabel span {
        display: inline-block;
        padding: 4px 5px;
        line-height: 1;
        color: var(--zt-text-2, #bbb);
        cursor: pointer;
        border-radius: 8px;
        border-color: transparent;
        border-style: solid;
        border-width: 1px;
        pointer-events: none;
      }
      .zenzaVideoSearchPanel .searchModeLabel:hover span {
        background: var(--zt-surface-3, #888);
      }
      .zenzaVideoSearchPanel .searchModeLabel input:checked + span {
        color: var(--zt-text-1, #ccc);
        border-color: currentColor;
        cursor: default;
      }

    .zenzaVideoSearchPanel .searchWord {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 4px;
      position: relative;
    }

      /* Task 071: 動画IDを入力した時に検索欄の下に出す動画カード */
      .zenzaVideoSearchPanel .searchVideoIdResult {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        transform: translateY(-6px);
        margin: 0 4px;
        transition:
          grid-template-rows 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
          opacity 0.22s ease,
          transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
          margin 0.32s ease;
        pointer-events: none;
        width: auto;
        max-width: 100%;
        box-sizing: border-box;
      }
      .zenzaVideoSearchPanel:focus-within .searchVideoIdResult.is-open {
        grid-template-rows: 1fr;
        opacity: 1;
        transform: none;
        margin: 6px 4px 4px;
        pointer-events: auto;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-inner {
        overflow: hidden;
        min-height: 0;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        padding: 0 2px 4px;
        font-size: 11px;
        color: var(--zt-text-2, #999);
        white-space: nowrap;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-label {
        color: var(--zt-accent, #ffb74d);
        font-weight: bold;
        letter-spacing: 0.05em;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-hint {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult:not(.is-multi) .multiOnly {
        display: none;
      }
      /* Task 072: タグ予測の表示方式 A(merged) / B(side) / C(delayed) */
      .zenzaVideoSearchPanel .searchVideoIdResult-body {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-wordCol,
      .zenzaVideoSearchPanel .searchVideoIdResult-cardCol {
        min-width: 0;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tags {
        display: none;
        list-style: none;
        margin: 0 0 6px;
        padding: 3px 0;
        border-radius: 8px;
        background: var(--zt-overlay-dark, rgba(30, 30, 30, 0.95));
        border: 1px solid var(--zt-border, #555);
        max-height: none;
        overflow: visible;
        overscroll-behavior: contain;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-bare.has-tags .searchVideoIdResult-tags {
        display: block;
        animation: zenzaVideoCardIn 0.3s cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tag {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        color: var(--zt-text-1, #ccc);
        font-size: 13px;
        line-height: 1.4;
        cursor: pointer;
        white-space: nowrap;
        animation: zenzaVideoTagIn 0.25s ease both;
        animation-delay: var(--tag-delay, 0ms);
        transition: background 0.12s ease, color 0.12s ease, padding-left 0.15s ease;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tag.is-leaving {
        animation: zenzaVideoTagOut 0.18s ease both;
        pointer-events: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tag:hover,
      .zenzaVideoSearchPanel .searchVideoIdResult-tag.is-selected {
        background: var(--zt-surface-3, #555);
        color: var(--zt-text-0, #fff);
        padding-left: 14px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagIcon {
        color: var(--zt-info, #4fc3f7);
        font-weight: bold;
        flex: 0 0 auto;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagText {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* B: 左右に並べる */
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side {
        width: auto;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare .searchVideoIdResult-body {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 8px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare .searchVideoIdResult-wordCol {
        flex: 1 1 250px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare .searchVideoIdResult-cardCol {
        flex: 1 1 240px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare .searchVideoIdResult-tags {
        max-height: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side:not(.is-bare) {
        width: 280px;
      }
      /* Task 073: 普通の単語（動画IDではない入力）の検索予測。動画カードの列は使わない */
      .zenzaVideoSearchPanel .searchVideoIdResult.is-word .searchVideoIdResult-cardCol {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare.is-word {
        width: 280px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare.is-word .searchVideoIdResult-body {
        flex-direction: column;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare.is-word .searchVideoIdResult-wordCol {
        flex: 1 1 auto;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare.is-word .searchVideoIdResult-tags {
        max-height: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tag .searchVideoIdResult-tagText {
        min-width: 0;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagCount {
        flex: 0 0 auto;
        margin-left: auto;
        padding: 0 6px;
        border-radius: 8px;
        background: var(--zt-info-translucent, rgba(79, 195, 247, 0.85));
        color: var(--zt-text-inverse, #111);
        font-size: 10px;
        font-weight: bold;
        line-height: 15px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagCount:empty {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagCount.is-counting {
        display: inline-block;
        width: 28px;
        flex: 0 0 28px;
        height: 15px;
        background: linear-gradient(90deg, var(--zt-surface-2, #444) 0%, var(--zt-surface-3, #666) 50%, var(--zt-surface-2, #444) 100%);
        background-size: 200% 100%;
        animation: zenzaVideoCardShimmer 1.2s linear infinite;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagCount.is-empty {
        background: var(--zt-surface-3, #555);
        color: var(--zt-text-2, #bbb);
      }

      /* C: 入力が止まるまで動画カードを待つ */
      .zenzaVideoSearchPanel .searchVideoIdResult-waiting {
        display: none;
        justify-content: center;
        gap: 5px;
        padding: 6px 0 8px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-waiting span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--zt-accent, #ffb74d);
        animation: zenzaVideoWaitDot 0.9s ease-in-out infinite;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-waiting span:nth-child(2) { animation-delay: 0.15s; }
      .zenzaVideoSearchPanel .searchVideoIdResult-waiting span:nth-child(3) { animation-delay: 0.3s; }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-cardsWaiting .searchVideoIdResult-waiting {
        display: flex;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-cardsWaiting .searchVideoIdResult-list {
        display: none;
      }
      @keyframes zenzaVideoTagIn {
        0%   { opacity: 0; transform: translateX(-6px); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes zenzaVideoTagOut {
        0%   { opacity: 1; }
        100% { opacity: 0; transform: translateX(6px); }
      }
      @keyframes zenzaVideoWaitDot {
        0%, 100% { opacity: 0.25; transform: translateY(0); }
        50%      { opacity: 1; transform: translateY(-3px); }
      }

      .zenzaVideoSearchPanel .searchVideoIdResult-search {
        display: none;
        width: 100%;
        box-sizing: border-box;
        align-items: center;
        gap: 6px;
        margin: 0 0 6px;
        padding: 5px 8px;
        border: 1px solid var(--zt-border, #555);
        border-radius: 8px;
        background: var(--zt-overlay-dark, rgba(50, 50, 50, 0.96));
        color: var(--zt-text-1, #ddd);
        font-size: 12px;
        text-align: left;
        cursor: pointer;
        animation: zenzaVideoCardIn 0.36s cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
        transition: border-color 0.2s ease, background 0.2s ease;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-bare .searchVideoIdResult-search {
        display: flex;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-search:hover,
      .zenzaVideoSearchPanel .searchVideoIdResult-search.is-selected {
        border-color: var(--zt-info, #4fc3f7);
        background: var(--zt-info-translucent, rgba(40, 70, 90, 0.96));
        box-shadow: 0 0 0 1px var(--zt-info-translucent, rgba(79, 195, 247, 0.35));
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-searchLabel {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-searchCount {
        flex: 0 0 auto;
        min-width: 32px;
        padding: 0 6px;
        border-radius: 8px;
        background: var(--zt-info, #4fc3f7);
        color: var(--zt-text-inverse, #111);
        font-size: 11px;
        font-weight: bold;
        line-height: 16px;
        text-align: center;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-searchCount:empty {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-search.is-counting .searchVideoIdResult-searchCount {
        display: inline-block;
        width: 32px;
        height: 16px;
        background: linear-gradient(90deg, var(--zt-surface-2, #444) 0%, var(--zt-surface-3, #666) 50%, var(--zt-surface-2, #444) 100%);
        background-size: 200% 100%;
        animation: zenzaVideoCardShimmer 1.2s linear infinite;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-search.is-empty .searchVideoIdResult-searchCount {
        background: var(--zt-surface-3, #555);
        color: var(--zt-text-2, #bbb);
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-searchCount.is-pop {
        animation: zenzaVideoCardDone 0.4s ease;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: none;
        overflow: visible;
        overscroll-behavior: contain;
        padding-bottom: 2px;
      }

      .zenzaVideoSearchPanel .searchVideoCard {
        position: relative;
        box-sizing: border-box;
        padding: 6px;
        border-radius: 8px;
        background: linear-gradient(180deg, var(--zt-overlay-dark, rgba(64, 64, 64, 0.96)), var(--zt-overlay-dark, rgba(40, 40, 40, 0.96)));
        border: 1px solid var(--zt-border, #555);
        box-shadow: 0 4px 14px var(--zt-shadow, rgba(0, 0, 0, 0.5));
        cursor: pointer;
        color: var(--zt-text-1, #ddd);
        white-space: normal;
        transform-origin: 50% 0;
        animation: zenzaVideoCardIn 0.42s cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
        animation-delay: var(--card-delay, 0ms);
        transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
      }
      .zenzaVideoSearchPanel .searchVideoCard:hover,
      .zenzaVideoSearchPanel .searchVideoCard.is-selected {
        border-color: var(--zt-accent, #ffb74d);
        box-shadow: 0 6px 18px var(--zt-shadow, rgba(0, 0, 0, 0.6)), 0 0 0 1px var(--zt-accent-translucent, rgba(255, 183, 77, 0.35));
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-leaving {
        animation: zenzaVideoCardOut 0.24s ease both;
        pointer-events: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-opening {
        animation: zenzaVideoCardOpen 0.28s ease both;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-failed {
        animation: zenzaVideoCardIn 0.42s cubic-bezier(0.2, 0.9, 0.25, 1.15) both, zenzaVideoCardShake 0.4s ease 0.42s;
      }
      .zenzaVideoSearchPanel .searchVideoCard-main {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .zenzaVideoSearchPanel .searchVideoCard-thumb {
        position: relative;
        flex: 0 0 104px;
        width: 104px;
        height: 58px;
        border-radius: 4px;
        overflow: hidden;
        background: linear-gradient(90deg, var(--zt-surface-2, #3a3a3a) 0%, var(--zt-surface-3, #555) 50%, var(--zt-surface-2, #3a3a3a) 100%);
        background-size: 200% 100%;
        animation: zenzaVideoCardShimmer 1.2s linear infinite;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-imageLoaded .searchVideoCard-thumb,
      .zenzaVideoSearchPanel .searchVideoCard.is-imageError .searchVideoCard-thumb {
        animation: none;
        background: var(--zt-surface-1, #222);
      }
      .zenzaVideoSearchPanel .searchVideoCard-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        opacity: 0;
        transform: scale(1.08);
        transition: opacity 0.35s ease, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-imageLoaded .searchVideoCard-image {
        opacity: 1;
        transform: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-imageError .searchVideoCard-image {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard-duration {
        position: absolute;
        right: 2px;
        bottom: 2px;
        padding: 0 3px;
        border-radius: 2px;
        background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.75));
        color: var(--zt-text-0, #fff);
        font-size: 10px;
        line-height: 14px;
      }
      .zenzaVideoSearchPanel .searchVideoCard-duration:empty {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard-play {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: var(--zt-text-0, #fff);
        text-shadow: 0 0 6px var(--zt-shadow, rgba(0, 0, 0, 0.8));
        background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.35));
        opacity: 0;
        transform: scale(0.7);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .zenzaVideoSearchPanel .searchVideoCard:hover .searchVideoCard-play,
      .zenzaVideoSearchPanel .searchVideoCard.is-selected .searchVideoCard-play {
        opacity: 1;
        transform: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard-body {
        flex: 1 1 auto;
        min-width: 0;
      }
      .zenzaVideoSearchPanel .searchVideoCard-id {
        font-size: 10px;
        line-height: 1.2;
        color: var(--zt-accent, #ffb74d);
        font-family: monospace;
      }
      .zenzaVideoSearchPanel .searchVideoCard-title {
        margin: 1px 0 2px;
        font-size: 12px;
        line-height: 1.35;
        font-weight: bold;
        color: var(--zt-text-0, #fff);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-all;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-failed .searchVideoCard-title {
        color: var(--zt-danger, #ff8a80);
        font-weight: normal;
      }
      .zenzaVideoSearchPanel .searchVideoCard-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
        font-size: 10px;
        line-height: 1.4;
        color: var(--zt-text-2, #aaa);
      }
      .zenzaVideoSearchPanel .searchVideoCard-owner {
        flex-basis: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--zt-text-2, #bbb);
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-loaded .searchVideoCard-title,
      .zenzaVideoSearchPanel .searchVideoCard.is-loaded .searchVideoCard-meta {
        animation: zenzaVideoCardFade 0.3s ease both;
      }
      .zenzaVideoSearchPanel .searchVideoCard .skeleton {
        display: block;
        height: 10px;
        margin: 3px 0;
        border-radius: 3px;
        background: linear-gradient(90deg, var(--zt-surface-2, #444) 0%, var(--zt-surface-3, #666) 50%, var(--zt-surface-2, #444) 100%);
        background-size: 200% 100%;
        animation: zenzaVideoCardShimmer 1.2s linear infinite;
      }
      .zenzaVideoSearchPanel .searchVideoCard .skeleton.short { width: 60%; }
      .zenzaVideoSearchPanel .searchVideoCard .skeleton.tiny { width: 40%; height: 8px; }

      .zenzaVideoSearchPanel .searchVideoCard-actions {
        display: flex;
        gap: 4px;
        margin-top: 6px;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button {
        position: relative;
        flex: 1 1 auto;
        min-width: 0;
        margin: 0;
        padding: 3px 4px;
        border: 1px solid var(--zt-border, #666);
        border-radius: 4px;
        background: var(--zt-surface-2, #333);
        color: var(--zt-text-1, #ccc);
        font-size: 11px;
        line-height: 1.2;
        white-space: nowrap;
        cursor: pointer;
        overflow: hidden;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button:hover {
        background: var(--zt-surface-3, #555);
        color: var(--zt-text-0, #fff);
      }
      .zenzaVideoSearchPanel .searchVideoCard-button:active {
        transform: scale(0.95);
      }
      .zenzaVideoSearchPanel .searchVideoCard-button.is-primary {
        background: var(--zt-accent, #ff9800);
        border-color: var(--zt-accent, #ffb74d);
        color: var(--zt-text-inverse, #111);
        font-weight: bold;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button.is-primary:hover {
        background: var(--zt-accent, #ffb74d);
      }
      .zenzaVideoSearchPanel .searchVideoCard-button.is-done {
        animation: zenzaVideoCardDone 0.9s ease;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button.is-done::after {
        content: '✓';
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--zt-success-strong, #43a047);
        color: var(--zt-text-0, #fff);
        font-weight: bold;
        animation: zenzaVideoCardDoneMark 0.9s ease both;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-unavailable {
        cursor: not-allowed;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-unavailable .searchVideoCard-button {
        opacity: 0.4;
        pointer-events: none;
        cursor: not-allowed;
      }

      @keyframes zenzaVideoCardIn {
        0%   { opacity: 0; transform: translateY(-10px) scale(0.96); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes zenzaVideoCardOut {
        0%   { opacity: 1; transform: none; }
        100% { opacity: 0; transform: translateX(16px) scale(0.96); }
      }
      @keyframes zenzaVideoCardOpen {
        0%   { transform: none; }
        40%  { transform: scale(0.97); box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.8); }
        100% { transform: scale(1.02); opacity: 0.6; }
      }
      @keyframes zenzaVideoCardShake {
        0%, 100% { transform: none; }
        20% { transform: translateX(-5px); }
        40% { transform: translateX(5px); }
        60% { transform: translateX(-3px); }
        80% { transform: translateX(3px); }
      }
      @keyframes zenzaVideoCardShimmer {
        0%   { background-position: 100% 0; }
        100% { background-position: -100% 0; }
      }
      @keyframes zenzaVideoCardFade {
        0%   { opacity: 0; transform: translateY(3px); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes zenzaVideoCardDone {
        0%   { transform: scale(1); }
        30%  { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      @keyframes zenzaVideoCardDoneMark {
        0%   { opacity: 0; }
        15%  { opacity: 1; }
        75%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .zenzaVideoSearchPanel .searchVideoIdResult,
        .zenzaVideoSearchPanel .searchVideoIdResult *,
        .zenzaVideoSearchPanel .searchVideoCard,
        .zenzaVideoSearchPanel .searchVideoCard * {
          animation-duration: 1ms !important;
          animation-delay: 0ms !important;
          transition-duration: 1ms !important;
        }
      }

      .zenzaVideoSearchPanel .searchWordInput {
        width: 0;
        min-width: 0;
        flex: 1 1 auto;
        box-sizing: border-box;
        margin: 0;
        height: 24px;
        line-height: 24px;
        background: transparent;
        font-size: 16px;
        padding: 0 4px;
        color: var(--zt-text-1, #ccc);
        border: 1px solid var(--zt-border-light, #ccc);
        opacity: 0;
        transition: opacity 0.2s ease;
        will-change: opacity;
      }

      .zenzaVideoSearchPanel .searchWordInput:-webkit-autofill {
        background: transparent;
      }

      .is-mouseMoving .searchWordInput {
        opacity: 0.5;
      }

      .is-mouseMoving .searchWordInput:hover {
        opacity: 0.8;
      }

      .zenzaVideoSearchPanel:focus-within .searchWordInput {
        opacity: 1 !important;
      }

      .zenzaVideoSearchPanel .searchSubmit {
        width: 34px;
        flex: 0 0 34px;
        margin: 0;
        padding: 0;
        font-size: 14px;
        line-height: 24px;
        height: 24px;
        border: solid 1px var(--zt-border-light, #ccc);
        cursor: pointer;
        background: var(--zt-surface-3, #888);
        pointer-events: none;
        opacity: 0;
        transform: translate3d(-100%, 0, 0);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      .zenzaVideoSearchPanel:focus-within .searchSubmit {
        pointer-events: auto;
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }

      .zenzaVideoSearchPanel:focus-within .searchSubmit:hover {
        transform: scale(1.5);
      }

      .zenzaVideoSearchPanel:focus-within .searchSubmit:active {
        transform: scale(1.2);
        border-style: inset;
      }

      .zenzaVideoSearchPanel .searchClear {
        display: inline-block;
        width: 28px;
        flex: 0 0 28px;
        margin: 0;
        padding: 0;
        font-size: 16px;
        line-height: 24px;
        height: 24px;
        border: none;
        cursor: pointer;
        color: var(--zt-text-1, #ccc);
        background: transparent;
        pointer-events: none;
        opacity: 0;
        transform: translate3d(100%, 0, 0);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      .zenzaVideoSearchPanel:focus-within .searchClear {
        pointer-events: auto;
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }

      .zenzaVideoSearchPanel:focus-within .searchClear:hover {
        transform: scale(1.5);
      }

      .zenzaVideoSearchPanel:focus-within .searchClear:active {
        transform: scale(1.2);
      }


    .zenzaVideoSearchPanel .searchInputFoot {
      display: none;
      white-space: normal;
      position: static;
      box-sizing: border-box;
      padding: 4px;
    }
    .zenzaVideoSearchPanel:focus-within .searchInputFoot {
      display: block;
      opacity: 1;
    }

      .zenzaVideoSearchPanel .searchSortSelect,
      .zenzaVideoSearchPanel .searchSortSelect option{
        background: var(--zt-surface-2, #333);
        color: var(--zt-text-1, #ccc);
      }

      .zenzaVideoSearchPanel .ownerOnlyLabel {
        cursor: pointer;
        display: flex;
        align-items: flex-start;
        gap: 4px;
      }

      .zenzaVideoSearchPanel .searchOptionRow {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 4px;
      }
      .zenzaVideoSearchPanel .searchOptionRow select {
        max-width: 100%;
        min-width: 0;
      }
      .zenzaVideoSearchPanel .searchOrderSelect[disabled] {
        opacity: 0.4;
      }

      .zenzaVideoSearchPanel .ownerOnlyLabel input + span {
        display: inline-block;
        pointer-events: none;
      }
      .zenzaVideoSearchPanel .ownerOnlyLabel input[disabled] + span {
        filter: brightness(80%);
        text-decoration: line-through;
      }

  `).trim();
VideoSearchForm.__tpl__ = (`
    <div class="zenzaVideoSearchPanel" id="zenzaVideoSearchPanel">
      <form action="javascript: void(0);">

        <div class="searchInputHead">
          <div class="searchModeRow" role="group" aria-label="検索方法">
            <label class="searchModeLabel"><input type="radio" name="mode" class="searchMode" value="keyword"><span>キーワード</span></label>
            <label class="searchModeLabel"><input type="radio" name="mode" class="searchMode" value="tag" id="zenzaVideoSearch-tag" checked><span>タグ</span></label>
          </div>
          <div class="searchModeRow searchContentRow" role="group" aria-label="検索対象">
            <label class="searchModeLabel"><input type="radio" name="selectContentType" class="searchContentType" value="long" checked><span>動画</span></label>
            <label class="searchModeLabel"><input type="radio" name="selectContentType" class="searchContentType" value="short"><span>ショート</span></label>
          </div>
        </div>

        <div class="searchWord">
          <button class="searchClear command"
            type="button"
            data-command="clear"
            title="クリア">&#x2716;</button>
          <input
            type="text"
            value=""
            autocomplete="off"
            spellcheck="false"
            name="word"
            accesskey="e"
            placeholder="簡易検索(テスト中)"
            class="searchWordInput"
            maxlength="75"
            >
          <input
            type="submit"
            value="▶"
            name="post"
            class="searchSubmit"
            >
        </div>

        <div class="searchVideoIdResult" aria-live="polite">
          <div class="searchVideoIdResult-inner">
            <div class="searchVideoIdResult-head">
              <span class="searchVideoIdResult-label">動画ID</span>
              <span class="searchVideoIdResult-hint"></span>
            </div>
            <div class="searchVideoIdResult-body">
              <div class="searchVideoIdResult-wordCol">
                <button type="button" class="searchVideoIdResult-search" data-action="search">
                  <span class="searchVideoIdResult-searchIcon">&#x1F50D;</span>
                  <span class="searchVideoIdResult-searchLabel"></span>
                  <span class="searchVideoIdResult-searchCount"></span>
                </button>
                <ul class="searchVideoIdResult-tags" role="listbox"></ul>
              </div>
              <div class="searchVideoIdResult-cardCol">
                <div class="searchVideoIdResult-waiting"><span></span><span></span><span></span></div>
                <div class="searchVideoIdResult-list"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="searchInputFoot focusOnly">
          <div class="searchOptionRow">
            <select name="sortKey" class="searchSortSelect searchSortKeySelect" title="並び順">
              <option value="playlist">自動(連続再生用・古い順)</option>
              <option value="h">ニコニコで人気</option>
              <option value="p">あなたへのおすすめ</option>
              <option value="f">投稿日時</option>
              <option value="v">再生数</option>
              <option value="n">コメント日時</option>
              <option value="likeCount">いいね！数</option>
              <option value="r">コメント数</option>
              <option value="m">マイリスト登録数</option>
              <option value="l">再生時間</option>
            </select>
            <select name="sortOrder" class="searchSortSelect searchOrderSelect" title="昇順/降順">
              <option value="d">降順</option>
              <option value="a">昇順</option>
            </select>
          </div>
          <div class="searchOptionRow">
            <select name="f_range" class="searchSortSelect" title="投稿日時">
              <option value="0">期間:指定なし</option>
              <option value="4">1時間以内</option>
              <option value="1">24時間以内</option>
              <option value="2">1週間以内</option>
              <option value="3">1ヶ月以内</option>
              <option value="5">1年以内</option>
            </select>
            <select name="l_range" class="searchSortSelect" title="再生時間">
              <option value="0">長さ:指定なし</option>
              <option value="1">5分以内</option>
              <option value="2">20分以上</option>
            </select>
            <select name="genre" class="searchSortSelect" title="ジャンル">
              <option value="all">ジャンル:指定なし</option>
              <option value="entertainment">エンターテイメント</option>
              <option value="radio">ラジオ</option>
              <option value="music_sound">音楽・サウンド</option>
              <option value="dance">ダンス</option>
              <option value="animal">動物</option>
              <option value="nature">自然</option>
              <option value="cooking">料理</option>
              <option value="traveling_outdoor">旅行・アウトドア</option>
              <option value="vehicle">乗り物</option>
              <option value="sports">スポーツ</option>
              <option value="society_politics_news">社会・政治・時事</option>
              <option value="technology_craft">技術・工作</option>
              <option value="commentary_lecture">解説・講座</option>
              <option value="anime">アニメ</option>
              <option value="game">ゲーム</option>
              <option value="other">その他</option>
              <option value="r18">例のソレ</option>
            </select>
          </div>
          <label class="ownerOnlyLabel" title="いま再生中の動画を投稿したユーザー（またはチャンネル）の動画だけに絞り込みます">
            <input type="checkbox" name="ownerOnly">
            <span>再生中の動画の投稿者の動画のみ</span>
          </label>
        </div>

      </form>
    </div>
  `).toString();
//===END===
export {
  VideoSearchForm
};
