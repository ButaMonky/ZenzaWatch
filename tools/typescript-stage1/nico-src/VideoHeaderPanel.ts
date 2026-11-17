/**
 * Canonical TypeScript source for src/VideoHeaderPanel.js (Task1063: VideoInfoPanel.ts から分割).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const CONSTANT: import('./shared-types/Constant').ZenzaConstant;
declare const ClassList: typeof import('./ClassList').ClassList;
declare const Config: Loose;
declare const Emitter: typeof import('./Emitter').Emitter;
declare const Fullscreen: typeof import('./Fullscreen').Fullscreen;
declare const RelatedInfoMenu: typeof import('./RelatedInfoMenu').RelatedInfoMenu;
declare const TagListView: typeof import('./TagListView').TagListView;
declare const UiVisibilityRegistry: typeof import('./external/UiVisibilityRegistry').UiVisibilityRegistry;
declare const VideoMetaInfo: typeof import('./VideoMetaInfo').VideoMetaInfo;
declare const VideoSearchForm: typeof import('./VideoSearchForm').VideoSearchForm;
declare const _: import('./shared-types/Lodash').LodashSubset;
declare const css: typeof import('./css').css;
declare const cssUtil: typeof import('./css').cssUtil;
declare const global: import('./shared-types/ZenzaGlobal').ZenzaGlobal;
declare const uq: typeof import('./uQuery').uq;

class VideoHeaderPanel extends Emitter {
  declare static HOLD_LINGER_MS: Loose;
  declare static __tpl__: Loose;
  declare static __css__: Loose;
  declare _$view: Loose;
  declare _height: Loose;
  declare _isInitialized: Loose;
  declare _lastOutsideLayout: Loose;
  declare _lingerTimer: Loose;
  declare _lingering: Loose;
  declare _relatedInfoMenu: Loose;
  declare _searchForm: Loose;
  declare _seriesCover: Loose;
  declare _tagListView: Loose;
  declare _videoInfo: Loose;
  declare _videoMetaInfo: Loose;
  declare _videoTitle: Loose;
  declare _visibility: Loose;
  declare classList: Loose;
  constructor(params?: Loose) {
    super();
  }
  _initializeDom() {
    if (this._isInitialized) {
      return;
    }
    this._isInitialized = true;
    cssUtil.addStyle(VideoHeaderPanel.__css__);
    const $view = this._$view = uq.html(VideoHeaderPanel.__tpl__);
    const view = $view[0];
    const classList = this.classList = ClassList(view);

    this._videoTitle = $view.find('.videoTitle')[0];
    this._searchForm = new VideoSearchForm({
      parentNode: view
    });

    $view.on('wheel', (e?: Loose) => e.stopPropagation(), {passive: true});
    this._seriesCover = view.querySelector('.series-thumbnail');

    this._tagListView = new TagListView({
      parentNode: view.querySelector('.videoTagsContainer')
    });

    this._relatedInfoMenu = new RelatedInfoMenu({
      parentNode: view.querySelector('.relatedInfoMenuContainer'),
      isHeader: true
    });
    this._relatedInfoMenu.on('open', () => {
      classList.add('is-relatedMenuOpen');
      this._updateHold();
    });
    this._relatedInfoMenu.on('close', () => {
      classList.remove('is-relatedMenuOpen');
      this._updateHold();
    });
    this._initHold(view);

    this._videoMetaInfo = new VideoMetaInfo({
      parentNode: view.querySelector('.videoMetaInfoContainer'),
    });

    this._visibility = UiVisibilityRegistry.connect(Config,view,'header',{
      beforeHide:(entry?: Loose,node?: Loose)=>{
        // Avoid keeping keyboard focus inside a hidden search field.
        if(entry.key==='ui.header.search' && node.contains(document.activeElement)){
          (document.activeElement as Loose).blur?.();
        }
      },
      afterApply:()=>{
        if(!view.isConnected){return;}
        this._resetHeight();
        this._onResize();
      }
    });

    classList.add(Fullscreen.now() ? 'is-fullscreen' : 'is-notFullscreen');
    global.emitter.on('fullScreenStatusChange', (isFull?: Loose) => {
      classList.toggle('is-fullscreen', isFull);
      classList.toggle('is-notFullscreen', !isFull);
      // Task 076: 全画面に入った/出た時は、外に出すための調整をすぐ戻す／やり直す
      this._onResize();
      window.setTimeout(() => this._onResize(), 600);
    });

    new MutationObserver((mutationList) => {
      for (const mutation of mutationList) {
        if (mutation.type !== 'attributes') return;
        if (mutation.attributeName !== 'data-screen-mode') return;

        this._resetHeight();
        window.setTimeout(() => this._onResize(), 1000);
        break;
      }
    }).observe(window.document.body, {attributes: true});
    window.addEventListener('resize', _.debounce(this._onResize.bind(this), 500));
    // Task 072: 表示位置の設定を変えたらすぐ反映する
    Config.onkey('videoHeader.position', () => {
      this._resetHeight();
      this._onResize();
      window.setTimeout(() => this._onResize(), 300);
    });
  }
  update(videoInfo?: Loose) {
    this._videoInfo = videoInfo;

    this._videoTitle.title =  this._videoTitle.textContent = videoInfo.title;

    const watchId = videoInfo.watchId;
    this._videoMetaInfo.update(videoInfo);

    this._tagListView.update({
      tagList: videoInfo.tagList,
      watchId,
      videoId: videoInfo.videoId,
      token: videoInfo.csrfToken,
      tagEdit: videoInfo.tagEdit,
      genre: videoInfo.genre, // Task 074: タグ欄の先頭にジャンルを表示する
    });

    this._relatedInfoMenu.update(videoInfo);

    const classList = this.classList;
    classList.remove('userVideo', 'channelVideo', 'initializing');
    classList.toggle('is-community', this._videoInfo.isCommunityVideo);
    classList.toggle('is-mymemory', this._videoInfo.isMymemory);
    classList.toggle('has-Parent', this._videoInfo.hasParentVideo);
    classList.add(videoInfo.isChannel ? 'channelVideo' : 'userVideo');
    this._$view.raf.css('display', '');

    if (videoInfo.series && videoInfo.series.thumbnailUrl) {
      this._seriesCover.style.backgroundImage = `url("${videoInfo.series.thumbnailUrl}")`;
    } else {
      this._seriesCover.removeAttribute('style');
    }

    this._resetHeight();
    window.setTimeout(() => this._onResize(), 1000);
  }
  updateVideoCount(...args: Loose[]) {
    this._videoMetaInfo.updateVideoCount(...args);
  }
  _resetHeight() {
    this._height = undefined;
  }
  /*
   * Task 076 (D-18): 入力中・メニュー表示中にヘッダーが透明になって消えないようにする。
   * 原因: ヘッダーは :hover か is-mouseMoving の時だけ表示されるため、検索欄に入力中（マウス静止）や、
   *       関連メニュー・タグの「？」メニューからマウスが外れた瞬間に透明になり、タグ欄も消えていた。
   * 対応（2026-09-17の提案 2-A＋2-B）:
   *  2-A 操作中は固定表示: ヘッダーの中にフォーカスがある間（検索欄・「？」メニュー・関連メニュー）と、
   *      関連メニューを開いている間は is-hold を付けて表示し続ける
   *  2-B 消えるまでの猶予: マウスがヘッダーから出ても HOLD_LINGER_MS の間は表示したままにする
   */
  _initHold(view?: Loose) {
    const update = () => this._updateHold();
    // シャドウDOMの中のフォーカスも focusin/focusout は外側まで届く
    view.addEventListener('focusin', update);
    view.addEventListener('focusout', () => window.setTimeout(update, 0));
    view.addEventListener('mouseenter', () => {
      window.clearTimeout(this._lingerTimer);
      this._lingering = false;
      update();
    });
    view.addEventListener('mouseleave', () => {
      window.clearTimeout(this._lingerTimer);
      this._lingering = true;
      update();
      this._lingerTimer = window.setTimeout(() => {
        this._lingering = false;
        update();
      }, VideoHeaderPanel.HOLD_LINGER_MS);
    });
  }
  _updateHold() {
    const view = this._$view && this._$view[0];
    if (!view) {
      return;
    }
    let focused = false;
    try {
      focused = view.matches(':focus-within');
    } catch (e) {
      focused = view.contains(document.activeElement);
    }
    const hold = focused || this._lingering || view.classList.contains('is-relatedMenuOpen');
    view.classList.toggle('is-hold', !!hold);
    view.classList.toggle('is-holdFocus', !!focused);
  }
  /*
   * Task 072: 動画ヘッダーの表示位置を設定（videoHeader.position）で選べるようにした。
   * 従来（auto）は「動画の上に置いた時に画面上端から20px以上はみ出すか」で、
   * 動画の外に置く／動画に重ねて自動で隠す（is-onscreen）を切り替えていた。
   * そのため同じ画面モードでも、タグの行数（ヘッダーの高さ）やウィンドウの大きさ次第で表示が変わっていた。
   *
   * Task 076: 「常に動画の外」の収め方を作り直した（Task 074の「動画だけ下げる」方式は、
   * ヘッダーが動画ではなく .zenzaPlayerContainer の上端基準で置かれているため効いていなかった）。
   * 実際に測りながら layoutOutsideHeader() で収める（詳細はその関数のコメント参照）。
   */
  _onResize() {
    const view = this._$view && this._$view[0];
    if (!view) {
      return;
    }
    const configMode = Config.props['videoHeader.position'] || 'auto';
    const classList = this.classList;
    // Task 076: 設定が効くのは通常・大モード（全画面を除く）だけ。
    // それ以外（小・サイドビュー・ワイド・3D・全画面）は従来通り(auto)の判定にする。
    // 以前は画面モードに関係なく is-onscreen を付けていたため、サイドビューで「常に重ねる」にすると
    // .is-onscreen { width: 100% !important } がサイドビュー用の幅を上書きしてしまっていた。
    const target = VideoHeaderPanel.isOutsideLayoutTarget(view);
    const mode = target ? configMode : 'auto';
    const layoutActive = mode === 'outside';
    if (!layoutActive) {
      // 自分が加えたズレ・縮みを戻してから判定する
      VideoHeaderPanel.resetOutsideLayout(view);
    }
    const rect = view.getBoundingClientRect();
    const isOnscreen = classList.contains('is-onscreen');
    const height = this._height ?? (rect.bottom - rect.top);
    if (!this._height && !isOnscreen) {
      this._height = height;
    }
    // The outside rule is bottom: calc(100% + 8px). Include its gap when
    // predicting that position from the overlay, or the -20px boundary flips
    // back and forth after the overlay hides the tag row.
    const top = isOnscreen ? (rect.top - height - 8) : rect.top;
    let onscreen;
    switch (mode) {
      case 'outside':
        onscreen = false;
        break;
      case 'overlay':
      case 'overlay-visible':
        onscreen = true;
        break;
      default:
        onscreen = top < -20;
    }
    classList.toggle('is-onscreen', onscreen);
    classList.toggle('is-overlayVisible', mode === 'overlay-visible');
    classList.toggle('is-outsideFixed', mode === 'outside');

    if (layoutActive) {
      const result = VideoHeaderPanel.layoutOutsideHeader(view);
      this._lastOutsideLayout = result;
      if (result && result.changed) {
        console.log('%c[Task076] ヘッダー配置', 'color: #0a0', result);
      }
    }
  }
  /* 「常に動画の外」の配置を行う画面モードか（通常・大、かつ全画面でない） */
  static isOutsideLayoutTarget(view?: Loose) {
    const body = document.body;
    if (!body.classList.contains('zenzaScreenMode_normal') &&
        !body.classList.contains('zenzaScreenMode_big')) {
      return false;
    }
    if (view && view.classList.contains('is-fullscreen')) {
      return false;
    }
    return !(Fullscreen && typeof Fullscreen.now === 'function' && Fullscreen.now());
  }
  // @@TASK076_LAYOUT_BEGIN
  /*
   * Task 076: 自分が加えたズレ・縮みを全部戻す
   */
  static resetOutsideLayout(view?: Loose) {
    const body = document.body;
    body.classList.remove('zenzaHeaderOutsideActive');
    body.style.removeProperty('--zenza-dialog-shift-y');
    if (view) {
      view.classList.remove('is-compact', 'is-tagsClamped');
      view.style.removeProperty('--zenza-header-outside-shift');
      view.style.removeProperty('--zenza-header-tags-max');
    }
  }
  /*
   * Task 076: 「常に動画の外」のヘッダーを画面内に収める。推測せず、1段ずつ実際に測りながら進める。
   *
   * 前提（実測で確認済み）
   *  - ヘッダーは .zenzaPlayerContainer の上端を基準に置かれている（bottom: calc(100% + 8px)）。
   *    動画(.videoPlayer)だけ動かしてもヘッダーは動かない。
   *  - .zenzaVideoPlayerDialogInner（プレイヤー＋情報パネルの箱）はダイアログの中央に置かれている
   *    （display:flex; align-items:center）。箱を下げればプレイヤーもヘッダーも一緒に下がる。
   *  - 再生バーは position: fixed で画面の一番下にある。動画の下端はバーの上端より上に保つ。
   *  - 画面の幅が狭い時は、情報パネル（プレイリスト等）がプレイヤーの「下」に来る（padding-bottom: 240px）。
   *
   * 順番
   *  0. 自分が加えたズレ・縮みを全部戻して素の位置を測る
   *  1. 箱ごと下げる（margin-top。transformやpositionは中のfixed/absoluteの基準を変えるので使わない）。
   *     下げてよい量 = 箱の下の空き。情報パネルが下にある時は、パネルが最低 MIN_INFO_VISIBLE(120)px 見える所まで。
   *     ただし動画の下端が再生バーに潜らない範囲
   *  2. コンパクト表示（is-compact: タイトル・メタ情報の文字と余白を詰める）
   *  3. タグ欄に高さの上限（is-tagsClamped: あふれた分はタグ欄の中でスクロール。最低1行は見せる）
   *  4. 残りだけヘッダー自体を下げる（動画の上端に重なる。動画の高さの1/4まで）
   * どの段階でも、最終的なヘッダーの上端が SAFE_TOP px 以上になれば終了する。
   */
  static layoutOutsideHeader(view?: Loose) {
    const SAFE_TOP = 4;
    const MIN_INFO_VISIBLE = 120;
    const body = document.body;
    const container = view.closest('.zenzaPlayerContainer') ||
      document.querySelector('.zenzaPlayerContainer');
    const inner = view.closest('.zenzaVideoPlayerDialogInner') ||
      document.querySelector('.zenzaVideoPlayerDialogInner');
    const prev = {
      dialogShift: parseFloat(body.style.getPropertyValue('--zenza-dialog-shift-y')) || 0,
      compact: view.classList.contains('is-compact'),
      clamped: view.classList.contains('is-tagsClamped'),
      headerShift: parseFloat(view.style.getPropertyValue('--zenza-header-outside-shift')) || 0
    };
    // 0. 全部戻して素の位置を測る
    VideoHeaderPanel.resetOutsideLayout(view);
    const result = {
      dialogShift: 0, compact: false, tagsMax: (null as Loose), headerShift: 0,
      headerTop: (null as Loose), changed: false
    };
    const finish = () => {
      result.headerTop = Math.round(view.getBoundingClientRect().top);
      result.changed = prev.dialogShift !== result.dialogShift ||
        prev.compact !== result.compact ||
        prev.clamped !== (result.tagsMax !== null) ||
        prev.headerShift !== result.headerShift;
      return result;
    };
    if (!container || !inner) {
      return finish();
    }
    let hRect = view.getBoundingClientRect();
    if (hRect.height <= 0) {
      return finish();
    }
    const over = () => SAFE_TOP - view.getBoundingClientRect().top;
    if (over() <= 0) {
      return finish();
    }
    body.classList.add('zenzaHeaderOutsideActive');

    // 1. 箱ごと下げる
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const cRect = container.getBoundingClientRect();
    const iRect = inner.getBoundingClientRect();
    const bar = container.querySelector('.videoControlBar');
    let floor = viewportH; // 動画の下端がこれより下に行かないようにする
    if (bar) {
      const bRect = bar.getBoundingClientRect();
      const barFixed = window.getComputedStyle(bar).position === 'fixed';
      if (barFixed && bRect.height > 0 && bRect.top > cRect.top) {
        floor = Math.min(floor, bRect.top);
      }
    }
    const containerRoom = Math.max(0, Math.floor(floor - cRect.bottom));
    let boxRoom = Math.max(0, Math.floor(viewportH - iRect.bottom));
    const info = inner.querySelector('.zenzaWatchVideoInfoPanel');
    if (info) {
      const infoRect = info.getBoundingClientRect();
      const infoBelow = infoRect.height > 0 && infoRect.top >= cRect.bottom - 2;
      if (infoBelow) {
        const visible = Math.min(viewportH, floor) - infoRect.top;
        boxRoom = Math.max(boxRoom, Math.floor(visible - MIN_INFO_VISIBLE));
      }
    }
    const dialogShift = Math.max(0, Math.min(Math.ceil(over()), containerRoom, boxRoom));
    if (dialogShift > 0) {
      body.style.setProperty('--zenza-dialog-shift-y', `${dialogShift}px`);
      result.dialogShift = dialogShift;
    }
    if (over() <= 0) {
      return finish();
    }

    // 2. コンパクト表示
    view.classList.add('is-compact');
    result.compact = true;
    if (over() <= 0) {
      // 小さくして余った分だけ、箱を下げる量を戻す（情報パネルをなるべく多く見せる）
      const spare = Math.floor(-over());
      if (spare > 0 && result.dialogShift > 0) {
        result.dialogShift = Math.max(0, result.dialogShift - spare);
        body.style.setProperty('--zenza-dialog-shift-y', `${result.dialogShift}px`);
      }
      return finish();
    }

    // 3. タグ欄に高さの上限（最低1行）
    const tags = view.querySelector('.videoTagsContainer');
    if (tags) {
      const tRect = tags.getBoundingClientRect();
      // タグの一覧はシャドウDOMの中にあることがあるので、両方探す
      const host = tags.firstElementChild;
      const firstItem = tags.querySelector('li') ||
        (host && host.shadowRoot && host.shadowRoot.querySelector('li'));
      const rowH = firstItem ? Math.ceil(firstItem.getBoundingClientRect().height + 4) : 28;
      const minH = Math.max(28, rowH);
      if (tRect.height > minH) {
        const max = Math.max(minH, Math.floor(tRect.height - Math.ceil(over())));
        view.style.setProperty('--zenza-header-tags-max', `${max}px`);
        view.classList.add('is-tagsClamped');
        result.tagsMax = max;
      }
    }
    if (over() <= 0) {
      return finish();
    }

    // 4. 残りだけヘッダー自体を下げる（動画の上端に重なる。動画の高さの1/4まで）
    const limit = Math.floor(container.getBoundingClientRect().height / 4);
    const headerShift = Math.max(0, Math.min(Math.ceil(over()), limit));
    if (headerShift > 0) {
      view.style.setProperty('--zenza-header-outside-shift', `${headerShift}px`);
      result.headerShift = headerShift;
    }
    return finish();
  }
  // @@TASK076_LAYOUT_END
  appendTo(node?: Loose) {
    this._initializeDom();
    this._$view.appendTo(node);
  }
  hide() {
    if (!this._$view) {
      return;
    }
    this.classList.remove('show');
  }
  close() {
  }
  clear() {
    if (!this._$view) {
      return;
    }
    this.classList.add('initializing');

    this._videoTitle.textContent = '';
  }
  getPublicStatusDom() {
    return this._$view.find('.publicStatus').html();
  }
}

