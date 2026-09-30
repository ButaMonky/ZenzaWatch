// Task 090（監査v2 R04）: NicoVideoPlayerDialog（本体の再生の中心）の、動画を開く・読み込む・失敗する・投稿する処理を、
// 本物のクラスのメソッドのまま、周りだけを代わりのものにして動かすための道具（監査の reproduce.cjs と同じ方法）。
// - 通信（動画情報・セッション・コメント）は、テストが好きな順で完了・失敗させられる「保留中の Promise」にする。
// - window.setTimeout は偽のタイマーにして、テストから時間を進める（自動の「次へ」・再読み込み・期限）。
// 実ブラウザ・実際のニコニコ動画・Tampermonkey での確認ではない。
'use strict';
const _ = require('lodash');
const {beginSection, createContext, run, loadClass} = require('./extractSource');

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return {promise, resolve, reject};
}

// 呼ばれるたびに保留中の Promise を作り、テストから完了させる
function controlled(name, log) {
  const calls = [];
  const fn = (...args) => {
    const d = deferred();
    calls.push({args, ...d});
    log && log.push(`${name}:${calls.length - 1}`);
    return d.promise;
  };
  fn.calls = calls;
  return fn;
}

function fakeTimers() {
  let now = 0, seq = 0;
  const timers = new Map();
  const setTimeout = (f, ms = 0) => { const id = ++seq; timers.set(id, {f, at: now + ms}); return id; };
  const clearTimeout = id => { timers.delete(id); };
  const advance = ms => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) { break; }
      timers.delete(due[0]);
      now = due[1].at;
      due[1].f();
    }
    now = end;
  };
  return {setTimeout, clearTimeout, advance, pending: () => timers.size};
}

const flush = async (n = 10) => { for (let i = 0; i < n; i++) { await Promise.resolve(); } await new Promise(r => setImmediate(r)); };

