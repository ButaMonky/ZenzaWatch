import * as $ from 'jquery';
import * as _ from 'lodash';
import {global} from './ZenzaWatchIndex';
import {CONSTANT} from './constant';
import {PlaybackPosition, VideoInfoLoader, NVWatchCaller, CommonsTreeLoader} from '../packages/lib/src/nico/loader';
import {Fullscreen, ShortcutKeyEmitter, util} from './util';
import {SHORTCUT_ACTIONS} from '../packages/zenza/src/ShortcutActions';
import {NicoVideoPlayer} from './NicoVideoPlayer';
import {VideoFilter, VideoInfoModel} from './VideoInfo';
import {CommentInputPanel} from './CommentInputPanel';
import {CommentPanel} from './CommentPanel';
import {VideoControlBar} from './VideoControlBar';
import {VideoInfoPanel} from './VideoInfoPanel';
import {PlayList, PlayListSession} from '../packages/zenza/src/playlist/PlayList';
import {Emitter} from './baselib';
import {ThreadLoader} from './loader/ThreadLoader';
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

//===BEGIN===
//@require MediaSessionApi
//@require LikeApi
//@require AudioAdjuster
//@require SHORTCUT_ACTIONS

class PlayerConfig {
  static getInstance(config) {
    if (!PlayerConfig.instance) {
      PlayerConfig.instance = this.wrapKey(config);
    }
    return PlayerConfig.instance;
  }
  static wrapKey(config, mode = '') {
    if (!mode && util.isGinzaWatchUrl()) {
      mode = 'ginza';
    } else if (location && location.host.indexOf('.nicovideo.jp') < 0) {
      mode = 'others';
    }
    if (!mode) { return config; }
    config.getNativeKey = key => {
      switch(mode) {
        case 'ginza':
          if (['autoPlay', 'screenMode'].includes(key)) {
            return `${key}:${mode}`;
          }
        break;
        case 'others':
          if (['autoPlay', 'screenMode', 'overrideWatchLink'].includes(key)) {
            return `${key}:${mode}`;
          }
        break;
      }
      return key;
    };
    return config;
  }
}

class VideoWatchOptions {
  constructor(watchId, options, config) {
    this._watchId = watchId;
    this._options = options || {};
    this._config = config;
  }
  get rawData() {
    return this._options;
  }
  get eventType() {
    return this._options.eventType || '';
  }
  get query() {
    return this._options.query || {};
  }
  get videoLoadOptions() {
    let options = {
      economy: this.isEconomySelected
    };
    return options;
  }
  get mylistLoadOptions() {
    let options = {};
    let query = this.query;
    options.shuffle = parseInt(query.shuffle, 10) === 1;
    options.watchId = this._watchId;
    return options;
  }
  get isPlaylistStartRequest() {
    let eventType = this.eventType;
    let query = this.query;
    if (eventType !== 'click' || query.continuous !== '1') {
      return false;
    }
    if (query.playlist.type) {
      return true;
    }
    return false;
  }
  hasKey(key) {
    return _.has(this._options, key);
  }
  get isOpenNow() {
    return this._options.openNow === true;
  }
  get isEconomySelected() {
    return _.isBoolean(this._options.economy) ?
      this._options.economy : this._config.getValue('smileVideoQuality') === 'eco';
  }
  get isAutoCloseFullScreen() {
    return !!this._options.autoCloseFullScreen;
  }
  get isReload() {
    return this._options.reloadCount > 0;
  }
  get videoServerType() {
    return this._options.videoServerType ?? this._config.getValue('videoServerType');
  }
  get isAutoZenTubeDisabled() {
    return !!this._options.isAutoZenTubeDisabled;
  }
  get reloadCount() {
    return this._options.reloadCount;
  }
  get currentTime() {
    if (_.isNumber(this._options.currentTime))
      return parseFloat(this._options.currentTime, 10);

    return !isNaN(this.query.from) ?
      parseFloat(this.query.from, 10) : 0;
  }
  createForVideoChange(options) {
    options = options || {};
    delete this._options.economy;
    _.defaults(options, this._options);
    options.openNow = true;
    delete options.videoServerType;
    options.isAutoZenTubeDisabled = false;
    options.currentTime = 0;
    options.reloadCount = 0;
    options.query = {};
    return options;
  }
  createForReload(options) {
    options = options || {};
    delete this._options.economy;
    options.isAutoZenTubeDisabled = typeof options.isAutoZenTubeDisabled === 'boolean' ?
      options.isAutoZenTubeDisabled : true;
    _.defaults(options, this._options);
    options.openNow = true;
    options.reloadCount = options.reloadCount ? (options.reloadCount + 1) : 1;
    options.query = {};
    return options;
  }
  createForSession(options) {
    options = options || {};
    _.defaults(options, this._options);
    options.query = {};
    return options;
  }
}


class NicoVideoPlayerDialogView extends Emitter {
  constructor(...args) {
    super();
    this.initialize(...args);
  }
  initialize(params) {
    const dialog = this._dialog = params.dialog;
    this._playerConfig = params.playerConfig;
    this._nicoVideoPlayer = params.nicoVideoPlayer;
    this._state = params.playerState;
    this._currentTimeGetter = params.currentTimeGetter;

    this._aspectRatio = 9 / 16;

    dialog.on('canPlay', this._onVideoCanPlay.bind(this));
    dialog.on('videoCount', this._onVideoCount.bind(this));
    dialog.on('error', this._onVideoError.bind(this));
    dialog.on('play', this._onVideoPlay.bind(this));
    dialog.on('playing', this._onVideoPlaying.bind(this));
    dialog.on('pause', this._onVideoPause.bind(this));
    dialog.on('stalled', this._onVideoStalled.bind(this));
    dialog.on('abort', this._onVideoAbort.bind(this));
    dialog.on('aspectRatioFix', this._onVideoAspectRatioFix.bind(this));
    dialog.on('volumeChange', this._onVolumeChange.bind(this));
    dialog.on('volumeChangeEnd', this._onVolumeChangeEnd.bind(this));
    dialog.on('beforeVideoOpen', this._onBeforeVideoOpen.bind(this));
    dialog.on('loadVideoInfoFail', this._onVideoInfoFail.bind(this));
    dialog.on('videoServerType', this._onVideoServerType.bind(this));

    this._initializeDom();
    this._state.on('update', this._onPlayerStateUpdate.bind(this));
    this._state.onkey('videoInfo', this._onVideoInfoLoad.bind(this));
  }
  async _initializeDom() {
    util.addStyle(NicoVideoPlayerDialogView.__css__);
    const $dialog = this._$dialog = util.$.html(NicoVideoPlayerDialogView.__tpl__.trim());
    const onCommand = this._onCommand.bind(this);
    const config = this._playerConfig;
    const state = this._state;
    this._$body = util.$('body, html');

    const $container = this._$playerContainer = $dialog.find('.zenzaPlayerContainer');
    const container = $container[0];
    const classList = this.classList = ClassList(container);

    this._initializeSmallModeDrag($container);
    this._initializeScreenFilter();

    container.addEventListener('click', e => {
      // 画面モード「小」でのドラッグ操作直後は、ドラッグの終了を動画クリックに
      // よる再生/一時停止トグルと誤認しないよう、1回だけこのclickを無視する
      // （_initializeSmallModeDrag参照）。
      if (this._suppressSmallModeClick) {
        this._suppressSmallModeClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      global.emitter.emitAsync('hideHover');
      if (
        e.target.classList.contains('touchWrapper') &&
        config.props.enableTogglePlayOnClick &&
        !classList.contains('menuOpen')) {
        onCommand('togglePlay');
      }
      e.preventDefault();
      e.stopPropagation();
      classList.remove('menuOpen');
    });
    container.addEventListener('command', e=> {
      e.stopPropagation();
      e.preventDefault();
      this._onCommand(e.detail.command, e.detail.param);
    });
    container.addEventListener('focusin', e => {
      const target = (e.path && e.path.length) ? e.path[0] : e.target;
      if (target.dataset.hasSubmenu) {
        classList.add('menuOpen');
      }
    });

    this._applyState();

    // マウスを動かしてないのにmousemoveが飛んできたらスルー
    let lastX = 0, lastY = 0;
    let onMouseMove = this._onMouseMove.bind(this);
    // is-mouseMoving（400ms）は、ホバーメニューや「小」モードのリサイズ
    // ハンドル等、コントロールバー以外の複数のUI要素の表示タイミングにも
    // 使われている（Task 039でこの400msに揃えられた経緯がある）ため、
    // ここは変更しない。
    let onMouseMoveEnd = _.debounce(this._onMouseMoveEnd.bind(this), 400);
    // コントロールバー専用の自動非表示（2026-09-11追加）。is-mouseMovingとは
    // 別のクラス・別のタイマーにする。理由: 「一時停止時の一時表示・マウスを
    // 外した時の非表示までの時間を、一般的な動画プレイヤーの目安（数秒）に
    // 合わせてほしい」というユーザー要望があった一方、is-mouseMoving自体の
    // 400msを直接延ばすと、上記のホバーメニュー等の表示タイミングまで遅く
    // なってしまう（無関係な機能への副作用）。そのためコントロールバーの
    // 表示トリガーだけを切り離し、3000ms（3秒）のdebounceにした。
    // _onVideoPauseからも同じインスタンスを使うことで、「マウスを動かさなく
    // なってから消えるまでの時間」と「一時停止した時に一時表示されてから
    // 消えるまでの時間」を常に一致させている。
    let onControlBarActive = this._onControlBarActive.bind(this);
    let onControlBarIdle = this._onControlBarIdleDebounced = _.debounce(this._onControlBarIdle.bind(this), 3000);
    container.addEventListener('mousemove', _.throttle(e => {
      if (e.buttons === 0 && lastX === e.screenX && lastY === e.screenY) {
        return;
      }
      lastX = e.screenX;
      lastY = e.screenY;
      onMouseMove(e);
      onMouseMoveEnd(e);
      onControlBarActive(e);
      onControlBarIdle(e);
    }, 100));

    $dialog
      .on('dblclick', e => {
        if (!e.target || e.target.id !== 'zenzaVideoPlayerDialog') {
          return;
        }
        if (config.props.enableDblclickClose) {
          this.emit('command', 'close');
        }
      })
      .toggleClass('is-guest', !util.isLogin());

    this.hoverMenu = new VideoHoverMenu({
      playerContainer: container,
      playerState: state
    });

    this.commentInput = new CommentInputPanel({
      $playerContainer: $container,
      playerConfig: config
    });

    this.commentInput.on('post', (e, chat, cmd) =>
      this.emit('postChat', e, chat, cmd));

    let hasPlaying = false;
    this.commentInput.on('focus', isAutoPause => {
      hasPlaying = state.isPlaying;
      if (isAutoPause) {
        this.emit('command', 'pause');
      }
    });
    this.commentInput.on('blur', isAutoPause => {
      if (isAutoPause && hasPlaying && state.isOpen) {
        this.emit('command', 'play');
      }
    });
    this.commentInput.on('esc', () => this._escBlockExpiredAt = Date.now() + 1000 * 2);

    // Task 050 (A-4): 「小」モードでのコメント入力欄の位置追従・上下反転・
    // 横クランプは、この時点で.commentInputPanelのDOMが揃って初めて実測できる
    // （_initializeSmallModeDrag実行時点ではまだ存在しないため、関数だけを
    // thisに退避してもらっている）。フォーカスして幅が500pxに広がった時・
    // フォーカスが外れて幅が戻った時にも再計算が必要。
    if (this._updateCommentInputLayout) {
      this._updateCommentInputLayout();
      this.commentInput.on('focus', () => this._updateCommentInputLayout());
      this.commentInput.on('blur', () => this._updateCommentInputLayout());
      // Task 074: 入力欄の幅はアニメーションで変わるようになったため、
      // 幅の変化が終わった時点でもう一度はみ出しを計算し直す
      const panelElm = container.querySelector('.commentInputPanel');
      panelElm && panelElm.addEventListener('transitionend', e => {
        if (e.target === panelElm && e.propertyName === 'width') {
          this._updateCommentInputLayout();
        }
      });
    }

    // this.settingPanel = new SettingPanel({
    //   $parent: $container,
    //   playerConfig: config,
    //   player: this._dialog
    // });
    // this.settingPanel.on('command', onCommand);

    await sleep.idle();
    this.videoControlBar = new VideoControlBar({
      $playerContainer: $container,
      playerConfig: config,
      player: this._dialog,
      playerState: this._state,
      currentTimeGetter: this._currentTimeGetter
    });
    this.videoControlBar.on('command', onCommand);

    this._$errorMessageContainer = $container.find('.errorMessageContainer');
    // Task 049: 「小」モードの読み込み中背景を.loadingMessageContainer側にも
    // 出せるようにするための参照（_setThumbnail参照）。
    this._$loadingMessageContainer = $container.find('.loadingMessageContainer');

    await sleep.idle();
    this._initializeVideoInfoPanel();
    this._initializeResponsive();

    this.selectTab(this._state.currentTab);

    document.documentElement.addEventListener('paste', this._onPaste.bind(this));

    global.emitter.on('showMenu', () => this.addClass('menuOpen'));
    global.emitter.on('hideMenu', () => this.removeClass('menuOpen'));
    global.emitter.on('fullscreenStatusChange', () => this._applyScreenMode(true));
    document.body.append($dialog[0]);
    this.emitResolve('dom-ready');
  }
  /**
   * 画面モード「小」（zenzaScreenMode_small）の時だけ、プレイヤーを画面上の
   * 好きな位置にドラッグで動かせ、右下のつまみでPiPのようにリサイズもできる
   * ようにする（Task 029〜032）。位置・サイズは次に開いた時のために記憶し、
   * 右上のボタンでいつでも初期状態（既定位置・既定サイズ）に戻せる。
   *
   * 実装方針: 「小」モードの本来の位置（左上固定）はCSS側のレイアウトに任せたまま、
   * 動画本体（.videoPlayer）とコメントレイヤー（.commentLayerFrame）にだけ
   * transform: translate()でドラッグ分のオフセットを上乗せする
   * （.zenzaPlayerContainer自体には掛けない。.videoControlBarが
   * position: fixedで.zenzaPlayerContainerの子要素になっているため、
   * 親側にtransformを掛けるとシークバーのcontaining blockがビューポートから
   * ずれてしまうため。詳細はCSS側のコメント、およびTask 031のドキュメント参照）。
   * リサイズ用のwidth/height自体はtransformと違いcontaining blockに影響しない
   * ため、.zenzaPlayerContainer自体に適用している。他の画面モードのCSSには
   * 一切触れないため、既存のレイアウトへの影響がない。
   *
   * ドラッグの起点は動画本体全体（.videoPlayer上でのポインタ操作）とする。
   * Task 029時点では専用のつまみ要素（オーバーレイ）で覆っていたが、それだと
   * 動画本体を覆う面積を広げるほど、NicoVideoPlayer.js側でtouchWrapperに
   * 直接バインドされている既存のダブルクリック（全画面切替等）・右クリック
   * メニュー・ホイールでのシーク操作まですべて塞いでしまう。そのため今回は
   * オーバーレイを廃止し、.zenzaPlayerContainer側でpointerdown等をバブリング
   * 経由で受け取るだけにとどめている（stopPropagationやpreventDefaultは
   * ドラッグ確定後のクリック抑制以外では行わない）。これにより、動画本体上の
   * 他の既存操作とは共存できる。
   * （制限事項: YouTube埋め込み再生時のようにvideoPlayerの中身が別オリジンの
   * iframeになるケースでは、iframe内部で発生したポインタイベントはブラウザの
   * 仕様上ページ側にバブリングしてこないため、この実装ではドラッグ開始を
   * 検知できない。既知の制限として残す）。
   *
   * 単なるクリック（動画クリックでの再生/一時停止トグル）とドラッグを区別する
   * ため、一定距離（DRAG_THRESHOLD）以上ポインタが動いて初めて「ドラッグ」と
   * みなす。ドラッグと判定された場合のみ、直後に発火するclickイベントでの
   * トグルをthis._suppressSmallModeClickフラグで1回だけ抑制する
   * （実際の抑制処理はcontainerのclickリスナー側、_initializeDom内）。
   *
   * リサイズは右下の専用つまみ（.zenzaSmallModeResizeHandle）だけを起点とする。
   * 独立した小さな要素なのでクリックとの区別は不要（掴んだら即リサイズ開始）。
   * アスペクト比の固定/自由は`smallModeAspectLock`のConfigで管理し、右下つまみの
   * すぐ上のロックボタンでいつでも切り替えられる（アドバンス設定パネル
   * （ZenzaAdvancedSettings.user.js）側にも同じ項目を用意した）。
   * 位置・サイズ・ロック状態はConfig（smallModeOffsetX/Y, smallModeWidth/Height,
   * smallModeAspectLock）に保存し、次回このダイアログを開いた時に復元する。
   */
  _initializeSmallModeDrag($container) {
    const container = $container[0];
    const config = this._playerConfig;
    const DRAG_THRESHOLD = 6;
    const MIN_WIDTH = 160, MIN_HEIGHT = 90;
    const DEFAULT_WIDTH = CONSTANT.SIDE_PLAYER_WIDTH;
    const DEFAULT_HEIGHT = CONSTANT.SIDE_PLAYER_HEIGHT;
    // 右上のホバーメニュー（いいね/ツイート/マイリスト/とりあえずマイリスト/
    // 閉じる の5個 × 32px）が必要とする横幅。動画がこれより狭い時は
    // メニュー側を縮小して動画の中に収める（Task 039）。
    const HOVER_MENU_BASE_WIDTH = 160;

    const classList = this.classList || ClassList(container);

    // ---- 位置(ドラッグ)・サイズ(リサイズ)の現在値 ----
    let offsetX = Number(config.props.smallModeOffsetX) || 0;
    let offsetY = Number(config.props.smallModeOffsetY) || 0;
    let width = Number(config.props.smallModeWidth) || 0;   // 0 = 既定値を使用
    let height = Number(config.props.smallModeHeight) || 0; // 0 = 既定値を使用

    // 現在のoffsetを考慮しない「素の（オフセット0の時の）」位置を元に、指定サイズ
    // （省略時は現在のサイズ）で画面外へ出て行方不明にならないようクランプする。
    //
    // 注意（Task 033で修正）: containerRect.left/topからoffsetX/offsetYを
    // 差し引いていたのは、Task 029/030当時にドラッグのtransformを
    // .zenzaPlayerContainer自体に掛けていた名残。Task 031でtransformを
    // 子要素（.videoPlayer/.commentLayerFrame）側に移した結果、
    // container.getBoundingClientRect()は常に「オフセット適用前の静的な位置」を
    // 返すようになっており、そこから改めてoffsetXを差し引くと基準位置が
    // 二重にズレる。ズレ幅はoffsetX自身に依存するため、ドラッグ中フレームごとに
    // クランプの上限・下限が変動し、上限が下限を下回る逆転が起きた瞬間、値が
    // 特定の座標に固定されて動かなくなる（「不安定・左に動かなくなる」不具合の
    // 原因だった）。containerは動かないので、そのままrect.left/topを使えばよい。
    // Task 039: 「ドラッグがマウスに遅れてついてくる」への対策。
    // clampOffsetはドラッグ中のpointermoveごとに呼ばれ、その中で
    // container.getBoundingClientRect()を実行していた。直前のフレームで
    // CSSカスタムプロパティ（＝transform）を書き換えているため、この読み取りは
    // ブラウザにレイアウトの再計算を同期的に強制する（レイアウトスラッシング）。
    // コメントレイヤー（iframe）や動画を含む重いページでは、これが
    // pointermoveのたびに発生して目に見える遅延になる。
    // Task 033で確認済みの通り、ドラッグ中に動くのは子要素（transform）だけで
    // container自体は動かないので、矩形はドラッグ開始時に一度だけ取れば足りる。
    let cachedRect = null;
    const getContainerRect = () => cachedRect || container.getBoundingClientRect();
    const clampOffset = (x, y, w, h) => {
      const rect = getContainerRect();
      const boxW = w || rect.width;
      const boxH = h || rect.height;
      const rawLeft = rect.left;
      const rawTop = rect.top;
      const minX = -rawLeft;
      const maxX = Math.max(minX, global.innerWidth - boxW - rawLeft);
      const minY = -rawTop;
      const maxY = Math.max(minY, global.innerHeight - boxH - rawTop);
      return [
        Math.min(Math.max(x, minX), maxX),
        Math.min(Math.max(y, minY), maxY)
      ];
    };
    const clampSize = (w, h) => {
      const maxW = Math.max(MIN_WIDTH, global.innerWidth * 0.9);
      const maxH = Math.max(MIN_HEIGHT, global.innerHeight * 0.9);
      return [
        Math.min(Math.max(w, MIN_WIDTH), maxW),
        Math.min(Math.max(h, MIN_HEIGHT), maxH)
      ];
    };

    // uQueryの.raf.css()は内部でCSSプロパティ名をtoCamel()に通すため、
    // '--zenzaSmallDragX'のようなCSSカスタムプロパティ名が'-zenzaSmallDragX'
    // （ハイフン1つ）に化けてしまい、実際には何も設定されない
    // （style.setPropertyを使わずstyle[key]=valで代入しているため、
    // 存在しないプロパティとして黙って無視される、Task 030）。この不具合を
    // 避けるため、カスタムプロパティはstyle.setPropertyで直接、rAFで自前に
    // バッチ更新する。ドラッグ用の2つは.zenzaPlayerContainerに設定するが、
    // 実際にtransformとして消費するのは（CSSカスタムプロパティの継承により）
    // 子要素の.videoPlayer/.commentLayerFrame側（CSS側のコメント参照）。
    let rafId = 0;
    let pendingX = 0, pendingY = 0, pendingW = 0, pendingH = 0;
    const flush = () => {
      rafId = 0;
      container.style.setProperty('--zenzaSmallDragX', `${pendingX}px`);
      container.style.setProperty('--zenzaSmallDragY', `${pendingY}px`);
      if (pendingW > 0) {
        container.style.setProperty('--zenzaSmallWidth', `${pendingW}px`);
      } else {
        container.style.removeProperty('--zenzaSmallWidth');
      }
      if (pendingH > 0) {
        container.style.setProperty('--zenzaSmallHeight', `${pendingH}px`);
      } else {
        container.style.removeProperty('--zenzaSmallHeight');
      }
      // Task 039: 右上のホバーメニュー（ボタン5個 = 32px × 5 = 160px。
      // 設定「メニューの大きさ」menuScaleの分だけ実際にはさらに大きい）が
      // 動画の幅に収まらない場合、その分だけ自動で縮小する。
      // 収まっている場合は1（＝設定値のまま）なので見た目は変わらない。
      const boxW = (pendingW > 0 ? pendingW : DEFAULT_WIDTH);
      const uiScale = Number(config.props.menuScale) || 1;
      const fit = Math.min(1, Math.max(0.4, (boxW - 8) / (HOVER_MENU_BASE_WIDTH * uiScale)));
      container.style.setProperty('--zenzaSmallUiScale', `${fit}`);
      // Task 050 追加: 上下反転・横クランプをドラッグ中も毎フレーム再計算する
      // （「ドラッグ中もコメント欄が動いてほしい」という実機フィードバックへの
      // 対応）。flush()自体がrAFで1フレームに1回だけ実行されるよう既に
      // スロットルされているため（scheduleFlush）、ここでの
      // offsetWidth/offsetHeight読み取り（強制リフロー）もドラッグ中の
      // pointermove頻度に関わらず最大フレームレート止まりで収まり、
      // Task 039で対策したのと同種の毎イベントでのレイアウトスラッシングには
      // ならない。updateCommentInputLayoutはこの後（同じ関数スコープ内）で
      // 定義されるが、flush自体はrAF経由で非同期に呼ばれるため定義順の問題は無い。
      if (typeof updateCommentInputLayout === 'function') {
        updateCommentInputLayout();
      }
    };
    const scheduleFlush = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(flush);
      }
    };
    const applyOffset = (x, y) => {
      offsetX = x;
      offsetY = y;
      pendingX = x;
      pendingY = y;
      scheduleFlush();
    };
    const applySize = (w, h) => {
      width = w;
      height = h;
      pendingW = w;
      pendingH = h;
      scheduleFlush();
    };
    // 初期表示時、前回保存した位置・サイズを復元する
    // （小モードでなければCSS側で無効なので、常時呼んでおいて構わない）。
    applyOffset(offsetX, offsetY);
    applySize(width, height);

