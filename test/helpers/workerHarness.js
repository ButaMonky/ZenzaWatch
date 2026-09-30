// Task 089（監査v2 R03: ZW-061〜064）: workerUtil（packages/lib/src/infra/workerUtil.js）を
// Node の上で「ブラウザの Worker に近い形」で動かすための道具。
//
// - ホスト側（ページ）: vm のコンテキストに Emitter と workerUtil の //===BEGIN===〜//===END=== を読み込む。
//   window.name・location・Blob・URL.createObjectURL・Worker は、ここで用意した偽物を渡す。
// - Worker 側: createObjectURL で渡された生成コードを、別の vm のコンテキストで実行する。
//   postMessage は非同期（setTimeout）で相手へ届け、中身は structuredClone で複製する（MessagePort・ArrayBuffer の移送も扱う）。
//   生成コードの構文エラー・タイマーの中の未捕捉例外は、ホスト側の Worker に error イベントとして届ける（ブラウザと同じ）。
//   terminate() の後は、どちら向きのメッセージも届かず、Worker 側のタイマーも止まる。
// 実ブラウザ（Chromium）での確認は、別途クラウドのオフラインのページで行う（docs/design-pack/97_TASK_089_R03.md）。
'use strict';
const vm = require('vm');
const {beginSection} = require('./extractSource');

// 送受信の記録（中身は残さず、種類と要求IDだけ）
const summary = data => {
  const body = data && data.body;
  return {
    command: body && body.command,
    sessionId: data && data.sessionId,
    resultFor: body && body.command === 'commandResult' && body.params ? body.params.command : undefined,
    status: data && data.status
  };
};

const isPort = x => x && typeof x === 'object' && typeof x.postMessage === 'function' && typeof x.close === 'function' &&
  x.constructor && x.constructor.name === 'MessagePort';

function cloneMessage(data, transfer) {
  const list = Array.isArray(transfer) ? transfer.filter(Boolean) : [];
  const r = structuredClone({data, ports: list.filter(isPort)}, {transfer: list});
  return r;
}

function quietConsole(sink, tag) {
  const c = {};
  for (const k of ['log', 'info', 'warn', 'error', 'debug', 'trace']) {
    c[k] = (...args) => sink.push({tag, kind: k, args});
  }
  c.time = c.timeEnd = c.timeLog = c.group = c.groupEnd = () => {};
  return c;
}

/**
 * @param {object} opt
 * @param {string} [opt.windowName] ページの window.name
 * @param {string} [opt.href] ページの location.href
 * @param {string} [opt.product] workerUtil.env で渡す PRODUCT
 * @param {boolean} [opt.withEnv] workerUtil.env で config を渡す（本体と同じく env の送信が起きる）
 */
