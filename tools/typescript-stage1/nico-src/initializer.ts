declare const HlsRuntime: {install(zenza:Loose,dependencies:{Emitter:Loose;dimport:Loose}):Promise<unknown>};
declare const Emitter: typeof import('./Emitter').Emitter;
declare const dimport: typeof import('./dimport').dimport;
declare const NotificationJournal: typeof import('./NotificationJournal').NotificationJournal;
declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;
/**
 * Canonical TypeScript source for src/initializer.js (Task965).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const BroadcastEmitter: typeof import('./messageUtil').BroadcastEmitter;
declare const CONSTANT: import('./shared-types/Constant').ZenzaConstant;
declare const CommentLayoutWorker: typeof import('./external/CommentLayoutWorker').CommentLayoutWorker;
declare const Config: Loose;
declare const CustomElements: typeof import('./CustomElements').CustomElements;
declare const HoverMenu: typeof import('./HoverMenu').HoverMenu;
declare const NicoComment: typeof import('./CommentPlayer').NicoComment;
declare const NicoVideoPlayerDialog: typeof import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
declare const OfficialPlayerRoute: Loose;
declare const PlayerConfig: typeof import('./NicoVideoPlayerDialog').PlayerConfig;
declare const PlayerSession: typeof import('./PlayerSession').PlayerSession;
declare const PlayerState: typeof import('./State').PlayerState;
declare const PlaylistSession: typeof import('./PlayListSession').PlaylistSession;
declare const RootDispatcher: typeof import('./RootDispatcher').RootDispatcher;
declare const START_PAGE_QUERY: string;
declare const StoryboardCacheDb: typeof import('./StoryboardCacheDb').StoryboardCacheDb;
declare const StoryboardWorker: typeof import('./StoryboardWorker').StoryboardWorker;
declare const ThumbInfoLoader: typeof import('./ThumbInfoLoader').ThumbInfoLoader;
declare const VideoSessionWorker: typeof import('./VideoSessionWorker').VideoSessionWorker;
declare const WatchInfoCacheDb: typeof import('./WatchInfoCacheDb').WatchInfoCacheDb;
declare const WatchPageHistory: typeof import('./WatchPageHistory').WatchPageHistory;
declare const ZenzaWatch: Loose;
declare const cssUtil: typeof import('./css').cssUtil;
declare const domEvent: typeof import('./domEvent').domEvent;
declare const global: import('./shared-types/ZenzaGlobal').ZenzaGlobal;
declare const initializeGinzaSlayer: Loose;
declare const replaceRedirectLinks: typeof import('./replaceRedirectLinks').replaceRedirectLinks;
declare const textUtil: typeof import('./textUtil').textUtil;
declare const uq: typeof import('./uQuery').uq;
declare const util: import('./shared-types/ZenzaUtil').ZenzaUtil;


const {initialize} = (() => {
//@require HoverMenu
//@require OfficialPlayerRoute
  /**
   * Task1036: ZenzaWatch 自身のコードで起きた、どこにも捕まえられなかったエラーを通知履歴へ残す。
   * ニコニコのページ自体のエラーは拾わない（発生元が ZenzaWatch のときだけ）。
   * 同じエラー（種類＋場所）は1件にまとめて回数を数える。メッセージは記録時に URL・トークンを伏せる。
   */
  // Task1059: 本体（boot が読み込む monkey）は ZenzaWatchMain.js という名前で動く。
  const ZENZA_SOURCE = /ZenzaWatch(?:Runtime|Main)\.js|userscript\.html\?name=ZenzaWatch|ZenzaWatch[^/\s]*\.user\.js/;
  const scriptErrorWhere = (stack: unknown): string => {
    if (typeof stack !== 'string') { return ''; }
    for (const line of stack.split('\n').slice(1, 8)) {
      if (!ZENZA_SOURCE.test(line)) { continue; }
      const fn = /at (?:async )?([A-Za-z_$][\w$.<>]*) /.exec(line);
      const pos = /:(\d+):\d+\)?\s*$/.exec(line);
      return (fn ? fn[1] : 'anonymous') + (pos ? '@' + pos[1] : '');
    }
    return '';
  };
  let scriptErrorInstalled = false;
  const installScriptErrorJournal = () => {
    if (scriptErrorInstalled) { return; }
    scriptErrorInstalled = true;
    const recordError = (error: Loose, filename: unknown) => {
      try {
        const stack = typeof error?.stack === 'string' ? error.stack : '';
        if (!ZENZA_SOURCE.test(String(filename || '')) && !ZENZA_SOURCE.test(stack)) { return; }
        const name = typeof error?.name === 'string' && /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : 'Error';
        const message = String(error?.message ?? error ?? '').slice(0, 300);
        const where = scriptErrorWhere(stack).replace(/[^A-Za-z0-9_.$@<>-]/g, '').slice(0, 100);
        const missing = (RequestDiagnostics as Loose)?.missingFromMessage?.(message);
        NotificationJournal.recordDiagnostic('script-error-' + name + '-' + (where || message.slice(0, 40)), {
          category: 'system', source: 'script-error', level: 'error',
          message: 'ZenzaWatch のスクリプトエラー: ' + name + ': ' + message,
          details: {operation: 'script-error', outcome: 'failed', reason: 'script', errorName: name,
            ...(where ? {where} : {}), ...(missing ? {missing} : {})}
        });
      } catch (_) { /* 記録の失敗で本体を止めない */ }
    };
    window.addEventListener('error', (e: ErrorEvent) => recordError(e.error || {message: e.message, name: 'Error'}, e.filename));
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      const reason = (e as Loose).reason;
      if (reason instanceof Error) { recordError(reason, ''); }
    });
  };

  // GINZAを置き換えるべきか？の判定
  // Task1065: 公式の視聴ページで Zenza が代わりに再生する時、公式プレイヤーの再生を止める見張り。
  // 以前は「ページの読み込みが全部終わってから（uq.complete）」公式の video を探して止めていたため、
  // 公式プレイヤーの読み込みと自動再生が速いと、その間ずっと両方が鳴っていた（掲示板 2595・2615 の報告）。
  // ここでは起動の最初に、ページ全体の play イベントを捕まえる（capture）見張りを置く。
  // 後から作り直される video にも効く。Zenza 自身の video と、Zenza を閉じた後と、小・横の画面モードは止めない。
  const isZenzaMedia = (el: Loose) => !!el && (el.classList?.contains('zenzaWatchVideoElement') ||
    !!el.closest?.('#ZenzaWatchVideoPlayerContainer, .zenzaVideoPlayerDialog, .zenzaPlayerContainer'));
  const isOfficialMedia = (el: Loose) => {
    if (!(el instanceof HTMLMediaElement) || isZenzaMedia(el)) { return false; }
    // 公式プレイヤーは #root（視聴ページの本体）の中にある。Zenza がサムネイル用に body へ足す video は対象外。
    const root = document.getElementById('root');
    return !!root && root.contains(el);
  };
  const createOfficialPlaybackGuard = () => {
    let active = true;
    let dialog: Loose = null;
    const sideBySide = () => /(^|[^\w])zenzaScreenMode_(small|sideView)([^\w]|$)/.test(document.body.className);
    const shouldStop = () => {
      if (!active || sideBySide()) { return false; }
      // ダイアログができた後は、開いている間だけ止める（閉じたら公式で見られるように）
      return !dialog || dialog.isOpen !== false;
    };
    const stop = (el: Loose) => {
      if (!isOfficialMedia(el) || el.paused) { return; }
      try { el.pause(); } catch (_) { /* 外れた video は止められなくてよい */ }
    };
    const onPlay = (ev: Event) => { if (shouldStop()) { stop(ev.target); } };
    window.addEventListener('play', onPlay, true);
    window.addEventListener('playing', onPlay, true);
    const stopAll = () => { if (shouldStop()) { document.querySelectorAll('video, audio').forEach(stop); } };
    stopAll();
    return {
      attach(next: Loose) {
        dialog = next;
        next.on?.('close', () => { active = false; });
        next.on?.('open', () => { active = true; stopAll(); });
        stopAll();
      },
      release() {
        active = false;
        window.removeEventListener('play', onPlay, true);
        window.removeEventListener('playing', onPlay, true);
      },
      get active() { return active; }
    };
  };
  const shouldOverrideGinza = (query?: Loose) =>
    !!Config.props.overrideGinza && !OfficialPlayerRoute.isOfficialRequest(query) && window.name !== 'watchGinza';

  const overrideGinza = async (dialog?: Loose, query?: Loose, guard?: Loose) => {
    // GINZAで視聴のリンクできた場合はスキップ
    if (OfficialPlayerRoute.isOfficialRequest(query) || window.name === 'watchGinza') {
      // Retain the legacy named-window fallback, but do not depend on it.
      // Chrome/Firefox may clear window.name during a navigation.
      if (window.name === 'watchGinza') { window.name = ''; }
      return;
    }

    // Task1030: task1019 で廃止された「公式の視聴ページでZenzaWatchを優先」を復活。
    // 視聴ページを直接開いた（アドレス・ブックマーク・別タブ）ときに公式プレイヤーしか
    // 開かなくなり、利用者から「公式のプレイヤーでしか再生されなくなった」と報告された。
    // 設定は従来どおり任意（初期値OFF）。ONにしている利用者だけ以前の動作に戻る。
    if (!Config.props.overrideGinza) {
      return;
    }
    // 公式プレイヤーの再生を止める見張り（Task1065: 起動の最初に置いたものを、ダイアログにつなぐ）
    (guard || createOfficialPlaybackGuard()).attach(dialog);
    initializeGinzaSlayer(dialog, query);
  };

  // Task175 (F02): the wait ends even if #root is missing or the SPA never mounts.
  const readyContent = (timeoutMs = 15000) => {
    if (document.querySelector('[aria-label="nicovideo-content"]') != null) {
      return Promise.resolve();
    }
    const root = document.getElementById('root');
    if (!root) {
      return Promise.resolve();
    }
    const {promise, resolve} = (Promise as Loose).withResolvers();
    let timer: Loose = null;
    const observer = new MutationObserver((records, observer) => {
      for (const record of records) {
        if(record.addedNodes.length === 0 || document.querySelector('[aria-label="nicovideo-content"]') == null) {
          continue;
        }
        clearTimeout(timer);
        observer.disconnect();
        resolve();
        return;
      }
    });
    observer.observe(root, {
      childList: true,
    });
    timer = setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeoutMs);
    return promise;
  }

  const isWatchPage = async () => {
    if (!util.isGinzaWatchUrl()) {
      return false;
    }

    const res = document.querySelector('meta[name="server-response"]')?.getAttribute('content');
    // Task175 (F02): decide per response, without network, between the legacy
    // data.response envelope and the Watch V4 data.response.$watchV4.data envelope.
    let json = null;
    if (res != null) {
      try {
        json = JSON.parse(res);
      } catch (_) {
        json = null;
      }
    }
    if (json == null || typeof json !== 'object') {
      await readyContent();
      return !!document.querySelector('.grid-area_\\[player\\]');
    }

    if (json.meta?.status > 299) {
      return false;
    }

    const response = json.data?.response;
    const watchData = response?.$watchV4 ? response.$watchV4.data : response;
    return typeof watchData?.okReason === 'string';
  };

  const initWorker = () => {
    // 動画ロード直後に初期化するとつっかかる原因になるのでWorkerだけ作っておく
    if (!location.host.endsWith('.nicovideo.jp')) { return; }
    CommentLayoutWorker.getInstance();
    void ThumbInfoLoader.load('sm9').catch(() => console.warn('Thumb info warm-up unavailable'));
    console.time('init Workers');
    // Storyboard cache is optional for playback readiness. Keep the Watch
    // history DB prewarm gate: first-open WatchInfoCacheDb.get may otherwise
    // move its IndexedDB open wait onto the pre-session playback path.
    const requiredWorkers = [
      StoryboardWorker.initWorker(),
      VideoSessionWorker.initWorker()
    ];
    void StoryboardCacheDb.initWorker().catch(() => console.warn('Storyboard cache unavailable'));
    const watchCacheReady = WatchInfoCacheDb.initWorker().catch(() => console.warn('Watch info cache unavailable'));
    return Promise.all([...requiredWorkers, watchCacheReady]).then(() => console.timeEnd('init Workers'));
  };