    const persistPosition = () => {
      config.props.smallModeOffsetX = offsetX;
      config.props.smallModeOffsetY = offsetY;
    };
    const persistSize = () => {
      config.props.smallModeWidth = width;
      config.props.smallModeHeight = height;
    };

    // ---------------- コメント入力欄の位置追従（Task 050, A-4） ----------------
    // .commentInputPanelは.commentInput等と違い、実測サイズ（offsetWidth/
    // offsetHeight）が無いと「画面外に出るかどうか」を判定できない。しかし
    // offsetWidth/Heightの読み取りは保留中のスタイル変更を同期的に確定させる
    // （強制リフロー）ため、ドラッグ・リサイズの毎フレーム（pointermoveのたび）
    // 呼ぶとTask 039で対策したのと同種のレイアウトスラッシングを再発させて
    // しまう。そのため、ここでは「操作が終わった時点」「ウィンドウリサイズ」
    // 「入力欄のフォーカス変化」でだけ呼び出す（呼び出し箇所は各所コメント参照）。
    // なお.zenzaPlayerContainer自体はドラッグ中も動かないため
    // （transformは子要素側、drag中のcontainer.getBoundingClientRect()の
    // 扱いはclampOffsetのコメント参照）、ここで毎回取得し直しても値は同じで
    // 安全（キャッシュを共有する必要はない）。
    const COMMENT_PANEL_EDGE_MARGIN = 8;
    // フォーカス時、.commandInput/.commentSubmit（CommentInputPanel.jsのCSSで
    // それぞれleft:-108px/right:-108px、幅100px）がパネル本体の枠から左右に
    // はみ出す。クランプ計算はこの分も見込まないと、フォーカス直後に
    // コマンド欄・送信ボタンだけ画面外に出てしまう（実機フィードバックで
    // 発見されたバグ）。
    const COMMENT_PANEL_FOCUS_EXTRA_OVERFLOW = 108;
    let commentInputPanelCache = null;
    const getCommentInputPanel = () => {
      if (!commentInputPanelCache) {
        commentInputPanelCache = container.querySelector('.commentInputPanel');
      }
      return commentInputPanelCache;
    };
    const updateCommentInputLayout = () => {
      if (this._state.screenMode !== 'small') { return; }
      const panel = getCommentInputPanel();
      if (!panel) { return; }
      const rect = container.getBoundingClientRect();
      // containerは動かないので、ドラッグ中の見た目の位置はoffsetX/Yを
      // 足したものになる（CSS側の--zenzaSmallDragX/Yと同じ考え方）。
      const effLeft = rect.left + offsetX;
      const effTop = rect.top + offsetY;
      const effBottom = effTop + rect.height;

      // 縦方向: 動画の下に置くと画面外にはみ出す場合は上に回り込ませる。
      // 上下の切り替えは--zenzaCommentPanelFlipY（transformのtranslateYへの
      // 加算分、px指定）で表現する。この値だけ@propertyでtransition可能に
      // 登録してあるため（CSS側参照）、ドラッグ中のtranslateX/Y自体は
      // 従来通り即時反映のまま、上下反転の瞬間だけ「さっと動く」アニメーションになる。
      // Task 073: フォーカス中は入力欄の下にコマンドの帯（.commandDrawer）が広がるので、
      // その下端までを高さとして見込む（見込まないと帯だけ画面の下にはみ出す）。
      const focusedNow = typeof panel.matches === 'function' && panel.matches(':focus-within');
      const drawer = focusedNow ? panel.querySelector('.commandDrawer') : null;
      const panelBaseH = panel.offsetHeight || 50;
      const panelH = drawer ? Math.max(panelBaseH, drawer.offsetTop + drawer.offsetHeight) : panelBaseH;
      const flip = (global.innerHeight - effBottom) < (panelH + COMMENT_PANEL_EDGE_MARGIN);
      const flipY = flip ? -(rect.height + panelH + COMMENT_PANEL_EDGE_MARGIN * 2) : 0;
      container.style.setProperty('--zenzaCommentPanelFlipY', `${flipY}px`);

      // 横方向: 動画中央に対して左右中央寄せしているコメント欄が画面外に
      // はみ出す場合、--zenzaCommentPanelClampXで内側へ補正する
      // （フォーカス時の500px幅は、動画が画面端近くにある場合に特に必要）。
      // フォーカス中はコマンド欄・送信ボタンのはみ出し分も枠として見込む。
      const focused = typeof panel.matches === 'function' && panel.matches(':focus-within');
      const extraOverflow = focused ? COMMENT_PANEL_FOCUS_EXTRA_OVERFLOW : 0;
      const panelW = (panel.offsetWidth || 200) + extraOverflow * 2;
      const centerX = effLeft + rect.width / 2;
      const leftEdge = centerX - panelW / 2;
      const rightEdge = centerX + panelW / 2;
      let clampX = 0;
      if (leftEdge < COMMENT_PANEL_EDGE_MARGIN) {
        clampX = COMMENT_PANEL_EDGE_MARGIN - leftEdge;
      } else if (rightEdge > global.innerWidth - COMMENT_PANEL_EDGE_MARGIN) {
        clampX = (global.innerWidth - COMMENT_PANEL_EDGE_MARGIN) - rightEdge;
      }
      container.style.setProperty('--zenzaCommentPanelClampX', `${clampX}px`);
    };
    // _initializeSmallModeDrag実行時点ではCommentInputPanelはまだ生成されて
    // いない（_initializeDom側で後から生成される）ため、外側（フォーカス/
    // ブラー時の呼び出し用）からアクセスできるようthisに退避しておく。
    this._updateCommentInputLayout = updateCommentInputLayout;

    // ---------------- ドラッグ（位置） ----------------
    let dragging = false;
    let dragArmed = false;
    let dragPointerId = null;
    let dragStartClientX = 0, dragStartClientY = 0;
    let baseOffsetX = 0, baseOffsetY = 0;