css.addStyle(`
  .zenzaScreenMode_small .zenzaWatchVideoHeaderPanel {
    display: none;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel {
    top: 0;
    left: 400px;
    width: calc(100vw - 400px);
    bottom: auto;
    background: var(--zt-surface-1, #272727);
    opacity: 0.9;
    height: 40px;
  }
  /* ヘッダ追従 */
  body.zenzaScreenMode_sideView:not(.nofix)  .zenzaWatchVideoHeaderPanel {
    top: 0;
  }
  /* ヘッダ固定 */
  .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel .videoTitleContainer {
    margin: 0;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel .publicStatus,
  .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel .videoTagsContainer {
    display: none;
  }

  @media screen and (min-width: 1432px)
  {
    .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .tabSelectContainer {
      width: calc(100% - 16px);
    }
    .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel {
      top: calc((100vw - 1024px) * 9 / 16 + 4px);
      width: calc(100vw - 1024px);
      height: calc(100vh - (100vw - 1024px) * 9 / 16 - 70px);
    }

    .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoTagsContainer {
      width: calc(100vw - 1024px - 26px);
    }

    .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel {
      width: calc(100vw - (100vw - 1024px));
      left:  calc(100vw - 1024px);
    }
  }

`, {className: 'screenMode for-popup videoHeaderPanel', disabled: true});