function createWorkerHost(opt = {}) {
  const windowName = opt.windowName === undefined ? '' : opt.windowName;
  const href = opt.href || 'https://www.nicovideo.jp/watch/sm9';
  const logs = [];
  const blobs = new Map();
  const workers = [];
  const pageErrors = [];
  let blobSeq = 0;
  const u = new URL(href);
  const location = {href, host: u.host, origin: u.origin, hostname: u.hostname, protocol: u.protocol};

  class FakeBlob {
    constructor(parts = [], options = {}) {
      this._text = parts.map(String).join('');
      this.type = options.type || '';
    }
  }
  const FakeURL = {
    createObjectURL(blob) {
      const id = `blob:${location.origin}/fake-${++blobSeq}`;
      blobs.set(id, blob._text);
      return id;
    },
    revokeObjectURL(id) { blobs.delete(id); }
  };

  class FakeWorker extends EventTarget {
    constructor(url, options = {}) {
      super();
      this.onmessage = null;
      this.onerror = null;
      this._url = url;
      this._src = blobs.get(url);
      this._options = options;
      this._terminated = false;
      this._timers = new Set();
      this._inbox = new EventTarget();
      this.terminateCalls = 0;
      this.postCount = 0;
      this.sent = [];      // ホスト → Worker
      this.received = [];  // Worker → ホスト
      workers.push(this);
      setTimeout(() => this._boot(), 0);
    }

    _boot() {
      if (this._terminated) { return; }
      const w = this;
      const g = {};
      const guard = fn => (...args) => {
        if (w._terminated) { return; }
        try { return fn(...args); } catch (err) { w._reportError(err); }
      };
      g.self = g;
      g.name = this._options.name || '';
      g.console = quietConsole(logs, `worker:${g.name}`);
      g.location = location;
      g.postMessage = (data, transfer) => {
        if (w._terminated) { return; }
        const c = cloneMessage(data, transfer);
        w.received.push(summary(data));
        setTimeout(() => {
          if (w._terminated) { return; }
          const ev = new MessageEvent('message', {data: c.data, ports: c.ports});
          w.dispatchEvent(ev);
          w.onmessage && w.onmessage(ev);
        }, 0);
      };
      g.close = () => w._stop();
      g.setTimeout = (fn, ms, ...a) => {
        const t = setTimeout(() => { w._timers.delete(t); guard(fn)(...a); }, ms);
        w._timers.add(t);
        return t;
      };
      g.clearTimeout = t => { w._timers.delete(t); clearTimeout(t); };
      g.setInterval = (fn, ms, ...a) => {
        const t = setInterval(() => guard(fn)(...a), ms);
        w._timers.add(t);
        return t;
      };
      g.clearInterval = t => { w._timers.delete(t); clearInterval(t); };
      g.addEventListener = (...a) => w._inbox.addEventListener(...a);
      g.removeEventListener = (...a) => w._inbox.removeEventListener(...a);
      g.fetch = () => Promise.reject(new Error('network is not available in tests'));
      Object.assign(g, {
        MessageChannel, BroadcastChannel, MessageEvent, Event, EventTarget, Blob, URL, TextEncoder, TextDecoder,
        structuredClone, queueMicrotask, performance, Headers: globalThis.Headers, Response: globalThis.Response
      });
      this._scope = g;
      this._context = vm.createContext(g);
      if (typeof this._src !== 'string') {
        this._reportError(new Error(`unknown worker url ${this._url}`));
        return;
      }
      try {
        new vm.Script(this._src, {filename: 'worker.js'}).runInContext(this._context);
      } catch (err) {
        this._reportError(err);
      }
    }

    _deliverToWorker(data, ports) {
      if (this._terminated || !this._scope) { return; }
      const g = this._scope;
      const ev = new MessageEvent('message', {data, ports});
      try {
        g.onmessage && g.onmessage(ev);
      } catch (err) {
        this._reportError(err);
      }
      this._inbox.dispatchEvent(ev);
    }

    postMessage(data, transfer) {
      if (this._terminated) { return; }
      this.postCount++;
      const c = cloneMessage(data, transfer);
      this.sent.push(summary(data));
      const deliver = () => {
        if (this._terminated) { return; }
        if (!this._scope) { return setTimeout(deliver, 0); }
        this._deliverToWorker(c.data, c.ports);
      };
      setTimeout(deliver, 0);
    }

    _reportError(err) {
      setTimeout(() => {
        if (this._terminated) { return; }
        const ev = new Event('error', {cancelable: true});
        ev.message = err && err.message;
        ev.error = err;
        this.dispatchEvent(ev);
        this.onerror && this.onerror(ev);
      }, 0);
    }

    /** テスト用: 受け取った内容を複製できなかった（messageerror）ことにする */
    simulateMessageError() {
      setTimeout(() => {
        const ev = new Event('messageerror');
        this.dispatchEvent(ev);
      }, 0);
    }

    _stop() {
      this._terminated = true;
      for (const t of this._timers) { clearTimeout(t); clearInterval(t); }
      this._timers.clear();
    }

    terminate() {
      this.terminateCalls++;
      this._stop();
    }
  }

  const sandbox = {
    console: quietConsole(logs, 'host'),
    setTimeout, clearTimeout, setInterval, clearInterval,
    Blob: FakeBlob, URL: FakeURL, Worker: FakeWorker, SharedWorker: undefined,
    MessageChannel, BroadcastChannel, MessageEvent, Event, EventTarget,
    location, name: windowName, structuredClone, queueMicrotask
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  const run = code => new vm.Script(code).runInContext(context);
  run(beginSection('packages/lib/src/Emitter.js'));
  run(`${beginSection('packages/lib/src/infra/workerUtil.js')};\nglobalThis.workerUtil = workerUtil;`);
  const workerUtil = sandbox.workerUtil;
  if (opt.withEnv) {
    workerUtil.env({config: {export: () => ({})}, TOKEN: 'synthetic-token', PRODUCT: opt.product || 'ZenzaWatch'});
  } else if (opt.product !== undefined) {
    workerUtil.env({PRODUCT: opt.product});
  }

  // 未処理の reject をこのホストの分だけ集める（Node の既定ではプロセスを止めるため）
  const unhandled = [];
  const onUnhandled = reason => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);

  const dispose = () => {
    process.removeListener('unhandledRejection', onUnhandled);
    for (const w of workers) { w._stop(); }
  };

  return {workerUtil, workers, logs, pageErrors, unhandled, dispose, sandbox, blobs};
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Promise の状態を、待たずに外から見られるようにする */
function track(p) {
  const s = {state: 'pending', value: undefined, settleCount: 0};
  Promise.resolve(p).then(v => { s.state = 'resolved'; s.value = v; s.settleCount++; },
    e => { s.state = 'rejected'; s.value = e; s.settleCount++; });
  return s;
}

/**
 * ホストから Worker へ送った「要求ID付き」のメッセージのうち、Worker から応答（commandResult）が返っていないもの
 */
function unansweredRequests(worker) {
  const answered = new Set(worker.received.filter(m => m.command === 'commandResult').map(m => m.sessionId));
  return worker.sent.filter(m => m.command !== 'commandResult' && m.sessionId !== undefined && !answered.has(m.sessionId));
}

module.exports = {createWorkerHost, sleep, track, unansweredRequests};