    const onDragMove = e => {
      if (dragPointerId !== e.pointerId) { return; }
      const dx = e.clientX - dragStartClientX;
      const dy = e.clientY - dragStartClientY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
          return;
        }
        dragging = true;
        classList.add('is-smallModeDragging');
        try { container.setPointerCapture(dragPointerId); } catch (err) { /* noop */ }
      }
      const [x, y] = clampOffset(baseOffsetX + dx, baseOffsetY + dy);
      applyOffset(x, y);
    };

    const endDrag = e => {
      if (dragPointerId !== e.pointerId) { return; }
      if (dragging) {
        // 直後に発火するclickイベントでの再生/一時停止トグルを、ドラッグの
        // 終了と誤認しないよう1回だけ抑制する（container側のclickリスナー参照）。
        this._suppressSmallModeClick = true;
        persistPosition();
        updateCommentInputLayout();
      }
      dragging = false;
      dragArmed = false;
      cachedRect = null;
      try { container.releasePointerCapture(dragPointerId); } catch (err) { /* noop */ }
      dragPointerId = null;
      classList.remove('is-smallModeDragging');
      container.removeEventListener('pointermove', onDragMove);
      container.removeEventListener('pointerup', endDrag);
      container.removeEventListener('pointercancel', endDrag);
    };

    // Task 035: 「動かし続けているとそのうち動かせなくなり、リロードしないと
    // 直らない」という報告への対策。原因を確定はできていないが、コード上は
    // 次の欠陥が実際にある: dragArmed（ドラッグ中の二重起動防止フラグ）は
    // endDrag内でしかfalseに戻らず、endDragはpointerup/pointercancelの
    // 発火にのみ依存している。何らかの理由（他の拡張機能がイベントの伝播を
    // 途中で止める、ポインタが離された時にウィンドウ/タブがフォーカスを
    // 失っている等）でそのどちらも届かなかった場合、dragArmedがtrueの
    // まま永久に固定され、以後は下のpointerdownハンドラの先頭のガードで
    // 常にreturnするようになり、ドラッグ機能そのものが二度と反応しなく
    // なる（ページを再読み込みするまで直らない）。
    // 保険として、以下の2つを常時（ドラッグの都度ではなく初期化時に一度だけ）
    // 監視しておく:
    //  - lostpointercapture: 理由を問わずpointer captureが解放された時に
    //    必ず発火する専用イベント（Pointer Events仕様上、まさにこの種の
    //    「pointerup/pointercancelを取りこぼした」場合の保険として使うことが
    //    想定されている）。
    //  - window自体のcaptureフェーズでのpointerup/pointercancel。ページ内の
    //    他のスクリプト（拡張機能等）がbubbleフェーズでイベントの伝播を
    //    止めていても、captureフェーズはそれより先に動くため影響を受けにくい。
    // どちらも、ドラッグが進行中でなければ（dragPointerIdがnullなら）
    // 何もしない安全な処理。
    const forceEndDragIfStuck = e => {
      if (dragPointerId === null) { return; }
      if (e && e.pointerId !== undefined && e.pointerId !== dragPointerId) { return; }
      endDrag({pointerId: dragPointerId});
    };
    container.addEventListener('lostpointercapture', forceEndDragIfStuck);
    window.addEventListener('pointerup', forceEndDragIfStuck, {capture: true});
    window.addEventListener('pointercancel', forceEndDragIfStuck, {capture: true});

    container.addEventListener('pointerdown', e => {
      if (this._state.screenMode !== 'small' ||
          (e.button !== undefined && e.button !== 0) ||
          dragArmed ||
          !e.target.closest('.videoPlayer')) {
        return;
      }
      dragArmed = true;
      dragPointerId = e.pointerId;
      // ドラッグ中はcontainer自体が動かないので、位置の基準はここで一度だけ
      // 測っておく（Task 039、clampOffsetのコメント参照）。
      cachedRect = container.getBoundingClientRect();
      dragStartClientX = e.clientX;
      dragStartClientY = e.clientY;
      baseOffsetX = offsetX;
      baseOffsetY = offsetY;
      container.addEventListener('pointermove', onDragMove);
      container.addEventListener('pointerup', endDrag);
      container.addEventListener('pointercancel', endDrag);
      // ここではpreventDefault()しない。ドラッグと判定されなかった場合
      // （＝一定距離動かないまま指を離した、単なるクリックだった場合）は、
      // 既存のクリックでの再生/一時停止トグル操作をそのまま活かすため。
    });

    // ---------------- リサイズ（右下つまみ） ----------------
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'zenzaSmallModeResizeHandle';
    resizeHandle.title = 'ドラッグしてサイズ変更';
    container.append(resizeHandle);

    let resizePointerId = null;
    let resizeStartClientX = 0, resizeStartClientY = 0;
    let baseWidth = 0, baseHeight = 0;

    const onResizeMove = e => {
      if (resizePointerId !== e.pointerId) { return; }
      const dx = e.clientX - resizeStartClientX;
      const dy = e.clientY - resizeStartClientY;
      const maxW = Math.max(MIN_WIDTH, global.innerWidth * 0.9);
      const maxH = Math.max(MIN_HEIGHT, global.innerHeight * 0.9);
      let newW, newH;
      if (config.props.smallModeAspectLock) {
        const aspect = baseWidth / baseHeight;
        newW = Math.min(Math.max(baseWidth + dx, MIN_WIDTH), maxW);
        newH = newW / aspect;
        if (newH < MIN_HEIGHT) { newH = MIN_HEIGHT; newW = newH * aspect; }
        if (newH > maxH) { newH = maxH; newW = newH * aspect; }
      } else {
        newW = Math.min(Math.max(baseWidth + dx, MIN_WIDTH), maxW);
        newH = Math.min(Math.max(baseHeight + dy, MIN_HEIGHT), maxH);
      }
      applySize(newW, newH);
      // サイズが変わって画面外にはみ出す場合は、位置も追従してクランプし直す。
      const [x, y] = clampOffset(offsetX, offsetY, newW, newH);
      if (x !== offsetX || y !== offsetY) {
        applyOffset(x, y);
      }
    };

    const endResize = e => {
      if (resizePointerId !== e.pointerId) { return; }
      try { resizeHandle.releasePointerCapture(resizePointerId); } catch (err) { /* noop */ }
      resizePointerId = null;
      classList.remove('is-smallModeResizing');
      resizeHandle.removeEventListener('pointermove', onResizeMove);
      resizeHandle.removeEventListener('pointerup', endResize);
      resizeHandle.removeEventListener('pointercancel', endResize);
      persistSize();
      persistPosition();
      updateCommentInputLayout();
    };

    resizeHandle.addEventListener('pointerdown', e => {
      if (this._state.screenMode !== 'small' || (e.button !== undefined && e.button !== 0)) {
        return;
      }
      resizePointerId = e.pointerId;
      resizeStartClientX = e.clientX;
      resizeStartClientY = e.clientY;
      const rect = container.getBoundingClientRect();
      baseWidth = rect.width;
      baseHeight = rect.height;
      classList.add('is-smallModeResizing');
      try { resizeHandle.setPointerCapture(resizePointerId); } catch (err) { /* noop */ }
      resizeHandle.addEventListener('pointermove', onResizeMove);
      resizeHandle.addEventListener('pointerup', endResize);
      resizeHandle.addEventListener('pointercancel', endResize);
      e.preventDefault();
      e.stopPropagation();
    });

    // ---------------- アスペクト比ロックの切り替えボタン ----------------
    const lockButton = document.createElement('button');
    lockButton.type = 'button';
    lockButton.className = 'zenzaSmallModeAspectLockButton';
    const updateLockButton = () => {
      const locked = !!config.props.smallModeAspectLock;
      lockButton.classList.toggle('is-locked', locked);
      lockButton.title = locked
        ? 'アスペクト比を固定中（クリックで解除）'
        : 'アスペクト比は自由（クリックで固定）';
      lockButton.textContent = locked ? '🔒' : '🔓';
    };
    updateLockButton();
    lockButton.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      config.props.smallModeAspectLock = !config.props.smallModeAspectLock;
      updateLockButton();
    });
    container.append(lockButton);

    // ---------------- 初期状態に戻すボタン ----------------
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'zenzaSmallModeResetButton';
    resetButton.title = '位置とサイズを初期状態に戻す';
    resetButton.textContent = '⟲';
    resetButton.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      applyOffset(0, 0);
      applySize(0, 0);
      persistPosition();
      persistSize();
      updateCommentInputLayout();
    });
    container.append(resetButton);

    window.addEventListener('resize', _.debounce(() => {
      if (this._state.screenMode !== 'small') {
        return;
      }
      const [x, y] = clampOffset(offsetX, offsetY, width || DEFAULT_WIDTH, height || DEFAULT_HEIGHT);
      if (x !== offsetX || y !== offsetY) {
        applyOffset(x, y);
      }
      updateCommentInputLayout();
    }, 200));
  }
  _initializeVideoInfoPanel() {
    if (this.videoInfoPanel) {
      return this.videoInfoPanel;
    }
    this.videoInfoPanel = new VideoInfoPanel({
      dialog: this,
      node: this._$playerContainer
    });
    this.videoInfoPanel.on('command', this._onCommand.bind(this));
    return this.videoInfoPanel;
  }
  _onCommand(command, param) {
    switch (command) {
      case 'settingPanel':
        this.toggleSettingPanel();
        break;
      // Task 077: 反転は画面フィルターの設定(screenFilter.flipH/flipV)に統合した。
      // 見た目は今まで通り .is-flipH / .is-flipV クラス（transform）で反映する
      // （_initializeScreenFilter 参照）。
      case 'toggle-flipH':
        this.emit('command', 'toggle-screenFilter.flipH');
        break;
      case 'toggle-flipV':
        this.emit('command', 'toggle-screenFilter.flipV');
        break;
      case 'toggle-screenFilterPanel':
        this.toggleScreenFilterPanel();
        break;
      default:
        this.emit('command', command, param);
    }
  }
  async _onPaste(e) {
    const isZen = !!e.target.closest('.zenzaVideoPlayerDialog');
    const target = (e.path && e.path[0]) ? e.path[0] : e.target;
    window.console.log('onPaste', {e, target, isZen});
    if (!isZen && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
      return;
    }
    let text;
    try { text = await navigator.clipboard.readText(); }
    catch(err) {
      window.console.warn(err, navigator.clipboard);
      text = e.clipboardData.getData('text/plain');
    }
    if (!text) {
      return;
    }

    text = text.trim();
    const isOpen = this._state.isOpen;
    // Task 074: ショート動画(ss〜)にも対応
    const watchIdReg = /((?:nm|sm|so|ss)\d+)/.exec(text);
    if (watchIdReg) {
      return this._onCommand('open', watchIdReg[1]);
    }
    if (!isOpen) {
      return;
    }
    const youtubeReg = /^https?:\/\/((www\.|)youtube\.com\/watch|youtu\.be)/.exec(text);
    if (youtubeReg) {
      return this._onCommand('setVideo', text);
    }
    const seekReg = /^(\d+):(\d+)$/.exec(text);
    if (seekReg) {
      return this._onCommand('seek', seekReg[1] * 60 + seekReg[2] * 1);
    }
    const mylistReg = /mylist(\/#\/|\/)(\d+)/.exec(text);
    if (mylistReg) {
      return this._onCommand('playlistSetMylist', mylistReg[2]);
    }
    const seriesReg = /series\/(\d+)/.exec(text);
    if (seriesReg) {
      return this._onCommand('playlistSetSeries', seriesReg[1]);
    }
    const ownerReg = /user\/(\d+)/.exec(text);
    if (ownerReg) {
      return this._onCommand('playlistSetUploadedVideo', ownerReg[1]);
    }
  }
  _initializeResponsive() {
    window.addEventListener('resize', _.debounce(this._updateResponsive.bind(this), 500));
    this.varMapper = new VariablesMapper({config: this._playerConfig});
    this.varMapper.on('update', () => this._updateResponsive());
  }
  _updateResponsive() {
    if (!this._state.isOpen) {
      return;
    }
    const $container = this._$playerContainer;
    const [header] = $container.find('.zenzaWatchVideoHeaderPanel');
    const config = this._playerConfig;

    // 画面の縦幅にシークバー分の余裕がある時は常時表示
    const update = () => {
      const w = global.innerWidth, h = global.innerHeight;
      const vMargin = h - w * this._aspectRatio;

      const controlBarMode = config.props.fullscreenControlBarMode;
      if (controlBarMode === 'always-hide') {
        this.toggleClass('showVideoControlBar', false);
        return;
      }
      const videoControlBarHeight = this.varMapper.videoControlBarHeight;
      const showVideoHeaderPanel = vMargin >= videoControlBarHeight + header.offsetHeight * 2;
      let showVideoControlBar;
      switch (controlBarMode) {
        case 'always-show':
          showVideoControlBar = true;
          break;
        case 'auto':
        default:
          // A-11: この「余白があれば常時表示」の判定は、ブラウザウィンドウ全体の
          // 高さ/幅と動画のアスペクト比から「ページ内に常時表示できる余白があるか」
          // を見るものであり、画面上の任意の位置へドラッグして動かす「小」モードの
          // フローティング表示には意味を持たない（ウィンドウがたまたま縦長なだけで
          // 常時表示になってしまい、意図した自動非表示が効かなくなる）。
          // 「小」モードでは常にfalseとし、is-mouseMoving/:hoverベースの
          // 自動非表示（下記CSS、および.zenzaSmallModeResizeHandle等と同じ仕組み）
          // に一本化する。
          // A-12: フルスクリーン（実機のフルスクリーン表示、および同じ`for-full`
          // スコープのCSSが有効になるワイド/3Dモードも含む）でも、上と同じ理由で
          // vMargin判定は意味を持たない（ウィンドウ/動画のアスペクト比次第で
          // 常時表示になってしまい、意図した自動非表示が効かなくなる）。
          // 2026-09-11のユーザー要望により、「小」モードと同様に常にfalseとし、
          // is-mouseMoving/:hoverベースの自動非表示に一本化する。
          showVideoControlBar = (this._state.screenMode === 'small' || this._isFullscreenControlBarScope())
            ? false
            : vMargin >= videoControlBarHeight;
      }
      this.toggleClass('showVideoControlBar', showVideoControlBar);
      this.toggleClass('showVideoHeaderPanel', showVideoHeaderPanel);
    };

    update();
  }
  // A-12: コントロールバーの自動非表示CSS（`screenMode for-full`スコープ）が
  // 有効になるのと同じ条件。実機のフルスクリーン表示中に加え、フルスクリーンで
  // なくてもワイド/3Dモードは同じ`for-full`スコープが有効になる
  // （`_updateScreenModeStyle()`参照）ため、ここでも同様に扱う。
  _isFullscreenControlBarScope() {
    return Fullscreen.now() || this._state.screenMode === 'wide' || this._state.screenMode === '3D';
  }
  _onMouseMove() {
    if (this._isMouseMoving) {
      return;
    }
    this.addClass('is-mouseMoving');
    this._isMouseMoving = true;
  }
  _onMouseMoveEnd() {
    if (!this._isMouseMoving) {
      return;
    }
    this.removeClass('is-mouseMoving');
    this._isMouseMoving = false;
  }
  // コントロールバー専用の表示トリガー（2026-09-11追加）。is-mouseMovingとは
  // 別に持つ理由は_initializeDom側のコメント参照。
  _onControlBarActive() {
    if (this._isControlBarActive) {
      return;
    }
    this.addClass('is-controlBarActive');
    this._isControlBarActive = true;
  }
  _onControlBarIdle() {
    if (!this._isControlBarActive) {
      return;
    }
    this.removeClass('is-controlBarActive');
    this._isControlBarActive = false;
  }
  _onVideoCanPlay(watchId, videoInfo, options) {
    this.emit('canPlay', watchId, videoInfo, options);
  }
  _onVideoCount({comment, view, mylist} = {}) {
    this.emit('videoCount', {comment, view, mylist});
  }
  _onVideoError(e) {
    this.emit('error', e);
  }
  _onBeforeVideoOpen() {
    this._setThumbnail();
  }
  _onVideoInfoLoad(videoInfo) {
    this.videoInfoPanel.update(videoInfo);
  }
  _onVideoInfoFail(videoInfo) {
    if (videoInfo) {
      this.videoInfoPanel.update(videoInfo);
    }
  }
  _onVideoServerType(type, sessionInfo) {
    this.emit('videoServerType', type, sessionInfo);
  }
  _onVideoPlay() {
  }
  _onVideoPlaying() {
  }
  _onVideoPause() {
    // 「小」モード・フルスクリーン等で下部のコントロールバーを自動非表示に
    // している時、一時停止した瞬間はマウスを動かした時と全く同じ扱いで一時的に
    // 再表示する（2026-09-11 ユーザー要望）。コントロールバー専用の
    // is-controlBarActiveを使い、消えるまでの待ち時間もマウス移動時と同一の
    // debounceインスタンス（3000ms）を共有しているため、「マウスを外した時に
    // 消えるまでの時間」と常に完全に一致する（タイマーの値を別々に持って
    // 食い違う、という事態が起きない）。実際にマウスが重なっていれば通常の
    // :hoverがそのまま効き続ける。
    this._onControlBarActive();
    if (this._onControlBarIdleDebounced) {
      this._onControlBarIdleDebounced();
    }
  }
  _onVideoStalled() {
  }
  _onVideoAbort() {
  }
  _onVideoAspectRatioFix(ratio) {
    this._aspectRatio = ratio;
    this._updateResponsive();
  }
  _onVolumeChange(/*vol, mute*/) {
    this.addClass('volumeChanging');
  }
  _onVolumeChangeEnd(/*vol, mute*/) {
    this.removeClass('volumeChanging');
  }
  _onScreenModeChange() {
    this._applyScreenMode();
  }
  _getStateClassNameTable() {
    // TODO: テーブルなくても対応できるようにcss名を整理
    return this._classNameTable = this._classNameTable || objUtil.toMap({
      isAbort: 'is-abort',
      isBackComment: 'is-backComment',
      isShowComment: 'is-showComment',
      isDebug: 'is-debug',
      isDomandAvailable: 'is-domandAvailable',
      isDmcAvailable: 'is-dmcAvailable',
      isError: 'is-error',
      isLoading: 'is-loading',
      isMute: 'is-mute',
      isLoop: 'is-loop',
      isOpen: 'is-open',
      isPlaying: 'is-playing',
      isSeeking: 'is-seeking',
      isPausing: 'is-pausing',
//      isStalled: 'is-stalled',
      isLiked: 'is-liked',
      isChanging: 'is-changing',
      isUpdatingDeflist: 'is-updatingDeflist',
      isUpdatingMylist: 'is-updatingMylist',
      isPlaylistEnable: 'is-playlistEnable',
      isCommentPosting: 'is-commentPosting',
      isRegularUser: 'is-regularUser',
      isWaybackMode: 'is-waybackMode',
      isNotPlayed: 'is-notPlayed',
      isYouTube: 'is-youTube'
    });
  }
  _onPlayerStateChange(changedState) {
    for (const key of changedState.keys()) {
      this._onPlayerStateUpdate(key, changedState.get(key));
    }
  }
  _onPlayerStateUpdate(key, value) {
    switch (key) {
      case 'thumbnail':
        return this._setThumbnail(value);
      case 'screenMode':
      case 'isOpen':
        if (this._state.isOpen) {
          this.show();
          this._onScreenModeChange();
        } else {
          this.hide();
        }
        return;
      case 'errorMessage':
        return this._$errorMessageContainer[0].textContent = value;
      case 'currentTab':
        return this.selectTab(value);
    }
    const table = this._getStateClassNameTable();
    const className = table.get(key);
    if (className) {
      this.toggleClass(className, !!value);
    }
  }
  _applyState() {
    const table = this._getStateClassNameTable();
    const state = this._state;
    for (const [key, className] of table) {
      this.classList.toggle(className, state[key]);
    }

    if (this._state.isOpen) {
      this._applyScreenMode();
    }
  }
  _getScreenModeClassNameTable() {
    return [
      'zenzaScreenMode_3D',
      'zenzaScreenMode_small',
      'zenzaScreenMode_sideView',
      'zenzaScreenMode_normal',
      'zenzaScreenMode_big',
      'zenzaScreenMode_wide'
    ];
  }
  _applyScreenMode(force = false) {
    const screenMode = this._state.isOpen ? `zenzaScreenMode_${this._state.screenMode}` : '';
    if (!force && this._lastScreenMode === screenMode) { return; }
    this._lastScreenMode = '';
    const modes = this._getScreenModeClassNameTable();
    const isFull = util.fullscreen.now();
    Object.assign(document.body.dataset, {
      screenMode: this._state.screenMode,
      fullscreen: isFull ? 'yes' : 'no'
    });
    modes.forEach(m => this._$body.raf.toggleClass(m, m === screenMode && !isFull));
    this._updateScreenModeStyle();
    // Task 050 (A-4): 他の画面モードから「小」に切り替わった直後は、
    // コメント入力欄の反転・クランプ状態が古いままになるため再計算する。
    // body側のモードclass付与自体がraf.toggleClassで次フレームに遅延するため
    // （直後に測ると切り替え前のレイアウトを読んでしまう）、こちらも1フレーム
    // 遅らせて測る。
    if (this._updateCommentInputLayout) {
      requestAnimationFrame(() => this._updateCommentInputLayout());
    }
    // A-11: 「小」モードへ切り替わった直後に、直前の画面モードで計算された
    // showVideoControlBar（常時表示）が残ったままだと自動非表示が効かない。
    // 画面モード切り替え時に再計算しておく（body側のクラス付与自体は
    // raf.toggleClassで次フレームになるため、こちらも1フレーム遅らせる）。
    if (this.varMapper) {
      requestAnimationFrame(() => this._updateResponsive());
    }
  }
  _updateScreenModeStyle() {
    if (!this._state.isOpen) {
      util.StyleSwitcher.update({off: 'style.screenMode'});
      return;
    }
    if (Fullscreen.now()) {
      util.StyleSwitcher.update({
        on: 'style.screenMode.for-full, style.screenMode.for-screen-full',
        off: 'style.screenMode:not(.for-full):not(.for-screen-full), link[href*="watch.css"]'
      });
      return;
    }
    let on, off;
    switch (this._state.screenMode) {
      case '3D':
      case 'wide':
        on = 'style.screenMode.for-full, style.screenMode.for-window-full';
        off = 'style.screenMode:not(.for-full):not(.for-window-full), link[href*="watch.css"]';
        break;
      default:
      case 'normal':
      case 'big':
        on = 'style.screenMode.for-dialog, style.screenMode.for-big, style.screenMode.for-normal, link[href*="watch.css"]';
        off = 'style.screenMode:not(.for-dialog):not(.for-big):not(.for-normal)';
        break;
      case 'small':
      case 'sideView':
        on = 'style.screenMode.for-popup, style.screenMode.for-sideView, .style.screenMode.for-small, link[href*="watch.css"]';
        off = 'style.screenMode:not(.for-popup):not(.for-sideView):not(.for-small)';
        break;
    }
    util.StyleSwitcher.update({on, off});
  }
  show() {
    ClassList(this._$dialog[0]).add('is-open');
    if (!Fullscreen.now()) {
      ClassList(document.body).remove('fullscreen');
    }
    this._$body.raf.addClass('showNicoVideoPlayerDialog');
    util.StyleSwitcher.update({on: 'style.zenza-open'});
    this._updateScreenModeStyle();
  }
  hide() {
    ClassList(this._$dialog[0]).remove('is-open');
    this.settingPanel && this.settingPanel.close();
    this.screenFilterPanel && this.screenFilterPanel.close();
    this._$body.raf.removeClass('showNicoVideoPlayerDialog');
    util.StyleSwitcher.update({off: 'style.zenza-open, style.screenMode', on: 'link[href*="watch.css"]'});
    this._clearClass();
  }
  _clearClass() {
    const modes = this._getScreenModeClassNameTable().join(' ');
    this._lastScreenMode = '';
    this._$body.raf.removeClass(modes);
  }
  _setThumbnail(thumbnail) {
    // base hrefのせいで変なurlを参照してしまうので、thumbnailが無ければ
    // 適当な黒画像にする
    const url = `url(${thumbnail || CONSTANT.BLANK_PNG})`;
    this.css('background-image', url);
    // Task 049: 「小」モードでドラッグした位置に読み込み中の背景も追従させる
    // ため、.zenzaPlayerContainer自身だけでなく.loadingMessageContainer側にも
    // 同じ画像を設定しておく（該当CSSは.zenzaScreenMode_small配下でのみ有効）。
    if (this._$loadingMessageContainer && this._$loadingMessageContainer[0]) {
      this._$loadingMessageContainer.raf.css('background-image', url);
    }
  }
  focusToCommentInput() {
    // 即フォーカスだと入力欄に"C"が入ってしまうのを雑に対処
    window.setTimeout(() => this.commentInput.focus(), 0);
  }
  toggleSettingPanel() {
    if (!this.settingPanel) {
      this.settingPanel = document.createElement('zenza-setting-panel');
      this.settingPanel.config = this._playerConfig;
      this._$playerContainer.append(this.settingPanel);
    }
    this.settingPanel.toggle();
  }
  // Task 077: 画面フィルターのパネル（動画を見ながら調整できる小さなパネル）
  toggleScreenFilterPanel(open) {
    if (!this.screenFilterPanel) {
      this.screenFilterPanel = new ScreenFilterPanel({config: this._playerConfig});
    }
    // 大きな設定パネルが開いていると動画が隠れて見比べられないので閉じる
    if (this.settingPanel && this.settingPanel.isOpen) {
      this.settingPanel.close();
    }
    const next = typeof open === 'boolean' ? open : !this.screenFilterPanel.isOpen;
    next ? this.screenFilterPanel.open() : this.screenFilterPanel.close();
  }
  _initializeScreenFilter() {
    const config = this._playerConfig;
    ScreenFilter.initialize(config);
    const applyFlip = () => {
      this.classList.toggle('is-flipH', !!config.props['screenFilter.flipH']);
      this.classList.toggle('is-flipV', !!config.props['screenFilter.flipV']);
    };
    config.onkey('screenFilter.flipH', applyFlip);
    config.onkey('screenFilter.flipV', applyFlip);
    applyFlip();
  }
  get$Container() {
    return this._$playerContainer;
  }
  css(key, val) {
    this._$playerContainer.raf.css(key, val);
  }
  addClass(name) {
    return this.classList.add(name);
  }
  removeClass(name) {
    return this.classList.remove(name);
  }
  toggleClass(name, v) {
    this.classList.toggle(name, v);
  }
  hasClass(name) {
    return this.classList.contains(name);
  }
  appendTab(name, title) {
    return this.videoInfoPanel.appendTab(name, title);
  }
  selectTab(name) {
    this._playerConfig.props.videoInfoPanelTab = name;
    this._state.currentTab = name;
    this.videoInfoPanel.selectTab(name);
    global.emitter.emit('tabChange', name);
  }
  execCommand(command, param) {
    this.emit('command', command, param);
  }
  blinkTab(name) {
    this.videoInfoPanel.blinkTab(name);
  }
  clearPanel() {
    this.videoInfoPanel.clear();
  }
}

util.addStyle(`
  .is-watch .BaseLayout {
    display: none;
  }
  #zenzaVideoPlayerDialog {
    touch-action: manipulation; /* for Safari */
    touch-action: none;
  }
  #zenzaVideoPlayerDialog::before {
    display: none;
  }

  .zenzaPlayerContainer {
    left: 0 !important;
    top:  0 !important;
    width:  100vw !important;
    height: 100vh !important;
    contain: size layout;
  }

  .videoPlayer,
  .commentLayerFrame,
  .resizeObserver {
    top:  0 !important;
    left: 0 !important;
    width:  100vw !important;
    height: 100% !important;
    right:  0 !important;
    border: 0 !important;
    z-index: 100 !important;
    contain: layout style size paint;
    will-change: transform,opacity;
  }
  .resizeObserver {
    z-index: -1;
    opacity: 0;
    pointer-events: none;
  }

  .is-open .videoPlayer>* {
    cursor: none;
  }

  .showVideoControlBar {
    --padding-bottom: ${VideoControlBar.BASE_HEIGHT}px;
    --padding-bottom: var(--zenza-control-bar-height);
  }
  .zenzaStoryboardOpen .showVideoControlBar {
    --padding-bottom: calc(var(--zenza-control-bar-height) + 80px);
  }
  .zenzaStoryboardOpen.is-fullscreen .showVideoControlBar {
    --padding-bottom: calc(var(--zenza-control-bar-height) + 50px);
  }

  .showVideoControlBar .videoPlayer,
  .showVideoControlBar .commentLayerFrame,
  .showVideoControlBar .resizeObserver {
    height: calc(100% - var(--padding-bottom)) !important;
  }

  .showVideoControlBar .videoPlayer {
    z-index: 100 !important;
  }

  .showVideoControlBar .commentLayerFrame {
    z-index: 101 !important;
  }

  /* Task 063: enableCommentPanel(コメントパネル表示ON/OFF、上級設定/ショートカット)
     がfalseの時、動画情報パネルの「コメント」タブ自体をタブボタンごと隠す。
     appendTab()が生成する.tabSelect.<tabName> / .tabs.<tabName>のペアを、
     この時だけまとめて非表示にする。 */
  .hideCommentPanelTab .tabSelect.comment,
  .hideCommentPanelTab .tabs.comment {
    display: none !important;
  }

  .is-showComment.is-backComment .videoPlayer
  {
    top:  25% !important;
    left: 25% !important;
    width:  50% !important;
    height: 50% !important;
    right:  0 !important;
    bottom: 0 !important;
    border: 0 !important;
    z-index: 102 !important;
  }

  body[data-screen-mode="3D"] .zenzaPlayerContainer .videoPlayer {
    transform: perspective(700px) rotateX(10deg);
    margin-top: -5%;
  }

  .zenzaPlayerContainer {
    left: 0;
    width: 100vw;
    height: 100vh;
    box-shadow: none;
  }

  .is-backComment .videoPlayer {
    left: 25%;
    top:  25%;
    width:  50%;
    height: 50%;
    z-index: 102;
  }

  body[data-screen-mode="3D"] .zenzaPlayerContainer .videoPlayer {
    transform: perspective(600px) rotateX(10deg);
    height: 100%;
  }

  body[data-screen-mode="3D"] .zenzaPlayerContainer .commentLayerFrame {
    transform: translateZ(0) perspective(600px) rotateY(30deg) rotateZ(-15deg) rotateX(15deg);
    opacity: 0.9;
    height: 100%;
    margin-left: 20%;
  }

`, {className: 'screenMode for-full', disabled: true});