css.addStyle(`
  body .is-open .zenzaWatchVideoHeaderPanel {
    width: calc(100% + ${CONSTANT.RIGHT_PANEL_WIDTH}px);
  }
    .zenzaWatchVideoHeaderPanel.is-onscreen {
      top: 0px;
      bottom: auto;
      background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.5));
      opacity: 0;
      box-shadow: none;
    }

    .is-loading .zenzaWatchVideoHeaderPanel.is-onscreen {
      opacity: 0.6;
      transition: 0.4s opacity;
    }

    .zenzaWatchVideoHeaderPanel.is-onscreen:hover {
      opacity: 1;
      transition: 0.5s opacity;
    }

    .zenzaWatchVideoHeaderPanel.is-onscreen:not(:hover) .videoTagsContainer {
      display: none;
    }
    .zenzaWatchVideoHeaderPanel.is-onscreen .videoTitleContainer {
      width: calc(100% - 220px);
    }

    .zenzaWatchVideoInfoPanelFoot {
      background: var(--zt-surface-1, #222);
    }

`, {className: 'screenMode for-dialog videoHeaderPanel', disabled: true});

css.addStyle(`
  .is-open .zenzaWatchVideoHeaderPanel {
    position: absolute; /* fixedだとFirefoxのバグでおかしくなる */
    top: 0px;
    bottom: auto;
    background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.5));
    opacity: 0;
    box-shadow: none;
  }

  .is-loading .zenzaWatchVideoHeaderPanel,
  .is-mouseMoving .zenzaWatchVideoHeaderPanel {
    opacity: 0.6;
    transition: 0.4s opacity;
  }

  .is-open .showVideoHeaderPanel .zenzaWatchVideoHeaderPanel,
  .is-open .zenzaWatchVideoHeaderPanel:hover {
    opacity: 1;
    transition: 0.5s opacity;
  }

  .is-open .zenzaWatchVideoHeaderPanel:not(:hover) .videoTagsContainer {
    display: none;
  }

  .is-open .zenzaWatchVideoHeaderPanel .videoTitleContainer {
    width: calc(100% - 220px);
  }

`, {className: 'screenMode for-full videoHeaderPanel', disabled: true});