//@require replaceRedirectLinks

  const initialize = async function (){
    // Task1065: 公式プレイヤーの見張りは、ほかの準備（設定・Worker・lit の読み込み）を待たずに最初に置く。
    const startQuery = textUtil.parseQuery(START_PAGE_QUERY);
    const officialGuard = util.isGinzaWatchUrl() && shouldOverrideGinza(startQuery) ? createOfficialPlaybackGuard() : null;
    if(typeof StoryboardCacheDb!=='undefined'&&StoryboardCacheDb.configure){
      const configureSceneCache=()=>{
        const capacity=Number(Config.getValue('storyboardCacheMaxMB'));
        const days=Number(Config.getValue('storyboardCacheDays'));
        void StoryboardCacheDb.configure({maxBytes:([0,32,64,128,256,512].includes(capacity)?capacity:128)*1024*1024,
          maxAgeMs:([1,3,7,14,30].includes(days)?days:7)*86400000}).catch(()=>console.warn('Scene cache settings unavailable'));
      };
      configureSceneCache();
      Config.onkey?.('storyboardCacheMaxMB',configureSceneCache);Config.onkey?.('storyboardCacheDays',configureSceneCache);
    }
    if (typeof NotificationJournal !== 'undefined') {
      NotificationJournal.configureRecording?.(key => Config.getValue(key));
      // Task1036: 上限件数と保存期間。設定を変えたらすぐ整理する。
      const applyRetention = () => (NotificationJournal as Loose).configureRetention?.(
        Config.getValue('notificationHistory.maxRecords'), Config.getValue('notificationHistory.maxAgeDays'));
      applyRetention();
      Config.onkey?.('notificationHistory.maxRecords', applyRetention);
      Config.onkey?.('notificationHistory.maxAgeDays', applyRetention);
    }
    if (typeof RequestDiagnostics !== 'undefined' && typeof NotificationJournal !== 'undefined') {
      NotificationJournal.configureBuild?.(ZenzaWatch.version, ZenzaWatch.build);
      RequestDiagnostics.setSink(event => NotificationJournal.recordDiagnostic(event.key, {
        category: 'network', source: event.operation, message: event.message,
        level: event.outcome === 'recovered' ? 'success' :
          ['spec-change', 'script'].includes(event.reason) ? 'error' :
          ['not-found', 'permission', 'unavailable'].includes(event.reason) ? 'info' : 'warning',
        details: {operation: event.operation, phase: event.phase, outcome: event.outcome,
          reason: event.reason, elapsedMs: event.elapsedMs,
          ...(event.statusCode === undefined ? {} : {statusCode: event.statusCode}),
          ...(event.errorCode === undefined ? {} : {errorCode: event.errorCode}),
          // Task1036: 直す場所がすぐ分かるように（値・URL・本文は含めない）。
          ...(event.missing === undefined ? {} : {missing: event.missing}),
          ...(event.errorName === undefined ? {} : {errorName: event.errorName}),
          ...(event.module === undefined ? {} : {module: event.module}),
          ...(event.distinctTargets === undefined ? {} : {distinctTargets: event.distinctTargets})}
      }));
    }
    if (typeof NotificationJournal !== 'undefined') { installScriptErrorJournal(); }
    await HlsRuntime.install(ZenzaWatch, {Emitter, dimport});
    console.log('%cinitialize ZenzaWatch...', 'background: lightgreen; ');

    domEvent.dispatchCustomEvent(
      document.body, 'BeforeZenzaWatchInitialize', (window as Loose).ZenzaWatch, {bubbles: true, composed: true});
    cssUtil.addStyle(CONSTANT.COMMON_CSS, {className: 'common'});
    initializeBySite();
    replaceRedirectLinks().catch(() => console.warn('Legacy redirect-link enhancement unavailable'));

    const query = textUtil.parseQuery(START_PAGE_QUERY);

    await uq.ready(); // DOMContentLoaded
    const isWatch = await isWatchPage();
    // 視聴できないページ（削除・非公開など）では Zenza は代わりに再生しないので、見張りを外す
    if (!isWatch) { officialGuard?.release(); }

    // migrate comment language
    if (typeof Config.props.commentLanguage === 'string') {
      Config.props.commentLanguage = Config.props.commentLanguage.replace('_', '-').toLowerCase();
    }

    const hoverMenu = global.debug.hoverMenu = new HoverMenu({playerConfig: Config});

    await Promise.all([
      NicoComment.offscreenLayer.get(Config),
      global.emitter.promise('lit-html'),
      initWorker()
    ]);
    document.body.classList.toggle('is-watch', isWatch);
    const dialog = (initializeDialogPlayer as Loose)(Config);
    hoverMenu.setPlayer(dialog);

    if (isWatch) {
      await overrideGinza(dialog, query, officialGuard);
    }

    initializeMessage(dialog);
    WatchPageHistory.initialize(dialog);
    (initializeExternal as Loose)(dialog, Config, hoverMenu);

    if (!isWatch) {
      initializeLastSession(dialog);
    }


    CustomElements.initialize!();
    (window as Loose).ZenzaWatch.ready = true;
    global.emitter.emitAsync('ready');
    global.emitter.emitResolve('init');
    domEvent.dispatchCustomEvent(
      document.body, 'ZenzaWatchInitialize', (window as Loose).ZenzaWatch, {bubbles: true, composed: true});
  };

  const initializeMessage = (player?: Loose) => {
    const config = Config;
    const bcast = BroadcastEmitter;
    /**
     * 複数ウィンドウ間
     * @param {CommandBody} cmd
     * @param {string} type
     * @param {string} sessionId
     */
    const onBroadcastMessage = (cmd?: Loose, type?: Loose, sessionId?: Loose) => {
      const isLast = player.isLastOpenedPlayer;
      const isOpen = player.isOpen;
      // window.console.log('initializeMessage.onBroadcastMessage', {cmd, isLast, isOpen, sessionId});
      const {command, params, requestId, now} = cmd;
      let result;
      const localNow = Date.now();

      if (command === 'hello') {
        console.log(
          '%cHELLO! \ntime: %s (%smsec)\nmessage: %s \nfrom: %s\nurl: %s\n', 'font-weight: bold;',
          new Date(params.now).toLocaleString(), localNow - now,
          params.message, params.from, params.url,
          {command, isLast, isOpen});
          result = {status: 'ok'};
      } else if (command  === 'sendExecCommand' &&
          (params.command === 'echo' || (isLast && isOpen))) {
        // window.console.log('execCommand', {params});
        result = player.execCommand(params.command, params.params);
      } else if (command === 'ping' && (params.force || (isLast && isOpen))) {
        console.info('pong!');
        result = {status: 'ok'};
      } else if (command === 'pong') {
        result = bcast.emitResolve('ping', params);
      } else if (command  === 'notifyClose' && isOpen) {
        result = player.refreshLastPlayerId();
        return;
      } else if (command  === 'notifyOpen') {
        config.refresh('lastPlayerId');
        return;
      } else if (command ==='pushHistory') {
        const {path, title} = params;
        WatchPageHistory.pushHistoryAgency(path, title);
      } else if (command === 'openVideo' && isLast) {
        const {watchId, query, eventType} = params;
        player.open(watchId, {autoCloseFullScreen: false, query, eventType});
      } else if (command === 'messageResult') {
        if (bcast.hasPromise(params.sessionId)) {
          params.status === 'ok' ?
            bcast.emitResolve(params.sessionId, params) :
            bcast.emitReject(params.sessionId, params);
        }
        return;
      } else {
        return;
      }

      result = result || {status: 'ok'};
      Object.assign(result, {
        playerId: player.getId(),
        title: document.title,
        url: location.href,
        windowId: bcast.windowId,
        sessionId,
        isLast,
        isOpen,
        requestId,
        now: localNow,
        time: localNow - now
      });
      bcast.sendMessage({command: 'messageResult', params: result});
  };
    /**
     * 親子ウィンドウ間
     * @param {CommandBody} cmd
     * @param {string} type
     * @param {string} sessionId
     */
    const onWindowMessage = (cmd?: Loose, type?: Loose, sessionId?: Loose) => {
      const {command, params} = cmd;
      const watchId = cmd.watchId || params.watchId; // 互換のため冗長
      // window.console.log('initializeMessage.onWindowMessage', {message: cmd, type, sessionId});

      if (watchId && command === 'open') {
        if (config.props.enableSingleton) {
          global.external.sendOrOpen(watchId);
        } else {
          player.open(watchId, {economy: Config.props.forceEconomy});
        }
      } else if (watchId && command === 'send') {
        BroadcastEmitter.sendExecCommand({command: 'openVideo', params: watchId});
      }
    };
    /**
     * @param {CommandBody} cmd
     * @param {string} type
     * @param {string} sessionId
     */
    BroadcastEmitter.on('message', (message?: Loose, type?: Loose, sessionId?: Loose) => {
      return type === 'broadcast' ?
        onBroadcastMessage(message, type, sessionId) :
        onWindowMessage(message, type, sessionId);
    });

    player.on('close', () => BroadcastEmitter.notifyClose());
    player.on('open', () => BroadcastEmitter.notifyOpen());
  };

  const initializeExternal = (dialog?: Loose) => {
    const command = (command?: Loose, param?: Loose) => dialog.execCommand(command, param);

    const open = (watchId?: Loose, params?: Loose) => dialog.open(watchId, params);

    // 最後にZenzaWatchを開いたタブに送る
    const send = (watchId?: Loose, params?: Loose) => BroadcastEmitter.sendOpen(watchId, params);

    // 最後にZenzaWatchを開いたタブに送る
    // なかったら同じタブで開く. 一見万能だが、pingを投げる都合上ワンテンポ遅れる。
    const sendOrOpen = (watchId?: Loose, params?: Loose): Promise<unknown> | void => {
      if (dialog.isLastOpenedPlayer) {
        open(watchId, params);
      } else {
        return BroadcastEmitter
          .ping()
          .then(() => send(watchId, params), () => open(watchId, params));
      }
    };

    const importPlaylist = (data?: Loose) => PlaylistSession.save(data);

    const exportPlaylist = () => PlaylistSession.restore() || {};

    const sendExecCommand = (command?: Loose, params?: Loose) => BroadcastEmitter.sendExecCommand({command, params});

    const sendOrExecCommand = (command?: Loose, params?: Loose) => {
      return BroadcastEmitter.ping()
        .then(() => sendExecCommand(command, params),
              () => dialog.execCommand(command, params));
    };

    const playlistAdd = (watchId?: Loose) => sendOrExecCommand('playlistAdd', watchId);

    const insertPlaylist = (watchId?: Loose) => sendOrExecCommand('playlistInsert', watchId);

    const deflistAdd = ({watchId, description, token}: Loose) => {
      const mylistApiLoader = ZenzaWatch.api.MylistApiLoader;
      if (token) {
        mylistApiLoader.setCsrfToken(token);
      }
      return mylistApiLoader.addDeflistItem(watchId, description);
    };

    const deflistRemove = ({watchId, token}: Loose) => {
      const mylistApiLoader = ZenzaWatch.api.MylistApiLoader;
      if (token) {
        mylistApiLoader.setCsrfToken(token);
      }
      return mylistApiLoader.removeDeflistItem(watchId);
    };

    const echo = (msg = 'こんにちはこんにちは！') => sendExecCommand('echo', msg);

    Object.assign(ZenzaWatch.external, {
      execCommand: command,
      sendExecCommand,
      sendOrExecCommand,
      open,
      send,
      sendOrOpen,
      deflistAdd,
      deflistRemove,
      hello: BroadcastEmitter.hello,
      ping: BroadcastEmitter.ping,
      echo,
      playlist: {
        add: playlistAdd,
        insert: insertPlaylist,
        import: importPlaylist,
        export: exportPlaylist
      }
    });
    Object.assign(ZenzaWatch.debug, {
      dialog,
      getFrameBodies: () => {
        return Array.from(document.querySelectorAll('.zenzaPlayerContainer iframe')).map(f => (f as Loose).contentWindow.document.body);
      }
    });
    if (ZenzaWatch !== (window as Loose).ZenzaWatch) {
      (window as Loose).ZenzaWatch.external = {
        open,
        sendOrOpen,
        sendOrExecCommand,
        hello: BroadcastEmitter.hello,
        ping: BroadcastEmitter.ping,
        echo,
        playlist: {
          add: playlistAdd,
          insert: insertPlaylist
        }
      };
    }
  };

  const initializeLastSession = (dialog?: Loose) => {
    // Task1030: 視聴ページでは「公式の視聴ページでZenzaWatchを優先」がONのときだけ前回の
    // 続きを復元する（OFFなら公式プレイヤーに任せる。task1019 の意図はOFF時に維持）。
    if (util.isGinzaWatchUrl() && !Config.props.overrideGinza) { return; }
    window.addEventListener('beforeunload', () => {
      if (!dialog.isOpen) {
        return;
      }
      PlayerSession.save(dialog.playingStatus);
      dialog.close();
    }, {passive: true});
    PlayerSession.init(sessionStorage);
    let lastSession = PlayerSession.restore();
    let screenMode = Config.props.screenMode;
    if (
      lastSession.playing &&
      (screenMode === 'small' ||
        screenMode === 'sideView' ||
        location.href === lastSession.url ||
        Config.props.continueNextPage
      )
    ) {
      lastSession.eventType = 'session';
      dialog.open(lastSession.watchId, lastSession);
    } else {
      PlayerSession.clear();
    }
  };

  const initializeBySite = () => {
    const hostClass = location.host
      .replace(/^.*\.slack\.com$/, 'slack.com')
      .replace(/\./g, '-');
    document.body.dataset.domain = hostClass;
    util.StyleSwitcher.update({on: `style.domain.${hostClass}`});
  };

  const initializeDialogPlayer = (config?: Loose, offScreenLayer?: Loose) => {
    console.log('initializeDialog');
    config = PlayerConfig.getInstance(config);
    const state = PlayerState.getInstance(config);
    ZenzaWatch.state.player = state;
    const dialog = new NicoVideoPlayerDialog({
      offScreenLayer,
      config,
      state
    });
    RootDispatcher.initialize(dialog);
    return dialog;
  };


  return {initialize};
})();

export {
  initialize
};