util.addStyle(`
  body #zenzaVideoPlayerDialog {
    contain: style size;
  }

  #zenzaVideoPlayerDialog::before {
    display: none;
  }

  body.zenzaScreenMode_sideView {
    --sideView-left-margin: ${CONSTANT.SIDE_PLAYER_WIDTH + 24}px;
    --sideView-top-margin: 76px;
    margin-left: var(--sideView-left-margin);
    margin-top: var(--sideView-top-margin);

    width: auto;
  }

  body.zenzaScreenMode_sideView.nofix {
    --sideView-top-margin: 40px;
  }
  body.zenzaScreenMode_sideView:not(.nofix) #siteHeader {
    width: auto;
  }
  body.zenzaScreenMode_sideView:not(.nofix) #siteHeader #siteHeaderInner {
    width: auto;
  }

 .zenzaScreenMode_sideView .zenzaVideoPlayerDialog.is-open,
 .zenzaScreenMode_small .zenzaVideoPlayerDialog.is-open {
    display: block;
    top: 0; left: 0; right: 100%; bottom: 100%;
  }

  .zenzaScreenMode_sideView .zenzaPlayerContainer {
    width: ${CONSTANT.SIDE_PLAYER_WIDTH}px;
    height: ${CONSTANT.SIDE_PLAYER_HEIGHT}px;
  }
  /* 画面モード「小」のサイズは、リサイズ機能（Task 032）を持つため下記で個別に指定する */

  /*
    画面モード「小」では、.videoControlBar（シークバーや各種アイコン）が
    .zenzaPlayerContainerの子要素でありながらposition: fixedで画面下に
    固定される設計になっている。もし.zenzaPlayerContainer自体にtransformを
    掛けると、position: fixedの子要素のcontaining blockがビューポートから
    .zenzaPlayerContainerに変わってしまい（CSSの仕様上、transformを持つ要素は
    position: fixedな子孫のcontaining blockになる）、シークバー等の表示位置と
    クリック判定がずれる不具合になる（Task 031で発覚・修正）。
    このため、ドラッグ分のオフセットは.zenzaPlayerContainer自体にではなく、
    動画本体（.videoPlayer）とコメント描画レイヤー（.commentLayerFrame）に
    だけtransformとして適用する。.videoControlBarを含む
    .zenzaPlayerContainer自身のレイアウトには一切触れないため、シークバーは
    元のスクリプト通り画面下に固定されたままになる。
    他の画面モードのCSS（left/top/right/bottom等）にも一切触れないため、
    通常時（オフセット0）は今まで通り左上に表示され、他の画面モードの
    レイアウトにも影響しない。

    注意（Task 033で追加）: リサイズつまみ・アスペクト比ロックボタン・
    リセットボタン（.zenzaSmallModeResizeHandle等）は.zenzaPlayerContainerの
    直接の子として追加されており、.videoPlayer/.commentLayerFrameの中には
    入っていない。そのため、これらにも同じtransformを適用しておかないと、
    動画だけがドラッグで動いて、これらのボタン・つまみは元の（静的な）
    位置に取り残されてしまう（「画面に何か残ってしまう」不具合の原因）。
    CSSカスタムプロパティは.zenzaPlayerContainerに設定されており子孫に
    継承されるため、同じtransform宣言をこれらの要素にも加えるだけで、
    動画と一緒に追従するようになる。

    注意（Task 035で追加）: いいね・ツイート・マイリスト登録・閉じるボタン等
    （VideoHoverMenuが描画する.hoverMenuContainerとその中の各
    .menuItemContainer、中央の再生/一時停止トグル等すべて含む）も、
    .zenzaPlayerContainerに直接appendされる別コンポーネントで、
    上と全く同じ理由で取り残されていた。

    注意（Task 036で修正）: Task 035では.hoverMenuContainer自体に
    transformを掛けていたが、これは誤りだった。.hoverMenuContainerには
    もともとposition指定がなく（static）、"contain: style size"が
    付いているだけで明示的なwidth/heightも無い。CSSの仕様上、transformを
    持つ要素はposition値によらずabsolute配置された子孫のcontaining block
    になるため、.hoverMenuContainerにtransformを付けた瞬間、中の
    .menuItemContainer（right:0/top:0等で自分自身を配置している）の基準が
    「.zenzaPlayerContainer」から「サイズを持たない.hoverMenuContainer」に
    変わってしまい、各メニューが本来の四隅ではなく原点付近に寄って
    表示される不具合になっていた（「ボタンが変な位置になる」不具合）。
    .menuItemContainer自体はTask 035以前から既にposition: absoluteで
    .zenzaPlayerContainerを基準に配置されているため、代わりに
    .menuItemContainer側へ直接transformを掛ける。この場合は
    「transformを持つ要素が新たなcontaining blockになる」影響を受けるのは
    .menuItemContainerの中身（.menuButton等、既に.menuItemContainer
    自身を基準に配置されている）だけなので、位置がズレる心配はない。

    ただし中央の再生/一時停止トグル（.togglePlayMenu、
    .menuItemContainer.centerでもある）だけは例外で、元々
    "top:50%;left:50%;transform:translate(-50%,-50%) scale(...)"という
    別のtransformで自分自身を中央寄せしている。ここに単純に
    ドラッグ分のtranslateを追加すると、後勝ちのCSSでtransform宣言
    そのものが上書きされ、中央寄せが効かなくなってしまう
    （左上を基準にズレて表示される）。そのため.togglePlayMenuは
    このルールの対象から除外し、直後の別ルールでcalc()を使い
    「中央寄せ＋ドラッグ追従」を1つのtransformに両立させている。

    注意（Task 049で追加）: 読み込み中表示（.loadingMessageContainer）も、
    上と全く同じ理由（.zenzaPlayerContainerの直接の子として追加され、
    videoPlayer/commentLayerFrameとは別に自分自身のright/bottom指定で
    位置決めしている）で取り残されていた。新しい動画を読み込む際、動画本体は
    display:noneになって消え、代わりにこの読み込み中表示が出るが、これに
    ドラッグ分のtransformが掛かっていなかったため、「小」モードで動画を
    移動した状態で新しい動画を開くと、読み込み中の表示だけが常に
    ドラッグ前の初期位置（画面左上）に出てしまっていた。
    （なお.errorMessageContainerも同じ構造だが、こちらは既に
    "top:50%;left:50%;transform:translate(-50%,-50%)"という中央寄せの
    transformを自分で持っており、ここに単純に追加すると
    .togglePlayMenuで起きたのと同じ理由で中央寄せが壊れる。対応するには
    calc()での合成が必要になるため、今回の依頼（読み込み中表示のみ）の
    範囲外として見送った。 → Task 054で対応。.togglePlayMenuと同じ
    calc()合成のルールを別途追加した。） */
  .zenzaScreenMode_small .zenzaPlayerContainer .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer .commentLayerFrame,
  .zenzaScreenMode_small .zenzaPlayerContainer > .zenzaSmallModeResizeHandle,
  .zenzaScreenMode_small .zenzaPlayerContainer > .zenzaSmallModeAspectLockButton,
  .zenzaScreenMode_small .zenzaPlayerContainer > .zenzaSmallModeResetButton,
  .zenzaScreenMode_small .zenzaPlayerContainer > .loadingMessageContainer,
  .zenzaScreenMode_small .zenzaPlayerContainer .hoverMenuContainer .menuItemContainer:not(.togglePlayMenu) {
    transform: translate(var(--zenzaSmallDragX, 0px), var(--zenzaSmallDragY, 0px));
    will-change: transform;
  }
  /* .togglePlayMenu（中央の再生/一時停止トグル）専用: 中央寄せの
     translate(-50%,-50%)にドラッグ分のオフセットをcalc()で合成する。
     :hover/:activeでのscale変化（元のCSSルール）を壊さないよう、
     それぞれの状態ごとに個別に上書きする。 */
  .zenzaScreenMode_small .zenzaPlayerContainer .hoverMenuContainer .togglePlayMenu {
    transform:
      translate(calc(-50% + var(--zenzaSmallDragX, 0px)), calc(-50% + var(--zenzaSmallDragY, 0px)))
      scale(1.5);
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .hoverMenuContainer .togglePlayMenu:hover {
    transform:
      translate(calc(-50% + var(--zenzaSmallDragX, 0px)), calc(-50% + var(--zenzaSmallDragY, 0px)))
      scale(1.6);
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .hoverMenuContainer .togglePlayMenu:active {
    transform:
      translate(calc(-50% + var(--zenzaSmallDragX, 0px)), calc(-50% + var(--zenzaSmallDragY, 0px)))
      scale(2.0, 1.2);
  }
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeDragging .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeDragging .commentLayerFrame {
    transition: none;
  }
  /* .errorMessageContainer（エラー表示）専用: 「小」モードでは他の要素と違い
     単純にtranslate(--zenzaSmallDragX/Y)を追加できない（元々自分自身の中央寄せ
     translate(-50%,-50%)を持っているため）。.togglePlayMenuと同じ要領で
     calc()で合成する（Task 054。ドラッグして動かした状態でエラーが出ると、
     動画本体は追従した位置に表示されるのにエラー表示だけドラッグ前の位置
     （.zenzaPlayerContainerの中央、多くの場合は画面左上寄り）に出てしまう
     不具合があった）。 */
  .zenzaScreenMode_small .zenzaPlayerContainer.is-error .errorMessageContainer {
    transform:
      translate(calc(-50% + var(--zenzaSmallDragX, 0px)), calc(-50% + var(--zenzaSmallDragY, 0px)));
  }
  /* Task 050 (A-4): コメント入力欄（.commentInputPanel）の「小」モード追従。
     通常はposition: fixedでビューポート基準に配置されているため、「小」モードで
     動画をドラッグしても追従しなかった。「小」モードに限り、動画と同じ
     .zenzaPlayerContainerを基準にしたposition: absoluteへ切り替え、動画の直下に
     配置した上で、.togglePlayMenuと同じ要領で中央寄せのtranslate(-50%, 0)と
     ドラッグ分のtransform（--zenzaSmallDragX/Y）をcalc()で合成する。
     画面外にはみ出す場合の「上に回り込ませる」上下反転は、常にtop: 100%を
     基準にしたまま、--zenzaCommentPanelFlipY（px指定のtranslateY加算分）で
     表現する。実際に描画されたコメント欄のサイズが必要なためJS側
     （_initializeSmallModeDrag内のupdateCommentInputLayout）で計算する
     （ドラッグ中は毎フレーム、それ以外はリサイズ・ウィンドウリサイズ・
     フォーカス変化のたびに再計算）。左右にはみ出す場合の補正
     （--zenzaCommentPanelClampX）も同じ関数内で計算する。
     --zenzaCommentPanelFlipYだけを下の@propertyでtransition可能な型として
     登録し、このプロパティにだけtransitionを掛けることで、ドラッグ追従の
     translateX/Y（--zenzaSmallDragX/Y、他の小モード要素と同じく常に即時反映）は
     従来通り一切遅延させずに、上下反転の瞬間だけ「さっと動く」アニメーションに
     している（実機フィードバック: 「はみ出る場合の上部下部移動には
     アニメーションがあるといい」への対応）。
     幅は「動画の幅より狭ければ動画の幅に合わせて縮む」仕様のため、
     min()で.zenzaPlayerContainerの幅（100%）と既定幅を比較している
     （containing blockが.zenzaPlayerContainerになるため、リサイズにも
     追加のJSなしでCSSだけで追従する）。フォーカス時は通常幅まで広がる。
     画面端の余白は実機フィードバックにより16px→8pxへ変更した。 */
  @property --zenzaCommentPanelFlipY {
    syntax: '<length>';
    inherits: true;
    initial-value: 0px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer > .commentInputPanel {
    position: absolute;
    top: 100%;
    bottom: auto;
    left: 50%;
    margin-top: 8px;
    transform:
      translate(
        calc(-50% + var(--zenzaSmallDragX, 0px) + var(--zenzaCommentPanelClampX, 0px)),
        calc(var(--zenzaSmallDragY, 0px) + var(--zenzaCommentPanelFlipY, 0px))
      );
    transition: --zenzaCommentPanelFlipY 0.2s ease, width 0.2s ease;
    width: min(200px, 100%);
    max-width: calc(100vw - 16px);
  }
  .zenzaScreenMode_small .zenzaPlayerContainer > .commentInputPanel:focus-within {
    width: min(500px, calc(100vw - 16px));
  }
  /* 「小」モード限定：動画または入力欄にマウスが重なっている間・入力欄が
     フォーカス中は、既存の:focus-within用の「白背景・黒文字」の配色を
     動画ホバーだけでも先出しする（他の画面モードの見た目・既存の
     :hover/:focus-within挙動そのものは変更しない。D-2の全体デザイン変更を
     妨げないよう、変更はこの.zenzaScreenMode_small配下のみに閉じている）。 */
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .commentInputOuter {
    border: none;
    opacity: 1;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .commentInput {
    opacity: 0.9 !important;
    box-sizing: border-box;
    border: 1px solid #888;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 0 8px #fff;
    color: #000;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer:hover :where(.commandInput, .commentSubmit) {
    background: #fff;
    color: #000;
  }
  /* ドラッグの起点は動画本体全体。掴んでいる間だけカーソルをgrabbingにする。

     Task 039: 「カーソルが十字になるのが遅れる」という報告の原因は、
     別の場所にある次のルールだった。

       .is-mouseMoving .videoPlayer>* { cursor: auto; }

     実際にマウスの下にあるのは.videoPlayer自身ではなく、その子要素の
     .touchWrapper（動画全体を覆う透明なカバー）である。上のルールは
     その子要素に直接cursor:autoを指定するため、.videoPlayerから
     受け継ぐはずのcursor:moveを打ち消してしまう（直接指定は継承に必ず勝つ）。
     さらに.is-mouseMovingは「マウスを動かしている間」付き、動きが止まって
     から400ms後に外れる。つまり、
       マウスを動かしている間＝矢印、止めて400ms待つ＝やっと十字
     という挙動になっていた。これが「遅れて十字になる」の正体。
     小モードでは子要素まで含めてmoveを指定し、常に十字にする。 */
  .zenzaScreenMode_small .zenzaPlayerContainer .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer .videoPlayer>* {
    cursor: move;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeDragging .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeDragging .videoPlayer>* {
    cursor: grabbing;
  }
  /* 読み込み中はカーソルを砂時計に戻す（元のルールと同じ意図） */
  .zenzaScreenMode_small .zenzaPlayerContainer.is-loading .videoPlayer,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-loading .videoPlayer>* {
    cursor: wait;
  }

  /*
    画面モード「小」のサイズも、PiPのようにリサイズできるようにする（Task 032）。
    ドラッグの位置と同じ理由（.videoControlBarのposition: fixed）から、サイズを
    決める width/height は.zenzaPlayerContainer自体に適用して問題ない
    （width/height自体はtransformと違い、position: fixedな子孫のcontaining block
    には影響しないため）。--zenzaSmallWidth/--zenzaSmallHeightが未設定の間は
    既定サイズ（CONSTANT.SIDE_PLAYER_WIDTH/HEIGHT）のまま。
  */
  .zenzaScreenMode_small .zenzaPlayerContainer {
    width: var(--zenzaSmallWidth, ${CONSTANT.SIDE_PLAYER_WIDTH}px);
    height: var(--zenzaSmallHeight, ${CONSTANT.SIDE_PLAYER_HEIGHT}px);
  }
  /* Task 050 追加: 実機フィードバックで発見されたバグの修正。
     「小」モードでは.zenzaVideoPlayerDialog自体が
     top:0; left:0; right:100%; bottom:100%;（このファイル内、上の
     ".zenzaScreenMode_sideView .zenzaVideoPlayerDialog.is-open,
     .zenzaScreenMode_small .zenzaVideoPlayerDialog.is-open"参照）により
     幅0・高さ0に潰され、画面左上(0,0)を起点として配置される。ドラッグ・
     リサイズの位置調整は.zenzaPlayerContainer自身にではなくその子要素
     （.videoPlayer/.commentLayerFrame、および本ファイル内で同様に
     transformを合成している他の直接の子要素）にのみtransformとして
     適用しているため（Task 031: .zenzaPlayerContainer自体にtransformを
     掛けるとposition: fixedな.videoControlBar等のcontaining blockが
     ずれてしまうのを避けるため）、.zenzaPlayerContainer自身の実際の
     レイアウト上の位置は動かした後も画面左上(0,0)のまま変わらない
     （見た目上そこには何も描画されないが、要素自体は
     現在の幅・高さ分の透明な当たり判定を持ったまま残る）。
     このため、動画を画面左上以外へドラッグしても、ニコニコ動画側の
     ページ左上のサイドメニュー開閉ボタン等、(0,0)付近にある既存の
     ページUIがこの透明な当たり判定に覆われてクリックを奪われ、
     反応しなくなってしまっていた（実機フィードバックで発見）。
     .zenzaPlayerContainer自身はpointer-events: noneにして当たり判定を
     持たせず、実際に見えている（=transformで正しい位置に移動している）
     直接の子要素だけpointer-events: autoで復元する
     （Task 038の.menuItemContainerでの対処と同じ考え方）。
     .commentLayerFrame（コメント描画レイヤー）・.loadingMessageContainer
     （読み込み中の文字表示、常にクリック不要）は他の画面モード共通で元々
     pointer-events: noneのため、動画本体へのクリックを妨げないよう
     ここでは復元の対象から除外している。 */
  .zenzaScreenMode_small .zenzaPlayerContainer {
    pointer-events: none;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer > :not(.commentLayerFrame):not(.loadingMessageContainer) {
    pointer-events: auto;
  }
  .zenzaSmallModeResizeHandle,
  .zenzaSmallModeAspectLockButton,
  .zenzaSmallModeResetButton {
    display: none;
  }
  .zenzaScreenMode_small .zenzaSmallModeResizeHandle,
  .zenzaScreenMode_small .zenzaSmallModeAspectLockButton,
  .zenzaScreenMode_small .zenzaSmallModeResetButton {
    display: block;
    position: absolute;
    z-index: 20001;
    opacity: 0;
    /* Task 039: 表示・非表示のタイミングを、動画に元からあるホバーメニュー
       （.menuButton）と揃える。以前はこの3つだけが
       「:hoverのみ・0.15秒」で、ホバーメニュー側は
       「.is-mouseMoving（マウスが止まって400ms後に外れる）・0.4秒」だったため、
       同じ動画の上にあるボタンなのに現れる/消える時間がバラバラだった。 */
    transition: opacity 0.4s ease;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .zenzaSmallModeResizeHandle,
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .zenzaSmallModeAspectLockButton,
  .zenzaScreenMode_small .zenzaPlayerContainer:hover .zenzaSmallModeResetButton,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-mouseMoving .zenzaSmallModeResizeHandle,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-mouseMoving .zenzaSmallModeAspectLockButton,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-mouseMoving .zenzaSmallModeResetButton,
  .zenzaScreenMode_small .zenzaPlayerContainer.is-smallModeResizing .zenzaSmallModeResizeHandle {
    opacity: 1;
  }

  /*
    Task 039: 画面モード「小」でプレイヤーを小さくすると、右上のホバーメニュー
    （いいね・ツイート・マイリスト・とりあえずマイリスト・閉じる）が動画の
    左外側にはみ出して、宙に浮いたように表示される問題への対策。

    原因は、この5つのボタンが「幅240pxの箱（.menuItemContainer.rightTop）の
    左端から left: 0 / 40 / 80 / 120px」という**左基準**で並べられていること。
    箱は right: 0 で動画の右端に貼り付くので、動画の幅が240pxより狭いと
    箱の左側がそのまま動画の外へ出てしまい、左寄りのボタン（いいね・ツイート）
    から順に動画の外に飛び出す。さらに設定の「メニューの大きさ」
    （--zenza-ui-scale）を大きくしていると、右端を原点に拡大されるため
    はみ出しはもっと大きくなる。

    小モードでのみ、これらを**右基準**（閉じるボタンから左へ32pxずつ）に
    置き換え、箱の幅も動画の幅までに制限する。これで、動画の幅が
    ボタン5個分（160px × 拡大率）以上ある限り、必ず動画の中に収まる。
    拡大率が大きくて収まらない場合の縮小は、JS側で
    --zenzaSmallUiScale を設定して行う（_initializeSmallModeDrag参照）。
  */
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop {
    width: 100%;
    max-width: 240px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .toggleLikeButton {
    left: auto;
    right: 128px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .zenzaTweetButton {
    left: auto;
    right: 96px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .mylistButton.mylistAddMenu {
    left: auto;
    right: 64px;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .mylistButton.deflistAdd {
    left: auto;
    right: 32px;
  }
  /* 動画の幅に対してメニューが大きすぎる場合の自動縮小。
     --zenzaSmallUiScaleはJS側がサイズ変更のたびに更新する。 */
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer .scalingUI {
    transform: scale(calc(var(--zenza-ui-scale, 1) * var(--zenzaSmallUiScale, 1)));
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.rightTop .scalingUI {
    transform-origin: right top;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.leftBottom .scalingUI {
    transform-origin: left bottom;
  }
  /* コメント表示切り替え（💬）は bottom: 48px に置かれているが、この48pxは
     「動画の下端にコントロールバーがある」ことを前提にした余白。画面モード
     「小」ではコントロールバーは position: fixed で画面下端に出ており、
     プレイヤーの中には無い。そのため、小さくするほど💬だけが動画の
     真ん中あたりに浮いて、他の表示と重なって見えていた。
     小モードでは左下の角に寄せる。右下の3つ（リセット・ロック・つまみ、
     右端から62px）とは横方向に離れているため衝突しない。 */
  .zenzaScreenMode_small .zenzaPlayerContainer .menuItemContainer.leftBottom {
    left: 2px;
    bottom: 2px;
  }
  .zenzaScreenMode_small .zenzaSmallModeResizeHandle {
    right: 0;
    bottom: 0;
    width: 18px;
    height: 18px;
    cursor: nwse-resize;
    touch-action: none;
    background: linear-gradient(135deg,
      transparent 0 50%,
      rgba(255,255,255,0.8) 50% 60%,
      transparent 60% 70%,
      rgba(255,255,255,0.8) 70% 80%,
      transparent 80% 100%);
  }
  .zenzaSmallModeAspectLockButton,
  .zenzaSmallModeResetButton {
    border: 0;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 11px;
    line-height: 20px;
    width: 20px;
    height: 20px;
    padding: 0;
    text-align: center;
    cursor: pointer;
    border-radius: 3px;
  }
  /* Task 038: 3つのボタンを右下の1列に横並びで固定する。
     以前はリサイズつまみ（右下）・アスペクト比ロック（右下から22px上）・
     リセット（右上から44px下）と、縦方向にバラバラに配置していたため、
     プレイヤーを小さくすると、
       - ロックボタン（下から22〜42px）とリセットボタン（上から44〜64px）が
         高さ106px未満で重なる（最小の高さは90pxなので実際に重なっていた）
       - リセットボタンが、動画に元々ある右上のホバーメニュー
         （.menuItemContainer.rightTop、高さ40px）とも近接する
     という問題が起きていた。
     横並びなら、必要なのは右端から62pxの横幅と下端から20pxの高さだけになり、
     最小サイズ（160x90）でも、右上のホバーメニュー（高さ40px）とも
     左下のコメント表示切り替え（左端から120px・下から48px）とも重ならない。 */
  .zenzaScreenMode_small .zenzaSmallModeAspectLockButton {
    right: 20px;
    bottom: 0;
  }
  .zenzaScreenMode_small .zenzaSmallModeResetButton {
    right: 42px;
    bottom: 0;
  }

  .is-open .zenzaVideoPlayerDialog {
    contain: layout style size;
  }

  .zenzaVideoPlayerDialogInner {
    top: 0;
    left: 0;
    transform: none;
  }


  @media screen and (min-width: 1432px)
  {
    body.zenzaScreenMode_sideView {
      --sideView-left-margin: calc(100vw - 1024px);
    }
    body.zenzaScreenMode_sideView:not(.nofix) #siteHeader {
      width: calc(100vw - (100vw - 1024px));
    }
    .zenzaScreenMode_sideView .zenzaPlayerContainer {
      width: calc(100vw - 1024px);
      height: calc((100vw - 1024px) * 9 / 16);
    }
  }
`, {className: 'screenMode for-popup', disabled: true});

