/**
 * Canonical TypeScript source for src/VideoHoverMenu.js (Task1060: NicoVideoPlayerDialog.ts から分割).
 * 動画の上に出るホバーメニュー。
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const MylistApiLoader: typeof import('./MylistApiLoader').MylistApiLoader;
declare const UiVisibilityRegistry: typeof import('./external/UiVisibilityRegistry').UiVisibilityRegistry;
declare const _: import('./shared-types/Lodash').LodashSubset;
declare const global: import('./shared-types/ZenzaGlobal').ZenzaGlobal;
declare const util: import('./shared-types/ZenzaUtil').ZenzaUtil;
declare const startup: import('../../../src/ZenzaContext').ZenzaStartup;


class VideoHoverMenu {
  declare static __tpl__: Loose;
  declare _bound: Loose;
  declare _config: Loose;
  declare _container: Loose;
  declare _mylistApiLoader: Loose;
  declare _mylistList: Loose;
  declare _state: Loose;
  declare _view: Loose;
  declare _visibility: Loose;
  static get VISIBILITY() {
    return UiVisibilityRegistry.list('hover').map((item?: Loose)=>[item.key,item.selector]);
  }
  constructor(...args: Loose[]) {
    this.initialize(...args);
  }
  initialize(params?: Loose) {
    this._container = params.playerContainer;
    this._state = params.playerState;
    this._config = params.playerConfig || null;

    this._bound = {};
    this._bound.emitClose =
      _.debounce(() => util.dispatchCommand(this._container, 'close'), 300);

    this._initializeDom();
  }
  async _initializeDom() {
    const container = this._container;
    util.$.html(VideoHoverMenu.__tpl__).appendTo(container);
    this._view = container.querySelector('.hoverMenuContainer');
    if (this._config) {
      this._visibility = UiVisibilityRegistry.connect(this._config,this._view,'hover');
    }

    const share = container.querySelector('.zenzaTweetButton') as HTMLElement | null;
    if (share) {
      for (const type of ['keydown', 'keyup'] as const) {
        share.addEventListener(type, (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') { return; }
          event.stopPropagation();
          event.preventDefault();
          if (!event.repeat && ((event.key === 'Enter' && type === 'keydown') ||
              (event.key === ' ' && type === 'keyup'))) { share.click(); }
        });
      }
    }

    const $mc = util.$(container.querySelectorAll('.menuItemContainer'));
    $mc.on('contextmenu',
      (e?: Loose) => { e.preventDefault(); e.stopPropagation(); });
    $mc.on('click', this._onClick.bind(this));
    $mc.on('mousedown', this._onMouseDown.bind(this));

    global.emitter.on('hideHover', this._hideMenu.bind(this));
    await this._initializeMylistSelectMenu()
      .catch(() => console.warn('Hover menu mylist submenu unavailable'));
  }
  _applyIconVisibility(key?: Loose) {
    if (!this._view || !this._config) { return; }
    return UiVisibilityRegistry.apply(this._config,this._view,key);
  }
  async _initializeMylistSelectMenu() {
    if (!util.isLogin()) {
      return;
    }
    this._mylistApiLoader = MylistApiLoader;
    this._mylistList = await this._mylistApiLoader.getMylistList();
    this._initializeMylistSelectMenuDom();
  }
  _initializeMylistSelectMenuDom(mylistList?: Loose) {
    if (!util.isLogin()) {
      return;
    }
    mylistList = mylistList || this._mylistList;
    const menu = this._container.querySelector('.mylistSelectMenu');
    menu.addEventListener('wheel', (e?: Loose) => e.stopPropagation(), {passive: true});

    const ul = document.createElement('ul');
    mylistList.forEach((mylist?: Loose) => {
      const li = document.createElement('li');

      const icon = document.createElement('span');
      icon.className = 'mylistIcon command';
      Object.assign(icon.dataset, {
        mylistId: mylist.id,
        mylistName: mylist.name,
        command: 'mylistOpen'
      });
      icon.title = mylist.name + 'を開く';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      const folder = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      folder.setAttribute('d', 'M1 6V5c0-1.1.9-2 2-2h7a2 2 0 011.6.9L13 6h8a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V6z');
      if (mylist.isPublic) {
        folder.setAttribute('fill-rule', 'evenodd');
        svg.append(folder);
      } else {
        const graph = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        graph.setAttribute('fill-rule', 'evenodd');
        const locked = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        locked.setAttribute('fill', '#FFF');
        locked.setAttribute('d', 'M17 13v-.5a1.5 1.5 0 00-3 0v.5h3zm2 0h1.2c.4 0 .8.4.8.9V19c0 .5-.4.9-.9.9H11a.9.9 0 01-.9-.9V14c0-.5.4-.9.9-.9H12v-.5a3.5 3.5 0 117 0v.5zm-3.5 2a1.5 1.5 0 100 3 1.5 1.5 0 000-3z');
        graph.append(folder, locked);
        svg.append(graph);
      }
      icon.append(svg);

      const link = document.createElement('a');
      link.className = 'mylistLink name command';
      link.textContent = mylist.name;
      link.href = `https://www.nicovideo.jp/my/mylist/#/${mylist.id}`;
      Object.assign(link.dataset, {
        mylistId: mylist.id,
        mylistName: mylist.name,
        command: 'mylistAdd'
      });

      li.append(icon, link);
      ul.append(li);
    });

    menu.querySelector('.mylistSelectMenuInner').append(ul);
  }
  _onMouseDown(e?: Loose) {
    e.stopPropagation();
    const target = e.target.closest('[data-command]');
    if (!target) {
      return;
    }
    let command = target.dataset.command;
    switch (command) {
      case 'deflistAdd':
        if (e.shiftKey) {
          command = 'mylistWindow';
        } else {
          command = e.which > 1 ? 'deflistRemove' : 'deflistAdd';
        }
        util.dispatchCommand(target, command);
        break;
      case 'toggle-like':
        util.dispatchCommand(target, command);
        break;
      case 'mylistAdd': {
        command = (e.shiftKey || e.which > 1) ? 'mylistRemove' : 'mylistAdd';
        const {mylistId, mylistName} = target.dataset;
        this._hideMenu();
        util.dispatchCommand(target, command, {mylistId, mylistName});
        break;
      }
      case 'mylistOpen': {
        const mylistId = target.dataset.mylistId;
        location.href = `https://www.nicovideo.jp/my/mylist/#/${mylistId}`;
        break;
      }
      case 'close':
        this._bound.emitClose();
        break;
      default:
        return;
    }
  }
  _onClick(e?: Loose) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target.closest('[data-command]');
    if (!target) {
      return;
    }
    let {command, type, param} = target.dataset;

    switch (type) {
      case 'json':
      case 'bool':
      case 'number':
        param = JSON.parse(param);
        break;
    }

    switch (command) {
      case 'deflistAdd':
      case 'mylistAdd':
      case 'mylistOpen':
      case 'close':
        this._hideMenu();
        break;
      case 'mylistMenu':
        if (e.shiftKey) {
          util.dispatchCommand(target, 'mylistWindow');
        }
        break;
      case 'nop':
        break;
      default:
        this._hideMenu();
        util.dispatchCommand(target, command, param);
        break;
    }
  }
  _hideMenu() {
    if (!this._view.contains(document.activeElement)) {
      return;
    }
    window.setTimeout(() => document.body.focus(), 0);
  }
}

// Task1074: 読み込んだ時に入れていた CSS を、起動の時に呼ぶ処理として登録する（今の配布物ではその場ですぐ呼ぶ）
startup.add('VideoHoverMenu:style', () => {
  util.addStyle(`
    .hoverMenuContainer .menuButton[hidden] { display: none !important; }
    .hoverMenuContainer {
      user-select: none;
      contain: style size;
    }

    .menuItemContainer {
      box-sizing: border-box;
      position: absolute;
      z-index: 40000;
      overflow: visible;

      will-change: transform, opacity;
      user-select: none;

      /* Task 038:
         .menuItemContainerは「ボタンを四隅に配置するための透明な箱」でしかないが、
         固定サイズ（rightTopは240x40、leftBottomは120x32）を持ち、中身のボタンが
         非表示（opacity:0）の時でも箱そのものが動画の上に乗ったままクリックを
         受け取っていた。z-index:40000で動画より手前にあり、かつ.videoPlayerの
         子ではなく兄弟要素のため、この箱の上で押した操作は
         「動画の上での操作」として扱われず、
           - 動画クリックでの再生/一時停止トグルが効かない
           - 画面モード「小」での動画のドラッグ移動が始まらない
         という状態になっていた（_initializeSmallModeDragのガード条件
         "e.target.closest('.videoPlayer')" がnullになるため）。
         プレイヤーを小さくするほど、この固定サイズの箱が占める割合が大きくなり、
         最終的にドラッグできる場所がほぼ無くなる。これが「ある程度小さくすると
         動かせなくなる」不具合の原因だった。
         箱自体はクリックを受け取らないようにし、実際のボタンだけが
         受け取るようにする。 */
      pointer-events: none;
    }
      /* 実際に押せる必要があるものだけpointer-eventsを戻す。
         中央の再生/一時停止トグル(.togglePlayMenu)は、中に.menuButtonを持たず
         それ自身がボタン（data-command="togglePlay"）なので個別に指定する。 */
      .menuItemContainer .menuButton,
      .menuItemContainer.togglePlayMenu {
        pointer-events: auto;
      }
      .menuItemContainer .menuButton {
        width: 32px;
        height:32px;
        font-size: 24px;
        background: var(--zt-surface-3, #888);
        color: var(--zt-text-inverse, #000);
        border: 1px solid var(--zt-border, #666);
        border-radius: 4px;
        line-height: 30px;
        white-space: nowrap;
        text-align: center;
        cursor: pointer;
        outline: none;
      }
      .menuItemContainer:hover .menuButton {
        pointer-events: auto;
      }

      .menuItemContainer.rightTop {
        width: 240px;
        height: 40px;
        right: 0px;
        top: 0;
        perspective: 150px;
        perspective-origin: center;
      }

      .menuItemContainer.rightTop .scalingUI {
        transform-origin: right top;
      }


      .is-updatingDeflist .menuItemContainer.rightTop,
      .is-updatingMylist  .menuItemContainer.rightTop {
        cursor: wait;
        opacity: 1 !important;
      }
      .is-updatingDeflist .menuItemContainer.rightTop>*,
      .is-updatingMylist  .menuItemContainer.rightTop>* {
        pointer-events: none;
      }

    .menuItemContainer.leftTop {
      width: auto;
      height: auto;
      left: 32px;
      top: 32px;
      display: none;
    }

      .is-debug .menuItemContainer.leftTop {
        display: inline-block !important;
        opacity: 1 !important;
        transition: none !important;
        transform: translateZ(0);
        max-width: 200px;
      }

    .menuItemContainer.leftBottom {
      width: 120px;
      height: 32px;
      left: 8px;
      bottom: 48px;
      transform-origin: left bottom;
    }
    .menuItemContainer.rightBottom {
      width: 120px;
      height: 80px;
      right:  0;
      bottom: 8px;
    }

    .menuItemContainer.onErrorMenu {
      position: absolute;
      left: 50%;
      top: 60%;
      transform: translate(-50%, 0);
      display: none;
      box-sizing: border-box;
      width: min(480px, calc(100% - 24px));
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
      white-space: normal;
    }
      .is-error .onErrorMenu {
        display: flex !important;
        opacity: 1 !important;
      }
      .zenzaScreenMode_small .zenzaPlayerContainer.is-error .hoverMenuContainer .menuItemContainer.onErrorMenu {
        transform: translate(calc(-50% + var(--zenzaSmallDragX, 0px)), var(--zenzaSmallDragY, 0px));
      }

      .is-youTube .onErrorMenu .for-nicovideo,
                  .onErrorMenu .for-ZenTube {
        display: none;
      }
      .is-youTube.is-error .onErrorMenu .for-ZenTube {
        display: inline-block;
      }

      .onErrorMenu .menuButton {
        position: relative;
        display: inline-block !important;
        margin: 0;
        box-sizing: border-box;
        flex: 1 1 84px;
        min-width: 0;
        max-width: 160px;
        min-height: 36px;
        height: auto;
        text-align: center;
        white-space: normal;
        padding: 8px;
        background: var(--zt-surface-3, #888);
        color: var(--zt-text-inverse, #000);
        opacity: 1;
        cursor: pointer;
        border-radius: 0;
        box-shadow: 4px 4px 0 var(--zt-shadow, #333);
        border: 2px outset;
        width: 100px;
        font-size: 14px;
        line-height: 16px;
      }
      .menuItemContainer.onErrorMenu .menuButton:active {
        background: var(--base-fore-color);
        border: 2px inset;
      }
      .menuItemContainer.onErrorMenu .playNextVideo {
        display: none !important;
      }
      .is-playlistEnable .menuItemContainer.onErrorMenu .playNextVideo {
        display: inline-block !important;
      }


    .menuButton {
      position: absolute;
      opacity: 0;
      transition:
        opacity 0.4s ease,
        transform 0.18s ease,
        box-shadow 0.2s ease 1s,
        background 0.4s ease;
      box-sizing: border-box;
      text-align: center;
      text-shadow: none;
      user-select: none;
      will-change: transform, opacity;
      contain: style size layout;
    }
      .menuButton:focus-within,
      .menuButton:hover {
        box-shadow: 0 2px 0 var(--zt-shadow, #000);
        cursor: pointer;
        opacity: 1;
        background: var(--zt-surface-3, #888);
        color: var(--zt-text-inverse, #000);
      }
      .menuButton:active,
      .menuButton.is-feedback-pressed {
        transform: translate(0, 2px);
        box-shadow: 0 0 0 var(--zt-shadow, #000);
        transition: none;
      }

      .menuButton .tooltip {
        display: none;
        pointer-events: none;
        position: absolute;
        left: 16px;
        top: -24px;
        font-size: 12px;
        line-height: 16px;
        padding: 2px 4px;
        border: 1px solid var(--zt-border-dark, #000);
        background: var(--zt-accent-soft, #ffc);
        color: black;
        box-shadow: 2px 2px 2px var(--zt-glow-light, #fff);
        text-shadow: none;
        white-space: nowrap;
        z-index: 100;
        opacity: 0.8;
      }

      .menuButton:hover .tooltip {
        display: block;
      }
      .menuButton:active .tooltip {
        display: none;
      }

      .menuButtonInner {
        will-change: opacity;
      }

      .menuButton:active .zenzaPopupMenu {
        transform: translate(0, -2px);
        transition: none;
      }
      .hoverMenuContainer .menuButton:focus-within {
        pointer-events: none;
      }
      .hoverMenuContainer .menuButton:focus-within .zenzaPopupMenu,
      .hoverMenuContainer .menuButton              .zenzaPopupMenu:hover {
        pointer-events: auto;
        visibility: visible;
        opacity: 0.99;
        pointer-events: auto;
        transition: opacity 0.3s;
      }


      .rightTop .menuButton .tooltip {
        top: auto;
        bottom: -24px;
        right: -16px;
        left: auto;
      }
      .rightBottom .menuButton .tooltip {
        right: 16px;
        left: auto;
      }

      .is-hoverUiActive .menuButton {
        opacity: 0.8;
        background: var(--zt-overlay-dark, rgba(80, 80, 80, 0.5));
        border: 1px solid var(--zt-border, #888);
        transition: box-shadow 0.2s ease;
      }
      .is-hoverUiActive .menuButton .menuButtonInner {
        opacity: 0.8;
        word-break: normal;
        transition:
          box-shadow 0.2s ease,
          background 0.4s ease;
       }


    .showCommentSwitch {
      left: 0;
      width:  32px;
      height: 32px;
      background:var(--zt-surface-3, #888);
      color: var(--zt-text-inverse, #000);
      border: 1px solid var(--zt-border, #666);
      line-height: 30px;
      filter: grayscale(100%);
      border-radius: 4px;
    }
      .is-showComment .showCommentSwitch {
        color: var(--zt-text-0, #fff);
        filter: none;
        text-decoration: none;
      }
      .showCommentSwitch .menuButtonInner {
        text-decoration: line-through;
      }
      .is-showComment .showCommentSwitch .menuButtonInner {
        text-decoration: none;
      }

    .ngFilterSwitch {
      left: 40px;
      width: 32px;
      height: 32px;
      background: var(--zt-surface-3, #888);
      color: var(--zt-text-inverse, #000);
      border: 1px solid var(--zt-border, #666);
      line-height: 30px;
      filter: grayscale(100%);
      border-radius: 4px;
    }
      .ngFilterSwitch .ngFilterIcon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }
      .ngFilterSwitch .ngFilterIcon svg {
        width: 24px;
        height: 24px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .is-enableFilter .ngFilterSwitch {
        color: var(--enabled-button-color, #9cf);
        filter: none;
      }
      .is-enableFilter .ngFilterSwitch .ngFilterIcon svg {
        filter: drop-shadow(0 0 2px currentColor);
      }

      /* Discussion #36: one real target, shared by commands and pointer input.
         Custom keyframes opt in via data-feedback-animation on a button. */
      .menuItemContainer .menuButton.is-shortcut-feedback {
        opacity: 1 !important;
        box-shadow: 0 0 0 2px var(--zt-glow-light, #fff) !important;
      }
      .is-shortcut-feedback[data-feedback-animation] > .menuButtonInner,
      .is-shortcut-feedback[data-feedback-animation] > .controlButtonInner {
        animation: var(--zenza-feedback-animation) 320ms ease-out;
      }
      .is-shortcut-feedback[data-shortcut-state]::after {
        content: attr(data-shortcut-state);
        position: absolute;
        bottom: calc(100% + 3px);
        left: 0;
        border-radius: 3px;
        padding: 2px 5px;
        background: var(--zt-info-strong, #192533);
        color: var(--zt-text-0, #fff);
        border: 1px solid var(--zt-info, #657a90);
        font: bold 11px/14px system-ui, sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .menuButton.is-shortcut-feedback,
        .menuButton.is-shortcut-feedback .menuButtonInner,
        .toggleLikeButton.is-shortcut-feedback .heart-effect {
          transition: none !important;
          animation: none !important;
        }
        .menuButton.is-feedback-pressed { transform: none; }
        .toggleLikeButton.is-shortcut-feedback .heart-effect { display: none; }
      }

    .menuItemContainer .mylistButton {
      font-size: 21px;
    }

    .mylistButton.mylistAddMenu {
      left: 80px;
      top: 0;
    }
    .mylistButton.deflistAdd {
      left: 120px;
      top: 0;
    }
    .zenzaTweetButton {
      left: 40px;
    }

    @keyframes spinX {
      0%   { transform: rotateX(0deg); }
      100% { transform: rotateX(1800deg); }
    }
    @keyframes spinY {
      0%   { transform: rotateY(0deg); }
      100% { transform: rotateY(1800deg); }
    }

    .is-updatingDeflist .mylistButton.deflistAdd {
      pointer-events: none;
      opacity: 1 !important;
      border: 1px inset !important;
      box-shadow: none !important;
      background: var(--zt-surface-3, #888) !important;
      color: var(--zt-text-inverse, #000) !important;
      animation-name: spinX;
      animation-iteration-count: infinite;
      animation-duration: 6s;
      animation-timing-function: linear;
    }
    .is-updatingDeflist .mylistButton.deflistAdd .tooltip {
      display: none;
    }

    .mylistButton.mylistAddMenu:focus-within,
    .is-updatingMylist  .mylistButton.mylistAddMenu {
      pointer-events: none;
      opacity: 1 !important;
      border: 1px inset var(--zt-border-dark, #000) !important;
      color: var(--zt-text-inverse, #000) !important;
      box-shadow: none !important;
    }
    .mylistButton.mylistAddMenu:focus-within {
      background: var(--zt-surface-3, #888) !important;
    }
    .is-updatingMylist  .mylistButton.mylistAddMenu {
      background: var(--zt-surface-3, #888) !important;
      color: var(--zt-text-inverse, #000) !important;
      animation-name: spinX;
      animation-iteration-count: infinite;
      animation-duration: 6s;
      animation-timing-function: linear;
    }

    .mylistSelectMenu {
      top: 36px;
      right: -48px;
      padding: 8px 0;
      font-size: 13px;
      backface-visibility: hidden;
    }
    .is-updatingMylist .mylistSelectMenu {
      display: none;
    }
      .mylistSelectMenu .mylistSelectMenuInner {
        overflow-y: auto;
        overflow-x: hidden;
        max-height: 50vh;
        overscroll-behavior: none;
      }

      .mylistSelectMenu .triangle {
        transform: rotate(135deg);
        top: -8.5px;
        right: 55px;
      }

      .mylistSelectMenu ul li {
        line-height: 120%;
        overflow-y: visible;
        border-bottom: none;
      }

      .mylistSelectMenu .mylistIcon {
        display: inline-block;
        width: 18px;
        height: 14px;
        margin: -4px 4px 0 0;
        margin-right: 15px;
        transform: scale(1.5);
        transform-origin: 0 0 0;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
        cursor: pointer;
      }
      .mylistSelectMenu .mylistIcon:hover {
        background-color: var(--zt-accent, #ff9);
        transform: scale(2);
      }
      .mylistSelectMenu .mylistIcon:hover::after {
        background: var(--zt-surface-light, #fff);
        z-index: 100;
        opacity: 1;
      }
      .mylistSelectMenu .mylistIcon > svg {
        fill: var(--zt-text-inverse, #666);
        width: 100%;
        height: 100%;
      }


      .mylistSelectMenu .name {
        display: inline-block;
        width: calc(100% - 20px);
        vertical-align: middle;
        font-size: 110%;
        color: var(--zt-text-0, #fff);
        text-decoration: none !important;
      }
      .mylistSelectMenu .name:hover {
        color: var(--zt-text-0, #fff);
      }
      .mylistSelectMenu .name::after {
        content: ' に登録';
        font-size: 75%;
        color: var(--zt-text-inverse, #333);
      }
      .mylistSelectMenu li:hover .name::after {
        color: var(--zt-text-0, #fff);
      }

      .toggleLikeButton {
        transition:
        opacity 0.4s ease,
        box-shadow 0.2s ease 1s,
        transform 0.2s ease 1s;
      }
      .toggleLikeButton:hover {
        text-shadow: 0 0 2px deeppink;
        background: none;
        color: pink;
      }
      .is-liked .toggleLikeButton {
        color: pink;
      }
      .toggleLikeButton .liked-heart {
        display: none;
      }
      .is-liked .toggleLikeButton .liked-heart {
        display: block;
      }
      .is-liked .toggleLikeButton .not-liked-heart {
        display: none;
      }
      .toggleLikeButton .heart-effect {
        position: absolute;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%) scale(5);
        text-shadow: 0 0 3px deeppink;
        color: var(--zt-text-0, #fff);
        opacity: 0;
        visibility: hidden;
        transition:
          transform 0.8s ease,
          opacity 0.8s ease,
          visibility 0.8s ease,
          color 0.8s ease;
      }
      .toggleLikeButton:active .heart-effect,
      .toggleLikeButton.is-feedback-pressed .heart-effect {
        transition: none;
        transform: translate(-50%, -50%) scale(0.3);
        color: pink;
        opacity: 0.5;
        visibility: visible;
      }

      .zenzaTweetButton:hover {
        text-shadow: 1px 1px 2px var(--zt-info, #88c);
        background: var(--zt-info, #1da1f2);
        color: var(--zt-text-0, #fff);
      }

    .menuItemContainer .menuButton.closeButton {
      position: absolute;
      font-size: 20px;
      top: 0;
      right: 0;
      z-index: 60000;
      margin: 0 0 40px 40px;
      color: var(--zt-text-1, #ccc);
      border: solid 1px var(--zt-border, #888);
      border-radius: 0;
      transition:
        opacity 0.4s ease,
        transform 0.2s ease,
        background 0.2s ease,
        box-shadow 0.2s ease
          ;
      pointer-events: auto;
      transform-origin: center center;
    }

    .is-hoverUiActive .closeButton,
    .closeButton:hover {
      opacity: 1;
      background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.8));
    }
    .closeButton:hover {
      background: var(--zt-overlay-dark, rgba(33, 33, 33, 0.9));
      box-shadow: 4px 4px 4px var(--zt-shadow, #000);
    }
    .closeButton:active {
      transform: scale(0.5);
    }

    .menuItemContainer .toggleDebugButton {
      position: relative;
      display: inline-block;
      opacity: 1 !important;
      padding: 8px 16px;
      color: var(--zt-text-inverse, #000);
      box-shadow: none;
      font-size: 21px;
      border: 1px solid black;
      background: var(--zt-overlay-light, rgba(192, 192, 192, 0.8));
      width: auto;
      height: auto;
    }

    .togglePlayMenu {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(1.5);
      width: 80px;
      height: 45px;
      font-size: 35px;
      line-height: 45px;
      border-radius: 8px;
      text-align: center;
      color: var(--base-fore-color);
      z-index: 10;
      background: var(--zt-overlay-dark, rgba(0, 0, 0, 0.8));
      transition: transform 0.2s ease, box-shadow 0.2s, text-shadow 0.2s, font-size 0.2s;
      box-shadow: 0 0 2px var(--zt-accent-translucent, rgba(255, 255, 192, 0.8));
      cursor: pointer;
    }

    .togglePlayMenu:hover {
      transform: translate(-50%, -50%) scale(1.6);
      text-shadow: 0 0 4px var(--zt-glow-light, #888);
      box-shadow: 0 0 8px var(--zt-glow-light, rgba(255, 255, 255, 0.8));
    }

    .togglePlayMenu:active {
      transform: translate(-50%, -50%) scale(2.0, 1.2);
      font-size: 30px;
      box-shadow: 0 0 4px inset var(--zt-shadow, rgba(0, 0, 0, 0.8));
      text-shadow: none;
      transition: transform 0.1s ease;
    }

    .is-notPlayed .togglePlayMenu {
      display: block;
    }

    .is-playing .togglePlayMenu,
    .is-error   .togglePlayMenu,
    .is-loading .togglePlayMenu {
      display: none;
    }


  `, {className: 'videoHoverMenu'});
util.addStyle(`
  .menuItemContainer.leftBottom {
    bottom: calc(64px * var(--zenza-ui-scale,1));
  }
  .menuItemContainer.leftBottom .scalingUI {
    transform-origin: left bottom;
  }
  .menuItemContainer.rightBottom {
    bottom: 64px;
  }
  .ngSettingSelectMenu {
    bottom: 0px;
  }
  `, {className: 'videoHoverMenu screenMode for-full'});
});

VideoHoverMenu.__tpl__ = (`
    <div class="hoverMenuContainer">
      <div class="menuItemContainer leftTop">
          <div class="menuButton toggleDebugButton" data-command="toggle-debug">
            <div class="menuButtonInner">debug mode</div>
          </div>
      </div>

      <div class="menuItemContainer rightTop">
        <div class="scalingUI">
          <div class="menuButton toggleLikeButton forMember" data-command="toggle-like" data-feedback-visible-ms="1500">
            <div class="tooltip">いいね！</div>
            <div class="menuButtonInner"><div class="not-liked-heart"
              >♡</div><div class="liked-heart"
              >♥</div><div class="heart-effect">♡</div></div>
          </div>
          <div role="button" tabindex="0" class="menuButton zenzaTweetButton" style="pointer-events:auto" data-command="tweet" aria-label="動画を共有" aria-haspopup="dialog">
            <div class="tooltip">共有（X・クリップ・リンク）</div>
            <div class="menuButtonInner">t</div>
          </div>
          <div class="menuButton mylistButton mylistAddMenu forMember"
            data-command="nop" tabindex="-1" data-has-submenu="1">
            <div class="tooltip">マイリスト登録</div>
            <div class="menuButtonInner">My</div>
            <div class="mylistSelectMenu selectMenu zenzaPopupMenu forMember">
              <div class="triangle"></div>
              <div class="mylistSelectMenuInner">
              </div>
            </div>
          </div>


          <div class="menuButton mylistButton deflistAdd forMember" data-command="deflistAdd">
            <div class="tooltip">あとで見る</div>
            <div class="menuButtonInner">&#x271A;</div>
          </div>

          <div class="menuButton closeButton" data-command="close">
            <div class="tooltip">閉じる</div>
            <div class="menuButtonInner">&#x2716;</div>
          </div>

        </div>
      </div>

      <div class="menuItemContainer leftBottom">
        <div class="scalingUI">
          <div class="showCommentSwitch menuButton" data-command="toggle-showComment">
            <div class="tooltip">コメント表示ON/OFF</div>
            <div class="menuButtonInner">💬</div>
          </div>
          <div class="ngFilterSwitch menuButton" data-command="toggle-enableFilter">
            <div class="tooltip">NGフィルターON/OFF</div>
            <div class="menuButtonInner ngFilterIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 2.5 19 5v5.5c0 4.6-2.8 8.4-7 10.8-4.2-2.4-7-6.2-7-10.8V5l7-2.5Z"/><path d="m8 8 8 8"/></svg>
            </div>
          </div>
        </div>
      </div>

      <div class="menuItemContainer onErrorMenu">
        <div class="menuButton openGinzaMenu" data-command="openGinza">
          <div class="menuButtonInner">(Re)で視聴</div>
        </div>

        <div class="menuButton reloadMenu for-nicovideo" data-command="reload">
          <div class="menuButtonInner for-nicovideo">リロード</div>
          <div class="menuButtonInner for-ZenTube">ZenTube解除</div>
        </div>

        <div class="menuButton playNextVideo" data-command="playNextVideo">
          <div class="menuButtonInner">次の動画</div>
        </div>
      </div>

      <div class="togglePlayMenu menuItemContainer center" data-command="togglePlay">
        ▶
      </div>

    </div>
  `).trim();

export {VideoHoverMenu};