VideoHeaderPanel.__css__ = (`
    .zenzaWatchVideoHeaderPanel {
      position: absolute;
      width: calc(100%);
      z-index: 30000;
      box-sizing: border-box;
      padding: 8px 8px 0;
      bottom: calc(100% + 8px);
      left: 0;
      background: var(--zt-surface-2, #333);
      color: var(--zt-text-1, #ccc);
      text-align: left;
      box-shadow: 4px 4px 4px var(--zt-shadow, #000);
      transition: opacity 0.4s ease;
      will-change: transform;
    }
    .zenzaWatchVideoHeaderPanel.is-onscreen {
      width: 100% !important;
    }

    /* Task 076: 「常に動画の外」でヘッダーが収まらない時の収め方（layoutOutsideHeader）。
       JSが実測して zenzaHeaderOutsideActive / is-compact / is-tagsClamped を付ける。
       画面モードが変わった瞬間に効かなくなるよう、通常・大モードの時だけ有効にしている。 */
    /* 1. プレイヤーの箱ごと下げる。箱は flex の align-items:center で中央にあるため、
          margin-top を「下げたい量×2」にすると箱がちょうど「下げたい量」だけ下がる。
          transform や position:relative は中の fixed/absolute の基準を変えるので使わない */
    body.zenzaScreenMode_normal.zenzaHeaderOutsideActive .zenzaVideoPlayerDialogInner,
    body.zenzaScreenMode_big.zenzaHeaderOutsideActive    .zenzaVideoPlayerDialogInner {
      margin-top: calc(var(--zenza-dialog-shift-y, 0px) * 2);
    }
    /* 2. コンパクト表示（文字と余白を小さくする） */
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen),
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) {
      padding-top: 4px;
    }
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTitle,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTitle {
      font-size: 18px;
      padding: 0;
    }
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTitleContainer,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTitleContainer {
      margin: 2px 8px;
    }
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTagsContainer,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTagsContainer {
      font-size: 12px;
    }
    /* 3. タグ欄に高さの上限。あふれた分はタグ欄の中でスクロール */
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-tagsClamped:not(.is-fullscreen) .videoTagsContainer,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-tagsClamped:not(.is-fullscreen) .videoTagsContainer {
      max-height: var(--zenza-header-tags-max, none);
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
    /* 4. 残りだけヘッダー自体を下げる（Task 072 から） */
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-outsideFixed:not(.is-onscreen):not(.is-fullscreen),
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-outsideFixed:not(.is-onscreen):not(.is-fullscreen) {
      transform: translateY(var(--zenza-header-outside-shift, 0px));
    }

    /* Task 076 (D-18): 入力中・メニュー表示中・マウスが出てから1.5秒は、隠れる設定でも表示し続ける */
    .zenzaWatchVideoHeaderPanel.is-hold {
      opacity: 1 !important;
      pointer-events: auto !important;
      transition: opacity 0.2s ease;
    }
    body:not(.zenzaScreenMode_sideView):not(.zenzaScreenMode_small) .zenzaWatchVideoHeaderPanel.is-hold .videoTagsContainer {
      display: block !important;
    }

    /* Task 072: 表示位置「常に動画に重ねる（隠さない）」 */
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-onscreen.is-overlayVisible,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-onscreen.is-overlayVisible {
      opacity: 1 !important;
      pointer-events: auto;
    }
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-onscreen.is-overlayVisible .videoTagsContainer,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-onscreen.is-overlayVisible .videoTagsContainer {
      display: block !important;
    }
    .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel,
    .zenzaWatchVideoHeaderPanel.is-fullscreen {
      z-index: 20000;
    }

    .zenzaWatchVideoHeaderPanel {
      pointer-events: none;
    }

    .is-mouseMoving .zenzaWatchVideoHeaderPanel,
                    .zenzaWatchVideoHeaderPanel:hover {
      pointer-events: auto;
    }

    .zenzaWatchVideoHeaderPanel.initializing {
      display: none;
    }
    .zenzaWatchVideoHeaderPanel.initializing>*{
      opacity: 0;
    }

    .zenzaWatchVideoHeaderPanel .videoTitleContainer {
      margin: 8px;
    }
    .zenzaWatchVideoHeaderPanel .publicStatus {
      position: relative;
      color: var(--zt-text-1, #ccc);
    }

    .zenzaWatchVideoHeaderPanel .videoTitle {
      font-size: 24px;
      color: var(--zt-text-0, #fff);
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      display: block;
      padding: 2px 0;
    }

    .zenzaWatchVideoHeaderPanel .videoTitle::before {
      display: none;
      position: absolute;
      font-size: 12px;
      top: 0;
      left: 0;
      background: var(--zt-surface-2, #333);
      border: 1px solid var(--zt-border, #888);
      padding: 2px 4px;
      pointer-events: none;
    }
    .zenzaWatchVideoHeaderPanel.is-mymemory:not(:hover) .videoTitle::before {
      content: 'マイメモリー';
      display: inline-block;
    }
    .zenzaWatchVideoHeaderPanel.is-community:not(:hover) .videoTitle::before {
      content: 'コミュニティ動画';
      display: inline-block;
    }

    .videoMetaInfoContainer {
      display: inline-block;
    }

    .zenzaWatchVideoHeaderPanel .relatedInfoMenuContainer {
      display: inline-block;
      position: absolute;
      top: 0;
      margin: 0 16px;
      z-index: 1000;
    }

    .zenzaWatchVideoHeaderPanel:focus-within,
    .zenzaWatchVideoHeaderPanel.is-relatedMenuOpen {
      z-index: 50000;
    }

    .zenzaWatchVideoHeaderPanel .series-thumbnail-cover {
      position: absolute;
      top: 0px;
      right: 0px;
      width: 50%;
      height: 100%;
      display: inline-block;
      overflow: hidden;
      contain: strict;
      pointer-events: none;
      user-select: none;
    }
    .zenzaWatchVideoHeaderPanel .series-thumbnail[style] {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      /*filter: sepia(50%) blur(4px);*/
      background-size: cover;
      background-position: center center;
      background-repeat: no-repeat;
      will-change: transform;
      -webkit-mask-image:
        linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 100%);
      mask-image:
        linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 100%);
    }
  `);

// Task 076 (D-18): マウスがヘッダーから出てから消えるまでの猶予
VideoHeaderPanel.HOLD_LINGER_MS = 1500;

VideoHeaderPanel.__tpl__ = (`
    <div class="zenzaWatchVideoHeaderPanel show initializing" style="display: none;">
      <h2 class="videoTitleContainer">
        <span class="videoTitle"></span>
      </h2>
      <p class="publicStatus">
        <span class="videoMetaInfoContainer"></span>
        <span class="relatedInfoMenuContainer"></span>
      </p>
      <div class="videoTagsContainer videoHeader">
      </div>
      <div class="series-thumbnail-cover"><div class="series-thumbnail"></div></div>
    </div>
  `).trim();

export {
  VideoHeaderPanel
};