util.addStyle(`
body.zenzaScreenMode_sideView,
body.zenzaScreenMode_small {
  border-bottom: 40px solid;
  margin-top: 0;
}
`, {className: 'domain slack-com', disabled: true});

util.addStyle(`

  .zenzaScreenMode_normal .zenzaPlayerContainer .videoPlayer {
    left: 2.38%;
    width: 95.23%;
  }
  .zenzaScreenMode_big .zenzaPlayerContainer {
    width: ${CONSTANT.BIG_PLAYER_WIDTH}px;
    height: ${CONSTANT.BIG_PLAYER_HEIGHT}px;
  }


`, {className: 'screenMode for-dialog', disabled: true});

util.addStyle(`
  .zenzaScreenMode_3D,
  .zenzaScreenMode_normal,
  .zenzaScreenMode_big,
  .zenzaScreenMode_wide
  {
    overflow-x: hidden !important;
    overflow-y: hidden !important;
    overflow: hidden !important;
  }

  /*
    プレイヤーが動いてる間、裏の余計な物のマウスイベントを無効化
    多少軽量化が期待できる？
  */
  body.zenzaScreenMode_big >*:not(.zen-family) *,
  body.zenzaScreenMode_normal >*:not(.zen-family) *,
  body.zenzaScreenMode_wide >*:not(.zen-family) *,
  body.zenzaScreenMode_3D >*:not(.zen-family) * {
    pointer-events: none;
    user-select: none;
    animation-play-state: paused !important;
    contain: style layout paint;
  }

  body.zenzaScreenMode_big .ZenButton,
  body.zenzaScreenMode_normal .ZenButton,
  body.zenzaScreenMode_wide .ZenButton,
  body.zenzaScreenMode_3D  .ZenButton {
    display: none;
  }

  .ads, .banner, iframe[name^="ads"] {
    visibility: hidden !important;
    pointer-events: none;
  }

  .VideoThumbnailComment {
    display: none !important;
  }

  /* 大百科の奴 */
  #scrollUp {
    display: none !important;
  }

  .SeriesDetailContainer-backgroundInner {
    background-image: none !important;
    filter: none !important;
  }
  .Hidariue-image {
    visibility: hidden !important;
  }
`, {className: 'zenza-open', disabled: true});

NicoVideoPlayerDialogView.__css__ = `

  .zenzaVideoPlayerDialog {
    display: none;
    position: fixed;
    /*background: rgba(0, 0, 0, 0.8);*/
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: ${CONSTANT.BASE_Z_INDEX};
    font-size: 13px;
    text-align: left;
    box-sizing: border-box;
    contain: size style layout;
  }

  .zenzaVideoPlayerDialog::before {
    content: ' ';
    background: rgba(0, 0, 0, 0.8);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    will-change: transform;
  }

  .is-regularUser  .forPremium {
    display: none !important;
  }

  .zenzaVideoPlayerDialog * {
    box-sizing: border-box;
  }

  .zenzaVideoPlayerDialog.is-open {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .zenzaVideoPlayerDialog li {
    text-align: left;
  }

  .zenzaVideoPlayerDialogInner {
    background: #000;
    box-sizing: border-box;
    z-index: 1;
    box-shadow: 4px 4px 4px #000;
  }

  .zenzaPlayerContainer {
    position: relative;
    background: #000;
    width: 672px;
    height: 384px;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center center;
  }
  .zenzaPlayerContainer.is-loading {
    cursor: wait;
  }
  .zenzaPlayerContainer:not(.is-loading):not(.is-error) {
    background-image: none !important;
    background: none !important;
  }
  .zenzaPlayerContainer.is-loading .videoPlayer,
  .zenzaPlayerContainer.is-loading .commentLayerFrame,
  .zenzaPlayerContainer.is-error .videoPlayer,
  .zenzaPlayerContainer.is-error .commentLayerFrame {
    display: none;
  }

  .zenzaPlayerContainer .videoPlayer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    right: 0;
    bottom: 0;
    height: 100%;
    border: 0;
    z-index: 100;
    background: #000;
    will-change: transform, opacity;
    user-select: none;
  }

  .is-mouseMoving .videoPlayer>* {
    cursor: auto;
  }

  .is-loading .videoPlayer>* {
    cursor: wait;
  }

  .zenzaPlayerContainer .commentLayerFrame {
    position: absolute;
    border: 0;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    z-index: 101;
    pointer-events: none;
    cursor: none;
    user-select: none;
    opacity: var(--zenza-comment-layer-opacity);
  }

  .zenzaPlayerContainer.is-backComment .commentLayerFrame {
    position: fixed;
    top:  0;
    left: 0;
    width:  100vw;
    height: calc(100vh - 40px);
    right: auto;
    bottom: auto;
    z-index: 1;
  }

  .is-showComment.is-backComment .videoPlayer {
    opacity: 0.90;
  }

  .is-showComment.is-backComment .videoPlayer:hover {
    opacity: 1;
  }

  .loadingMessageContainer {
    display: none;
    pointer-events: none;
  }
  .zenzaPlayerContainer.is-loading .loadingMessageContainer {
    display: inline-block;
    position: absolute;
    z-index: 10000;
    right: 8px;
    bottom: 8px;
    font-size: 24px;
    color: var(--base-fore-color);
    text-shadow: 0 0 8px #003;
    font-family: serif;
    letter-spacing: 2px;
  }

  @keyframes spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(-1800deg); }
  }

  .zenzaPlayerContainer.is-loading .loadingMessageContainer::before,
  .zenzaPlayerContainer.is-loading .loadingMessageContainer::after {
    display: inline-block;
    text-align: center;
    content: '${'\\00272A'}';
    font-size: 18px;
    line-height: 24px;
    animation-name: spin;
    animation-iteration-count: infinite;
    animation-duration: 5s;
    animation-timing-function: linear;
  }
  .zenzaPlayerContainer.is-loading .loadingMessageContainer::after {
    animation-direction: reverse;
  }

  /*
    Task 049（追記）: 読み込み中の見た目の主体は、実はこのテキスト
    （"動画読込中"）ではなく、.zenzaPlayerContainer自身が持つ黒背景／
    サムネイル画像（_setThumbnail()がJSで.zenzaPlayerContainerに
    直接background-imageを設定している）だった。このテキストにだけ
    ドラッグのtransformを追加しても、背景の黒い箱自体は
    .zenzaPlayerContainer自身の位置（＝ドラッグしても動かない静的な位置）に
    残ったままになり、「小」モードで動画を移動してから新しい動画を開くと、
    大きな黒い箱だけが元の位置に出続けてしまう（ユーザー提供のスクリーン
    ショットで確認）。

    .zenzaPlayerContainer自体には他の子要素（videoControlBar等、
    position: fixedな子孫を持つ）の都合上transformを掛けられないため
    （Task 031参照）、「小」モードでは読み込み中に限り、背景の役目を
    .zenzaPlayerContainer自身から.loadingMessageContainer（transform対象に
    含めた要素）へ肩代わりさせる。.loadingMessageContainerをコンテナ全面に
    広げ、同じ背景スタイルを持たせた上で、.zenzaPlayerContainer自身の背景は
    非表示にする（JSが設定するインラインstyleより優先させるため!important）。
    背景画像そのもの（サムネイルURL）は_setThumbnail()側で
    .loadingMessageContainerにも同じ値を設定するよう対応済み。
  */
  .zenzaScreenMode_small .zenzaPlayerContainer.is-loading {
    background: none !important;
  }
  .zenzaScreenMode_small .zenzaPlayerContainer.is-loading .loadingMessageContainer {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 8px;
    background: #000;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center center;
  }

  .errorMessageContainer {
    display: none;
    pointer-events: none;
    user-select: none;
  }

  .zenzaPlayerContainer.is-error .errorMessageContainer {
    display: inline-block;
    position: absolute;
    z-index: 10000;
    top: 50%;
    left: 50%;
    padding: 8px 16px;
    transform: translate(-50%, -50%);
    background: rgba(255, 0, 0, 0.9);
    font-size: 24px;
    box-shadow: 8px 8px 4px rgba(128, 0, 0, 0.8);
    white-space: nowrap;
  }
  .errorMessageContainer:empty {
    display: none !important;
  }

  .popupMessageContainer {
    top: 50px;
    left: 50px;
    z-index: 25000;
    position: absolute;
    pointer-events: none;
    transform: translateZ(0);
    user-select: none;
  }

  /*
    Task 049: 画面モード「小」専用のリサイズつまみ・アスペクト比ロック・
    リセットボタン（.zenzaSmallModeResizeHandle/.zenzaSmallModeAspectLockButton/
    .zenzaSmallModeResetButton）を、既定で非表示にしておく。

    これらを「小」モードでだけ表示する制御自体は、下の"screenMode for-popup"の
    <style>ブロック（画面モードが small/sideView の時だけ有効化される）の中に
    「display: none」→「.zenzaScreenMode_small の中でだけ display: block」という
    形で入っている。しかしそのブロックは、他の画面モード（通常・大・ワイド・3D）
    の時は _updateScreenModeStyle() によって<style>要素ごとdisabledにされる。
    ブロックごと無効化されると、"display: none"という既定の非表示ルールまで
    一緒に失われてしまうため、他の画面モードではこの3つの要素を隠すCSSが
    一切存在しない状態になり、ブラウザの既定表示（<button>は枠付きで見える、
    位置はcontainer内の通常のフロー＝左上寄り）で見えてしまっていた
    （「アスペクト比ロックボタンが他の画面サイズでも左上に表示される」不具合）。

    このブロック（__css__）は画面モードに関わらず常に有効なので、ここに同じ
    既定の非表示ルールを重ねておけば、"screenMode for-popup"ブロックが
    無効化された状態でも常に非表示になる。"small"モードでは、"screenMode
    for-popup"ブロック側の.zenzaScreenMode_small配下の上書き
    （display: block）がクラス数の多さでこちらに優先するため、従来通り表示される。
  */
  .zenzaSmallModeResizeHandle,
  .zenzaSmallModeAspectLockButton,
  .zenzaSmallModeResetButton {
    display: none;
  }


  @media screen {
    /* 右パネル分の幅がある時は右パネルを出す */
    @media (min-width: 992px) {
      .zenzaScreenMode_normal .zenzaVideoPlayerDialogInner {
        padding-right: ${CONSTANT.RIGHT_PANEL_WIDTH}px;
        background: none;
      }
    }

    @media (min-width: 1216px) {
      .zenzaScreenMode_big .zenzaVideoPlayerDialogInner {
        padding-right: ${CONSTANT.RIGHT_PANEL_WIDTH}px;
        background: none;
      }
    }

    /* 縦長モニター */
    @media
      (max-width: 991px) and (min-height: 700px)
    {
      .zenzaScreenMode_normal .zenzaVideoPlayerDialogInner {
        padding-bottom: 240px;
        background: none;
      }
    }

    @media
      (max-width: 1215px) and (min-height: 700px)
    {
      .zenzaScreenMode_big .zenzaVideoPlayerDialogInner {
        padding-bottom: 240px;
        background: none;
      }
    }

    /* 960x540 */
    @media
      (min-width: 1328px) and (min-height: 700px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: calc(960px * 1.05);
        height: 540px;
      }
    }

    /* 1152x648 */
    @media
      (min-width: 1530px) and (min-height: 900px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: calc(1152px * 1.05);
        height: 648px;
      }
    }

    /* 1280x720 */
    @media
      (min-width: 1664px) and (min-height: 900px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: calc(1280px * 1.05);
        height: 720px;
      }
    }

    /* 1920x1080 */
    @media
      (min-width: 2336px) and (min-height: 1200px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: calc(1920px * 1.05);
        height: 1080px;
      }
    }

    /* 2560x1440 */
    @media
      (min-width: 2976px) and (min-height: 1660px)
    {
      .zenzaScreenMode_big .zenzaPlayerContainer {
        width: calc(2560px * 1.05);
        height: 1440px;
      }
    }
  }

  `.trim();

NicoVideoPlayerDialogView.__tpl__ = (`
    <div id="zenzaVideoPlayerDialog" class="zenzaVideoPlayerDialog zen-family zen-root">
      <div class="zenzaVideoPlayerDialogInner">
        <div class="menuContainer"></div>
        <div class="zenzaPlayerContainer">

          <div class="popupMessageContainer"></div>
          <div class="errorMessageContainer"></div>
          <div class="loadingMessageContainer">動画読込中</div>
        </div>
      </div>
    </div>
  `).trim();
/**
 * TODO: 分割 まにあわなくなっても知らんぞー
 */
