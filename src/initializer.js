import {HlsRuntime} from '../packages/zenza/src/hls/HlsRuntime';
import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';
import {NotificationJournal} from './NotificationJournal';
import {ZenzaWatch, global} from './ZenzaContext';
import {
  Config,
  PlayerSession,
  util,
  WatchPageHistory
} from './util';
import {PlaylistSession} from '../packages/zenza/src/Playlist/PlayListSession';
import {NicoComment} from './CommentPlayer';
import {NicoVideoPlayerDialog, PlayerConfig, PlayerState} from './NicoVideoPlayerDialog';
import {initializeGinzaSlayer} from './GinzaSlayer';
import {OfficialPlayerRoute} from '../packages/zenza/src/menu/OfficialPlayerRoute';
import {CONSTANT} from './constant';
import {CustomElements} from '../packages/zenza/src/parts/CustomElements';
import {RootDispatcher} from './RootDispatcher';
import {BroadcastEmitter} from '../packages/lib/src/message/messageUtil';
import {HoverMenu} from '../packages/zenza/src/menu/HoverMenu';
import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';
import {replaceRedirectLinks} from '../packages/zenza/src/init/replaceRedirectLinks';
import {cssUtil} from '../packages/lib/src/css/css';
import {ThumbInfoLoader} from '../packages/lib/src/nico/ThumbInfoLoader';
import {StoryboardWorker} from '../packages/zenza/src/storyboard/StoryboardWorker';
import {VideoSessionWorker} from '../packages/lib/src/nico/VideoSessionWorker';
import {StoryboardCacheDb} from '../packages/lib/src/nico/StoryboardCacheDb';
import {CommentLayoutWorker} from '../packages/zenza/src/commentLayer/CommentLayoutWorker';
import {WatchInfoCacheDb} from '../packages/lib/src/nico/WatchInfoCacheDb';
import {domEvent} from '../packages/lib/src/dom/domEvent';
import {uq} from '../packages/lib/src/uQuery';
// import {domUtil} from '../packages/lib/src/dom/domUtil';
import {textUtil} from '../packages/lib/src/text/textUtil';
const START_PAGE_QUERY = 'hoge=fuga';
import {Emitter} from '../packages/lib/src/Emitter';
import {dimport} from '../packages/lib/src/infra/dimport';

