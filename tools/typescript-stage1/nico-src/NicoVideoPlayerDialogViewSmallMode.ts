/**
 * Canonical TypeScript source for src/NicoVideoPlayerDialogViewSmallMode.js (Task1063: NicoVideoPlayerDialogView.ts から役割ごとに分割).
 * 小さい画面モードでの、プレイヤーのドラッグ移動・大きさの変更。
 * NicoVideoPlayerDialogView.prototype へそのまま取り付ける（クラスのメソッドと同じく列挙されない）。
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// 本体のクラス（実行時は同じスコープにある）。
type View = import('./NicoVideoPlayerDialogView').NicoVideoPlayerDialogView;
// legacy-to-ts: names provided by other bundled modules
declare const CONSTANT: import('./shared-types/Constant').ZenzaConstant;
declare const ClassList: typeof import('./ClassList').ClassList;
declare const CommentInputPanel: typeof import('./CommentInputPanel').CommentInputPanel;
declare const NicoVideoPlayer: typeof import('./NicoVideoPlayer').NicoVideoPlayer;
declare const _: import('./shared-types/Lodash').LodashSubset;
declare const global: import('./shared-types/ZenzaGlobal').ZenzaGlobal;

/** 小さい画面モードでの、プレイヤーのドラッグ移動・大きさの変更。 */
const NicoVideoPlayerDialogViewSmallMode = {
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
  _initializeSmallModeDrag(this: View, $container?: Loose) {
    const container = $container[0];
    const config = this._playerConfig;
    const DRAG_THRESHOLD = 6;
    const MIN_WIDTH = 160, MIN_HEIGHT = 90;
    const DEFAULT_WIDTH = CONSTANT.SIDE_PLAYER_WIDTH;
    const DEFAULT_HEIGHT = CONSTANT.SIDE_PLAYER_HEIGHT;
    // 右上のホバーメニュー（いいね/ツイート/マイリスト/あとで見る/
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
    let cachedRect: Loose = null;
    const getContainerRect = () => cachedRect || container.getBoundingClientRect();
    const clampOffset = (x?: Loose, y?: Loose, w?: Loose, h?: Loose) => {
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
    const clampSize = (w?: Loose, h?: Loose) => {
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
    const applyOffset = (x?: Loose, y?: Loose) => {
      offsetX = x;
      offsetY = y;
      pendingX = x;
      pendingY = y;
      scheduleFlush();
    };
    const applySize = (w?: Loose, h?: Loose) => {
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
    let commentInputPanelCache: Loose = null;
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
    let dragPointerId: Loose = null;
    let dragStartClientX = 0, dragStartClientY = 0;
    let baseOffsetX = 0, baseOffsetY = 0;

    const onDragMove = (e?: Loose) => {
      if (dragPointerId !== e.pointerId) { return; }
      const dx = e.clientX - dragStartClientX;
      const dy = e.clientY - dragStartClientY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
          return;
        }
        dragging = true;
        classList.add('is-smallModeDragging');
        this.emit('sceneSearchGeometryChange',{active:true});
        try { container.setPointerCapture(dragPointerId); } catch (err) { /* noop */ }
      }
      const [x, y] = (clampOffset as Loose)(baseOffsetX + dx, baseOffsetY + dy);
      applyOffset(x, y);
    };

    const endDrag = (e?: Loose) => {
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
      this.emit('sceneSearchGeometryChange',{active:false});
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
    const forceEndDragIfStuck = (e?: Loose) => {
      if (dragPointerId === null) { return; }
      if (e && e.pointerId !== undefined && e.pointerId !== dragPointerId) { return; }
      endDrag({pointerId: dragPointerId});
    };
    container.addEventListener('lostpointercapture', forceEndDragIfStuck);
    window.addEventListener('pointerup', forceEndDragIfStuck, {capture: true});
    window.addEventListener('pointercancel', forceEndDragIfStuck, {capture: true});

    container.addEventListener('pointerdown', (e?: Loose) => {
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

    let resizePointerId: Loose = null;
    let resizeStartClientX = 0, resizeStartClientY = 0;
    let baseWidth = 0, baseHeight = 0;

    const onResizeMove = (e?: Loose) => {
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

    const endResize = (e?: Loose) => {
      if (resizePointerId !== e.pointerId) { return; }
      try { resizeHandle.releasePointerCapture(resizePointerId); } catch (err) { /* noop */ }
      resizePointerId = null;
      classList.remove('is-smallModeResizing');
      this.emit('sceneSearchGeometryChange',{active:false});
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
      this.emit('sceneSearchGeometryChange',{active:true});
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
      this.emit('sceneSearchGeometryChange',{active:false});
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
  },
};

export {NicoVideoPlayerDialogViewSmallMode};