class NicoVideoPlayerDialog extends Emitter {
  constructor(params) {
    super();
    this.initialize(params);
  }
  initialize(params) {
    // this._offScreenLayer = params.offScreenLayer;
    this._playerConfig = params.config;
    this._state = params.state;

    this._keyEmitter = params.keyHandler || ShortcutKeyEmitter.create(
      params.config,
      document.body,
      global.emitter
    );

    this._initializeDom();

    this._keyEmitter.on('keyDown', this._onKeyDown.bind(this));
    this._keyEmitter.on('keyUp', this._onKeyUp.bind(this));

    this._id = 'ZenzaWatchDialog_' + Date.now() + '_' + Math.random();
    this._playerConfig.on('update', this._onPlayerConfigUpdate.bind(this));

    this._escBlockExpiredAt = -1;

    this._videoFilter = new VideoFilter(
      this._playerConfig.props.videoOwnerFilter,
      this._playerConfig.props.videoTagFilter
    );

    this._savePlaybackPosition =
      _.throttle(this._savePlaybackPosition.bind(this), 1000, {trailing: false});

    this._onToggleLike = _.debounce(this._onToggleLike.bind(this), 1000);

    this.promise('firstVideoInitialized').then(() => console.log('firstVideoInitialized'));
  }
  async _initializeDom() {
    this._view = new NicoVideoPlayerDialogView({
      dialog: this,
      playerConfig: this._playerConfig,
      nicoVideoPlayer: this._nicoVideoPlayer,
      playerState: this._state,
      currentTimeGetter: () => this.currentTime
    });
    await this._view.promise('dom-ready');

    this._initializeCommentPanel();

    this._$playerContainer = this._view.get$Container();
    this._view.on('command', this._onCommand.bind(this));
    this._view.on('postChat', (e, chat, cmd) => {
      this.addChat(chat, cmd)
        .then(() => e.resolve())
        .catch(() => e.reject());
    });
    MediaSessionApi.onCommand(this._onCommand.bind(this));
  }
  async _initializeNicoVideoPlayer() {
    if (this._nicoVideoPlayer) {
      return this._nicoVideoPlayer;
    }
    await this._view.promise('dom-ready');
    const config = this._playerConfig;
    const nicoVideoPlayer = this._nicoVideoPlayer = new NicoVideoPlayer({
      node: this._$playerContainer,
      playerConfig: config,
      playerState: this._state,
      volume: Math.max(config.props.volume, 0),
      loop: config.props.loop,
    });

    // Task 074: 音声の自動調整（倍率が変わるたびにプレイヤーへ反映する）
    AudioAdjuster.initialize(config);
    nicoVideoPlayer.audioGain = AudioAdjuster.gain;
    AudioAdjuster.onChange(gain => { nicoVideoPlayer.audioGain = gain; });

    this.threadLoader = ThreadLoader;

    nicoVideoPlayer.on('loadedMetaData', this._onLoadedMetaData.bind(this));
    nicoVideoPlayer.on('ended', this._onVideoEnded.bind(this));
    nicoVideoPlayer.on('canPlay', this._onVideoCanPlay.bind(this));
    nicoVideoPlayer.on('play', this._onVideoPlay.bind(this));
    nicoVideoPlayer.on('pause', this._onVideoPause.bind(this));
    nicoVideoPlayer.on('playing', this._onVideoPlaying.bind(this));
    nicoVideoPlayer.on('seeking', this._onVideoSeeking.bind(this));
    nicoVideoPlayer.on('seeked', this._onVideoSeeked.bind(this));
    nicoVideoPlayer.on('stalled', this._onVideoStalled.bind(this));
    nicoVideoPlayer.on('waiting', this._onVideoStalled.bind(this));
    nicoVideoPlayer.on('timeupdate', this._onVideoTimeUpdate.bind(this));
    nicoVideoPlayer.on('progress', this._onVideoProgress.bind(this));
    nicoVideoPlayer.on('aspectRatioFix', this._onVideoAspectRatioFix.bind(this));
    nicoVideoPlayer.on('commentParsed', this._onCommentParsed.bind(this));
    nicoVideoPlayer.on('commentChange', this._onCommentChange.bind(this));
    nicoVideoPlayer.on('commentFilterChange', this._onCommentFilterChange.bind(this));
    nicoVideoPlayer.on('videoPlayerTypeChange', this._onVideoPlayerTypeChange.bind(this));

    nicoVideoPlayer.on('error', this._onVideoError.bind(this));
    nicoVideoPlayer.on('abort', this._onVideoAbort.bind(this));

    nicoVideoPlayer.on('volumeChange', this._onVolumeChange.bind(this));
    nicoVideoPlayer.on('volumeChange', _.debounce(this._onVolumeChangeEnd.bind(this), 1500));
    nicoVideoPlayer.on('command', this._onCommand.bind(this));

    this.emitResolve('nicovideo-player-ready');
    return nicoVideoPlayer;
  }
  execCommand(command, param) {
    return this._onCommand(command, param);
  }
  _onCommand(command, param) {
    let v;
    switch (command) {
      case 'volume':
        this.volume = param;
        break;
      case 'volumeBy':
        this.volume = this._nicoVideoPlayer.volume * param;
        break;
      case 'volumeUp':
        this._nicoVideoPlayer.volumeUp();
        break;
      case 'volumeDown':
        this._nicoVideoPlayer.volumeDown();
        break;
      case 'togglePlay':
        this.togglePlay();
        break;
      case 'pause':
        this.pause();
        break;
      case 'play':
        this.play();
        break;
      case 'fullscreen':
      case 'toggle-fullscreen':
        this._nicoVideoPlayer.toggleFullScreen();
        break;
      case 'deflistAdd':
        return this._onDeflistAdd(param);
      case 'deflistRemove':
        return this._onDeflistRemove(param);
      case 'playlistAdd':
      case 'playlistAppend':
        this._onPlaylistAppend(param);
        break;
      case 'playlistInsert':
        this._onPlaylistInsert(param);
        break;
      case 'playlistSetMylist':
        this._onPlaylistSetMylist(param);
        break;
      case 'playlistSetUploadedVideo':
        this._onPlaylistSetUploadedVideo(param);
        break;
      case 'playlistSetSearchVideo':
        this._onPlaylistSetSearchVideo(param);
        break;
      case 'playlistSetSeries':
        this._onPlaylistSetSeriesVideo(param);
      break;
      case 'playlistSetCommonsTree':
        this._onPlaylistSetCommonsTree();
        break;
      case 'playNextVideo':
        this.playNextVideo();
        break;
      case 'playPreviousVideo':
        this.playPreviousVideo();
        break;
      case 'shufflePlaylist':
          this._playlist.shuffle();
        break;
      case 'togglePlaylist':
          this._playlist.toggleEnable();
        break;
      case 'toggle-like':
        return this._onToggleLike();
      case 'mylistAdd':
        return this._onMylistAdd(param.mylistId, param.mylistName);
      case 'mylistRemove':
        return this._onMylistRemove(param.mylistId, param.mylistName);
      case 'mylistWindow':
        util.openMylistWindow(this._videoInfo.watchId);
        break;
      case 'seek':
      case 'seekTo':
        this.currentTime = param * 1;
        break;
      case 'seekBy':
        this.currentTime = this.currentTime + param * 1;
        break;
      case 'seekPrevFrame':
      case 'seekNextFrame':
        this.execCommand('pause');
        this.execCommand('seekBy', command === 'seekNextFrame' ? 1/60 : -1/60);
        break;
      case 'seekRelativePercent': {
        const dur = this._videoInfo.duration;
        const mv = Math.abs(param.movePerX) > 10 ?
          (param.movePerX / 2) : (param.movePerX / 8);
        const pos = this.currentTime + (mv * dur / 100);
        this.currentTime=Math.min(Math.max(0, pos), dur);
        break;
      }
      case 'seekToResumePoint':
        this.currentTime=this._videoInfo.initialPlaybackTime;
        break;
      case 'addWordFilter':
        this._nicoVideoPlayer.filter.addWordFilter(param);
        break;
      case 'setWordRegFilter':
      case 'setWordRegFilterFlags':
        this._nicoVideoPlayer.filter.setWordRegFilter(param);
        break;
      case 'addUserIdFilter':
        this._nicoVideoPlayer.filter.addUserIdFilter(param);
        break;
      case 'addCommandFilter':
        this._nicoVideoPlayer.filter.addCommandFilter(param);
        break;
      case 'setWordFilterList':
        this._nicoVideoPlayer.filter.wordFilterList = param;
        break;
      case 'setUserIdFilterList':
        this._nicoVideoPlayer.filter.userIdFilterList = param;
        break;
      case 'setCommandFilterList':
        this._nicoVideoPlayer.filter.commandFilterList = param;
        break;
      case 'openNow':
        this.open(param, {openNow: true});
        break;
      case 'open':
        this.open(param);
        break;
      case 'close':
        this.close(param);
        break;
      case 'reload':
        this.reload({currentTime: this.currentTime});
        break;
      case 'openGinza':
        window.open('//www.nicovideo.jp/watch/' + this._watchId, 'watchGinza');
        break;
      case 'reloadComment':
        this.reloadComment(param);
        break;
      case 'playbackRate':
        this._playerConfig.setValue(command, param);
        MediaSessionApi.updatePositionStateByMedia(this);
        break;
      case 'shiftUp': {
        v = parseFloat(this._playerConfig.getValue('playbackRate'), 10);
        if (v < 2) {
          v += 0.25;
        } else {
          v = Math.min(10, v + 0.5);
        }
        this._playerConfig.setValue('playbackRate', v);
      }
        break;
      case 'shiftDown': {
        v = parseFloat(this._playerConfig.getValue('playbackRate'), 10);
        if (v > 2) {
          v -= 0.5;
        } else {
          v = Math.max(0.1, v - 0.25);
        }
        this._playerConfig.setValue('playbackRate', v);
      }
        break;
      case 'screenShot':
        if (this._state.isYouTube) {
          util.capTube({
            title: this._videoInfo.title,
            videoId: this._videoInfo.videoId,
            author: this._videoInfo.owner.name
          });
          return;
        }
        this._nicoVideoPlayer.getScreenShot();
        break;
      case 'screenShotWithComment':
        if (this._state.isYouTube) {
          return;
        }
        this._nicoVideoPlayer.getScreenShotWithComment();
        break;
      // Task 077: 画面フィルター。反転は画面フィルターの設定に統合した
      // （右クリックメニュー・ショートカットのどちらから来ても同じ処理になる）。
      case 'toggle-flipH':
        this.execCommand('toggle-screenFilter.flipH');
        break;
      case 'toggle-flipV':
        this.execCommand('toggle-screenFilter.flipV');
        break;
      case 'toggle-screenFilterPanel':
        this._view && this._view.toggleScreenFilterPanel();
        break;
      case 'nextVideo':
        this._nextVideo = param;
        break;
      case 'nicosSeek':
        this._onNicosSeek(param);
        break;
      case 'fastSeek':
        this._nicoVideoPlayer.fastSeek(param);
        break;
      case 'setVideo':
        this.setVideo(param);
        break;
      case 'selectTab':
        this._state.currentTab = param;
        break;
      case 'nicoru':
        this.threadLoader.nicoru(this._videoInfo.msgInfo, param).catch(e => {
          this.execCommand('alert', e.message || 'ニコれなかった＞＜');
        });
        break;
      case 'update-smileVideoQuality':
        this._playerConfig.props.videoServerType = 'smile';
        this._playerConfig.props.smileVideoQuality = param;
        this.reload({videoServerType: 'smile', economy: param === 'eco'});
        break;
      case 'update-dmcVideoQuality':
        this._playerConfig.props.videoServerType = 'dmc';
        this._playerConfig.props.dmcVideoQuality = param;
        this.reload({videoServerType: 'dmc'});
        break;
      case 'update-domandVideoQuality':
        this._playerConfig.props.videoServerType = 'domand';
        this._playerConfig.props.domandVideoQuality = param;
        this.reload({videoServerType: 'domand'});
        break;
      case 'update-videoServerType':
        this._playerConfig.props.videoServerType = param;
        this.reload({videoServerType: param === 'domand' ? 'domand' : 'dmc'});
        break;
      case 'update-commentLanguage':
        if (this._playerConfig.props.commentLanguage === param) {
          break;
        }
        this._playerConfig.props.commentLanguage = param;
        this.reloadComment();
        break;
      case 'saveMymemory':
        util.saveMymemory(this, this._state.videoInfo);
        break;
      default:
        this.emit('command', command, param);
    }
  }
  _onKeyDown(name, e, param) {
    this._onKeyEvent(name, e, param);
  }
  _onKeyUp(name, e, param) {
    this._onKeyEvent(name, e, param);
  }
  _onKeyEvent(name, e, param) {
    if (!this._state.isOpen) {
      const lastWatchId = this._playerConfig.props.lastWatchId;
      if (name === 'RE_OPEN' && lastWatchId) {
        this.open(lastWatchId);
        e.preventDefault();
      }
      return;
    }
    const TABLE = {
      'RE_OPEN': 'reload',
      'PAUSE': 'pause',
      'TOGGLE_PLAY': 'togglePlay',
      'SPACE': 'togglePlay',
      'FULL': 'toggle-fullscreen',
      'TOGGLE_PLAYLIST': 'togglePlaylist',
      'DEFLIST': 'deflistAdd',
      'DEFLIST_REMOVE': 'deflistRemove',
      'VIEW_COMMENT': 'toggle-showComment',
      'TOGGLE_LOOP': 'toggle-loop',
      'MUTE': 'toggle-mute',
      'VOL_UP': 'volumeUp',
      'VOL_DOWN': 'volumeDown',
      'SEEK_TO': 'seekTo',
      'SEEK_BY': 'seekBy',
      'SEEK_PREV_FRAME': 'seekPrevFrame',
      'SEEK_NEXT_FRAME': 'seekNextFrame',
      'NEXT_VIDEO': 'playNextVideo',
      'PREV_VIDEO': 'playPreviousVideo',
      'PLAYBACK_RATE': 'playbackRate',
      'SHIFT_UP': 'shiftUp',
      'SHIFT_DOWN': 'shiftDown',
      'SCREEN_MODE': 'screenMode',
      'SCREEN_SHOT': 'screenShot',
      'SCREEN_SHOT_WITH_COMMENT': 'screenShotWithComment'
    };
    switch (name) {
      case 'ESC':
        // ESCキーは連打にならないようブロック期間を設ける
        if (Date.now() < this._escBlockExpiredAt) {
          window.console.log('block ESC');
          break;
        }
        this._escBlockExpiredAt = Date.now() + 1000 * 2;
        if (!Fullscreen.now()) {
          this.close();
        }
        break;
      case 'INPUT_COMMENT':
        this._view.focusToCommentInput();
        break;
      default:
        if (TABLE[name]) {
          this.execCommand(TABLE[name], param);
          break;
        }
        // Task 059: ShortcutActions.js に登録された「新規」ショートカット
        // (legacyでないもの)の汎用ディスパッチ。新しいショートカットを
        // 追加する時は、ShortcutActions.js にエントリを1つ足すだけでよく、
        // このTABLEやswitch文自体を変更する必要はない。
        {
          const action = SHORTCUT_ACTIONS.find(a => a.id === name && !a.legacy && a.command);
          if (!action) { return; }
          this.execCommand(action.command, param);
        }
    }
    const screenMode = this._playerConfig.props.screenMode;
    if (['small', 'sideView'].includes(screenMode) && ['TOGGLE_PLAY'].includes(name)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  }
  _onPlayerConfigUpdate(key, value) {
    // Task 063: enableCommentPanel(コメントパネル表示ON/OFF)は動画プレイヤー
    // (_nicoVideoPlayer)の有無に関係なく効かせたいタブ表示の切り替えなので、
    // 下の「動画プレイヤーが無ければ何もしない」ガードより前で個別に処理する。
    // 以前はこのイベント自体は受け取っていたが、値を読んで実際に表示/非表示へ
    // 反映する処理が無く、ショートカットで切り替えても見た目が変わらなかった
    // （上級設定監査で発見したバグ）。
    if (key === 'enableCommentPanel') {
      this._applyCommentPanelVisibility(value);
      return;
    }
    if (!this._nicoVideoPlayer) { return; }
    const np = this._nicoVideoPlayer, filter = np.filter;
    switch (key) {
      case 'enableFilter':
        filter.isEnable = value;
        break;
      case 'wordFilter':
        filter.wordFilterList = value;
        break;
      case 'userIdFilter':
        filter.userIdFilterList = value;
        break;
      case 'commandFilter':
        filter.commandFilterList = value;
        break;
      case 'filter.fork0':
      case 'filter.fork1':
      case 'filter.fork2':
      case 'filter.fork3':
      case 'filter.defaultThread':
      case 'filter.ownerThread':
      case 'filter.communityThread':
      case 'filter.nicosThread':
      case 'filter.easyThread':
      case 'filter.aiThread':
      case 'filter.extraDefaultThread':
      case 'filter.extraOwnerThread':
      case 'filter.extraCommunityThread':
      case 'filter.extraNicosThread':
      case 'filter.extraEasyThread':
      case 'removeNgMatchedUser':
        filter[key.replace(/^.*\./, '')] = value;
        break;
    }
  }
  // Task 063: enableCommentPanelの実体。falseの時は「コメント」タブ自体を
  // (タブボタンごと)隠す。現在アクティブなタブがまさに「コメント」だった
  // 場合は、非表示のタブが選択されたままになって何も見えなくならないよう
  // 動画情報タブへ切り替える。CSS側は下のスタイル定義
  // (.hideCommentPanelTab)を参照。
  //
  // Task 064: toggleClass()・selectTab()はどちらもNicoVideoPlayerDialogView
  // 側にのみ定義されたメソッド（このクラスNicoVideoPlayerDialog自身には無い）
  // で、実際のDOM操作はthis._view（NicoVideoPlayerDialogViewのインスタンス）
  // へ委譲する設計になっている。Task 063では誤ってthis.toggleClass()/
  // this.selectTab()のように自分自身のメソッドとして呼び出しており、
  // 「this.toggleClass is not a function」で例外が発生し、ZenzaWatch自体が
  // 起動できなくなる重大な不具合になっていた（ユーザー実機で発覚）。
  // this._view経由の呼び出しに修正。
  _applyCommentPanelVisibility(enable) {
    this._view.toggleClass('hideCommentPanelTab', !enable);
    if (!enable && this._state.currentTab === 'comment') {
      this._view.selectTab('videoInfoTab');
    }
  }
  _updateScreenMode(mode) {
    this.emit('screenModeChange', mode);
  }
  _onPlaylistAppend(watchId) {
    this._playlist.append(watchId);
  }
  _onPlaylistInsert(watchId) {
    this._playlist.insert(watchId);
  }
  _onPlaylistSetMylist(id) {

    let option = {watchId: this._watchId};
    // 通常時はプレイリストの置き換え、
    // 連続再生中はプレイリストに追加で読み込む
    option.insert = this._playlist.isEnable;

    this._playlist.load({ type: 'mylist', id }, option, this._videoInfo.msgInfo).then(result => {
        this.execCommand('notify', result.message);
        this._state.currentTab = 'playlist';
        this._playlist.insertCurrentVideo(this._videoInfo);
      },
      () => this.execCommand('alert', 'マイリストのロード失敗'));
  }
  _onPlaylistSetUploadedVideo(id) {
    let option = {watchId: this._watchId};
    // 通常時はプレイリストの置き換え、
    // 連続再生中はプレイリストに追加で読み込む
    option.insert = this._playlist.isEnable;

    this._playlist.load({ type: 'user-uploaded', id }, option, this._videoInfo.msgInfo).then(result => {
        this.execCommand('notify', result.message);
        this._state.currentTab = 'playlist';
        this._playlist.insertCurrentVideo(this._videoInfo);
      },
      err => this.execCommand('alert', err.message || '投稿動画一覧のロード失敗'));
  }
  _onPlaylistSetSearchVideo(params) {

    let option = Object.assign({watchId: this._watchId}, params.option || {});
    let word = params.word;
    // 通常時はプレイリストの置き換え、
    // 連続再生中はプレイリストに追加で読み込む
    option.insert = this._playlist.isEnable;

    if (option.owner) {
      const owner = this._videoInfo && this._videoInfo.owner;
      let ownerId = parseInt(owner && owner.id, 10);
      // Task 066: 投稿者IDが取れていない動画（投稿者欄が空の動画で、補完にも
      // 失敗した場合）では NaN のまま検索条件に入り、検索が壊れていた。
      if (isNaN(ownerId)) {
        window.console.warn('投稿者IDが不明のため、投稿者で絞り込まずに検索します', this._videoInfo && this._videoInfo.watchId);
        this.execCommand('notify', '投稿者IDが不明のため、投稿者で絞り込まずに検索します');
        ownerId = null;
      }
      if (ownerId === null) {
        // 絞り込みなし
      } else if (this._videoInfo.isChannel) {
        option.channelId = ownerId;
      } else {
        option.userId = ownerId;
      }
    }
    delete option.owner;

    let query = this._videoWatchOptions.query;
    option = Object.assign(option, query);

    this._state.currentTab = 'playlist';
    // Task 073: 以前は件数を渡しておらず、常に既定の300件だった。
    // 設定（search.limit、上級者向け設定で変更可）の件数を渡す。範囲外の値はPlayList側で丸める。
    const searchLimit = this._playerConfig.props['search.limit'];
    this._playlist.loadSearchVideo(word, option, searchLimit).then(result => {
        this.execCommand('notify', result.message);
        this._playlist.insertCurrentVideo(this._videoInfo);
        global.emitter.emitAsync('searchVideo', {word, option});
        window.setTimeout(() => this._playlist.scrollToActiveItem(), 1000);
      },
      err => {
        this.execCommand('alert', err.message || '検索失敗または該当無し: 「' + word + '」');
      });
  }
  _onPlaylistSetSeriesVideo(id) {

    let option = {watchId: this._watchId};
    option.insert = this._playlist.isEnable;
    this._state.currentTab = 'playlist';
    this._playlist.load({ type: 'series', id }, option, this._videoInfo.msgInfo).then(result => {
      this.execCommand('notify', result.message);
      this._playlist.insertCurrentVideo(this._videoInfo);
      window.setTimeout(() => this._playlist.scrollToActiveItem(), 1000);
    },
    err => this.execCommand('alert', err.message || `シリーズリストの取得に失敗: series/${id}`));
  }
  /**
   * ニコニ・コモンズのコンテンツツリー（親作品・子作品）のうち、
   * 動画であるものをプレイリストに読み込む（Task 043）。
   *
   * 並び順は「親作品 → 子作品」。ユーザーとの相談の結果、今回は
   * 順番で分かるようにするだけとし、行の色分けや区切り線は将来の課題とした。
   * 辿るのは直接の親子のみ（孫以降は辿らない）。
   */
  async _onPlaylistSetCommonsTree() {
    const videoId = this._videoInfo ? this._videoInfo.videoId : null;
    if (!videoId) {
      return this.execCommand('alert', '動画の情報がまだ読み込めていません');
    }
    this.execCommand('notify', 'コンテンツツリーを取得中...');
    let tree;
    try {
      tree = await CommonsTreeLoader.load(videoId);
    } catch (e) {
      window.console.error('コンテンツツリーの取得に失敗', e);
      return this.execCommand('alert',
        (e && e.message) || 'コンテンツツリーの取得に失敗しました');
    }

    // 再生できるのは公開中の動画だけ。コモンズ素材や非公開・削除済みは除外する。
    const parents = tree.parents.works.filter(w => w.isVideo);
    const children = tree.children.works.filter(w => w.isVideo);
    const skipped =
      (tree.parents.works.length - parents.length) +
      (tree.children.works.length - children.length);

    if (!parents.length && !children.length) {
      // Task 074: コンテンツツリー自体が無い動画（APIが404）も「0件」として普通に伝える
      const notRegistered = tree.parents.notFound && tree.children.notFound;
      return this.execCommand('notify',
        skipped > 0 ?
          `親作品・子作品は0件でした（動画以外・非公開の作品${skipped}件は追加できません）` :
          (notRegistered ?
            'この動画はコンテンツツリーに登録されていません（親作品・子作品0件）' :
            '親作品・子作品は0件でした'));
    }

    // 親 → 子 の順に並べる
    const watchIds = parents.concat(children).map(w => w.contentId);
    const option = {watchId: this._watchId};
    option.insert = this._playlist.isEnable;
    this._state.currentTab = 'playlist';

    const added = await this._playlist.appendWatchIds(watchIds, option);

    const detail = `親作品${parents.length}件・子作品${children.length}件`;
    // APIが総数を返すので、取得できた件数が総数に満たない場合は伝える
    const total = tree.parents.total + tree.children.total;
    const fetched = tree.parents.works.length + tree.children.works.length;
    const truncated = total > fetched ? `／全${total}件中${fetched}件を取得` : '';
    if (added === 0) {
      this.execCommand('notify',
        `追加できる動画がありませんでした（${detail}はすべて既にプレイリストにあります）`);
    } else {
      this.execCommand('notify',
        `プレイリストに${added}件追加しました（${detail}${skipped > 0 ? `／動画以外${skipped}件は除外` : ''}${truncated}）`);
    }
    this._playlist.insertCurrentVideo(this._videoInfo);
    window.setTimeout(() => this._playlist.scrollToActiveItem(), 1000);
  }
  _onPlaylistStatusUpdate() {
    let playlist = this._playlist;
    this._playerConfig.setValue('playlistLoop', playlist.isLoop);
    this._state.isPlaylistEnable = playlist.isEnable;
    if (playlist.isEnable) {
      this._playerConfig.setValue('loop', false);
    }
    this._view.blinkTab('playlist');
  }
  _onCommentPanelStatusUpdate() {
    let commentPanel = this._commentPanel;
    this._playerConfig.setValue(
      'enableCommentPanelAutoScroll', commentPanel.isAutoScroll);
  }
  _onDeflistAdd(watchId) {
    if (this._state.isUpdatingDeflist || !util.isLogin()) {
      return;
    }
    const unlock = () => this._state.isUpdatingDeflist = false;
    this._state.isUpdatingDeflist = true;
    let timer = window.setTimeout(unlock, 10000);

    watchId = watchId || this._videoInfo.watchId;
    let description;
    if (!this._mylistApiLoader) {
      this._mylistApiLoader = MylistApiLoader;
    }
    const {enableAutoMylistComment} = this._playerConfig.props;
    (() => {
      if (watchId === this._watchId || !enableAutoMylistComment) {
        return Promise.resolve(this._videoInfo);
      }
      return ThumbInfoLoader.load(watchId);
    })().then(info => {
      const originalVideoId = info.originalVideoId ?
        `元動画: ${info.originalVideoId}` : '';
      description = enableAutoMylistComment ?
          `投稿者: ${info.owner.name} ${info.owner.linkId} ${originalVideoId}` : '';
    }).then(() => this._mylistApiLoader.addDeflistItem(watchId, description))
      .then(result => this.execCommand('notify', result.message))
      .catch(err => this.execCommand('alert', err.message ? err.message : 'とりあえずマイリストに登録失敗'))
      .then(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(unlock, 2000);
    });
  }
  _onDeflistRemove(watchId) {
    if (this._state.isUpdatingDeflist || !util.isLogin()) {
      return;
    }
    const unlock = () => this._state.isUpdatingDeflist = false;
    this._state.isUpdatingDeflist = true;
    let timer = window.setTimeout(unlock, 10000);

    watchId = watchId || this._videoInfo.watchId;
    if (!this._mylistApiLoader) {
      this._mylistApiLoader = MylistApiLoader;
    }

    this._mylistApiLoader.removeDeflistItem(watchId)
      .then(result => this.execCommand('notify', result.message))
      .catch(err => this.execCommand('alert', err.message))
      .then(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(unlock, 2000);
      });
  }
  _onToggleLike() {
    if (!util.isLogin()) { return; }
    const videoId = this._videoInfo.videoId;
    const isLiked = this._videoInfo.isLiked;
    (isLiked ? LikeApi.unlike(videoId) : LikeApi.like(videoId))
      .then(result => {
      const message = result.data ? (result.data.thanksMessage || '') : '';
      if (message) {
        this.execCommand('notify', `${message}`);
        // Task 074: お礼メッセージにURLが書かれていることがあるので、
        // 消えるポップアップだけでなく動画情報パネルにも残す（選択・コピーできる）
        this._view.emit('likeThanksMessage', {message, videoId});
      } else {
        this.execCommand('notify',
          isLiked ? '(･A･)ﾉｼ' : '(･∀･)ｨｨﾈ!!');
        this._view.emit('likeThanksMessage', {message: '', videoId});
      }
      this._state.isLiked = this._videoInfo.isLiked = !isLiked;
    }).catch(err => {
      console.warn(err);
      // Task 066: 失敗理由（HTTPステータス・errorCode）が分かるようにする
      this.execCommand('alert', (err && err.message) || 'いいね！できなかった');
    });
  }
  _onMylistAdd(groupId, mylistName) {
    if (this._state.isUpdatingMylist || !util.isLogin()) {
      return;
    }

    const unlock = () => this._state.isUpdatingMylist = false;

    this._state.isUpdatingMylist = true;
    let timer = window.setTimeout(unlock, 10000);

    const owner = this._videoInfo.owner;
    const originalVideoId = this._videoInfo.originalVideoId ?
      `元動画: ${this._videoInfo.originalVideoId}` : '';
    const watchId = this._videoInfo.watchId;
    const description =
      this._playerConfig.getValue('enableAutoMylistComment') ?
        `投稿者: ${owner.name} ${owner.linkId} ${originalVideoId}` : '';
    if (!this._mylistApiLoader) {
      this._mylistApiLoader = MylistApiLoader;
    }

    this._mylistApiLoader.addMylistItem(watchId, groupId, description)
      .then(result => this.execCommand('notify', `${result.message}: ${mylistName}`))
      .catch(err => this.execCommand('alert', `${err.message}: ${mylistName}`))
      .then(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(unlock, 2000);
      });
  }
  _onMylistRemove(groupId, mylistName) {
    if (this._state.isUpdatingMylist || !util.isLogin()) {
      return;
    }

    const unlock = () => this._state.isUpdatingMylist = false;

    this._state.isUpdatingMylist = true;
    let timer = window.setTimeout(unlock, 10000);

    let watchId = this._videoInfo.watchId;

    if (!this._mylistApiLoader) {
      this._mylistApiLoader = MylistApiLoader;
    }

    this._mylistApiLoader.removeMylistItem(watchId, groupId)
      .then(result => this.execCommand('notify', `${result.message}: ${mylistName}`))
      .catch(err => this.execCommand('alert', `${err.message}: ${mylistName}`))
      .then(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(unlock, 2000);
      });
  }
  _onCommentParsed() {
    const lang = this._playerConfig.getValue('commentLanguage');
    this.emit('commentParsed', lang, this._threadInfo);
    global.emitter.emit('commentParsed');
  }
  _onCommentChange() {
    const lang = this._playerConfig.getValue('commentLanguage');
    this.emit('commentChange', lang, this._threadInfo);
    global.emitter.emit('commentChange');
  }
  _onCommentFilterChange(filter) {
    const config = this._playerConfig;
    config.props.enableFilter = filter.isEnable;
    config.props.wordFilter = filter.wordFilterList;
    config.props.userIdFilter = filter.userIdFilterList;
    config.props.commandFilter = filter.commandFilterList;
    this.emit('commentFilterChange', filter);
  }
  _onVideoPlayerTypeChange(type = '') {
    switch (type.toLowerCase()) {
      case 'youtube':
        this._state.setState({isYouTube: true});
        break;
      default:
        this._state.setState({isYouTube: false});
    }
  }
  _onNicosSeek(time) {
    const ct = this.currentTime;
    window.console.info('nicosSeek!', time);
    if (this.isPlaylistEnable) {
      // 連続再生中は後方へのシークのみ有効にする
      if (ct < time) {
        this.execCommand('fastSeek', time);
      }
    } else {
      this.execCommand('fastSeek', time);
    }
  }
  show() {
    this._state.isOpen = true;
  }
  hide() {
    this._state.isOpen = false;
  }
  async open(watchId, options) {
    if (!watchId) {
      return;
    }
    // 連打対策
    if (Date.now() - this._lastOpenAt < 1500 && this._watchId === watchId) {
      return;
    }

    this.refreshLastPlayerId();
    this._requestId = 'play-' + Math.random();
    this._videoWatchOptions = options = new VideoWatchOptions(watchId, options, this._playerConfig);

    if (!options.isPlaylistStartRequest &&
      this.isPlaying && this.isPlaylistEnable && !options.isOpenNow) {
      this._onPlaylistInsert(watchId);
      return;
    }

    window.console.log('%copen video: ', 'color: blue;', watchId);
    window.console.time('動画選択から再生可能までの時間 watchId=' + watchId);

    let nicoVideoPlayer = this._nicoVideoPlayer;
    if (!nicoVideoPlayer) {
      nicoVideoPlayer = await this._initializeNicoVideoPlayer();
    } else {
      if (this._videoInfo) {
        this._savePlaybackPosition(this._videoInfo.contextWatchId, this.currentTime);
      }
      nicoVideoPlayer.close();
      this._view.clearPanel();
      this.emit('beforeVideoOpen');
      if (this._videoSession) {
        this._videoSession.close();
      }
    }

    this._state.resetVideoLoadingStatus();

    this._state.isCommentReady = false;
    this._watchId = watchId;
    this._lastCurrentTime = 0;
    this._lastOpenAt = Date.now();
    this._state.isError = false;

    Promise.all([
      VideoInfoLoader.load(watchId, options.videoLoadOptions),
      WatchInfoCacheDb.get(this._watchId),
      this._initializePlaylist()  //videoinfo取得に300msくらいかかってるぽいから他のことやろうか
    ]).then(this._onVideoInfoLoaderLoad.bind(this, this._requestId)
    ).catch(this._onVideoInfoLoaderFail.bind(this, this._requestId));

    this.show();
    if (this._playerConfig.getValue('autoFullScreen') && !util.fullscreen.now()) {
      nicoVideoPlayer.requestFullScreen();
    }
    this.emit('open', watchId, options);
    global.emitter.emitAsync('DialogPlayerOpen', watchId, options);
    global.emitter.emitResolve('firstPlayerOpen');
  }
  get isOpen() {
    return this._state.isOpen;
  }
  reload(options) {
    options = this._videoWatchOptions.createForReload(options);

    if (this._lastCurrentTime > 0) {
      options.currentTime = this._lastCurrentTime;
    }
    this.open(this._watchId, options);
  }
  get currentTime() {
    if (!this._nicoVideoPlayer) {
      return 0;
    }
    const ct = this._nicoVideoPlayer.currentTime * 1;
    if (!this._state.isError && ct > 0) {
      this._lastCurrentTime = ct;
    }
    return this._lastCurrentTime;
  }
  set currentTime(sec) {
    if (!this._nicoVideoPlayer) {
      return;
    }
    sec = Math.max(0, sec);
    this._nicoVideoPlayer.currentTime=sec;
    this._lastCurrentTime = sec;
    MediaSessionApi.updatePositionStateByMedia(this);
  }
  get id() { return this._id;}
  get isLastOpenedPlayer() {
    return this.id === this._playerConfig.props.lastPlayerId;
  }
  refreshLastPlayerId() {
    if (this.isLastOpenedPlayer) {
      return;
    }
    this._playerConfig.props.lastPlayerId = '';
    this._playerConfig.props.lastPlayerId = this.id;
  }
  async _onVideoInfoLoaderLoad(requestId, [videoInfoData, localCacheData]) {
    console.log('VideoInfoLoader.load!', requestId, this._watchId, videoInfoData);
    if (this._requestId !== requestId) {
      return;
    }
    const videoInfo = this._videoInfo = new VideoInfoModel(videoInfoData, localCacheData);
    this._watchId = videoInfo.watchId;
    WatchInfoCacheDb.put(this._watchId, {videoInfo});
    let serverType;
    let videoQuality;
    if (!videoInfo.isDomandOnly && this._playerConfig.props.autoDisableNew && videoInfo.maybeBetterQualityServerType === 'dmc') {
      serverType = 'dmc';
      videoQuality = this._playerConfig.props.dmcVideoQuality;
    } else if (videoInfo.isDomandOnly || (this._videoWatchOptions.videoServerType === 'domand' && videoInfo.isDomandAvailable)) {
      serverType = 'domand';
      videoQuality = this._playerConfig.props.domandVideoQuality;
    } else if (videoInfo.isDmcOnly || (this._videoWatchOptions.videoServerType === 'dmc' && videoInfo.isDmcAvailable)) {
      serverType = 'dmc';
      videoQuality = this._playerConfig.props.dmcVideoQuality;
    } else {
      serverType = 'domand';
      videoQuality = this._playerConfig.props.domandVideoQuality;
    }

    this._state.setState({
      isDomandAvailable: videoInfo.isDomandAvailable,
      isDmcAvailable: videoInfo.isDmcAvailable,
      isCommunity: videoInfo.isCommunityVideo,
      isMymemory: videoInfo.isMymemory,
      isChannel: videoInfo.isChannel,
      isLiked: videoInfo.isLiked
    });
    MediaSessionApi.updateByVideoInfo(this._videoInfo);
    // Task 074: 音声の自動調整。動画ごとの音量倍率を音量に掛ける（設定 audio.autoAdjust）
    AudioAdjuster.setContext({
      watchId: videoInfo.watchId,
      loudness: videoInfo.loudness,
      isChannel: videoInfo.isChannel
    });

    const isHLSRequired = videoInfo.isHLSRequired;
    const isHLSSupported = !!global.debug.isHLSSupported ||
      document.createElement('video').canPlayType('application/vnd.apple.mpegURL') !== '' ||
      document.createElement('video').canPlayType('application/x-mpegURL') !== '';
    const useHLS = isHLSSupported && (isHLSRequired || !this._playerConfig.props['video.hls.enableOnlyRequired'] || serverType != 'dmc');
    this._videoSession = await VideoSessionWorker.create({
      videoInfo,
      videoQuality,
      serverType,
      useHLS
    });

    if (this._videoFilter.isNgVideo(videoInfo)) {
      return this._onVideoFilterMatch();
    }

    try {
      if (this._videoSession.isDmc) {
        await NVWatchCaller.call(videoInfo.dmcInfo.trackingId)
      }
      const sessionInfo = await this._videoSession.connect();
      this.setVideo(sessionInfo.url);
      videoInfo.setCurrentVideo(sessionInfo.url);
      this.emit('videoServerType', sessionInfo.type, sessionInfo, videoInfo);
    } catch (e) {
      this._onVideoSessionFail(this._videoSession.serverType, e);
    }
    this._state.videoInfo = videoInfo;

    this.loadComment(videoInfo.msgInfo);

    this.emit('loadVideoInfo', videoInfo);
    this.emitResolve('firstVideoInitialized', this._watchId);

    if (Fullscreen.now() || this._playerConfig.props.screenMode === 'wide') {
      this.execCommand('notifyHtml',
        `<img src="${textUtil.escapeHtml(videoInfo.thumbnail)}" style="width: 96px;">` +
        util.escapeToZenkaku(videoInfo.title)
      );
    }
  }
  setVideo(url) {
    this._state.setState({
      isYouTube: url.indexOf('youtube') >= 0,
      currentSrc: url
    });
  }
  loadComment(msgInfo) {
    msgInfo.language = this._playerConfig.props.commentLanguage;
    this._playerConfig.props.commentLanguage = msgInfo.language;
    this.threadLoader.load(msgInfo).then(
      this._onCommentLoadSuccess.bind(this, this._requestId),
      this._onCommentLoadFail.bind(this, this._requestId)
    );
  }
  reloadComment(param = {}) {
    const msgInfo = Object.assign({}, this._videoInfo.msgInfo);
    if (typeof param.when === 'number') {
      msgInfo.when = param.when;
    }
    this.loadComment(msgInfo);
  }
  _onVideoInfoLoaderFail(requestId, e) {
    const watchId = e.watchId;
    window.console.error('_onVideoInfoLoaderFail', watchId, e);
    if (this._requestId !== requestId) {
      return;
    }
    this._setErrorMessage(e.message || '通信エラー', watchId);
    this._state.isError = true;
    if (e.info) {
      this._videoInfo = new VideoInfoModel(e.info);
      this._state.videoInfo = this._videoInfo;
      this.emit('loadVideoInfoFail', this._videoInfo);
    } else {
      this.emit('loadVideoInfoFail');
    }
    global.emitter.emitAsync('loadVideoInfoFail', e);

    if (!this.isPlaylistEnable) {
      return;
    }
    if (e.reason === 'forbidden' || e.info.isPlayable === false) {
      window.setTimeout(() => this.playNextVideo(), 3000);
    }
  }
  _onVideoSessionFail(serverType, result) {
    const server = serverType === 'dmc' ? 'dmc.nico' : serverType;
    window.console.error(`${server} fail`, result);
    this._setErrorMessage(
      `動画の読み込みに失敗しました(${server}) ${result && result.message || ''}`, this._watchId);
    this._state.setState({isError: true, isLoading: false});
    if (this.isPlaylistEnable) {
      window.setTimeout(() => this.playNextVideo(), 3000);
    }
  }
  _onVideoPlayStartFail(err) {
    window.console.error('動画再生開始に失敗', err);
    if (!(err instanceof DOMException)) { //
      return;
    }

    console.warn('play() request was rejected code: %s. message: %s', err.code, err.message);
    const message = err.message;
    switch (message) {
      case 'SessionClosedError':
        // TODO: DMCのセッション切れなら自動リロード
        // if (this._videoSession.isDeleted && !this._videoSession.isAbnormallyClosed) {
        //   window.console.info('%cリロードしたら直るかも', 'background: yellow');
        //
        // }
        if (this._playserState.isError) { break; }
        this._setErrorMessage('動画の再生開始に失敗しました', this._watchId);
        this._state.setVideoErrorOccurred();
        break;

      case 'AbortError': // 再生開始を待っている間に動画変更などで中断された等
      case 'NotAllowedError': // 自動再生のブロック
      default:
        break;
    }

    this.emit('loadVideoPlayStartFail');
    global.emitter.emitAsync('loadVideoPlayStartFail');
  }
  _onVideoFilterMatch() {
    window.console.error('ng video', this._watchId);
    this._setErrorMessage('再生除外対象の動画または投稿者です');
    this._state.isError = true;
    this.emit('error');
    if (this.isPlaylistEnable) {
      window.setTimeout(() => this.playNextVideo(), 3000);
    }
  }
  _setErrorMessage(msg) {
    this._state.errorMessage = msg;
  }
  _onCommentLoadSuccess(requestId, result) {
    if (requestId !== this._requestId) {
      return;
    }
    let options = {
      replacement: this._videoInfo.replacementWords,
      duration: this._videoInfo.duration,
      // Task 081: 提供画面を出す設定なら、動画の後ろ（提供画面の間）のコメントを詰めない
      creditDuration: this._playerConfig.props['supporterCredit.enable'] ? 30 : 0,
      mainThreadId: result.threadInfo.threadId,
      format: result.format
    };
    this._nicoVideoPlayer.closeCommentPlayer();
    this._threadInfo = result.threadInfo;
    this._nicoVideoPlayer.setComment(result.body, options);

    // 選択中の言語がその動画で使えず、ThreadLoader側でサーバー既定言語に
    // フォールバックして読み込めた場合、設定を書き換えずにいると次に開く
    // 動画でも同じ言語指定で失敗→リトライを繰り返してしまう。
    // 実際に使えた言語で設定を更新し、以後は最初から成功するようにする
    // （Task B-5 追加調査）。
    if (result.threadInfo.language && result.threadInfo.language !== this._playerConfig.props.commentLanguage) {
      this._playerConfig.props.commentLanguage = result.threadInfo.language;
    }

    WatchInfoCacheDb.put(this._watchId, {threadInfo: result.threadInfo});
    this._state.isCommentReady = true;
    this._state.isWaybackMode = result.threadInfo.isWaybackMode;
    this.emit('commentReady', result, this._threadInfo);
    if (result.threadInfo.totalResCount !== this._videoInfo.count.comment) {
      this._state.count = {
        ...this._state.count, comment: result.threadInfo.totalResCount
      };
      this.emit('videoCount', {comment: result.threadInfo.totalResCount});
    }
  }
  _onCommentLoadFail(requestId, e) {
    if (requestId !== this._requestId) {
      return;
    }
    this.execCommand('alert', e.message);
  }
  _onLoadedMetaData() {
    // Task 077c: 動画が変わったら自動レベル補正を測り直す
    ScreenFilter.resetAutoLevels();
    // YouTubeは動画指定時にパラメータで開始位置を渡すので不要
    if (this._state.isYouTube) {
      return;
    }

    // パラメータで開始秒数が指定されていたらそこにシーク
    let currentTime = this._videoWatchOptions.currentTime;
    if (currentTime > 0) {
      this.currentTime=currentTime;
    }
  }
  async _onVideoCanPlay() {
    if (!this._state.isLoading) {
      return;
    }
    window.console.timeEnd('動画選択から再生可能までの時間 watchId=' + this._watchId);
    this._playerConfig.props.lastWatchId = this._watchId;
    WatchInfoCacheDb.put(this._watchId, {watchCount: 1});

    await this.promise('playlist-ready');

    if (this._videoWatchOptions.isPlaylistStartRequest) {

      let option = this._videoWatchOptions.mylistLoadOptions;
      let query = this._videoWatchOptions.query;

      // 通常時はプレイリストの置き換え、
      // 連続再生中はプレイリストに追加で読み込む
      option.append = this.isPlaying && this._playlist.isEnable;

      // //www.nicovideo.jp/watch/sm20353707 // プレイリスト開幕用動画
      console.log('playlist option:', option);

      option.limit = this._playerConfig.props['search.limit'];

      this._playlist.load(query.playlist, option, this._videoInfo.msgInfo);
      this._playlist.toggleEnable(true);
    }
    // チャンネル動画は、1本の動画がwatchId表記とvideoId表記で2本登録されてしまう。
    // そこでwatchId表記のほうを除去する
    this._playlist.insertCurrentVideo(this._videoInfo);
    if (this._videoInfo.watchId !== this._videoInfo.videoId &&
      this._videoInfo.videoId.startsWith('so')) {
      this._playlist.removeItemByWatchId(this._videoInfo.watchId);
    }

    this._state.setVideoCanPlay();
    this.emitAsync('canPlay', this._watchId, this._videoInfo, this._videoWatchOptions);
    this.emitResolve('firstVideoCanPlay', this._watchId, this._videoInfo, this._videoWatchOptions);

    // プレイリストによって開かれた時は、自動再生設定に関係なく再生する
    if (this._videoWatchOptions.eventType === 'playlist' && this.isOpen) {
      this.play();
    }
    if (this._nextVideo) {
      const nextVideo = this._nextVideo;
      this._nextVideo = null;
      if (this._playerConfig.props.enableNicosJumpVideo) {
        const nv = this._playlist.findByWatchId(nextVideo);
        if (nv && nv.isPlayed()) {
          return;
        } // 既にリストにあって再生済みなら追加しない(無限ループ対策)
        this.execCommand('notify', '@ジャンプ: ' + nextVideo);
        this.execCommand('playlistInsert', nextVideo);
      }
    }

  }
  _onVideoPlay() {
    this._state.setPlaying();
    MediaSessionApi.updatePositionStateByMedia(this);
    this.emit('play');
  }
  _onVideoPlaying() {
    this._state.setPlaying();
    this.emit('playing');
  }
  _onVideoSeeking() {
    this._state.isSeeking = true;
    this.emit('seeking');
  }
  _onVideoSeeked() {
    this._state.isSeeking = false;
    MediaSessionApi.updatePositionStateByMedia(this);
    this.emit('seeked');
  }
  _onVideoPause() {
    this._state.setPausing();
    this._savePlaybackPosition(this._videoInfo.contextWatchId, this.currentTime);
    this.emit('pause');
  }
  _onVideoStalled() {
    this._state.isStalled = true;
    this.emit('stalled');
  }
  _onVideoTimeUpdate() {
    this._state.isStalled = false;
  }
  _onVideoProgress(range, currentTime) {
    this.emit('progress', range, currentTime);
  }
  async _onVideoError(e) {
    this._state.setVideoErrorOccurred();
    if (e.type === 'youtube') {
      return this._onYouTubeVideoError(e);
    }
    if (!this._videoInfo) {
      this._setErrorMessage('動画の再生に失敗しました。');
      return;
    }

    const retry = params => {
      setTimeout(() => {
        if (!this.isOpen) {
          return;
        }
        this.reload(params);
      }, 3000);
    };

    const sessionState = await this._videoSession.getState();
    const {isDomand, isDmc, isDeleted, isAbnormallyClosed} = sessionState;
    const videoWatchOptions = this._videoWatchOptions;
    const code = (e && e.target && e.target.error && e.target.error.code) || 0;
    window.console.error('VideoError!', code, e, (e.target && e.target.error), {isDeleted, isAbnormallyClosed});

    if (Date.now() - this._lastOpenAt > 3 * 60 * 1000 && isDeleted && !isAbnormallyClosed) {

      if (videoWatchOptions.reloadCount < 5) {
        retry();
      } else {
        this._setErrorMessage('動画のセッションが切断されました。');
      }
    } else if (isDomand && this._videoInfo.isDmcAvailable) {
      this._setErrorMessage('Domand動画の再生に失敗しました。DMC動画に接続します。');
      retry({videoServerType: 'dmc'});
    } else if (isDmc && this._videoInfo.isDomandAvailable) {
      this._setErrorMessage('DMC動画の再生に失敗しました。Domand動画に接続します。');
      retry({videoServerType: 'domand'});
    } else {
      this._setErrorMessage('動画の再生に失敗しました。');
    }

    this.emit('error', e, code);
  }
  _onYouTubeVideoError(e) {
    window.console.error('onYouTubeVideoError!', e);
    this._setErrorMessage(e.description);
    this.emit('error', e);
    if (e.fallback) {
      setTimeout(() => this.reload({isAutoZenTubeDisabled: true}), 3000);
    }
  }
  _onVideoAbort() {
    this.emit('abort');
  }
  _onVideoAspectRatioFix(ratio) {
    this.emit('aspectRatioFix', ratio);
  }
  _onVideoEnded() {
    // ループ再生中は飛んでこない
    this.emitAsync('ended');
    this._state.setVideoEnded();
    this._savePlaybackPosition(this._videoInfo.contextWatchId, 0);
    if (this.isPlaylistEnable && this._playlist.hasNext) {
      this.playNextVideo({eventType: 'playlist'});
      return;
    } else if (this._playlist) {
      this._playlist.toggleEnable(false);
    }

    const isAutoCloseFullScreen =
      this._videoWatchOptions.hasKey('autoCloseFullScreen') ?
        this._videoWatchOptions.isAutoCloseFullScreen :
        this._playerConfig.getValue('autoCloseFullScreen');
    if (Fullscreen.now() && isAutoCloseFullScreen) {
      Fullscreen.cancel();
    }
    global.emitter.emitAsync('videoEnded');
  }
  _onVolumeChange(vol, mute) {
    this.emit('volumeChange', vol, mute);
  }
  _onVolumeChangeEnd(vol, mute) {
    this.emit('volumeChangeEnd', vol, mute);
  }
  _savePlaybackPosition(contextWatchId, ct) {
    if (!util.isLogin()) {
      return;
    }
    const vi = this._videoInfo;
    if (!vi) {
      return;
    }
    const dr = this.duration;
    console.info('%csave PlaybackPosition:', 'background: cyan', ct, dr, vi.csrfToken);
    if (vi.contextWatchId !== contextWatchId) {
      return;
    }
    if (Math.abs(ct - dr) < 3) {
      return;
    }
    if (dr < 120) {
      return;
    } // 短い動画は記録しない
    PlaybackPosition.record(
      contextWatchId,
      ct,
      vi.msgInfo.frontendId,
      vi.msgInfo.frontendVersion
    ).catch(e => {
      window.console.warn('save playback fail', e);
    });
  }
  close() {
    if (this.isPlaying) {
      this._savePlaybackPosition(this._watchId, this.currentTime);
    }
    WatchInfoCacheDb.put(this._watchId, {currentTime: this.currentTime});
    if (Fullscreen.now()) {
      Fullscreen.cancel();
    }
    this.pause();
    this.hide();
    this._refresh();
    this.emit('close');
    global.emitter.emitAsync('DialogPlayerClose');
  }
  _refresh() {
    if (this._nicoVideoPlayer) {
      this._nicoVideoPlayer.close();
    }
    if (this._videoSession) {
      this._videoSession.close();
    }
  }
  async _initializePlaylist() {
    if (this._playlist) {
      return;
    }
    const $container = this._view.appendTab('playlist', 'プレイリスト');
    this._playlist = new PlayList({
      loader: ThumbInfoLoader,
      container: $container[0],
      loop: this._playerConfig.props.playlistLoop,
      enableAdDecoration: this._playerConfig.props.enableAdDecoration,
      debugCheckAdDecoration: this._playerConfig.props.debugCheckAdDecoration
    });
    this._playlist.on('command', this._onCommand.bind(this));
    this._playlist.on('update', _.debounce(this._onPlaylistStatusUpdate.bind(this), 100));
    if (PlayListSession.isExist()) {
      this._playlist.restoreFromSession();
    }
    this.emitResolve('playlist-ready');
  }
  _initializeCommentPanel() {
    if (this._commentPanel) {
      return;
    }
    const $container = this._view.appendTab('comment', 'コメント');
    this._commentPanel = new CommentPanel({
      player: this,
      $container: $container,
      autoScroll: this._playerConfig.props.enableCommentPanelAutoScroll,
      language: this._playerConfig.props.commentLanguage
    });
    this._commentPanel.on('command', this._onCommand.bind(this));
    this._commentPanel.on('deleteChat', (e, chat) => {
      this.removeChat(chat)
        .then(() => e.resolve());
    });
    this._commentPanel.on('update', _.debounce(this._onCommentPanelStatusUpdate.bind(this), 100));
    // Task 063: タブ生成直後、現在の設定値をすぐに反映する(_onPlayerConfigUpdate
    // は値が「変わった」時にしか呼ばれないため、初期状態はここで別途適用する)。
    this._applyCommentPanelVisibility(this._playerConfig.props.enableCommentPanel);
    this.emitResolve('commentpanel-ready');
  }
  get isPlaylistEnable() {
    return this._playlist && this._playlist.isEnable;
  }
  playNextVideo(options) {
    if (!this._playlist || !this.isOpen) {
      return;
    }
    let opt = this._videoWatchOptions.createForVideoChange(options);

    let nextId = this._playlist.selectNext();
    if (nextId) {
      this.open(nextId, opt);
    }
  }
  playPreviousVideo(options) {
    if (!this._playlist || !this.isOpen) {
      return;
    }
    let opt = this._videoWatchOptions.createForVideoChange(options);

    let prevId = this._playlist.selectPrevious();
    if (prevId) {
      this.open(prevId, opt);
    }
  }
  play() {
    if (!this._state.isError && this._nicoVideoPlayer) {
      this._nicoVideoPlayer.play().catch((e) => {
        this._onVideoPlayStartFail(e);
      });
    }
  }
  pause() {
    if (!this._state.isError && this._nicoVideoPlayer) {
      this._nicoVideoPlayer.pause();
      this._state.setPausing();
    }
  }
  get isPlaying() {
    return this._state.isPlaying;
  }
  get paused() {
    return this._nicoVideoPlayer ? this._nicoVideoPlayer.paused : true;
  }
  togglePlay() {
    if (!this._state.isError && this._nicoVideoPlayer) {
      if (this.isPlaying) {
        this.pause();
        return;
      }

      this._nicoVideoPlayer.togglePlay().catch((e) => {
        this._onVideoPlayStartFail(e);
      });
    }
  }
  set volume(v) {
    if (this._nicoVideoPlayer) {
      this._nicoVideoPlayer.volume = v;
    }
  }
  get volume() {
    return this._playerConfig.props.volume;
  }
  async addChat(text, cmd, vpos = null, options = {}) {
    if (!this._nicoVideoPlayer ||
      !this.threadLoader ||
      !this._state.isCommentReady ||
      this._state.isCommentPosting) {
      return Promise.reject();
    }
    if (!util.isLogin()) {
      return Promise.reject();
    }
    const threadId = this._threadInfo.threadId * 1;
    // force184のスレッドに184コマンドをつけてしまうとエラー. 同じなんだから無視すりゃいいだろが
    if (this._threadInfo.force184 !== '1') {
      cmd = cmd ? ('184 ' + cmd) : '184';
    }
    Object.assign(options, {isMine: true, isUpdating: true, thead: threadId});
    vpos = (!isNaN(vpos) && typeof vpos === 'number') ? vpos : this._nicoVideoPlayer.vpos;
    const nicoChat = this._nicoVideoPlayer.addChat(text, cmd, vpos, options);

    this._state.isCommentPosting = true;

    const lang = this._playerConfig.props.commentLanguage;
    window.console.time('コメント投稿');

    const onSuccess = result => {
      window.console.timeEnd('コメント投稿');
      nicoChat.isUpdating = false;
      nicoChat.no = result.no;
      this.execCommand('notify', 'コメント投稿成功');
      this._state.isCommentPosting = false;

      this._threadInfo.blockNo = result.blockNo;
      WatchInfoCacheDb.put(this._watchId, {comment: {text, cmd, vpos, options}});
      return Promise.resolve(result);
    };

    const onFail = err => {
      err = err || {};
      window.console.log('_onFail: ', err);
      window.console.timeEnd('コメント投稿');
      nicoChat.isPostFail = true;
      nicoChat.isUpdating = false;
      this.execCommand('alert', err.message);
      this._state.isCommentPosting = false;
      if (err.blockNo && typeof err.blockNo === 'number') {
        this._threadInfo.blockNo = err.blockNo;
      }
      return Promise.reject(err);
    };

    const msgInfo = this._videoInfo.msgInfo;
    return this.threadLoader.postChat(msgInfo, text, cmd, vpos, lang)
      .then(onSuccess).catch(onFail);
  }
  removeChat(chat) {
    if (!this._nicoVideoPlayer ||
      !this.threadLoader ||
      !this._state.isCommentReady) {
      return;
    }
    if (!util.isLogin()) {
      return;
    }

    window.console.time('コメント削除');

    const msgInfo = this._videoInfo.msgInfo;
    return this.threadLoader.deleteChat(msgInfo, chat)
      .then(result => {
        window.console.timeEnd('コメント削除');
        this.execCommand('notify', 'コメント削除成功');
        this._nicoVideoPlayer.removeChat(chat);
      })
      .catch(err => {
        err = err || {};
        window.console.log('_onFail: ', err);
        window.console.timeEnd('コメント削除');
        this.execCommand('alert', err.message);
      });
  }
  get duration() {
    if (!this._videoInfo) {
      return 0;
    }
    return this._videoInfo.duration;
  }
  get bufferedRange() {return this._nicoVideoPlayer.bufferedRange;}
  get nonFilteredChatList() {return this._nicoVideoPlayer.nonFilteredChatList;}
  get chatList() {return this._nicoVideoPlayer.chatList;}
  get playingStatus() {
    if (!this._nicoVideoPlayer || !this._nicoVideoPlayer.isPlaying) {
      return {};
    }

    const session = {
      playing: true,
      watchId: this._watchId,
      url: location.href,
      currentTime: this._nicoVideoPlayer.currentTime
    };

    const options = this._videoWatchOptions.createForSession();
    Object.keys(options).forEach(key => {
      session[key] = session.hasOwnProperty(key) ? session[key] : options[key];
    });

    return session;
  }
  get watchId() {
    return this._watchId;
  }
  get currentTab() {
    return this._state.currentTab;
  }
  getId() { return this.id; }
  getDuration() { return this.duration; }
  getBufferedRange() { return this.bufferedRange; }
  getNonFilteredChatList() { return this.nonFilteredChatList;}
  getChatList() { return this.chatList; }
  getPlayingStatus() { return this.playingStatus; }
  getMymemory() {
    return this._nicoVideoPlayer.getMymemory();
  }
}