// GENERATED FROM tools/typescript-stage1/nico-src/initializer.ts (Task965). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require HlsRuntime
//@require RequestDiagnostics
//@require NotificationJournal
const { initialize } = (() => {
    //@require HoverMenu
    //@require OfficialPlayerRoute
    /**
     * Task1036: ZenzaWatch 自身のコードで起きた、どこにも捕まえられなかったエラーを通知履歴へ残す。
     * ニコニコのページ自体のエラーは拾わない（発生元が ZenzaWatch のときだけ）。
     * 同じエラー（種類＋場所）は1件にまとめて回数を数える。メッセージは記録時に URL・トークンを伏せる。
     */
    // Task1059: 本体（boot が読み込む monkey）は ZenzaWatchMain.js という名前で動く。
    const ZENZA_SOURCE = /ZenzaWatch(?:Runtime|Main)\.js|userscript\.html\?name=ZenzaWatch|ZenzaWatch[^/\s]*\.user\.js/;
    const scriptErrorWhere = (stack) => {
        if (typeof stack !== 'string') {
            return '';
        }
        for (const line of stack.split('\n').slice(1, 8)) {
            if (!ZENZA_SOURCE.test(line)) {
                continue;
            }
            const fn = /at (?:async )?([A-Za-z_$][\w$.<>]*) /.exec(line);
            const pos = /:(\d+):\d+\)?\s*$/.exec(line);
            return (fn ? fn[1] : 'anonymous') + (pos ? '@' + pos[1] : '');
        }
        return '';
    };
    let scriptErrorInstalled = false;
    const installScriptErrorJournal = () => {
        if (scriptErrorInstalled) {
            return;
        }
        scriptErrorInstalled = true;
        const recordError = (error, filename) => {
            try {
                const stack = typeof error?.stack === 'string' ? error.stack : '';
                if (!ZENZA_SOURCE.test(String(filename || '')) && !ZENZA_SOURCE.test(stack)) {
                    return;
                }
                const name = typeof error?.name === 'string' && /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : 'Error';
                const message = String(error?.message ?? error ?? '').slice(0, 300);
                const where = scriptErrorWhere(stack).replace(/[^A-Za-z0-9_.$@<>-]/g, '').slice(0, 100);
                const missing = RequestDiagnostics?.missingFromMessage?.(message);
                const locationKey = (where || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 90);
                NotificationJournal.recordDiagnostic('diag-script-' + name.toLowerCase() + '-' + locationKey, {
                    category: 'system', source: 'script-error', level: 'error',
                    message: 'ZenzaWatch のスクリプトエラー（' + name + '）',
                    details: { operation: 'script-error', outcome: 'failed', reason: 'script', errorName: name,
                        ...(where ? { where } : {}), ...(missing ? { missing } : {}) }
                });
            }
            catch (_) { /* 記録の失敗で本体を止めない */ }
        };
        window.addEventListener('error', (e) => recordError(e.error || { message: e.message, name: 'Error' }, e.filename));
        window.addEventListener('unhandledrejection', (e) => {
            const reason = e.reason;
            if (reason instanceof Error) {
                recordError(reason, '');
            }
        });
    };
    // GINZAを置き換えるべきか？の判定
    // Task1065: 公式の視聴ページで Zenza が代わりに再生する時、公式プレイヤーの再生を止める見張り。
    // 以前は「ページの読み込みが全部終わってから（uq.complete）」公式の video を探して止めていたため、
    // 公式プレイヤーの読み込みと自動再生が速いと、その間ずっと両方が鳴っていた（掲示板 2595・2615 の報告）。
    // ここでは起動の最初に、ページ全体の play イベントを捕まえる（capture）見張りを置く。
    // 後から作り直される video にも効く。Zenza 自身の video と、Zenza を閉じた後と、小・横の画面モードは止めない。
    const isZenzaMedia = (el) => !!el && (el.classList?.contains('zenzaWatchVideoElement') ||
        !!el.closest?.('#ZenzaWatchVideoPlayerContainer, .zenzaVideoPlayerDialog, .zenzaPlayerContainer'));
    const isOfficialMedia = (el) => {
        if (!(el instanceof HTMLMediaElement) || isZenzaMedia(el)) {
            return false;
        }
        // 公式プレイヤーは #root（視聴ページの本体）の中にある。Zenza がサムネイル用に body へ足す video は対象外。
        const root = document.getElementById('root');
        return !!root && root.contains(el);
    };
    // Task1075: 見張りを直した（画面モード「小」でも止める・ページを読み込まない移動・ショート動画）。
    // Task1076: 止めた公式の video は play() を差し替え、再生・停止の取り合い（音のノイズ）をなくした。
    // Task1077: 上級者設定「公式の視聴ページでZenzaWatchを優先」の下の設定で、次を選べるようにした（設定は毎回その時の値を読む）。
    //   overrideGinza.officialPlayer   'manual'（初期値）: Zenza を開いた時に必ず止める。公式の再生ボタンを自分で押した時だけ一緒に再生できる
    //                                  'block': Zenza が開いている間は、公式の再生ボタンを押しても再生しない
    //   overrideGinza.followNavigation 公式の画面で別の動画へ移ったら、Zenza もその動画に切り替える（初期値 ON）
    //   overrideGinza.openOnNavigation Zenza が閉じている時に、ページを読み込まずに視聴ページへ移ったら Zenza で開く（初期値 ON）
    //   overrideGinza.shorts           ショート動画のページでも Zenza で開く（初期値 ON）
    //   overrideGinza.resumeOnClose    Zenza を閉じたら、公式プレイヤーで同じ所から続きを再生する（初期値 OFF）
    // 「公式の再生ボタンを自分で押した」の見分け方: 公式プレイヤーの枠の上で押してから 1 秒以内の play() だけを利用者の操作とみなす
    // （一覧のリンクを押した直後の自動再生は、押した場所が枠の外なので止める）。
    const installOfficialLaunchButton = (watchId, launch) => {
        const player = '[class~="grid-area_[player]"]';
        const selector = 'button[aria-label="コメントを非表示にする"],button[aria-label="コメントを表示する"]';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'zen-family zenzaOfficialLaunch';
        button.textContent = 'Zen';
        button.setAttribute('aria-label', 'この動画をZenzaWatchで開く');
        button.title = 'この動画をZenzaWatchで開く';
        button.addEventListener('click', event => { event.stopPropagation(); launch(); });
        const addButtonStyle = () => cssUtil.addStyle(`
      .zenzaOfficialLaunch { display:inline-grid;place-items:center;align-self:stretch;min-width:2em;
        padding:0 .2em;border:0;border-radius:3px;background:transparent;color:#ccc;cursor:pointer;
        font:700 14px/1 Arial,sans-serif; flex:0 0 auto; }
      .zenzaOfficialLaunch:hover,.zenzaOfficialLaunch:focus-visible {color:#fff;background:rgba(255,255,255,.15)}
      .zenzaOfficialLaunch:focus-visible {outline:2px solid currentColor;outline-offset:-2px}
      .zenzaOfficialLaunch:active {background:rgba(255,255,255,.25)}
    `, { className: 'zenzaOfficialLaunchStyle' });
        let styled = false;
        let frame = 0;
        let anchor = null;
        let lastUrl = '';
        const update = () => {
            frame = 0;
            lastUrl = location.href;
            // A rebuilt toolbar can include an inert clone of our button.
            document.querySelectorAll('#root .zenzaOfficialLaunch').forEach(el => { if (el !== button) {
                el.remove();
            } });
            if (!watchId() || !Config.getValue('officialLaunch.button')) {
                button.remove();
                anchor = null;
                return;
            }
            const area = document.querySelector('#root ' + player);
            anchor = area?.querySelector(selector) ?? null;
            if (!anchor) {
                button.remove();
                return;
            }
            if (!styled) {
                addButtonStyle();
                styled = true;
            }
            if (Config.getValue('officialLaunch.side') === 'right') {
                if (anchor.nextElementSibling !== button) {
                    anchor.after(button);
                }
            }
            else if (anchor.previousElementSibling !== button) {
                anchor.before(button);
            }
        };
        const schedule = () => { if (!frame) {
            frame = requestAnimationFrame(update);
        } };
        const observer = new MutationObserver(records => {
            if (lastUrl !== location.href) {
                schedule();
                return;
            }
            if (!location.pathname.startsWith('/watch/') || !Config.getValue('officialLaunch.button')) {
                return;
            }
            if (anchor && button.isConnected && anchor.isConnected) {
                const adjacent = Config.getValue('officialLaunch.side') === 'right' ? anchor.nextElementSibling : anchor.previousElementSibling;
                if (adjacent !== button) {
                    schedule();
                }
            }
            else if (anchor || records.some(r => [...r.addedNodes].some(n => n instanceof Element && (n.matches(selector) || n.querySelector(selector))))) {
                schedule();
            }
        });
        observer.observe(document.getElementById('root') || document.documentElement, { subtree: true, childList: true });
        window.addEventListener('popstate', schedule);
        Config.onkey?.('officialLaunch.button', schedule);
        Config.onkey?.('officialLaunch.side', schedule);
        update();
        return () => {
            observer.disconnect();
            window.removeEventListener('popstate', schedule);
            Config.offkey?.('officialLaunch.button', schedule);
            Config.offkey?.('officialLaunch.side', schedule);
            cancelAnimationFrame(frame);
            button.remove();
        };
    };
    const createOfficialPlaybackGuard = () => {
        let active = true;
        let dialog = null;
        let allowedWatchId = null; // 利用者が Zenza を閉じた動画（その動画は公式で見る）
        let lastGestureAt = -Infinity; // 公式プレイヤーの枠の上で押した時刻
        let userPlayed = new WeakSet(); // 利用者が自分で再生した公式の video（止めない）
        const setting = (key) => Config.getValue(key);
        const currentQuery = () => textUtil.parseQuery(location.search.replace(/^\?/, ''));
        const currentWatchId = () => util.isGinzaWatchUrl() ? util.getWatchId() : null;
        const isShortsPage = () => /^\/shorts\//.test(location.pathname);
        // Zenza 自身が既読の色のために URL を動画のものにしている間（WatchPageHistory）は、公式の移動とみなさない
        const zenzaOwnUrl = () => !!WatchPageHistory.isZenzaUrl?.();
        let lastOfficialWatchId = currentWatchId();
        const wanted = () => !!Config.props.overrideGinza && !OfficialPlayerRoute.isOfficialRequest(currentQuery()) &&
            window.name !== 'watchGinza' && (!isShortsPage() || setting('overrideGinza.shorts') !== false);
        let manual = null;
        let queuedManualId = null;
        let recovering = false;
        const launchId = () => location.pathname.startsWith('/watch/') && !zenzaOwnUrl() &&
            window.name !== 'watchGinza' && !OfficialPlayerRoute.isOfficialRequest(currentQuery()) ? currentWatchId() : null;
        const manualMode = () => setting('overrideGinza.officialPlayer') !== 'block';
        const officialRects = () => [...document.querySelectorAll('#root video')]
            .filter(isOfficialMedia)
            .map(v => (v.closest('.grid-area_\\[player\\]') || v).getBoundingClientRect())
            .filter(r => r.width > 0 && r.height > 0);
        const onPointerDown = (ev) => {
            if (isZenzaMedia(ev.target) || ev.target?.closest?.('.zen-family, .zenzaVideoPlayerDialog')) {
                return;
            }
            const hit = officialRects().some(r => ev.clientX >= r.left && ev.clientX <= r.right &&
                ev.clientY >= r.top && ev.clientY <= r.bottom + 64);
            if (hit) {
                lastGestureAt = performance.now();
            }
        };
        const userWantsOfficial = () => manualMode() && performance.now() - lastGestureAt < 1000;
        const realPlay = HTMLMediaElement.prototype.play;
        const open = (watchId) => {
            try {
                dialog.open(watchId, {});
            }
            catch (_) { /* 開けなかった時は公式のまま */ }
        };
        // 公式が再生しようとした時（play イベント、または差し替えた play() が呼ばれた時）に、公式の画面で別の動画へ移ったかを見る
        const followIfNavigated = () => {
            const watchId = currentWatchId();
            if (!watchId || zenzaOwnUrl() || watchId === lastOfficialWatchId) {
                return;
            }
            lastOfficialWatchId = watchId;
            userPlayed = new WeakSet();
            if (dialog?.isOpen && setting('overrideGinza.followNavigation') !== false && wanted() && dialog.watchId !== watchId) {
                open(watchId);
            }
        };
        // この video を止めておくべきか
        const shouldHold = (el) => {
            if (!active || !isOfficialMedia(el)) {
                return false;
            }
            if (manual && currentWatchId() === manual.id && el.closest('[class~="grid-area_[player]"]')) {
                return true;
            }
            if (!wanted() || userPlayed.has(el)) {
                return false;
            }
            const watchId = currentWatchId();
            if (!watchId) {
                return false;
            } // 視聴ページ以外の動画（一覧の試し再生など）には触らない
            if (!dialog || dialog.isOpen) {
                return true;
            } // 起動の途中・Zenza が開いている間
            return watchId !== allowedWatchId && setting('overrideGinza.openOnNavigation') !== false;
        };
        const held = new Set();
        function guardedPlay() {
            followIfNavigated();
            if (userWantsOfficial() && dialog?.isOpen) {
                userPlayed.add(this);
            }
            if (!shouldHold(this)) {
                unhold(this);
                return realPlay.call(this);
            }
            openIfClosed();
            return Promise.resolve();
        }
        const hold = (el) => {
            if (!held.has(el)) {
                held.add(el);
                try {
                    Object.defineProperty(el, 'play', { configurable: true, writable: true, value: guardedPlay });
                }
                catch (_) { /* 差し替えられなくても止めはする */ }
            }
            if (!el.paused) {
                try {
                    el.pause();
                }
                catch (_) { /* 外れた video は止められなくてよい */ }
            }
        };
        const unhold = (el) => {
            if (!held.delete(el)) {
                return;
            }
            try {
                delete el.play;
            }
            catch (_) { /* 元に戻せなくても続ける */ }
        };
        const releaseHeld = () => { [...held].forEach(unhold); };
        // Zenza が閉じている時に、止めるべき公式の再生が始まった = ページを読み込まずに視聴ページへ移った・判定が間に合わなかった
        const openIfClosed = () => {
            const watchId = currentWatchId();
            if (!manual && dialog && !dialog.isOpen && watchId) {
                open(watchId);
            }
        };
        const onPlay = (ev) => {
            const el = ev.target;
            if (!isOfficialMedia(el)) {
                return;
            }
            followIfNavigated();
            if (userWantsOfficial() && dialog?.isOpen) {
                userPlayed.add(el);
            }
            if (!shouldHold(el)) {
                return;
            }
            hold(el);
            openIfClosed();
        };
        const stopAll = () => { document.querySelectorAll('video, audio').forEach(el => { if (shouldHold(el)) {
            hold(el);
        } }); };
        // Zenza が開いている間に公式が作った video は、再生を始める前に止めておく（一瞬鳴るのも防ぐ）
        let watcher = null;
        const watchNew = () => {
            const root = document.getElementById('root');
            if (watcher || !root) {
                return;
            }
            watcher = new MutationObserver(records => {
                const hasMedia = records.some(r => [...r.addedNodes].some((n) => n.nodeType === 1 && (n instanceof HTMLMediaElement || n.querySelector?.('video, audio'))));
                if (hasMedia) {
                    stopAll();
                }
            });
            watcher.observe(root, { childList: true, subtree: true });
        };
        const unwatchNew = () => { watcher?.disconnect(); watcher = null; };
        // Zenza を閉じた時、公式で同じ所から続きを再生する（設定が ON の時だけ）
        const resumeOfficial = (watchId, time) => {
            if (setting('overrideGinza.resumeOnClose') !== true || !watchId || currentWatchId() !== watchId) {
                return;
            }
            const v = [...document.querySelectorAll('#root video')].find(el => isOfficialMedia(el) &&
                el.getBoundingClientRect().width > 0);
            if (!v) {
                return;
            }
            try {
                if (time > 0 && Number.isFinite(time)) {
                    v.currentTime = time;
                }
                void realPlay.call(v).catch(() => { });
            }
            catch (_) { /* 続きから再生できなくても閉じるのは続ける */ }
        };
        const failLaunch = (session) => {
            if (manual !== session) {
                return;
            }
            const samePage = launchId() === session.id;
            manual = null;
            allowedWatchId = session.id;
            recovering = true;
            try {
                if (dialog.isOpen && dialog.watchId === session.id) {
                    dialog.close();
                }
            }
            finally {
                recovering = false;
                releaseHeld();
            }
            if (samePage && session.playing && setting('officialLaunch.restoreOnFailure') && session.video?.isConnected) {
                void realPlay.call(session.video).catch(() => { });
            }
        };
        const launch = () => {
            const id = launchId();
            if (!id || !dialog || dialog.isOpen || manual?.id === id) {
                return false;
            }
            const area = document.querySelector('#root [class~="grid-area_[player]"]');
            if (!area) {
                return false;
            }
            const video = [...area.querySelectorAll('video')].find(v => isOfficialMedia(v) && v.getBoundingClientRect().width > 0) ?? null;
            const session = { id, video, playing: !!video && !video.paused && !video.ended, starting: true };
            const time = setting('officialLaunch.continueTime') && video && !video.ended && Number.isFinite(video.currentTime) ? video.currentTime : 0;
            manual = session;
            lastGestureAt = -Infinity;
            stopAll();
            const openManual = async () => {
                const full = document.fullscreenElement;
                if (full && (area.contains(full) || full.contains(area))) {
                    await document.exitFullscreen();
                }
                if (manual !== session || launchId() !== id) {
                    failLaunch(session);
                    return;
                }
                await dialog.open(id, { currentTime: time, openNow: true, eventType: 'officialManual' });
                if (!dialog.isOpen || dialog.watchId !== id) {
                    failLaunch(session);
                }
            };
            void openManual().catch(() => failLaunch(session));
            return true;
        };
        // Keep the dedicated Zen button usable while HLS and the dialog are still starting.
        const disposeButton = installOfficialLaunchButton(launchId, () => {
            if (dialog) {
                launch();
            }
            else {
                queuedManualId = launchId();
            }
        });
        window.addEventListener('play', onPlay, true);
        window.addEventListener('playing', onPlay, true);
        window.addEventListener('pointerdown', onPointerDown, true);
        stopAll();
        return {
            attach(next) {
                dialog = next;
                next.on?.('requestOfficialLaunch', (e) => {
                    if (launch()) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
                next.on?.('canPlay', (id) => { if (manual?.id === id) {
                    manual.starting = false;
                } });
                const failed = () => {
                    if (manual?.starting && dialog.watchId === manual.id) {
                        failLaunch(manual);
                    }
                };
                next.on?.('loadVideoInfoFail', failed);
                next.on?.('error', failed);
                next.on?.('close', () => {
                    const watchId = currentWatchId();
                    const closedWatchId = next.watchId, time = Number(next._lastCurrentTime) || 0;
                    manual = null;
                    allowedWatchId = watchId;
                    unwatchNew();
                    releaseHeld();
                    if (!recovering && watchId && closedWatchId === watchId) {
                        resumeOfficial(watchId, time);
                    }
                });
                next.on?.('open', (id) => {
                    if (manual && manual.id !== id) {
                        manual = null;
                        releaseHeld();
                    }
                    // Zenza を開くたびに、公式は必ず止める（利用者が一緒に再生していたものも）
                    allowedWatchId = null;
                    userPlayed = new WeakSet();
                    stopAll();
                    watchNew();
                });
                stopAll();
                if (next.isOpen) {
                    watchNew();
                }
                if (queuedManualId && queuedManualId === launchId()) {
                    launch();
                }
                queuedManualId = null;
            },
            release() {
                active = false;
                manual = null;
                queuedManualId = null;
                disposeButton();
                unwatchNew();
                releaseHeld();
                window.removeEventListener('play', onPlay, true);
                window.removeEventListener('playing', onPlay, true);
                window.removeEventListener('pointerdown', onPointerDown, true);
            },
            get manualLaunchActive() { return !!manual; },
            get active() { return active; }
        };
    };
    // Task1077: ショート動画のページは、設定「ショート動画も Zenza で開く」が OFF なら公式に任せる
    const shortsAllowed = () => !/^\/shorts\//.test(location.pathname) || Config.getValue('overrideGinza.shorts') !== false;
    const shouldOverrideGinza = (query) => !!Config.props.overrideGinza && !OfficialPlayerRoute.isOfficialRequest(query) && window.name !== 'watchGinza' &&
        shortsAllowed();
    const overrideGinza = async (dialog, query, guard) => {
        // GINZAで視聴のリンクできた場合はスキップ
        if (OfficialPlayerRoute.isOfficialRequest(query) || window.name === 'watchGinza') {
            // Retain the legacy named-window fallback, but do not depend on it.
            // Chrome/Firefox may clear window.name during a navigation.
            if (window.name === 'watchGinza') {
                window.name = '';
            }
            return;
        }
        // Task1030: task1019 で廃止された「公式の視聴ページでZenzaWatchを優先」を復活。
        // 視聴ページを直接開いた（アドレス・ブックマーク・別タブ）ときに公式プレイヤーしか
        // 開かなくなり、利用者から「公式のプレイヤーでしか再生されなくなった」と報告された。
        // 設定は従来どおり任意（初期値OFF）。ONにしている利用者だけ以前の動作に戻る。
        if (!Config.props.overrideGinza || !shortsAllowed() || guard?.manualLaunchActive) {
            return;
        }
        // 公式プレイヤーの再生を止める見張りは initialize でダイアログにつないである（Task1075）
        if (!guard) {
            createOfficialPlaybackGuard().attach(dialog);
        }
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
        const { promise, resolve } = Promise.withResolvers();
        let timer = null;
        // Task1075: 以前は #root の直下の変化しか見ておらず、本体の枠だけできてプレイヤーの枠がまだ無い時に
        // 「視聴ページではない」と判定することがあった（Zenza が開かない）。プレイヤーの枠ができるまで、中まで見る。
        const ready = () => document.querySelector('.grid-area_\\[player\\]') != null;
        if (ready()) {
            return Promise.resolve();
        }
        const observer = new MutationObserver((records, observer) => {
            if (!ready()) {
                return;
            }
            clearTimeout(timer);
            observer.disconnect();
            resolve();
        });
        observer.observe(root, {
            childList: true,
            subtree: true,
        });
        timer = setTimeout(() => {
            observer.disconnect();
            resolve();
        }, timeoutMs);
        return promise;
    };
    const isWatchPage = async () => {
        if (!util.isGinzaWatchUrl()) {
            return false;
        }
        // Task1075: ショート動画のページ（/shorts/ss〜）には、ページの情報（meta）もプレイヤーの枠（grid-area_[player]）も無いので、
        // 以前は 15 秒待った後に「視聴ページではない」と判定して Zenza が開かなかった。動画の番号があれば視聴ページとして扱う。
        if (/^\/shorts\//.test(location.pathname)) {
            return !!util.getWatchId();
        }
        const res = document.querySelector('meta[name="server-response"]')?.getAttribute('content');
        // Task175 (F02): decide per response, without network, between the legacy
        // data.response envelope and the Watch V4 data.response.$watchV4.data envelope.
        let json = null;
        if (res != null) {
            try {
                json = JSON.parse(res);
            }
            catch (_) {
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
    const warmWatchCache = () => WatchInfoCacheDb.initWorker().catch(() => console.warn('Watch info cache unavailable'));
    const initWorker = (warmThumbnail = true, pendingCache) => {
        // 動画ロード直後に初期化するとつっかかる原因になるのでWorkerだけ作っておく
        if (!location.host.endsWith('.nicovideo.jp')) {
            return;
        }
        if (pendingCache) {
            // Search cards need neither comment layout nor a storyboard canvas until the player uses them.
            return Promise.all([VideoSessionWorker.initWorker(), pendingCache]).then(() => { });
        }
        CommentLayoutWorker.getInstance();
        if (warmThumbnail) {
            void ThumbInfoLoader.load('sm9').catch(() => console.warn('Thumb info warm-up unavailable'));
        }
        console.time('init Workers');
        // Storyboard cache is optional for playback readiness. Keep the Watch
        // history DB prewarm gate: first-open WatchInfoCacheDb.get may otherwise
        // move its IndexedDB open wait onto the pre-session playback path.
        const requiredWorkers = [
            StoryboardWorker.initWorker(),
            VideoSessionWorker.initWorker()
        ];
        void StoryboardCacheDb.initWorker().catch(() => console.warn('Storyboard cache unavailable'));
        const watchCacheReady = warmWatchCache();
        return Promise.all([...requiredWorkers, watchCacheReady]).then(() => console.timeEnd('init Workers'));
    };
    //@require replaceRedirectLinks
    const addCommonStyle = () => cssUtil.addStyle(CONSTANT.COMMON_CSS, { className: 'common' });
    const createHoverMenu = () => {
        const hoverMenu = global.debug.hoverMenu = new HoverMenu({ playerConfig: Config });
        return hoverMenu;
    };
    const initialize = async function () {
        // Task1065: 公式プレイヤーの見張りは、ほかの準備（設定・Worker・lit の読み込み）を待たずに最初に置く。
        // Task1075: 視聴ページ以外でも置く（ページを読み込まずに視聴ページへ移った時のため）。設定が OFF なら何もしない。
        const officialGuard = location.host === 'www.nicovideo.jp' ? createOfficialPlaybackGuard() : null;
        const earlySearch = HoverMenu.canStartOnSearch(Config);
        if (earlySearch) {
            addCommonStyle();
        }
        const earlyHoverMenu = earlySearch ? createHoverMenu() : null;
        try {
            await initializePlayer(officialGuard, earlyHoverMenu);
        }
        catch (error) {
            earlyHoverMenu?.setPlayerUnavailable();
            officialGuard?.release();
            throw error;
        }
    };
    const initializePlayer = async (officialGuard, earlyHoverMenu) => {
        let idleSearch = false;
        if (earlyHoverMenu && !Config.props.overrideGinza && !window.name && !location.hash &&
            !/(Android|iPad;|CriOS)/i.test(navigator.userAgent) && !document.hidden &&
            typeof window.requestIdleCallback === 'function') {
            try {
                idleSearch = sessionStorage.getItem('ZenzaWatch_PlayingStatus') === null &&
                    ![...new URLSearchParams(location.search).keys()].some(key => /^(zenza|playlist|continuous|shuffle)/i.test(key));
            }
            catch (_) { /* Inaccessible storage keeps setup immediate. */ }
        }
        if (typeof StoryboardCacheDb !== 'undefined' && StoryboardCacheDb.configure) {
            const configureSceneCache = (onFirstUse = false) => {
                const capacity = Number(Config.getValue('storyboardCacheMaxMB'));
                const days = Number(Config.getValue('storyboardCacheDays'));
                void StoryboardCacheDb.configure({ maxBytes: ([0, 32, 64, 128, 256, 512].includes(capacity) ? capacity : 128) * 1024 * 1024,
                    maxAgeMs: ([1, 3, 7, 14, 30].includes(days) ? days : 7) * 86400000 }, onFirstUse === true && capacity === 128 && days === 7).catch(() => console.warn('Scene cache settings unavailable'));
            };
            configureSceneCache(idleSearch);
            Config.onkey?.('storyboardCacheMaxMB', configureSceneCache);
            Config.onkey?.('storyboardCacheDays', configureSceneCache);
        }
        if (typeof NotificationJournal !== 'undefined') {
            NotificationJournal.configureRecording?.(key => Config.getValue(key));
            // Task1036: 上限件数と保存期間。設定を変えたらすぐ整理する。
            const applyRetention = () => NotificationJournal.configureRetention?.(Config.getValue('notificationHistory.maxRecords'), Config.getValue('notificationHistory.maxAgeDays'));
            applyRetention();
            Config.onkey?.('notificationHistory.maxRecords', applyRetention);
            Config.onkey?.('notificationHistory.maxAgeDays', applyRetention);
        }
        if (typeof RequestDiagnostics !== 'undefined' && typeof NotificationJournal !== 'undefined') {
            NotificationJournal.configureBuild?.(ZenzaWatch.version, ZenzaWatch.build);
            const recordRequestDiagnostic = (event) => NotificationJournal.recordDiagnostic(event.key, {
                category: 'network', source: event.operation, message: event.message,
                level: event.outcome === 'recovered' ? 'success' :
                    ['spec-change', 'script'].includes(event.reason) ? 'error' :
                        ['not-found', 'permission', 'unavailable'].includes(event.reason) ? 'info' : 'warning',
                details: { operation: event.operation, phase: event.phase, outcome: event.outcome,
                    reason: event.reason, elapsedMs: event.elapsedMs,
                    ...(event.statusCode === undefined ? {} : { statusCode: event.statusCode }),
                    ...(event.apiStatus === undefined ? {} : { apiStatus: event.apiStatus }),
                    ...(event.errorCode === undefined ? {} : { errorCode: event.errorCode }),
                    // Task1036: 直す場所がすぐ分かるように（値・URL・本文は含めない）。
                    ...(event.missing === undefined ? {} : { missing: event.missing }),
                    ...(event.errorName === undefined ? {} : { errorName: event.errorName }),
                    ...(event.module === undefined ? {} : { module: event.module }),
                    ...(event.distinctTargets === undefined ? {} : { distinctTargets: event.distinctTargets }) }
            });
            RequestDiagnostics.setSink(recordRequestDiagnostic);
        }
        if (typeof NotificationJournal !== 'undefined') {
            installScriptErrorJournal();
        }
        const pendingCache = idleSearch ? warmWatchCache() : undefined;
        const hlsReady = HlsRuntime.install(ZenzaWatch, { Emitter, dimport });
        const searchWorkers = idleSearch && earlyHoverMenu ? earlyHoverMenu.waitForPlayerIdle()
            .then(() => initWorker(false, pendingCache)) : undefined;
        // The same rejection is propagated at the readiness gate after HLS installation.
        void searchWorkers?.catch(() => { });
        await hlsReady;
        console.log('%cinitialize ZenzaWatch...', 'background: lightgreen; ');
        domEvent.dispatchCustomEvent(document.body, 'BeforeZenzaWatchInitialize', window.ZenzaWatch, { bubbles: true, composed: true });
        if (!earlyHoverMenu) {
            addCommonStyle();
        }
        initializeBySite();
        replaceRedirectLinks().catch(() => console.warn('Legacy redirect-link enhancement unavailable'));
        const query = textUtil.parseQuery(START_PAGE_QUERY);
        await uq.ready(); // DOMContentLoaded
        const isWatch = await isWatchPage();
        // Task1075: 視聴ページと判定できなくても見張りは外さない（判定が間に合わなかった時は、公式が鳴り始めた時に Zenza で開く。
        // 削除・非公開のページでは公式プレイヤーが鳴らないので、何も起きない）
        // migrate comment language
        if (typeof Config.props.commentLanguage === 'string') {
            Config.props.commentLanguage = Config.props.commentLanguage.replace('_', '-').toLowerCase();
        }
        const hoverMenu = earlyHoverMenu || createHoverMenu();
        await Promise.all([
            NicoComment.offscreenLayer.get(Config),
            global.emitter.promise('lit-html'),
            searchWorkers || initWorker(!earlyHoverMenu)
        ]);
        if (idleSearch) {
            await hoverMenu.waitForPlayerIdle();
        }
        document.body.classList.toggle('is-watch', isWatch);
        const dialog = initializeDialogPlayer(Config);
        hoverMenu.setPlayer(dialog);
        officialGuard?.attach(dialog);
        if (isWatch) {
            await overrideGinza(dialog, query, officialGuard);
        }
        initializeMessage(dialog);
        WatchPageHistory.initialize(dialog);
        initializeExternal(dialog, Config, hoverMenu);
        if (!isWatch) {
            initializeLastSession(dialog);
        }
        CustomElements.initialize();
        window.ZenzaWatch.ready = true;
        global.emitter.emitAsync('ready');
        global.emitter.emitResolve('init');
        domEvent.dispatchCustomEvent(document.body, 'ZenzaWatchInitialize', window.ZenzaWatch, { bubbles: true, composed: true });
    };
    const initializeMessage = (player) => {
        const config = Config;
        const bcast = BroadcastEmitter;
        /**
         * 複数ウィンドウ間
         * @param {CommandBody} cmd
         * @param {string} type
         * @param {string} sessionId
         */
        const onBroadcastMessage = (cmd, type, sessionId) => {
            const isLast = player.isLastOpenedPlayer;
            const isOpen = player.isOpen;
            // window.console.log('initializeMessage.onBroadcastMessage', {cmd, isLast, isOpen, sessionId});
            const { command, params, requestId, now } = cmd;
            let result;
            const localNow = Date.now();
            if (command === 'hello') {
                console.log('%cHELLO! \ntime: %s (%smsec)\nmessage: %s \nfrom: %s\nurl: %s\n', 'font-weight: bold;', new Date(params.now).toLocaleString(), localNow - now, params.message, params.from, params.url, { command, isLast, isOpen });
                result = { status: 'ok' };
            }
            else if (command === 'sendExecCommand' &&
                (params.command === 'echo' || (isLast && isOpen))) {
                // window.console.log('execCommand', {params});
                result = player.execCommand(params.command, params.params);
            }
            else if (command === 'ping' && (params.force || (isLast && isOpen))) {
                console.info('pong!');
                result = { status: 'ok' };
            }
            else if (command === 'pong') {
                result = bcast.emitResolve('ping', params);
            }
            else if (command === 'notifyClose' && isOpen) {
                result = player.refreshLastPlayerId();
                return;
            }
            else if (command === 'notifyOpen') {
                config.refresh('lastPlayerId');
                return;
            }
            else if (command === 'pushHistory') {
                const { path, title } = params;
                WatchPageHistory.pushHistoryAgency(path, title);
            }
            else if (command === 'openVideo' && isLast) {
                const { watchId, query, eventType } = params;
                player.open(watchId, { autoCloseFullScreen: false, query, eventType });
            }
            else if (command === 'messageResult') {
                if (bcast.hasPromise(params.sessionId)) {
                    params.status === 'ok' ?
                        bcast.emitResolve(params.sessionId, params) :
                        bcast.emitReject(params.sessionId, params);
                }
                return;
            }
            else {
                return;
            }
            result = result || { status: 'ok' };
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
            bcast.sendMessage({ command: 'messageResult', params: result });
        };
        /**
         * 親子ウィンドウ間
         * @param {CommandBody} cmd
         * @param {string} type
         * @param {string} sessionId
         */
        const onWindowMessage = (cmd, type, sessionId) => {
            const { command, params } = cmd;
            const watchId = cmd.watchId || params.watchId; // 互換のため冗長
            // window.console.log('initializeMessage.onWindowMessage', {message: cmd, type, sessionId});
            if (watchId && command === 'open') {
                if (config.props.enableSingleton) {
                    global.external.sendOrOpen(watchId);
                }
                else {
                    player.open(watchId, { economy: Config.props.forceEconomy });
                }
            }
            else if (watchId && command === 'send') {
                BroadcastEmitter.sendExecCommand({ command: 'openVideo', params: watchId });
            }
        };
        /**
         * @param {CommandBody} cmd
         * @param {string} type
         * @param {string} sessionId
         */
        BroadcastEmitter.on('message', (message, type, sessionId) => {
            return type === 'broadcast' ?
                onBroadcastMessage(message, type, sessionId) :
                onWindowMessage(message, type, sessionId);
        });
        player.on('close', () => BroadcastEmitter.notifyClose());
        player.on('open', () => BroadcastEmitter.notifyOpen());
    };
    const initializeExternal = (dialog) => {
        const command = (command, param) => dialog.execCommand(command, param);
        const open = (watchId, params) => dialog.open(watchId, params);
        // 最後にZenzaWatchを開いたタブに送る
        const send = (watchId, params) => BroadcastEmitter.sendOpen(watchId, params);
        // 最後にZenzaWatchを開いたタブに送る
        // なかったら同じタブで開く. 一見万能だが、pingを投げる都合上ワンテンポ遅れる。
        const sendOrOpen = (watchId, params) => {
            if (dialog.isLastOpenedPlayer) {
                open(watchId, params);
            }
            else {
                return BroadcastEmitter
                    .ping()
                    .then(() => send(watchId, params), () => open(watchId, params));
            }
        };
        const importPlaylist = (data) => PlaylistSession.save(data);
        const exportPlaylist = () => PlaylistSession.restore() || {};
        const sendExecCommand = (command, params) => BroadcastEmitter.sendExecCommand({ command, params });
        const sendOrExecCommand = (command, params) => {
            return BroadcastEmitter.ping()
                .then(() => sendExecCommand(command, params), () => dialog.execCommand(command, params));
        };
        const playlistAdd = (watchId) => sendOrExecCommand('playlistAdd', watchId);
        const insertPlaylist = (watchId) => sendOrExecCommand('playlistInsert', watchId);
        const deflistAdd = ({ watchId, description, token }) => {
            const mylistApiLoader = ZenzaWatch.api.MylistApiLoader;
            if (token) {
                mylistApiLoader.setCsrfToken(token);
            }
            return mylistApiLoader.addDeflistItem(watchId, description);
        };
        const deflistRemove = ({ watchId, token }) => {
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
                return Array.from(document.querySelectorAll('.zenzaPlayerContainer iframe')).map(f => f.contentWindow.document.body);
            }
        });
        if (ZenzaWatch !== window.ZenzaWatch) {
            window.ZenzaWatch.external = {
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
    const initializeLastSession = (dialog) => {
        // Task1030: 視聴ページでは「公式の視聴ページでZenzaWatchを優先」がONのときだけ前回の
        // 続きを復元する（OFFなら公式プレイヤーに任せる。task1019 の意図はOFF時に維持）。
        if (util.isGinzaWatchUrl() && !Config.props.overrideGinza) {
            return;
        }
        window.addEventListener('beforeunload', () => {
            if (!dialog.isOpen) {
                return;
            }
            PlayerSession.save(dialog.playingStatus);
            dialog.close();
        }, { passive: true });
        PlayerSession.init(sessionStorage);
        let lastSession = PlayerSession.restore();
        let screenMode = Config.props.screenMode;
        if (lastSession.playing &&
            (screenMode === 'small' ||
                screenMode === 'sideView' ||
                location.href === lastSession.url ||
                Config.props.continueNextPage)) {
            lastSession.eventType = 'session';
            dialog.open(lastSession.watchId, lastSession);
        }
        else {
            PlayerSession.clear();
        }
    };
    const initializeBySite = () => {
        const hostClass = location.host
            .replace(/^.*\.slack\.com$/, 'slack.com')
            .replace(/\./g, '-');
        document.body.dataset.domain = hostClass;
        util.StyleSwitcher.update({ on: `style.domain.${hostClass}` });
    };
    const initializeDialogPlayer = (config, offScreenLayer) => {
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
    return { initialize };
})();
//===END===
export {
  initialize
};