function createDialogHarness() {
  const log = [];
  const timers = fakeTimers();
  const quiet = {};
  for (const k of ['log', 'info', 'warn', 'error', 'debug', 'time', 'timeEnd', 'timeLog', 'group', 'groupEnd', 'trace']) { quiet[k] = () => {}; }
  const loader = controlled('VideoInfoLoader.load', log);
  const cacheGet = controlled('WatchInfoCacheDb.get', log);
  const sessionCreate = controlled('VideoSessionWorker.create', log);
  const cachePuts = [];
  const emitted = [];

  class VideoInfoModel {
    constructor(data, cache) { Object.assign(this, data); this._cache = cache; this.msgInfo = data.msgInfo || {}; }
    setCurrentVideo(url) { this.currentVideo = url; }
  }

  const c = createContext({
    _,
    console: quiet,
    window: null,
    util: {fullscreen: {now: () => false}, isLogin: () => true, escapeToZenkaku: s => s},
    global: {debug: {isHLSSupported: true}, emitter: {emitAsync: (...a) => emitted.push(['global', ...a]), emitResolve() {}}},
    VideoInfoLoader: {load: loader},
    WatchInfoCacheDb: {
      get: cacheGet,
      put: (id, data) => cachePuts.push({id, data}),
      putBestEffort: async (id, data) => { cachePuts.push({id, data}); }
    },
    VideoInfoModel,
    MediaSessionApi: {updateByVideoInfo() {}, updatePositionStateByMedia() {}},
    AudioAdjuster: {setContext() {}},
    VideoSessionWorker: {create: sessionCreate},
    NVWatchCaller: {call: async () => {}},
    Fullscreen: {now: () => false, cancel() {}},
    document: {createElement: () => ({canPlayType: () => ''})},
    textUtil: {escapeHtml: s => String(s)},
    DOMException: globalThis.DOMException,
    // プレイリスト（本物の _initializePlaylist を動かす時の代わり）
    PlayList: class {
      constructor() { this.isEnable = false; this.inserted = []; }
      on() {}
      insert(id) { this.inserted.push(id); }
      insertCurrentVideo(v) { this.current = v; }
      restoreFromSession() { if (c.__restoreFails) { throw new Error('broken playlist session'); } }
    },
    PlayListSession: {isExist: () => true},
    ThumbInfoLoader: {}
  });
  c.window = c;
  c.setTimeout = timers.setTimeout;
  c.clearTimeout = timers.clearTimeout;
  run(beginSection('packages/lib/src/Emitter.js'), c);
  const VideoWatchOptions = loadClass('src/NicoVideoPlayerDialog.js', 'VideoWatchOptions', c);
  run('globalThis.VideoWatchOptions = __subject;', c);
  const Dialog = loadClass('src/NicoVideoPlayerDialog.js', 'NicoVideoPlayerDialog', c);

  // 再生器（NicoVideoPlayer）の代わり
  const player = {
    closeCount: 0, chats: [], vpos: 0,
    close() { this.closeCount++; },
    addChat(text, cmd, vpos, options) { const chat = {text, cmd, vpos, options}; this.chats.push(chat); return chat; },
    requestFullScreen() {}
  };
  let initDeferred = null;

  const o = Object.create(Dialog.prototype);
  const state = {
    isPlaying: false, isOpen: false, isError: false, isCommentReady: true, isCommentPosting: false, errorMessage: '',
    videoInfo: null,
    setState(obj) { Object.assign(this, obj); },
    resetVideoLoadingStatus() { Object.assign(this, {isLoading: true, isPlaying: false, isError: false}); },
    setVideoErrorOccurred() { Object.assign(this, {isError: true, isPlaying: false}); },
    setVideoCanPlay() { Object.assign(this, {isLoading: false, isCanPlay: true}); }
  };
  Object.assign(o, {
    _state: state,
    _playerConfig: {props: {commentLanguage: 'ja-jp', screenMode: 'normal'}, getValue: () => false},
    _videoFilter: {isNgVideo: v => !!v.isNg},
    _view: {clearPanel() {}, appendTab: () => [{}]},
    _lastOpenAt: 0,
    threadLoader: {load: controlled('threadLoader.load', log), postChat: controlled('threadLoader.postChat', log)},
    _nicoVideoPlayer: null,
    _playlist: {isEnable: false, inserted: [], insert(id) { this.inserted.push(id); }, selectNext() { return 'smNext'; }},
    execCommand(cmd, param) { log.push(`execCommand:${cmd}`); },
    emit(name, ...a) { emitted.push([name, ...a]); },
    emitResolve(name) { log.push(`emitResolve:${name}`); },
    emitAsync(name) { emitted.push([name]); },
    refreshLastPlayerId() {},
    _savePlaybackPosition() {},
    show() { state.isOpen = true; },
    hide() { state.isOpen = false; },
    pause() {},
    _initializePlaylist: async () => {},
    _initializeNicoVideoPlayer() {
      // 本物と同じく「無ければ作る」。作るのに時間がかかる（dom-ready 待ち）場合を、テストが initDeferred で作れる
      if (o._nicoVideoPlayer) { return Promise.resolve(o._nicoVideoPlayer); }
      log.push('initPlayer');
      const d = initDeferred;
      const make = () => { o._nicoVideoPlayer = player; return player; };
      return d ? d.promise.then(make) : Promise.resolve(make());
    }
  });
  // setVideo・loadComment は本物（状態に記録される）。記録を見やすくする
  const setVideo = o.setVideo;
  o.setVideo = function(url) { log.push(`setVideo:${url}`); return setVideo.call(this, url); };
  o.loadComment = function(msgInfo) { log.push(`loadComment:${msgInfo && msgInfo.tag}`); };

  const openedSession = (tag, extra = {}) => {
    const connect = controlled(`connect:${tag}`, log);
    const s = {
      tag, isDmc: false, serverType: 'domand', closeCount: 0,
      connect, close() { this.closeCount++; log.push(`sessionClose:${tag}`); },
      getState: async () => ({isDomand: true}),
      ...extra
    };
    return s;
  };
  const videoData = tag => ({watchId: tag, isDomandOnly: true, msgInfo: {tag}, title: tag, thumbnail: ''});

  return {
    Dialog, dialog: o, state, player, log, emitted, cachePuts, timers, flush, context: c,
    loader, cacheGet, sessionCreate, openedSession, videoData, deferred,
    setSlowPlayerInit() { initDeferred = deferred(); return initDeferred; },
    get playlist() { return o._playlist; }
  };
}

module.exports = {createDialogHarness, deferred, flush};