class VideoHoverMenu {
  constructor(...args) {
    this.initialize(...args);
  }
  initialize(params) {
    this._container = params.playerContainer;
    this._state = params.playerState;

    this._bound = {};
    this._bound.emitClose =
      _.debounce(() => util.dispatchCommand(this._container, 'close'), 300);

    this._initializeDom();
  }
  async _initializeDom() {
    const container = this._container;
    util.$.html(VideoHoverMenu.__tpl__).appendTo(container);
    this._view = container.querySelector('.hoverMenuContainer');

    const $mc = util.$(container.querySelectorAll('.menuItemContainer'));
    $mc.on('contextmenu',
      e => { e.preventDefault(); e.stopPropagation(); });
    $mc.on('click', this._onClick.bind(this));
    $mc.on('mousedown', this._onMouseDown.bind(this));

    global.emitter.on('hideHover', this._hideMenu.bind(this));
    await this._initializeMylistSelectMenu();
  }
  async _initializeMylistSelectMenu() {
    if (!util.isLogin()) {
      return;
    }
    this._mylistApiLoader = MylistApiLoader;
    this._mylistList = await this._mylistApiLoader.getMylistList();
    this._initializeMylistSelectMenuDom();
  }
  _initializeMylistSelectMenuDom(mylistList) {
    if (!util.isLogin()) {
      return;
    }
    mylistList = mylistList || this._mylistList;
    const menu = this._container.querySelector('.mylistSelectMenu');
    menu.addEventListener('wheel', e => e.stopPropagation(), {passive: true});

    const ul = document.createElement('ul');
    mylistList.forEach(mylist => {
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
  _onMouseDown(e) {
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
  _onClick(e) {
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

  util.addStyle(`
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
        background: #888;
        color: #000;
        border: 1px solid #666;
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
      white-space: nowrap;
    }
      .is-error .onErrorMenu {
        display: block !important;
        opacity: 1 !important;
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
        margin: 0 16px;
        padding: 8px;
        background: #888;
        color: #000;
        opacity: 1;
        cursor: pointer;
        border-radius: 0;
        box-shadow: 4px 4px 0 #333;
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
        box-shadow: 0 2px 0 #000;
        cursor: pointer;
        opacity: 1;
        background: #888;
        color: #000;
      }
      .menuButton:active {
        transform: translate(0, 2px);
        box-shadow: 0 0 0 #000;
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
        border: 1px solid !000;
        background: #ffc;
        color: black;
        box-shadow: 2px 2px 2px #fff;
        text-shadow: none;
        white-space: nowrap;
        z-index: 100;
        opacity: 0.8;
      }

      .menuButton:hover .tooltip {
        display: block;
      }
      .menuButton:avtive .tooltip {
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

      .is-mouseMoving .menuButton {
        opacity: 0.8;
        background: rgba(80, 80, 80, 0.5);
        border: 1px solid #888;
        transition: box-shadow 0.2s ease;
      }
      .is-mouseMoving .menuButton .menuButtonInner {
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
      background:#888;
      color: #000;
      border: 1px solid #666;
      line-height: 30px;
      filter: grayscale(100%);
      border-radius: 4px;
    }
      .is-showComment .showCommentSwitch {
        color: #fff;
        filter: none;
        text-decoration: none;
      }
      .showCommentSwitch .menuButtonInner {
        text-decoration: line-through;
      }
      .is-showComment .showCommentSwitch .menuButtonInner {
        text-decoration: none;
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
      background: #888 !important;
      color: #000 !important;
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
      border: 1px inset #000 !important;
      color: #000 !important;
      box-shadow: none !important;
    }
    .mylistButton.mylistAddMenu:focus-within {
      background: #888 !important;
    }
    .is-updatingMylist  .mylistButton.mylistAddMenu {
      background: #888 !important;
      color: #000 !important;
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
        background-color: #ff9;
        transform: scale(2);
      }
      .mylistSelectMenu .mylistIcon:hover::after {
        background: #fff;
        z-index: 100;
        opacity: 1;
      }
      .mylistSelectMenu .mylistIcon > svg {
        fill: #666;
        width: 100%;
        height: 100%;
      }


      .mylistSelectMenu .name {
        display: inline-block;
        width: calc(100% - 20px);
        vertical-align: middle;
        font-size: 110%;
        color: #fff;
        text-decoration: none !important;
      }
      .mylistSelectMenu .name:hover {
        color: #fff;
      }
      .mylistSelectMenu .name::after {
        content: ' に登録';
        font-size: 75%;
        color: #333;
      }
      .mylistSelectMenu li:hover .name::after {
        color: #fff;
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
        color: #fff;
        opacity: 0;
        visibility: hidden;
        transition:
          transform 0.8s ease,
          opacity 0.8s ease,
          visibility 0.8s ease,
          color 0.8s ease;
      }
      .toggleLikeButton:active .heart-effect {
        transition: none;
        transform: translate(-50%, -50%) scale(0.3);
        color: pink;
        opacity: 0.5;
        visibility: visible;
      }

      .zenzaTweetButton:hover {
        text-shadow: 1px 1px 2px #88c;
        background: #1da1f2;
        color: #fff;
      }

    .menuItemContainer .menuButton.closeButton {
      position: absolute;
      font-size: 20px;
      top: 0;
      right: 0;
      z-index: 60000;
      margin: 0 0 40px 40px;
      color: #ccc;
      border: solid 1px #888;
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

    .is-mouseMoving .closeButton,
    .closeButton:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.8);
    }
    .closeButton:hover {
      background: rgba(33, 33, 33, 0.9);
      box-shadow: 4px 4px 4px #000;
    }
    .closeButton:active {
      transform: scale(0.5);
    }

    .menuItemContainer .toggleDebugButton {
      position: relative;
      display: inline-block;
      opacity: 1 !important;
      padding: 8px 16px;
      color: #000;
      box-shadow: none;
      font-size: 21px;
      border: 1px solid black;
      background: rgba(192, 192, 192, 0.8);
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
      background: rgba(0, 0, 0, 0.8);
      transition: transform 0.2s ease, box-shadow 0.2s, text-shadow 0.2s, font-size 0.2s;
      box-shadow: 0 0 2px rgba(255, 255, 192, 0.8);
      cursor: pointer;
    }

    .togglePlayMenu:hover {
      transform: translate(-50%, -50%) scale(1.6);
      text-shadow: 0 0 4px #888;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
    }

    .togglePlayMenu:active {
      transform: translate(-50%, -50%) scale(2.0, 1.2);
      font-size: 30px;
      box-shadow: 0 0 4px inset rgba(0, 0, 0, 0.8);
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

VideoHoverMenu.__tpl__ = (`
    <div class="hoverMenuContainer">
      <div class="menuItemContainer leftTop">
          <div class="menuButton toggleDebugButton" data-command="toggle-debug">
            <div class="menuButtonInner">debug mode</div>
          </div>
      </div>

      <div class="menuItemContainer rightTop">
        <div class="scalingUI">
          <div class="menuButton toggleLikeButton forMember" data-command="toggle-like">
            <div class="tooltip">いいね！</div>
            <div class="menuButtonInner"><div class="not-liked-heart"
              >♡</div><div class="liked-heart"
              >♥</div><div class="heart-effect">♡</div></div>
          </div>
          <div class="menuButton zenzaTweetButton" data-command="tweet">
            <div class="tooltip">ツイート</div>
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
            <div class="tooltip">とりあえずマイリスト(T)</div>
            <div class="menuButtonInner">&#x271A;</div>
          </div>

          <div class="menuButton closeButton" data-command="close">
            <div class="menuButtonInner">&#x2716;</div>
          </div>

        </div>
      </div>

      <div class="menuItemContainer leftBottom">
        <div class="scalingUI">
          <div class="showCommentSwitch menuButton" data-command="toggle-showComment">
            <div class="tooltip">コメント表示ON/OFF(V)</div>
            <div class="menuButtonInner">💬</div>
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


class VariablesMapper {
  get nextState() {
    const {menuScale, commentLayerOpacity, fullscreenControlBarMode} = this.config.props;
    return {menuScale, commentLayerOpacity, fullscreenControlBarMode};
  }

  get videoControlBarHeight() {
    return(
      (VideoControlBar.BASE_HEIGHT - VideoControlBar.BASE_SEEKBAR_HEIGHT) *
        this.state.menuScale + VideoControlBar.BASE_SEEKBAR_HEIGHT);
  }

  constructor({config, element}){
    this.config = config;

    this.state = {
      menuScale: 0,
      commentLayerOpacity: 0,
      fullscreenControlBarMode: 'auto'
    };

    this.element = element || document.body;
    this.emitter = new Emitter();

    const update = _.debounce(this.update.bind(this), 500);
    Object.keys(this.state).forEach(key =>
      config.onkey(key, () => update(key)));
    update();
  }

  on(...args) {
    this.emitter.on(...args);
  }

  shouldUpdate(state, nextState) {
    return Object.keys(state).some(key => state[key] !== nextState[key]);
  }

  setVar(key, value) {
    cssUtil.setProps([this.element, key, value]); }

  update() {
    const state = this.state;
    const nextState = this.nextState;

    if (!this.shouldUpdate(state, nextState)) {
      return;
    }

    const {menuScale, commentLayerOpacity, fullscreenControlBarMode} = nextState;

    this.state = nextState;
    Object.assign(this.element.dataset, {fullscreenControlBarMode});
    if (state.scale !== menuScale) {
      this.setVar('--zenza-ui-scale', menuScale);
      this.setVar('--zenza-control-bar-height', css.px(this.videoControlBarHeight));
    }
    if (state.commentLayerOpacity !== commentLayerOpacity) {
      this.setVar('--zenza-comment-layer-opacity', commentLayerOpacity);
    }
    this.emitter.emit('update', nextState);
  }

}

//===END===

export {
  PlayerConfig,
  VideoWatchOptions,
  PlayerState,
  NicoVideoPlayerDialog,
  NicoVideoPlayerDialogView,
  VideoHoverMenu,
  VariablesMapper
};
